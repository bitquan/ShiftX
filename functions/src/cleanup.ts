import * as admin from 'firebase-admin';
import { logRideEvent } from './eventLog';

const HEARTBEAT_TIMEOUT_MS = 120_000; // 2 minutes

/**
 * Janitor function: cleans up stuck rides and expired offers
 * Should run every 1-5 minutes via scheduled function
 */
export async function runCleanupJobs(firestoreDb: FirebaseFirestore.Firestore = admin.firestore()) {
  const now = Date.now();
  const results = {
    cancelledRides: 0,
    expiredOffers: 0,
    offlineDrivers: 0,
  };

  console.log('[Cleanup] Starting cleanup jobs at', new Date(now).toISOString());

  // 1. Cancel rides stuck past searchExpiresAtMs
  await cancelStuckRides(now, firestoreDb, results);

  // 2. Expire pending offers past expiresAtMs
  await expireStuckOffers(now, firestoreDb, results);

  // 3. Mark ghost drivers as offline
  await cleanupGhostDrivers(now, firestoreDb, results);

  console.log('[Cleanup] Completed:', results);
  return results;
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
  // Query all rides that might have expired offers
  const ridesWithOffers = await firestoreDb
    .collection('rides')
    .where('status', 'in', ['offered', 'dispatching'])
    .where('offerExpiresAtMs', '<=', now)
    .limit(50)
    .get();

  if (ridesWithOffers.empty) {
    return;
  }

  console.log(`[Cleanup] Found ${ridesWithOffers.size} rides with potentially expired offers`);

  for (const rideDoc of ridesWithOffers.docs) {
    const rideId = rideDoc.id;
    const rideRef = rideDoc.ref;

    // Get all pending offers for this ride
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
