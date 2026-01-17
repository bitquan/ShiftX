import * as admin from 'firebase-admin';
import { logRideEvent } from './eventLog';

const HEARTBEAT_TIMEOUT_MS = 120_000; // 2 minutes

/**
 * Janitor function: cleans up stuck rides and expired offers
 * Should run every 1-5 minutes via scheduled function
 */
export async function runCleanupJobs(
  firestoreDb: FirebaseFirestore.Firestore = admin.firestore(),
  stripe?: any,
  stripeEnabled: boolean = false,
  paymentAuthTimeoutMs: number = 5 * 60 * 1000,
  driverStartTimeoutMs: number = 10 * 60 * 1000
) {
  const now = Date.now();
  const results = {
    cancelledRides: 0,
    expiredOffers: 0,
    offlineDrivers: 0,
    cancelledUnpaid: 0,
    cancelledUnstarted: 0,
    cancelledStalePayments: 0,
    missingTransfers: 0,
  };

  console.log('[Cleanup] Starting cleanup jobs at', new Date(now).toISOString());

  // 1. Cancel rides stuck past searchExpiresAtMs
  await cancelStuckRides(now, firestoreDb, results);

  // 2. Expire pending offers past expiresAtMs
  await expireStuckOffers(now, firestoreDb, results);

  // 3. Mark ghost drivers as offline
  await cleanupGhostDrivers(now, firestoreDb, results);

  // 4. Cancel accepted rides where payment wasn't authorized in time
  await cancelUnpaidRides(now, paymentAuthTimeoutMs, firestoreDb, results);

  // 5. Cancel authorized rides where driver didn't start in time (and cancel payment hold)
  if (stripe && stripeEnabled) {
    await cancelUnstartedRides(now, driverStartTimeoutMs, stripe, stripeEnabled, firestoreDb, results);
  }

  // 6. Cancel stale PaymentIntents (rides stuck in payment limbo)
  if (stripe && stripeEnabled) {
    await cancelStalePaymentIntents(now, paymentAuthTimeoutMs, stripe, firestoreDb, results);
  }

  // 7. Detect captured payments with missing transfers (Connect)
  if (stripe && stripeEnabled) {
    await flagMissingTransfers(now, stripe, firestoreDb, results);
  }

  console.log('[Cleanup] Completed:', results);
  return results;
}

/**
 * Flag captured rides where a Connect transfer is missing
 */
async function flagMissingTransfers(
  now: number,
  stripe: any,
  firestoreDb: FirebaseFirestore.Firestore,
  results: { missingTransfers: number }
) {
  const snapshot = await firestoreDb
    .collection('rides')
    .where('paymentStatus', '==', 'captured')
    .orderBy('updatedAtMs', 'desc')
    .limit(50)
    .get();

  if (snapshot.empty) {
    return;
  }

  for (const doc of snapshot.docs) {
    const ride = doc.data();
    const rideId = doc.id;

    if (!ride?.transferDestination || ride?.connectTransferId) {
      continue;
    }

    const ageMs = now - (ride.updatedAtMs || now);
    if (ageMs < 2 * 60 * 1000) {
      continue; // allow time for transfer creation
    }

    const paymentIntentId = ride?.stripePaymentIntentId || ride?.paymentIntentId;
    if (!paymentIntentId) {
      continue;
    }

    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const charge = paymentIntent.charges?.data?.[0];
      const transferId = charge?.transfer || null;

      if (transferId) {
        await doc.ref.update({
          connectTransferId: transferId,
          connectTransferStatus: 'created',
          paymentAuditTransferMissing: false,
          updatedAtMs: Date.now(),
        });
      } else {
        await doc.ref.update({
          paymentAuditTransferMissing: true,
          paymentAuditAtMs: Date.now(),
          updatedAtMs: Date.now(),
        });

        await firestoreDb.collection('adminLogs').add({
          action: 'payment_captured_missing_transfer',
          details: {
            rideId,
            paymentIntentId,
            transferDestination: ride.transferDestination,
          },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          timestampMs: Date.now(),
        });

        results.missingTransfers++;
      }
    } catch (error) {
      console.error('[Cleanup] Error checking transfer for ride', rideId, error);
    }
  }
}

