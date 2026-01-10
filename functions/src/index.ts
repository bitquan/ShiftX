import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { logRideEvent } from './eventLog';
import { runCleanupJobs } from './cleanup';

admin.initializeApp();
const db = admin.firestore();

const RIDES = db.collection('rides');

const OFFERS_PER_BATCH = 3;
const OFFER_TTL_MS = 60_000;
const MAX_DISPATCH_ATTEMPTS = 3;
const SEARCH_TIMEOUT_MS = process.env.SEARCH_TIMEOUT_MS 
  ? parseInt(process.env.SEARCH_TIMEOUT_MS, 10) 
  : 120_000; // 2 minutes default, override with env var for testing

type RideStatus =
  | 'requested'
  | 'dispatching'
  | 'offered'
  | 'accepted'
  | 'started'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

type LatLng = {
  lat: number;
  lng: number;
};

type TripRequestData = {
  rideId?: string;
  pickup: LatLng;
  dropoff: LatLng;
  priceCents?: number;
  metadata?: Record<string, unknown>;
};

type RideActionData = {
  rideId: string;
};

type CancelRideData = RideActionData & {
  reason?: string;
};

type SetDriverOnlineData = {
  online?: boolean;
};

type CreateTestRideData = RideActionData & {
  riderId?: string;
  pickup?: LatLng;
  dropoff?: LatLng;
  priceCents?: number;
};

type RideDocument = FirebaseFirestore.DocumentData & {
  status?: RideStatus;
  riderId?: string;
  driverId?: string | null;
  dispatchAttempts?: number;
  offerExpiresAtMs?: number;
  attemptedDriverIds?: string[];
  searchStartedAtMs?: number;
  searchExpiresAtMs?: number;
  createdAtMs?: number;
};

type DriverDocument = FirebaseFirestore.DocumentData & {
  isOnline?: boolean;
  isBusy?: boolean;
};

function ensureAuthenticated(context: functions.https.CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in');
  }
  return context.auth.uid;
}

async function ensureDriverRole(uid: string, firestoreDb: FirebaseFirestore.Firestore = db) {
  const userDoc = await firestoreDb.collection('users').doc(uid).get();
  const role = userDoc.data()?.role;
  if (role !== 'driver') {
    throw new functions.https.HttpsError('permission-denied', 'Driver role required');
  }
}

function logCallable(functionName: string, uid: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({
    function: functionName,
    uid,
    ...data,
    timestamp: Date.now(),
  }));
}

async function findEligibleDrivers(rideId: string, firestoreDb: FirebaseFirestore.Firestore = db) {
  const rideRef = firestoreDb.collection('rides').doc(rideId);
  const rideSnap = await rideRef.get();
  const ride = rideSnap.data() as RideDocument;
  const attemptedDriverIds = ride?.attemptedDriverIds || [];
  
  const driversSnap = await firestoreDb
    .collection('drivers')
    .where('isOnline', '==', true)
    .where('isBusy', '==', false)
    .get();
  
  // Filter out drivers who have already been attempted
  const eligibleDocs = driversSnap.docs.filter(doc => !attemptedDriverIds.includes(doc.id));
  return { docs: eligibleDocs.slice(0, OFFERS_PER_BATCH), empty: eligibleDocs.length === 0 };
}

