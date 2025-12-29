// Cloud Functions: ride state transitions
// Purpose: Provide authoritative, transactional handlers for ride lifecycle events (accept/start/complete/cancel).
// When to update: Update these functions when the ride workflow or required validations change.

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

const RIDES = db.collection('rides');

export async function acceptRideHandler(data: any, context: functions.https.CallableContext, firestoreDb = admin.firestore()) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be signed in'
    );
  }

  const rideId = data.rideId as string;
  const driverId = context.auth.uid;

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

    const ride = rideSnap.data()!;
    const driver = driverSnap.data()!;

    if (ride.status !== 'requested') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Ride already taken'
      );
    }

    if (driver.isBusy) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Driver is busy'
      );
    }

    tx.update(rideRef, {
      status: 'accepted',
      driverId,
      acceptedAtMs: Date.now(),
    });

    tx.update(driverRef, {
      isBusy: true,
      currentRideId: rideId,
      updatedAtMs: Date.now(),
    });
  });

  return { ok: true };
}

export const acceptRide = functions.https.onCall(async (data, context) => acceptRideHandler(data, context));

export async function startRideHandler(data: any, context: functions.https.CallableContext, firestoreDb = admin.firestore()) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in');
  }

  const rideId = data.rideId as string;
  const driverId = context.auth.uid;

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

    const ride = rideSnap.data()!;

    if (ride.status !== 'accepted' || ride.driverId !== driverId) {
      throw new functions.https.HttpsError('failed-precondition', 'Ride cannot be started');
    }

    tx.update(rideRef, {
      status: 'started',
      startedAtMs: Date.now(),
    });
  });

  return { ok: true };
}

export const startRide = functions.https.onCall(async (data, context) => startRideHandler(data, context));

export async function completeRideHandler(data: any, context: functions.https.CallableContext, firestoreDb = admin.firestore()) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in');
  }

  const rideId = data.rideId as string;
  const driverId = context.auth.uid;

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

    const ride = rideSnap.data()!;

    if (ride.status !== 'started' || ride.driverId !== driverId) {
      throw new functions.https.HttpsError('failed-precondition', 'Ride cannot be completed');
    }

    tx.update(rideRef, {
      status: 'completed',
      completedAtMs: Date.now(),
    });

    tx.update(driverRef, {
      isBusy: false,
      currentRideId: null,
      updatedAtMs: Date.now(),
    });
  });

  return { ok: true };
}

export const completeRide = functions.https.onCall(async (data, context) => completeRideHandler(data, context));

export async function cancelRideHandler(data: any, context: functions.https.CallableContext, firestoreDb = admin.firestore()) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in');
  }

  const rideId = data.rideId as string;
  const userId = context.auth.uid;

  const rideRef = firestoreDb.collection('rides').doc(rideId);

  await firestoreDb.runTransaction(async (tx) => {
    const rideSnap = await tx.get(rideRef);
    if (!rideSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Ride not found');
    }

    const ride = rideSnap.data()!;

    // Allow rider to cancel when requested/accepted, or driver to cancel if accepted
    const allowedByRider = ride.riderId === userId && ['requested', 'accepted'].includes(ride.status);
    const allowedByDriver = ride.driverId === userId && ['accepted', 'started'].includes(ride.status);

    if (!allowedByRider && !allowedByDriver) {
      throw new functions.https.HttpsError('failed-precondition', 'Cannot cancel ride');
    }

    tx.update(rideRef, {
      status: 'cancelled',
      cancelledAtMs: Date.now(),
    });

    if (ride.driverId) {
      const driverRef = firestoreDb.collection('drivers').doc(ride.driverId);
      tx.update(driverRef, {
        isBusy: false,
        currentRideId: null,
        updatedAtMs: Date.now(),
      });
    }
  });

  return { ok: true };
}

export const cancelRide = functions.https.onCall(async (data, context) => cancelRideHandler(data, context));

// Test helper: create a ride document for integration tests.
// Only allowed when running against emulators (checks FIRESTORE_EMULATOR_HOST).
export const createTestRide = functions.https.onCall(async (data, context) => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new functions.https.HttpsError('permission-denied', 'Test helper only allowed in emulator');
  }

  const rideId = data.rideId as string;
  const riderId = (data.riderId as string) || 'TEST_RIDER';

  const rideRef = RIDES.doc(rideId);

  await rideRef.set({
    riderId,
    driverId: null,
    pickup: data.pickup || { lat: 0, lng: 0 },
    dropoff: data.dropoff || { lat: 0, lng: 0 },
    status: 'requested',
    priceCents: data.priceCents || 100,
    createdAtMs: Date.now(),
  });

  return { ok: true };
});

// setDriverOnline: toggles a driver's online state (authoritative)
export async function setDriverOnlineHandler(data: any, context: functions.https.CallableContext, firestoreDb = admin.firestore()) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in');
  }

  const driverId = context.auth.uid;
  const online = Boolean(data.online);

  const driverRef = firestoreDb.collection('drivers').doc(driverId);

  await firestoreDb.runTransaction(async (tx) => {
    const driverSnap = await tx.get(driverRef);
    if (!driverSnap.exists) {
      throw new functions.https.HttpsError('failed-precondition', 'Driver not found');
    }

    const driver = driverSnap.data()!;

    if (!online && driver.isBusy) {
      throw new functions.https.HttpsError('failed-precondition', 'Driver is busy');
    }

    tx.update(driverRef, {
      isOnline: online,
      updatedAtMs: Date.now(),
    });
  });

  return { ok: true };
}

export const setDriverOnline = functions.https.onCall(async (data, context) => setDriverOnlineHandler(data, context));

// driverHeartbeat: updates lastSeenAtMs
export async function driverHeartbeatHandler(_data: any, context: functions.https.CallableContext, firestoreDb = admin.firestore()) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in');
  }

  const driverId = context.auth.uid;
  const driverRef = firestoreDb.collection('drivers').doc(driverId);

  await driverRef.set({ lastSeenAtMs: Date.now() }, { merge: true });
  return { ok: true };
}

export const driverHeartbeat = functions.https.onCall(async (data, context) => driverHeartbeatHandler(data, context));