/**
 * Cancel rides that are stuck searching past their timeout
 */
async function cancelStuckRides(
  now: number,
  firestoreDb: FirebaseFirestore.Firestore,
  results: { cancelledRides: number }
) {
  // Find rides in searching states that have expired
  const stuckRides = await firestoreDb
    .collection('rides')
    .where('status', 'in', ['requested', 'dispatching', 'offered'])
    .where('searchExpiresAtMs', '<=', now)
    .limit(50) // Process in batches to avoid timeout
    .get();

  if (stuckRides.empty) {
    return;
  }

  console.log(`[Cleanup] Found ${stuckRides.size} stuck rides to cancel`);

  const batch = firestoreDb.batch();
  const eventPromises: Promise<void>[] = [];

  for (const doc of stuckRides.docs) {
    const ride = doc.data();
    const rideId = doc.id;

    // Skip if already cancelled/completed
    if (ride.status === 'cancelled' || ride.status === 'completed') {
      continue;
    }

    console.log(`[Cleanup] Cancelling stuck ride ${rideId} (status: ${ride.status})`);

    batch.update(doc.ref, {
      status: 'cancelled',
      cancelReason: 'search_timeout',
      cancelledAtMs: now,
      updatedAtMs: now,
    });

    // Log the timeout event
    eventPromises.push(
      logRideEvent(rideId, 'search_timeout', {
        reason: 'cleanup_job',
        originalStatus: ride.status,
        searchDurationMs: now - (ride.searchStartedAtMs || ride.createdAtMs || now),
      }, firestoreDb)
    );

    // If driver was assigned, free them up
    if (ride.driverId) {
      const driverRef = firestoreDb.collection('drivers').doc(ride.driverId);
      batch.update(driverRef, {
        isBusy: false,
        currentRideId: null,
        currentRideStatus: null,
        updatedAtMs: now,
      });
    }

    results.cancelledRides++;
  }

  await batch.commit();
  await Promise.all(eventPromises);
}

/**
 * Expire offers that are pending past their TTL
 */
async function expireStuckOffers(
  now: number,
  firestoreDb: FirebaseFirestore.Firestore,
  results: { expiredOffers: number }
) {
  // 1. Query all rides that might have expired offers (time-based)
  const ridesWithOffers = await firestoreDb
    .collection('rides')
    .where('status', 'in', ['offered', 'dispatching'])
    .where('offerExpiresAtMs', '<=', now)
    .limit(50)
    .get();

  if (!ridesWithOffers.empty) {
    console.log(`[Cleanup] Found ${ridesWithOffers.size} rides with potentially expired offers`);

    for (const rideDoc of ridesWithOffers.docs) {
      const rideId = rideDoc.id;
      const rideRef = rideDoc.ref;

      // Get all pending offers for this ride that have expired
      const pendingOffers = await rideRef
        .collection('offers')
        .where('status', '==', 'pending')
        .where('expiresAtMs', '<=', now)
        .get();

      if (pendingOffers.empty) {
        continue;
      }

      console.log(`[Cleanup] Expiring ${pendingOffers.size} offers for ride ${rideId}`);

      const batch = firestoreDb.batch();
      const expiredDriverIds: string[] = [];

      for (const offerDoc of pendingOffers.docs) {
        batch.update(offerDoc.ref, {
          status: 'expired',
          expiredAtMs: now,
        });
        expiredDriverIds.push(offerDoc.id);
        results.expiredOffers++;
      }

      await batch.commit();

      // Log the expiry event
      await logRideEvent(rideId, 'offer_expired', {
        reason: 'cleanup_job',
        expiredDriverIds,
        count: expiredDriverIds.length,
      }, firestoreDb);
    }
  }

  // 2. Query rides that have been accepted/started and mark remaining pending offers as taken
  const acceptedRides = await firestoreDb
    .collection('rides')
    .where('status', 'in', ['accepted', 'started', 'in_progress'])
    .where('driverId', '!=', null)
    .limit(50)
    .get();

  if (!acceptedRides.empty) {
    console.log(`[Cleanup] Found ${acceptedRides.size} accepted rides to clean up offers`);

    for (const rideDoc of acceptedRides.docs) {
      const rideId = rideDoc.id;
      const ride = rideDoc.data();
      const rideRef = rideDoc.ref;

      // Get all pending offers for accepted rides
      const pendingOffers = await rideRef
        .collection('offers')
        .where('status', '==', 'pending')
        .get();

      if (pendingOffers.empty) {
        continue;
      }

      console.log(`[Cleanup] Marking ${pendingOffers.size} pending offers as taken for accepted ride ${rideId}`);

      const batch = firestoreDb.batch();
      const takenDriverIds: string[] = [];

      for (const offerDoc of pendingOffers.docs) {
        // Don't mark the accepted driver's offer as taken
        if (offerDoc.id !== ride.driverId) {
          batch.update(offerDoc.ref, {
            status: 'taken_by_other',
            takenAtMs: now,
          });
          takenDriverIds.push(offerDoc.id);
          results.expiredOffers++;
        }
      }

      if (takenDriverIds.length > 0) {
        await batch.commit();
        await logRideEvent(rideId, 'offer_expired', {
          reason: 'cleanup_job_taken_by_other',
          takenDriverIds,
          acceptedBy: ride.driverId,
          count: takenDriverIds.length,
        }, firestoreDb);
      }
    }
  }
}