async function runMatching(rideId: string, firestoreDb: FirebaseFirestore.Firestore = db) {
  const rideRef = firestoreDb.collection('rides').doc(rideId);
  const rideSnap = await rideRef.get();
  if (!rideSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Ride not found');
  }

  const ride = rideSnap.data() as RideDocument;
  if (!ride || ['cancelled', 'completed', 'accepted'].includes(ride.status ?? '')) {
    return { matched: false };
  }

  const now = Date.now();
  const dispatchAttempts = (ride.dispatchAttempts || 0) + 1;

  await logRideEvent(rideId, 'matching_started', { dispatchAttempt: dispatchAttempts }, firestoreDb);

  await rideRef.update({
    status: 'dispatching',
    dispatchAttempts,
    dispatchingAtMs: now,
    updatedAtMs: now,
  });

  const driversResult = await findEligibleDrivers(rideId, firestoreDb);
  if (driversResult.empty) {
    // Check if search has timed out
    const searchStartedAtMs = ride.searchStartedAtMs || ride.createdAtMs || now;
    const searchExpiresAtMs = ride.searchExpiresAtMs || (searchStartedAtMs + SEARCH_TIMEOUT_MS);
    const hasTimedOut = now >= searchExpiresAtMs;

    // No eligible drivers found
    if (dispatchAttempts >= MAX_DISPATCH_ATTEMPTS || hasTimedOut) {
      // Max attempts reached or search timeout - cancel the ride
      await logRideEvent(rideId, 'search_timeout', { 
        reason: hasTimedOut ? 'timeout' : 'max_attempts', 
        dispatchAttempts,
        searchDurationMs: now - searchStartedAtMs 
      }, firestoreDb);
      
      await rejectPendingOffers(rideId, firestoreDb);
      await rideRef.update({
        status: 'cancelled',
        cancelReason: hasTimedOut ? 'search_timeout' : 'no_drivers',
        cancelledAtMs: now,
        updatedAtMs: now,
      });
      return { matched: false, cancelled: true };
    }
    
    // Attempt available - use exponential backoff with jitter
    // Base delay: 1s, 2s, 4s, etc. with +/- 20% jitter
    const baseDelay = Math.min(1000 * Math.pow(2, dispatchAttempts - 1), 8000);
    const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1); // +/- 20%
    const retryDelay = Math.max(500, baseDelay + jitter); // Minimum 500ms
    
    console.log(`No drivers found for ride ${rideId}, attempt ${dispatchAttempts}/${MAX_DISPATCH_ATTEMPTS}. Retrying in ${Math.round(retryDelay)}ms...`);
    await rideRef.update({
      status: 'requested',
      lastMatchingFailureMs: now,
      updatedAtMs: now,
    });
    
    // Wait with backoff then retry
    await new Promise(resolve => setTimeout(resolve, retryDelay));
    return await runMatching(rideId, firestoreDb);
  }

  const expiresAt = now + OFFER_TTL_MS;
  const batch = firestoreDb.batch();
  
  // Collect driver IDs being offered to
  const offeredDriverIds: string[] = [];
  
  driversResult.docs.forEach((driverDoc) => {
    offeredDriverIds.push(driverDoc.id);
    const offerRef = rideRef.collection('offers').doc(driverDoc.id);
    batch.set(
      offerRef,
      {
        driverId: driverDoc.id,
        status: 'pending',
        createdAtMs: now,
        expiresAtMs: expiresAt,
      },
      { merge: true }
    );
  });

  // Add offered drivers to attemptedDriverIds so they won't be re-offered
  const currentAttemptedIds = ride.attemptedDriverIds || [];
  const updatedAttemptedIds = [...new Set([...currentAttemptedIds, ...offeredDriverIds])];

  batch.update(rideRef, {
    status: 'offered',
    offerExpiresAtMs: expiresAt,
    offersSentAtMs: now,
    updatedAtMs: now,
    dispatchAttempts,
    attemptedDriverIds: updatedAttemptedIds,
  });

  await batch.commit();
  
  // Log each offer created
  await Promise.all(offeredDriverIds.map(driverId => 
    logRideEvent(rideId, 'offer_created', { 
      driverId, 
      expiresAtMs: expiresAt,
      dispatchAttempt: dispatchAttempts 
    }, firestoreDb)
  ));
  
  // Schedule a check to re-match if all offers expire without being accepted
  // Wait for TTL + 1 second buffer
  setTimeout(async () => {
    try {
      const rideSnap = await rideRef.get();
      if (!rideSnap.exists) return;
      
      const currentRide = rideSnap.data() as RideDocument;
      // Only re-match if still in 'offered' state (no one accepted)
      if (currentRide.status === 'offered') {
        console.log(`All offers expired for ride ${rideId}, triggering re-match`);
        await logRideEvent(rideId, 'offer_expired', { 
          reason: 'all_expired',
          offeredDriverIds 
        }, firestoreDb);
        
        // Mark expired offers
        const expiredOffers = await rideRef.collection('offers')
          .where('status', '==', 'pending')
          .get();
        
        const expireBatch = firestoreDb.batch();
        expiredOffers.forEach(doc => {
          expireBatch.update(doc.ref, { status: 'expired', expiredAtMs: Date.now() });
        });
        await expireBatch.commit();
        
        // Trigger re-matching
        await runMatching(rideId, firestoreDb);
      }
    } catch (error) {
      console.error(`Failed to re-match after offer expiry for ride ${rideId}:`, error);
    }
  }, OFFER_TTL_MS + 1000);
  
  return { matched: true };
}

async function rejectPendingOffers(rideId: string, firestoreDb: FirebaseFirestore.Firestore = db) {
  const rideRef = firestoreDb.collection('rides').doc(rideId);
  const pendingOffers = await rideRef.collection('offers').where('status', '==', 'pending').get();
  if (pendingOffers.empty) {
    return;
  }

  const now = Date.now();
  const batch = firestoreDb.batch();
  
  // Collect driver IDs from pending offers to add to attemptedDriverIds
  const driverIds = pendingOffers.docs.map(doc => doc.id);
  
  pendingOffers.forEach((doc) => batch.update(doc.ref, { status: 'rejected', rejectedAtMs: now }));
  
  // Add these drivers to attemptedDriverIds so they won't be offered again
  const rideSnap = await rideRef.get();
  if (rideSnap.exists) {
    const ride = rideSnap.data() as RideDocument;
    const attemptedDriverIds = ride.attemptedDriverIds || [];
    const updatedAttemptedIds = [...new Set([...attemptedDriverIds, ...driverIds])];
    batch.update(rideRef, { attemptedDriverIds: updatedAttemptedIds, updatedAtMs: now });
  }
  
  await batch.commit();
}

async function expireAllOffers(rideId: string, firestoreDb: FirebaseFirestore.Firestore = db) {
  const rideRef = firestoreDb.collection('rides').doc(rideId);
  const offers = await rideRef.collection('offers').where('status', 'in', ['pending', 'accepted', 'rejected']).get();
  if (offers.empty) {
    return;
  }

  const now = Date.now();
  const batch = firestoreDb.batch();
  offers.forEach((doc) => batch.update(doc.ref, { status: 'expired', expiredAtMs: now }));
  await batch.commit();
}

export async function tripRequestHandler(
  data: TripRequestData,
  context: functions.https.CallableContext,
  firestoreDb: FirebaseFirestore.Firestore = db
) {
  const riderId = ensureAuthenticated(context);
  const rideId = data.rideId || firestoreDb.collection('rides').doc().id;
  const now = Date.now();
  const rideRef = firestoreDb.collection('rides').doc(rideId);

  await rideRef.set({
    riderId,
    status: 'requested',
    pickup: data.pickup,
    dropoff: data.dropoff,
    priceCents: data.priceCents || 0,
    metadata: data.metadata || {},
    createdAtMs: now,
    searchStartedAtMs: now,
    attemptedDriverIds: [],
    searchExpiresAtMs: now + SEARCH_TIMEOUT_MS,
    dispatchAttempts: 0,
    updatedAtMs: now,
  });

  await logRideEvent(rideId, 'ride_created', { riderId, priceCents: data.priceCents }, firestoreDb);

  console.log('Starting runMatching for ride:', rideId);
  try {
    await runMatching(rideId, firestoreDb);
    console.log('runMatching completed for ride:', rideId);
  } catch (error) {
    console.error('runMatching failed for ride:', rideId, error);
    throw error;
  }
  return { rideId };
}

export const tripRequest = functions.https.onCall(async (data, context) => {
  try {
    return await tripRequestHandler(data as TripRequestData, context);
  } catch (error) {
    console.error('tripRequest error:', error);
    throw error;
  }
});

export async function acceptRideHandler(
  data: RideActionData,
  context: functions.https.CallableContext,
  firestoreDb: FirebaseFirestore.Firestore = db
) {
  const driverId = ensureAuthenticated(context);
  await ensureDriverRole(driverId, firestoreDb);
  const { rideId } = data;
  
  logCallable('acceptRide', driverId, { rideId });
  
  if (!rideId) {
    throw new functions.https.HttpsError('invalid-argument', 'rideId is required');
  }

  const rideRef = firestoreDb.collection('rides').doc(rideId);
  const driverRef = firestoreDb.collection('drivers').doc(driverId);

  await firestoreDb.runTransaction(async (tx) => {
    const rideSnap = await tx.get(rideRef);
    const driverSnap = await tx.get(driverRef);

    if (!rideSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Ride not found');
    }
    if (!driverSnap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Driver not found');
    }

    const ride = rideSnap.data() as RideDocument;
    
    // Idempotency: if already accepted by this driver, return success
    if (ride.status === 'accepted' && ride.driverId === driverId) {
      return;
    }
    
    if (!['offered', 'requested'].includes(ride.status ?? '')) {
      throw new functions.https.HttpsError('failed-precondition', 'Ride is not offered');
    }
    if (driverSnap.data()?.isBusy) {
      throw new functions.https.HttpsError('failed-precondition', 'Driver is busy');
    }

    const now = Date.now();
    if (ride.status === 'offered') {
      const offerRef = rideRef.collection('offers').doc(driverId);
      const offerSnap = await tx.get(offerRef);
      if (!offerSnap.exists) {
        throw new functions.https.HttpsError('failed-precondition', 'No pending offer');
      }

      const offer = offerSnap.data();
      
      // Validate offer status
      if (offer?.status !== 'pending') {
        throw new functions.https.HttpsError('failed-precondition', 'Offer is no longer pending');
      }
      
      // Validate offer hasn't expired (TTL enforcement)
      const expiresAtMs = offer?.expiresAtMs || 0;
      if (expiresAtMs <= now) {
        throw new functions.https.HttpsError('failed-precondition', 'Offer has expired');
      }

      tx.update(offerRef, {
        status: 'accepted',
        acceptedAtMs: now,
      });
    }

    tx.update(rideRef, {
      status: 'accepted',
      driverId,
      acceptedAtMs: now,
      updatedAtMs: now,
    });
    tx.update(driverRef, {
      isBusy: true,
      currentRideId: rideId,
      currentRideStatus: 'accepted',
      updatedAtMs: now,
    });
  });

  await logRideEvent(rideId, 'ride_accepted', { driverId }, firestoreDb);
  await rejectPendingOffers(rideId, firestoreDb);
  return { ok: true };
}

export const acceptRide = functions.https.onCall(async (data, context) =>
  acceptRideHandler(data as RideActionData, context)
);