/**
 * Mark drivers as offline if they haven't sent heartbeat recently
 */
async function cleanupGhostDrivers(
  now: number,
  firestoreDb: FirebaseFirestore.Firestore,
  results: { offlineDrivers: number }
) {
  const heartbeatCutoff = now - HEARTBEAT_TIMEOUT_MS;

  // Find drivers marked online but with stale heartbeat
  const ghostDrivers = await firestoreDb
    .collection('drivers')
    .where('isOnline', '==', true)
    .where('lastHeartbeatMs', '<=', heartbeatCutoff)
    .limit(50)
    .get();

  if (ghostDrivers.empty) {
    return;
  }

  console.log(`[Cleanup] Found ${ghostDrivers.size} ghost drivers to mark offline`);

  const batch = firestoreDb.batch();

  for (const doc of ghostDrivers.docs) {
    const driver = doc.data();
    const driverId = doc.id;

    console.log(`[Cleanup] Marking ghost driver ${driverId} as offline (last heartbeat: ${driver.lastHeartbeatMs})`);

    // Only mark offline, don't clear busy state if they have an active ride
    // The ride cleanup will handle freeing up busy drivers
    const updates: any = {
      isOnline: false,
      updatedAtMs: now,
    };

    // Only clear busy if no active ride
    if (!driver.currentRideId) {
      updates.isBusy = false;
      updates.currentRideStatus = null;
    }

    batch.update(doc.ref, updates);
    results.offlineDrivers++;
  }

  await batch.commit();
}

/**
 * Auto-cancel rides where payment wasn't authorized in time
 * @param paymentAuthTimeoutMs - Time allowed for payment authorization after accept
 */
export async function cancelUnpaidRides(
  now: number,
  paymentAuthTimeoutMs: number,
  firestoreDb: FirebaseFirestore.Firestore,
  results: { cancelledUnpaid: number }
) {
  const cutoffTime = now - paymentAuthTimeoutMs;

  // Find accepted rides where payment hasn't been authorized
  const unpaidRides = await firestoreDb
    .collection('rides')
    .where('status', '==', 'accepted')
    .where('acceptedAtMs', '<=', cutoffTime)
    .limit(50)
    .get();

  if (unpaidRides.empty) {
    return;
  }

  console.log(`[AutoCancel] Found ${unpaidRides.size} unpaid rides to check`);

  const batch = firestoreDb.batch();
  const eventPromises: Promise<void>[] = [];

  for (const doc of unpaidRides.docs) {
    const ride = doc.data();
    const rideId = doc.id;

    // Skip if already cancelled/completed or payment is authorized/captured
    if (ride.status === 'cancelled' || ride.status === 'completed') {
      continue;
    }
    
    const paymentStatus = ride.paymentStatus || 'none';
    if (paymentStatus === 'authorized' || paymentStatus === 'captured') {
      continue;
    }

    console.log(`[AutoCancel] Cancelling unpaid ride ${rideId} (payment: ${paymentStatus})`);

    batch.update(doc.ref, {
      status: 'cancelled',
      cancelReason: 'payment_timeout',
      cancelledBy: 'system',
      cancelledAtMs: now,
      updatedAtMs: now,
    });

    // Log the event
    eventPromises.push(
      logRideEvent(rideId, 'ride_cancelled', {
        reason: 'payment_timeout',
        cancelledBy: 'system',
        paymentStatus,
        acceptedDurationMs: now - (ride.acceptedAtMs || now),
      }, firestoreDb)
    );

    // Release driver lock
    if (ride.driverId) {
      const driverRef = firestoreDb.collection('drivers').doc(ride.driverId);
      batch.update(driverRef, {
        isBusy: false,
        currentRideId: null,
        currentRideStatus: null,
        updatedAtMs: now,
      });
    }

    // Expire any pending offers
    const offersSnap = await firestoreDb
      .collection('offers')
      .where('rideId', '==', rideId)
      .where('status', '==', 'pending')
      .get();

    offersSnap.forEach(offerDoc => {
      batch.update(offerDoc.ref, {
        status: 'expired',
        expiredAtMs: now,
        expireReason: 'ride_cancelled_payment_timeout',
      });
    });

    results.cancelledUnpaid++;
  }

  await batch.commit();
  await Promise.all(eventPromises);
}