export async function declineOfferHandler(
  data: RideActionData,
  context: functions.https.CallableContext,
  firestoreDb: FirebaseFirestore.Firestore = db
) {
  const driverId = ensureAuthenticated(context);
  await ensureDriverRole(driverId, firestoreDb);
  const { rideId } = data;
  
  logCallable('declineOffer', driverId, { rideId });
  
  if (!rideId) {
    throw new functions.https.HttpsError('invalid-argument', 'rideId is required');
  }

  const rideRef = firestoreDb.collection('rides').doc(rideId);
  const offerRef = rideRef.collection('offers').doc(driverId);
  
  console.log(`Declining offer: rideId=${rideId}, driverId=${driverId}, offerPath=${offerRef.path}`);
  
  let rideData: RideDocument | undefined = undefined;
  
  await firestoreDb.runTransaction(async (tx) => {
    // ALL READS FIRST (Firestore transaction requirement)
    const offerSnap = await tx.get(offerRef);
    const rideSnap = await tx.get(rideRef);
    
    if (!offerSnap.exists) {
      console.error(`Offer not found at path: ${offerRef.path}`);
      throw new functions.https.HttpsError('not-found', 'Offer not found');
    }
    
    const offer = offerSnap.data();
    console.log(`Offer status: ${offer?.status}`);
    
    if (offer?.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', `Offer is not pending (status: ${offer?.status})`);
    }
    
    // NOW ALL WRITES
    // Mark offer as declined
    tx.update(offerRef, {
      status: 'declined',
      declinedAtMs: Date.now(),
    });
    
    // Add this driver to attemptedDriverIds so they won't be offered again
    if (rideSnap.exists) {
      const ride = rideSnap.data() as RideDocument;
      rideData = ride;
      const attemptedDriverIds = ride.attemptedDriverIds || [];
      if (!attemptedDriverIds.includes(driverId)) {
        attemptedDriverIds.push(driverId);
        tx.update(rideRef, {
          attemptedDriverIds,
          updatedAtMs: Date.now(),
        });
      }
    }
  });
  
  await logRideEvent(rideId, 'offer_declined', { driverId }, firestoreDb);
  
  // Trigger matching again to find another driver with small delay + jitter
  if (rideData && ['requested', 'dispatching', 'offered'].includes((rideData as RideDocument).status ?? '')) {
    const baseDelay = 500;
    const jitter = baseDelay * 0.4 * (Math.random() * 2 - 1); // +/- 40%
    const delay = Math.max(300, baseDelay + jitter); // Min 300ms
    console.log(`Triggering re-matching for ride ${rideId} after decline in ${Math.round(delay)}ms`);
    setTimeout(() => runMatching(rideId, firestoreDb), delay);
  }

  return { ok: true };
}

export const declineOffer = functions.https.onCall(async (data, context) =>
  declineOfferHandler(data as RideActionData, context)
);

export async function startRideHandler(
  data: RideActionData,
  context: functions.https.CallableContext,
  firestoreDb: FirebaseFirestore.Firestore = db
) {
  const driverId = ensureAuthenticated(context);
  await ensureDriverRole(driverId, firestoreDb);
  const { rideId } = data;
  
  logCallable('startRide', driverId, { rideId });
  
  if (!rideId) {
    throw new functions.https.HttpsError('invalid-argument', 'rideId is required');
  }

  const rideRef = firestoreDb.collection('rides').doc(rideId);
  const driverRef = firestoreDb.collection('drivers').doc(driverId);

  await firestoreDb.runTransaction(async (tx) => {
    const rideSnap = await tx.get(rideRef);
    const driverSnap = await tx.get(driverRef);

    if (!rideSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Ride not found');
    }
    if (!driverSnap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Driver not found');
    }

    const ride = rideSnap.data() as RideDocument;
    console.log('startRide validation:', { rideId, rideStatus: ride.status, rideDriverId: ride.driverId, requestDriverId: driverId });
    
    // Idempotency: if already started, return success
    if (ride.status === 'started' && ride.driverId === driverId) {
      return;
    }
    
    if (ride.status !== 'accepted' || ride.driverId !== driverId) {
      throw new functions.https.HttpsError('failed-precondition', `Ride cannot be started (status: ${ride.status}, driverId match: ${ride.driverId === driverId})`);
    }

    const now = Date.now();
    tx.update(rideRef, {
      status: 'started',
      startedAtMs: now,
      updatedAtMs: now,
    });
    tx.update(driverRef, {
      currentRideStatus: 'started',
      updatedAtMs: now,
    });
  });

  await logRideEvent(rideId, 'ride_started', { driverId }, firestoreDb);
  return { ok: true };
}

export const startRide = functions.https.onCall(async (data, context) =>
  startRideHandler(data as RideActionData, context)
);

export async function progressRideHandler(
  data: RideActionData,
  context: functions.https.CallableContext,
  firestoreDb: FirebaseFirestore.Firestore = db
) {
  const driverId = ensureAuthenticated(context);
  await ensureDriverRole(driverId, firestoreDb);
  const { rideId } = data;
  
  logCallable('progressRide', driverId, { rideId });
  
  if (!rideId) {
    throw new functions.https.HttpsError('invalid-argument', 'rideId is required');
  }

  const rideRef = firestoreDb.collection('rides').doc(rideId);
  const driverRef = firestoreDb.collection('drivers').doc(driverId);
  await firestoreDb.runTransaction(async (tx) => {
    const rideSnap = await tx.get(rideRef);
    if (!rideSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Ride not found');
    }
    const ride = rideSnap.data() as RideDocument;
    
    // Idempotency: if already in_progress, return success
    if (ride.status === 'in_progress' && ride.driverId === driverId) {
      return;
    }
    
    if (ride.status !== 'started' || ride.driverId !== driverId) {
      throw new functions.https.HttpsError('failed-precondition', 'Ride cannot progress');
    }
    const driverSnap = await tx.get(driverRef);
    if (!driverSnap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Driver not found');
    }
    const now = Date.now();
    tx.update(rideRef, {
      status: 'in_progress',
      inProgressAtMs: now,
      updatedAtMs: now,
    });
    tx.update(driverRef, {
      currentRideStatus: 'in_progress',
      updatedAtMs: now,
    });
  });

  return { ok: true };
}

export const progressRide = functions.https.onCall(async (data, context) =>
  progressRideHandler(data as RideActionData, context)
);

export async function completeRideHandler(
  data: RideActionData,
  context: functions.https.CallableContext,
  firestoreDb: FirebaseFirestore.Firestore = db
) {
  const driverId = ensureAuthenticated(context);
  await ensureDriverRole(driverId, firestoreDb);
  const { rideId } = data;
  
  logCallable('completeRide', driverId, { rideId });
  
  if (!rideId) {
    throw new functions.https.HttpsError('invalid-argument', 'rideId is required');
  }

  const rideRef = firestoreDb.collection('rides').doc(rideId);
  const driverRef = firestoreDb.collection('drivers').doc(driverId);

  await firestoreDb.runTransaction(async (tx) => {
    const rideSnap = await tx.get(rideRef);
    const driverSnap = await tx.get(driverRef);

    if (!rideSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Ride not found');
    }
    if (!driverSnap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Driver not found');
    }

    const ride = rideSnap.data() as RideDocument;
    
    // Idempotency: if already completed, return success
    if (ride.status === 'completed' && ride.driverId === driverId) {
      return;
    }
    
    const isCompletable = ride.status === 'in_progress' || ride.status === 'started';
    if (!isCompletable || ride.driverId !== driverId) {
      throw new functions.https.HttpsError('failed-precondition', 'Ride cannot be completed');
    }

    const now = Date.now();
    tx.update(rideRef, {
      status: 'completed',
      completedAtMs: now,
      updatedAtMs: now,
    });
    tx.update(driverRef, {
      isBusy: false,
      currentRideId: null,
      currentRideStatus: null,
      updatedAtMs: now,
    });
  });

  await logRideEvent(rideId, 'ride_completed', { driverId }, firestoreDb);
  return { ok: true };
}

export const completeRide = functions.https.onCall(async (data, context) =>
  completeRideHandler(data as RideActionData, context)
);

export async function cancelRideHandler(
  data: CancelRideData,
  context: functions.https.CallableContext,
  firestoreDb: FirebaseFirestore.Firestore = db
) {
  const userId = ensureAuthenticated(context);
  const { rideId } = data;
  const reason = data.reason || 'cancelled';
  if (!rideId) {
    throw new functions.https.HttpsError('invalid-argument', 'rideId is required');
  }

  const rideRef = firestoreDb.collection('rides').doc(rideId);
  await firestoreDb.runTransaction(async (tx) => {
    const rideSnap = await tx.get(rideRef);
    if (!rideSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Ride not found');
    }

    const ride = rideSnap.data() as RideDocument;
    const isRider = ride.riderId === userId;
    const isDriver = ride.driverId === userId;
    const allowedStatuses: RideStatus[] = ['requested', 'dispatching', 'offered', 'accepted', 'started', 'in_progress'];
    if (!allowedStatuses.includes(ride.status ?? 'requested') || (!isRider && !isDriver)) {
      throw new functions.https.HttpsError('failed-precondition', 'Cannot cancel ride at this time');
    }

    const now = Date.now();
    tx.update(rideRef, {
      status: 'cancelled',
      cancelledAtMs: now,
      cancelReason: reason,
      updatedAtMs: now,
    });

    if (isDriver && ride.driverId) {
      const driverRef = firestoreDb.collection('drivers').doc(ride.driverId);
      tx.update(driverRef, {
        isBusy: false,
        currentRideId: null,
        updatedAtMs: now,
      });
    }
  });

  await logRideEvent(rideId, 'ride_cancelled', { userId, reason }, firestoreDb);
  await expireAllOffers(rideId, firestoreDb);
  return { ok: true };
}

export const cancelRide = functions.https.onCall(async (data, context) =>
  cancelRideHandler(data as CancelRideData, context)
);

export async function setDriverOnlineHandler(
  data: SetDriverOnlineData,
  context: functions.https.CallableContext,
  firestoreDb: FirebaseFirestore.Firestore = db
) {
  const driverId = ensureAuthenticated(context);
  await ensureDriverRole(driverId, firestoreDb);
  const online = Boolean(data.online);
  
  logCallable('driverSetOnline', driverId, { online });
  
  const driverRef = firestoreDb.collection('drivers').doc(driverId);

  await firestoreDb.runTransaction(async (tx) => {
    const driverSnap = await tx.get(driverRef);
    if (!driverSnap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Driver not found');
    }
    const driver = driverSnap.data() as DriverDocument;
    if (!online && driver.isBusy) {
      throw new functions.https.HttpsError('failed-precondition', 'Driver is busy');
    }

    tx.update(driverRef, {
      isOnline: online,
      updatedAtMs: Date.now(),
    });
  });

  // When driver comes online, trigger matching for the oldest searching ride
  if (online) {
    try {
      const searchingRides = await firestoreDb
        .collection('rides')
        .where('status', 'in', ['requested', 'dispatching', 'offered'])
        .orderBy('createdAtMs', 'asc')
        .limit(1)
        .get();
      
      if (!searchingRides.empty) {
        const oldestRide = searchingRides.docs[0];
        const rideId = oldestRide.id;
        console.log(`Driver ${driverId} came online, triggering matching for ride ${rideId}`);
        
        // Log the event
        await logRideEvent(rideId, 'driver_online_triggered_match', { driverId }, firestoreDb);
        
        // Trigger matching asynchronously (don't block the response)
        setTimeout(() => runMatching(rideId, firestoreDb), 100);
      }
    } catch (error) {
      console.error('Failed to trigger matching on driver online:', error);
      // Don't fail the entire request if matching trigger fails
    }
  }

  return { ok: true };
}

export const setDriverOnline = functions.https.onCall(async (data, context) =>
  setDriverOnlineHandler(data as SetDriverOnlineData, context)
);