/**
 * Auto-cancel rides where driver didn't start after payment was authorized
 * Also cancels the Stripe PaymentIntent to release the hold
 * @param driverStartTimeoutMs - Time allowed for driver to start after payment authorized
 * @param stripe - Stripe instance for canceling payment holds
 */
export async function cancelUnstartedRides(
  now: number,
  driverStartTimeoutMs: number,
  stripe: any,
  stripeEnabled: boolean,
  firestoreDb: FirebaseFirestore.Firestore,
  results: { cancelledUnstarted: number }
) {
  const cutoffTime = now - driverStartTimeoutMs;

  // Find accepted rides where payment was authorized but driver never started
  const unstartedRides = await firestoreDb
    .collection('rides')
    .where('status', '==', 'accepted')
    .where('paymentStatus', '==', 'authorized')
    .where('paymentAuthorizedAtMs', '<=', cutoffTime)
    .limit(50)
    .get();

  if (unstartedRides.empty) {
    return;
  }

  console.log(`[AutoCancel] Found ${unstartedRides.size} unstarted rides to check`);

  const batch = firestoreDb.batch();
  const eventPromises: Promise<void>[] = [];

  for (const doc of unstartedRides.docs) {
    const ride = doc.data();
    const rideId = doc.id;

    // Skip if already cancelled/completed/started
    if (ride.status === 'cancelled' || ride.status === 'completed' || ride.status === 'started' || ride.status === 'in_progress') {
      continue;
    }

    // Skip if ride was actually started (double-check)
    if (ride.startedAtMs) {
      continue;
    }

    console.log(`[AutoCancel] Cancelling unstarted ride ${rideId} (authorized but not started)`);

    // Cancel Stripe PaymentIntent if available
    if (ride.paymentIntentId && stripeEnabled) {
      try {
        await stripe.paymentIntents.cancel(ride.paymentIntentId, {
          cancellation_reason: 'abandoned',
        });

        eventPromises.push(
          logRideEvent(rideId, 'payment_cancelled', {
            reason: 'driver_no_start_timeout',
            paymentIntentId: ride.paymentIntentId,
          }, firestoreDb)
        );

        console.log(`[AutoCancel] Cancelled PaymentIntent ${ride.paymentIntentId} for ride ${rideId}`);
      } catch (error) {
        console.error(`[AutoCancel] Failed to cancel PaymentIntent for ride ${rideId}:`, error);
        // Continue with ride cancellation even if payment cancellation fails
      }
    }

    batch.update(doc.ref, {
      status: 'cancelled',
      cancelReason: 'driver_no_start_timeout',
      cancelledBy: 'system',
      cancelledAtMs: now,
      paymentStatus: 'cancelled',
      paymentCancelledAtMs: now,
      updatedAtMs: now,
    });

    // Log the ride cancellation event
    eventPromises.push(
      logRideEvent(rideId, 'ride_cancelled', {
        reason: 'driver_no_start_timeout',
        cancelledBy: 'system',
        authorizedDurationMs: now - (ride.paymentAuthorizedAtMs || now),
      }, firestoreDb)
    );

    // Release driver lock
    if (ride.driverId) {
      const driverRef = firestoreDb.collection('drivers').doc(ride.driverId);
      batch.update(driverRef, {
        isBusy: false,
        currentRideId: null,
        currentRideStatus: null,
        updatedAtMs: now,
      });
    }

    results.cancelledUnstarted++;
  }

  await batch.commit();
  await Promise.all(eventPromises);
}