type DriverHeartbeatData = {
  location?: { lat: number; lng: number };
};

export async function driverHeartbeatHandler(
  data: DriverHeartbeatData,
  context: functions.https.CallableContext,
  firestoreDb: FirebaseFirestore.Firestore = db
) {
  const driverId = ensureAuthenticated(context);
  await ensureDriverRole(driverId, firestoreDb);
  
  const loc = data?.location;
  const hasLoc = loc && typeof loc.lat === 'number' && typeof loc.lng === 'number';
  
  logCallable('driverHeartbeat', driverId, hasLoc ? { hasLocation: true } : {});
  
  const now = Date.now();
  const driverRef = firestoreDb.collection('drivers').doc(driverId);
  
  // Update driver document with heartbeat and optional location
  await driverRef.set({
    lastHeartbeatMs: now,
    ...(hasLoc ? { location: { lat: loc.lat, lng: loc.lng } } : {}),
    updatedAtMs: now,
  }, { merge: true });
  
  // If driver has active ride and location provided, mirror to ride document
  if (hasLoc) {
    const driverSnap = await driverRef.get();
    const currentRideId = driverSnap.data()?.currentRideId;
    
    if (currentRideId) {
      const rideRef = firestoreDb.collection('rides').doc(currentRideId);
      const rideSnap = await rideRef.get();
      
      if (rideSnap.exists) {
        const ride = rideSnap.data();
        // Safety check: only update if this driver is assigned to the ride
        if (ride?.driverId === driverId) {
          await rideRef.set({
            driverLocation: { lat: loc.lat, lng: loc.lng },
            driverLocationUpdatedAtMs: now,
          }, { merge: true });
        }
      }
    }
  }
  
  return { ok: true };
}

export const driverHeartbeat = functions.https.onCall(async (data, context) =>
  driverHeartbeatHandler(data, context)
);

export async function processRideOfferTimeout(rideId: string, firestoreDb: FirebaseFirestore.Firestore = db) {
  const rideRef = firestoreDb.collection('rides').doc(rideId);
  const rideSnap = await rideRef.get();
  if (!rideSnap.exists) {
    return;
  }
  const ride = rideSnap.data() as RideDocument;
  if (!ride || ride.status !== 'offered') {
    return;
  }

  const now = Date.now();
  const expiredOffers = await rideRef
    .collection('offers')
    .where('status', '==', 'pending')
    .where('expiresAtMs', '<=', now)
    .get();

  if (expiredOffers.empty) {
    return;
  }

  const batch = firestoreDb.batch();
  expiredOffers.forEach((doc) => batch.update(doc.ref, { status: 'expired', expiredAtMs: now }));
  batch.update(rideRef, { updatedAtMs: now });
  await batch.commit();

  const remainingPending = await rideRef.collection('offers').where('status', '==', 'pending').get();
  if (!remainingPending.empty) {
    return;
  }

  const attempts = ride.dispatchAttempts || 0;
  if (attempts >= MAX_DISPATCH_ATTEMPTS) {
    await rideRef.update({
      status: 'cancelled',
      cancelledAtMs: now,
      cancelReason: 'no_driver_available',
      updatedAtMs: now,
    });
    return;
  }

  await rideRef.update({
    status: 'requested',
    updatedAtMs: now,
  });
  await runMatching(rideId, firestoreDb);
}

export async function processOfferTimeouts(firestoreDb: FirebaseFirestore.Firestore = db) {
  const now = Date.now();
  const snapshot = await firestoreDb
    .collection('rides')
    .where('status', '==', 'offered')
    .where('offerExpiresAtMs', '<=', now)
    .get();

  await Promise.all(snapshot.docs.map((doc) => processRideOfferTimeout(doc.id, firestoreDb)));
}

export const offerTimeoutJob = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async () => {
    await processOfferTimeouts();
    return null;
  });

export const driverSetOnline = functions.https.onCall(async (data: SetDriverOnlineData, context) => {
  const driverId = ensureAuthenticated(context);
  const now = Date.now();
  await db.collection('drivers').doc(driverId).set(
    {
      isOnline: data.online ?? true,
      updatedAtMs: now,
    },
    { merge: true }
  );
  return { ok: true };
});

export const createTestRide = functions.https.onCall(async (data: CreateTestRideData, context) => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new functions.https.HttpsError('permission-denied', 'Test helper only allowed in emulator');
  }

  const driverId = ensureAuthenticated(context);
  const { rideId, riderId, pickup, dropoff, priceCents } = data;
  const rideRef = RIDES.doc(rideId);
  const driverRef = db.collection('drivers').doc(driverId);
  const now = Date.now();
  
  await rideRef.set({
    riderId: riderId || 'TEST_RIDER',
    driverId,
    pickup: pickup || { lat: 0, lng: 0 },
    dropoff: dropoff || { lat: 0, lng: 0 },
    priceCents: priceCents || 0,
    status: 'accepted',
    createdAtMs: now,
    acceptedAtMs: now,
    updatedAtMs: now,
  });
  
  await driverRef.update({
    isBusy: true,
    currentRideId: rideId,
    currentRideStatus: 'accepted',
    updatedAtMs: now,
  });
  
  return { ok: true, rideId };
});

export const devSeedDrivers = functions.https.onCall(async (data: { count?: number; online?: boolean }, context) => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new functions.https.HttpsError('permission-denied', 'Dev helper only allowed in emulator');
  }

  const requesterId = ensureAuthenticated(context);
  const count = Math.min(data.count || 5, 50); // Max 50 drivers
  const online = data.online ?? true;
  const now = Date.now();
  
  const batch = db.batch();
  const driverIds: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const driverId = `dev-driver-${Date.now()}-${i}`;
    driverIds.push(driverId);
    
    // Create user doc
    const userRef = db.collection('users').doc(driverId);
    batch.set(userRef, {
      role: 'driver',
      createdAtMs: now,
      updatedAtMs: now,
    });
    
    // Create driver doc
    const driverRef = db.collection('drivers').doc(driverId);
    batch.set(driverRef, {
      isOnline: online,
      isBusy: false,
      onboardingStatus: 'active',
      location: {
        lat: 37.7749 + (Math.random() - 0.5) * 0.1, // SF area with randomness
        lng: -122.4194 + (Math.random() - 0.5) * 0.1,
      },
      lastHeartbeatMs: now,
      createdAtMs: now,
      updatedAtMs: now,
    });
  }
  
  await batch.commit();
  
  console.log(`Created ${count} dev drivers by ${requesterId}:`, driverIds);
  
  return { 
    ok: true, 
    count,
    driverIds,
    message: `Created ${count} ${online ? 'online' : 'offline'} drivers` 
  };
});

export const getRideEvents = functions.https.onCall(async (data, context) => {
  ensureAuthenticated(context);
  const { rideId } = data;
  
  if (!rideId) {
    throw new functions.https.HttpsError('invalid-argument', 'rideId is required');
  }

  const eventsSnap = await db
    .collection('rides')
    .doc(rideId)
    .collection('events')
    .orderBy('atMs', 'asc')
    .get();

  return {
    events: eventsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  };
});

export const getRideHistory = functions.https.onCall(async (data, context) => {
  const riderId = ensureAuthenticated(context);
  const limit = data.limit || 10;

  const ridesSnap = await RIDES
    .where('riderId', '==', riderId)
    .orderBy('createdAtMs', 'desc')
    .limit(limit)
    .get();

  const rides = ridesSnap.docs.map(doc => ({
    rideId: doc.id,
    ...doc.data()
  }));

  return { rides };
});

// ============================================================================
// CLEANUP & MAINTENANCE
// ============================================================================

/**
 * Scheduled cleanup job - runs every 2 minutes
 * Cleans up stuck rides, expired offers, and ghost drivers
 */
export const scheduledCleanup = functions.pubsub
  .schedule('every 2 minutes')
  .onRun(async () => {
    console.log('[Scheduled] Running cleanup job');
    const results = await runCleanupJobs(db);
    console.log('[Scheduled] Cleanup complete:', results);
    return results;
  });

/**
 * Manual cleanup trigger for testing/debugging
 */