/**
 * Cancel stale PaymentIntents for rides stuck in payment limbo
 * Prevents "Incomplete" PaymentIntents from accumulating in Stripe
 * @param paymentTimeoutMs - Time allowed for payment to be authorized/completed
 */
export async function cancelStalePaymentIntents(
  now: number,
  paymentTimeoutMs: number,
  stripe: any,
  firestoreDb: FirebaseFirestore.Firestore,
  results: { cancelledStalePayments?: number }
) {
  // Find rides with stale payments that need cleanup
  // Status: accepted (waiting for payment) or created with payment in progress
  const staleRides = await firestoreDb
    .collection('rides')
    .where('status', 'in', ['accepted', 'requested'])
    .where('stripePaymentIntentId', '!=', null)
    .limit(50)
    .get();

  if (staleRides.empty) {
    return;
  }

  console.log(`[PaymentCleanup] Found ${staleRides.size} rides with payment intents to check`);

  const batch = firestoreDb.batch();
  const eventPromises: Promise<void>[] = [];

  for (const doc of staleRides.docs) {
    const ride = doc.data();
    const rideId = doc.id;

    // Skip if payment is already in a terminal state
    const paymentStatus = ride.paymentStatus || 'none';
    if (paymentStatus === 'captured' || paymentStatus === 'cancelled') {
      continue;
    }

    // Skip if ride is too new (still within timeout window)
    const rideAge = now - (ride.acceptedAtMs || ride.createdAtMs || now);
    if (rideAge < paymentTimeoutMs) {
      continue;
    }

    // Skip if ride is already cancelled/completed
    if (ride.status === 'cancelled' || ride.status === 'completed') {
      continue;
    }

    console.log(`[PaymentCleanup] Checking stale payment for ride ${rideId} (status: ${ride.status}, payment: ${paymentStatus}, age: ${rideAge}ms)`);

    // Fetch PaymentIntent from Stripe to check actual status
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.retrieve(ride.stripePaymentIntentId);
    } catch (error: any) {
      console.error(`[PaymentCleanup] Failed to retrieve PaymentIntent ${ride.stripePaymentIntentId}:`, error.message);
      continue;
    }

    // Only cancel if PaymentIntent is in a non-terminal state
    const shouldCancel = 
      paymentIntent.status === 'requires_payment_method' ||
      paymentIntent.status === 'requires_confirmation' ||
      paymentIntent.status === 'requires_action' ||
      paymentIntent.status === 'processing';

    if (!shouldCancel) {
      // PaymentIntent is already in terminal state (succeeded, canceled, etc.)
      console.log(`[PaymentCleanup] PaymentIntent ${ride.stripePaymentIntentId} already in terminal state: ${paymentIntent.status}`);
      
      // Sync Firestore with actual Stripe status if needed
      if (paymentIntent.status === 'succeeded' && paymentStatus !== 'captured') {
        batch.update(doc.ref, {
          paymentStatus: 'captured',
          paymentCapturedAtMs: now,
          updatedAtMs: now,
        });
      } else if (paymentIntent.status === 'canceled' && paymentStatus !== 'cancelled') {
        batch.update(doc.ref, {
          paymentStatus: 'cancelled',
          paymentCancelledAtMs: now,
          updatedAtMs: now,
        });
      }
      continue;
    }

    // Cancel the stale PaymentIntent in Stripe
    try {
      await stripe.paymentIntents.cancel(ride.stripePaymentIntentId, {
        cancellation_reason: 'abandoned',
      });

      console.log(`[PaymentCleanup] Cancelled stale PaymentIntent ${ride.stripePaymentIntentId} for ride ${rideId}`);

      eventPromises.push(
        logRideEvent(rideId, 'payment_cancelled', {
          reason: 'payment_timeout',
          paymentIntentId: ride.stripePaymentIntentId,
          previousStatus: paymentIntent.status,
          ageMs: rideAge,
        }, firestoreDb)
      );

    } catch (error: any) {
      console.error(`[PaymentCleanup] Failed to cancel PaymentIntent ${ride.stripePaymentIntentId}:`, error.message);
      continue;
    }

    // Update ride to cancelled state
    batch.update(doc.ref, {
      status: 'cancelled',
      cancelReason: 'payment_timeout',
      cancelledBy: 'system',
      cancelledAtMs: now,
      paymentStatus: 'cancelled',
      paymentCancelledAtMs: now,
      updatedAtMs: now,
    });

    // Log ride cancellation event
    eventPromises.push(
      logRideEvent(rideId, 'ride_cancelled', {
        reason: 'payment_timeout',
        cancelledBy: 'system',
        paymentStatus,
        ageMs: rideAge,
      }, firestoreDb)
    );

    // Release driver if assigned
    if (ride.driverId) {
      const driverRef = firestoreDb.collection('drivers').doc(ride.driverId);
      batch.update(driverRef, {
        isBusy: false,
        currentRideId: null,
        currentRideStatus: null,
        updatedAtMs: now,
      });
    }

    // Expire any pending offers
    const offersSnap = await doc.ref
      .collection('offers')
      .where('status', '==', 'pending')
      .get();

    offersSnap.forEach(offerDoc => {
      batch.update(offerDoc.ref, {
        status: 'expired',
        expiredAtMs: now,
        expireReason: 'ride_cancelled_payment_timeout',
      });
    });

    if (results.cancelledStalePayments !== undefined) {
      results.cancelledStalePayments++;
    }
  }

  await batch.commit();
  await Promise.all(eventPromises);
}

// Scheduled Cloud Function that runs every 2 minutes
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';

function isEmulator() {
  return process.env.FUNCTIONS_EMULATOR === 'true' || !!process.env.FIREBASE_EMULATOR_HUB;
}

type StripeMode = 'test' | 'live';

function getStripeMode(): StripeMode {
  if (isEmulator()) return 'test';
  return process.env.STRIPE_MODE === 'live' ? 'live' : 'test';
}

const stripeSecretLive = defineSecret('STRIPE_SECRET_KEY_LIVE');
const stripeSecretTest = defineSecret('STRIPE_SECRET_KEY_TEST');

export const scheduledCleanup = onSchedule(
  {
    schedule: 'every 2 minutes',
    timeoutSeconds: 540,
    memory: '256MiB',
    secrets: [stripeSecretLive, stripeSecretTest],
  },
  async (event) => {
    console.log('[scheduledCleanup] Starting cleanup jobs...');
    
    // Initialize Stripe if available
    let stripe = null;
    let stripeEnabled = false;
    try {
      const mode = getStripeMode();
      const emulator = isEmulator();
      let stripeKey: string | undefined;

      if (emulator) {
        stripeKey = process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY;
      } else if (mode === 'test') {
        stripeKey = stripeSecretTest.value();
      } else {
        stripeKey = stripeSecretLive.value();
      }

      if (!stripeKey) {
        throw new Error('Stripe key missing for cleanup job');
      }

      if (mode === 'test' && !stripeKey.startsWith('sk_test')) {
        throw new Error('STRIPE_MODE=test requires sk_test_* key');
      }
      if (mode === 'live' && !stripeKey.startsWith('sk_live')) {
        throw new Error('STRIPE_MODE=live requires sk_live_* key');
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Stripe = require('stripe');
      stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
      stripeEnabled = true;
      console.log('[scheduledCleanup] Stripe initialized', { mode });
    } catch (error) {
      console.warn('[scheduledCleanup] Stripe not available:', error);
    }
    
    const results = await runCleanupJobs(
      admin.firestore(),
      stripe,
      stripeEnabled,
      10 * 60 * 1000, // 10 min payment timeout
      10 * 60 * 1000  // 10 min driver start timeout
    );
    console.log('[scheduledCleanup] Cleanup completed:', results);
  }
);