export const manualCleanup = functions.https.onCall(async (data, context) => {
  // Only allow in emulator or for authenticated users
  if (!process.env.FIRESTORE_EMULATOR_HOST && !context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  
  console.log('[Manual] Running cleanup job');
  const results = await runCleanupJobs(db);
  return results;
});

// ============================================================================
// PREFERRED DRIVER & AVAILABILITY
// ============================================================================

type SetPreferredDriverData = {
  driverId: string;
};

/**
 * Set preferred driver for customer
 */
export const setPreferredDriver = functions.https.onCall(async (data: SetPreferredDriverData, context) => {
  const customerId = ensureAuthenticated(context);
  const { driverId } = data;
  
  if (!driverId) {
    throw new functions.https.HttpsError('invalid-argument', 'driverId is required');
  }
  
  logCallable('setPreferredDriver', customerId, { driverId });
  
  // Verify driver exists
  const driverDoc = await db.collection('drivers').doc(driverId).get();
  if (!driverDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Driver not found');
  }
  
  // Update customer doc
  await db.collection('customers').doc(customerId).set({
    preferredDriverId: driverId,
    updatedAtMs: Date.now(),
  }, { merge: true });
  
  return { ok: true };
});

type WeeklyInterval = {
  day: number; // 0=Sunday, 6=Saturday
  startMinutes: number; // minutes since midnight
  endMinutes: number;
};

type SetDriverAvailabilityData = {
  timezone: string; // e.g. "America/New_York"
  intervals: WeeklyInterval[];
};

/**
 * Set driver availability schedule
 */
export const setDriverAvailability = functions.https.onCall(async (data: SetDriverAvailabilityData, context) => {
  const driverId = ensureAuthenticated(context);
  await ensureDriverRole(driverId, db);
  
  const { timezone, intervals } = data;
  
  if (!timezone || !intervals) {
    throw new functions.https.HttpsError('invalid-argument', 'timezone and intervals are required');
  }
  
  // Basic validation
  if (!Array.isArray(intervals)) {
    throw new functions.https.HttpsError('invalid-argument', 'intervals must be an array');
  }
  
  for (const interval of intervals) {
    if (interval.day < 0 || interval.day > 6) {
      throw new functions.https.HttpsError('invalid-argument', 'day must be 0-6');
    }
    if (interval.startMinutes < 0 || interval.startMinutes > 1439) {
      throw new functions.https.HttpsError('invalid-argument', 'startMinutes must be 0-1439');
    }
    if (interval.endMinutes < 0 || interval.endMinutes > 1439) {
      throw new functions.https.HttpsError('invalid-argument', 'endMinutes must be 0-1439');
    }
  }
  
  logCallable('setDriverAvailability', driverId, { timezone, intervalCount: intervals.length });
  
  await db.collection('drivers').doc(driverId).set({
    availability: {
      timezone,
      intervals,
    },
    updatedAtMs: Date.now(),
  }, { merge: true });
  
  return { ok: true };
});

type ScheduleRideData = {
  pickup: LatLng;
  dropoff: LatLng;
  priceCents: number;
  scheduledForMs: number;
};

/**
 * Schedule a ride for a future time
 * Requires customer has preferredDriverId set
 * Validates scheduledForMs is within driver availability
 */
export const scheduleRide = functions.https.onCall(async (data: ScheduleRideData, context) => {
  const riderId = ensureAuthenticated(context);
  const { pickup, dropoff, priceCents, scheduledForMs } = data;
  
  if (!pickup || !dropoff || !priceCents || !scheduledForMs) {
    throw new functions.https.HttpsError('invalid-argument', 'pickup, dropoff, priceCents, and scheduledForMs are required');
  }
  
  logCallable('scheduleRide', riderId, { priceCents, scheduledForMs });
  
  // Get customer's preferred driver
  const customerDoc = await db.collection('customers').doc(riderId).get();
  const preferredDriverId = customerDoc.data()?.preferredDriverId;
  
  if (!preferredDriverId) {
    throw new functions.https.HttpsError('failed-precondition', 'Customer must have a preferred driver to schedule rides');
  }
  
  // Get driver's availability
  const driverDoc = await db.collection('drivers').doc(preferredDriverId).get();
  if (!driverDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Preferred driver not found');
  }
  
  const driverData = driverDoc.data();
  const availability = driverData?.availability;
  
  if (availability && availability.intervals && availability.intervals.length > 0) {
    // Validate scheduledForMs is within driver availability
    const scheduledDate = new Date(scheduledForMs);
    const day = scheduledDate.getDay(); // 0=Sunday
    const minutes = scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
    
    const isAvailable = availability.intervals.some((interval: WeeklyInterval) =>
      interval.day === day &&
      minutes >= interval.startMinutes &&
      minutes <= interval.endMinutes
    );
    
    if (!isAvailable) {
      throw new functions.https.HttpsError('failed-precondition', 'Driver is not available at the scheduled time');
    }
  }
  
  // Create scheduled ride
  const now = Date.now();
  const rideRef = db.collection('rides').doc();
  
  await rideRef.set({
    riderId,
    driverId: preferredDriverId,
    pickup,
    dropoff,
    priceCents,
    status: 'scheduled',
    scheduledForMs,
    createdAtMs: now,
    updatedAtMs: now,
  });
  
  await logRideEvent(rideRef.id, 'ride_scheduled', {
    riderId,
    driverId: preferredDriverId,
    scheduledForMs,
    priceCents,
  }, db);
  
  return { ok: true, rideId: rideRef.id };
});

/**
 * Scheduled function to activate scheduled rides
 * Runs every minute, finds scheduled rides where scheduledForMs is near/now
 * Converts them to offers for the assigned driver
 */
export const activateScheduledRides = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async () => {
    const now = Date.now();
    const activationWindow = 5 * 60 * 1000; // 5 minutes before scheduled time
    const activationTime = now + activationWindow;
    
    console.log(`[ActivateScheduled] Checking for rides scheduled before ${new Date(activationTime).toISOString()}`);
    
    // Find scheduled rides that should be activated
    const scheduledRides = await db.collection('rides')
      .where('status', '==', 'scheduled')
      .where('scheduledForMs', '<=', activationTime)
      .limit(50)
      .get();
    
    if (scheduledRides.empty) {
      console.log('[ActivateScheduled] No scheduled rides to activate');
      return null;
    }
    
    console.log(`[ActivateScheduled] Found ${scheduledRides.size} scheduled rides to activate`);
    
    const batch = db.batch();
    const offerPromises: Promise<void>[] = [];
    
    for (const rideDoc of scheduledRides.docs) {
      const ride = rideDoc.data();
      const rideId = rideDoc.id;
      const driverId = ride.driverId;
      
      if (!driverId) {
        console.warn(`[ActivateScheduled] Ride ${rideId} has no assigned driver, skipping`);
        continue;
      }
      
      const expiresAt = now + OFFER_TTL_MS;
      
      // Create offer for the assigned driver
      const offerRef = rideDoc.ref.collection('offers').doc(driverId);
      batch.set(offerRef, {
        driverId,
        status: 'pending',
        createdAtMs: now,
        expiresAtMs: expiresAt,
      });
      
      // Update ride status to 'offered'
      batch.update(rideDoc.ref, {
        status: 'offered',
        offerExpiresAtMs: expiresAt,
        offersSentAtMs: now,
        updatedAtMs: now,
      });
      
      offerPromises.push(
        logRideEvent(rideId, 'scheduled_ride_activated', {
          driverId,
          scheduledForMs: ride.scheduledForMs,
          expiresAtMs: expiresAt,
        }, db)
      );
    }
    
    await batch.commit();
    await Promise.all(offerPromises);
    
    console.log(`[ActivateScheduled] Activated ${scheduledRides.size} scheduled rides`);
    return { activated: scheduledRides.size };
  });

