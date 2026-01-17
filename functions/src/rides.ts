import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { logRideEvent } from './eventLog';
import { callableOptions as baseCorsOptions } from './cors';

const db = admin.firestore();

// Helper to detect if running in emulator
function isEmulator() {
  return process.env.FUNCTIONS_EMULATOR === 'true' || !!process.env.FIREBASE_EMULATOR_HUB;
}

type StripeMode = 'test' | 'live';

function getStripeMode(): StripeMode {
  if (isEmulator()) return 'test';
  return process.env.STRIPE_MODE === 'live' ? 'live' : 'test';
}

// Define secrets (emulator uses .env.local)
const stripeSecretLive = defineSecret('STRIPE_SECRET_KEY_LIVE');
const stripeSecretTest = defineSecret('STRIPE_SECRET_KEY_TEST');

const callableOptions = isEmulator()
  ? baseCorsOptions
  : {
      ...baseCorsOptions,
      secrets: [stripeSecretLive, stripeSecretTest],
    };

// Get Stripe from environment - MODE AWARE
function getStripe() {
  const emulator = isEmulator();
  const mode = getStripeMode();

  if (emulator) {
    // Emulator: use TEST key from .env.local
    const key = process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new HttpsError('failed-precondition', 'Missing STRIPE_SECRET_KEY_TEST in functions/.env.local');
    }
    if (!key.startsWith('sk_test')) {
      throw new HttpsError('failed-precondition', 'EMULATOR requires TEST key (sk_test_*)');
    }
    console.log('[Rides] Using TEST Stripe key in emulator');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require('stripe');
    return new Stripe(key, { apiVersion: '2023-10-16' });
  }

  if (mode === 'test') {
    const key = stripeSecretTest.value();
    if (!key) {
      throw new HttpsError('failed-precondition', 'Missing STRIPE_SECRET_KEY_TEST in Secret Manager');
    }
    if (!key.startsWith('sk_test')) {
      throw new HttpsError('failed-precondition', 'STRIPE_SECRET_KEY_TEST must be a test key (sk_test_*)');
    }
    console.log('[Rides] Using TEST Stripe key (STRIPE_MODE=test)');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require('stripe');
    return new Stripe(key, { apiVersion: '2023-10-16' });
  }

  // Production: use LIVE key from Secret Manager
  const key = stripeSecretLive.value();
  if (!key) {
    throw new HttpsError('failed-precondition', 'Missing STRIPE_SECRET_KEY_LIVE in Secret Manager');
  }
  if (!key.startsWith('sk_live')) {
    throw new HttpsError('failed-precondition', 'PRODUCTION requires LIVE key (sk_live_*)');
  }
  console.log('[Rides] Using LIVE Stripe key in production');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Stripe = require('stripe');
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

async function assertLivePaymentsAllowed(uid: string, ride: any | null) {
  if (getStripeMode() !== 'live') return;

  const flagsSnap = await db.collection('config').doc('runtimeFlags').get();
  const flags = flagsSnap.data() || {};

  const allowLivePayments = flags.allowLivePayments === true;
  const pilotUids: string[] = Array.isArray(flags.livePaymentPilotUids) ? flags.livePaymentPilotUids : [];

  const driverId = ride?.driverId || null;
  const customerId = ride?.customerId || null;

  const isPilot = pilotUids.includes(uid) || (driverId && pilotUids.includes(driverId)) || (customerId && pilotUids.includes(customerId));

  if (!allowLivePayments || !isPilot) {
    throw new HttpsError(
      'failed-precondition',
      'LIVE payments are disabled. Enable allowLivePayments and whitelist pilot UIDs.'
    );
  }
}

interface TripRequestPayload {
  pickup: {
    lat: number;
    lng: number;
    address?: string;
  };
  dropoff: {
    lat: number;
    lng: number;
    address?: string;
  };
  serviceClass?: 'shiftx' | 'shift_lx' | 'shift_black';
  vehicleClass?: 'shiftx' | 'shift_lx' | 'shift_black'; // alias
  priceCents?: number; // alias
  estimatedFareCents?: number;
  distanceMeters?: number;
  durationSeconds?: number;
  metadata?: Record<string, any>;
}

/**
 * tripRequest - Customer requests a ride
 */
export const tripRequest = onCall<TripRequestPayload>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const {
      pickup,
      dropoff,
      serviceClass,
      vehicleClass,
      estimatedFareCents,
      priceCents,
      distanceMeters,
      durationSeconds,
      metadata,
    } = request.data;

    // Accept either serviceClass or vehicleClass
    const finalServiceClass = serviceClass || vehicleClass;
    const finalPriceCents = estimatedFareCents || priceCents || 0;

    // Validate required fields
    if (!pickup?.lat || !pickup?.lng) {
      throw new HttpsError('invalid-argument', 'Valid pickup location required');
    }
    if (!dropoff?.lat || !dropoff?.lng) {
      throw new HttpsError('invalid-argument', 'Valid dropoff location required');
    }
    if (!finalServiceClass) {
      throw new HttpsError('invalid-argument', 'Service class required');
    }

    // Create ride document
    const rideRef = db.collection('rides').doc();
    const now = Date.now();

    const rideData = {
      rideId: rideRef.id,
      customerId: uid,
      riderId: uid, // alias
      status: 'requested',
      paymentStatus: 'none', // Initialize payment status
      pickup: {
        lat: pickup.lat,
        lng: pickup.lng,
        address: pickup.address || '',
      },
      dropoff: {
        lat: dropoff.lat,
        lng: dropoff.lng,
        address: dropoff.address || '',
      },
      serviceClass: finalServiceClass,
      vehicleClass: finalServiceClass, // alias
      estimatedFareCents: finalPriceCents,
      priceCents: finalPriceCents, // alias
      distanceMeters: distanceMeters || 0,
      durationSeconds: durationSeconds || 0,
      metadata: metadata || {},
      createdAtMs: now,
      updatedAtMs: now,
    };

    await rideRef.set(rideData);

    // Find nearby online drivers and create offers
    try {
      const driversSnap = await db.collection('drivers')
        .where('isOnline', '==', true)
        .where('isBusy', '==', false)
        .get();

      const now = Date.now();
      const batch = db.batch();
      let offersCreated = 0;

      for (const driverDoc of driversSnap.docs) {
        const driver = driverDoc.data();
        
        // Check if driver has location
        if (!driver.location?.lat || !driver.location?.lng) {
          continue;
        }

        // Check if driver has blocked this customer
        try {
          const blockedDoc = await driverDoc.ref
            .collection('blockedCustomers')
            .doc(uid)
            .get();
          
          if (blockedDoc.exists) {
            console.log(`Driver ${driverDoc.id} has blocked customer ${uid}, skipping`);
            continue;
          }
        } catch (error) {
          console.error(`Error checking blocked status for driver ${driverDoc.id}:`, error);
          // Continue anyway - don't let this break matching
        }

        // Check if driver supports this service class
        const driverVehicleClass = driver.vehicleClass || 'shiftx';
        if (!isServiceClassCompatible(finalServiceClass, driverVehicleClass)) {
          continue;
        }

        // Calculate distance (simple haversine)
        const distance = calculateDistance(
          pickup.lat,
          pickup.lng,
          driver.location.lat,
          driver.location.lng
        );

        // Only offer to drivers within 10 miles
        if (distance > 10) {
          continue;
        }

        // Create offer document
        const offerRef = rideRef.collection('offers').doc(driverDoc.id);
        batch.set(offerRef, {
          driverId: driverDoc.id,
          status: 'pending',
          distanceMiles: distance,
          createdAtMs: now,
          expiresAtMs: now + (2 * 60 * 1000), // 2 minutes to respond
        });

        offersCreated++;
      }

      if (offersCreated > 0) {
        await batch.commit();
        console.log(`Created ${offersCreated} offers for ride ${rideRef.id}`);
      }
    } catch (error) {
      console.error('Error creating offers:', error);
      // Don't fail the whole request if offer creation fails
    }

    return {
      rideId: rideRef.id,
      status: 'requested',
    };
  }
);

// Helper: Check if driver's vehicle class can fulfill service class
function isServiceClassCompatible(
  requestedClass: string,
  driverClass: string
): boolean {
  // shift_black can fulfill all requests
  if (driverClass === 'shift_black') return true;
  // shift_lx can fulfill shiftx and shift_lx
  if (driverClass === 'shift_lx') return requestedClass !== 'shift_black';
  // shiftx can only fulfill shiftx
  return requestedClass === 'shiftx';
}

// Helper: Calculate distance in miles using Haversine formula
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

const DRIVER_LOCATION_MAX_AGE_MS = 60 * 1000; // 60s freshness window
const START_RADIUS_M = 200;
const COMPLETE_RADIUS_M = 200;

function calculateDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  return calculateDistance(lat1, lng1, lat2, lng2) * 1609.34;
}

function getDriverLocationFreshness(driverData: any): number | null {
  const lastMs =
    driverData?.lastHeartbeatMs || driverData?.lastSeenAtMs || driverData?.updatedAtMs;
  return typeof lastMs === 'number' ? lastMs : null;
}

/**
 * acceptRide - Driver accepts a ride offer
 */
export const acceptRide = onCall<{ rideId: string }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { rideId } = request.data;
    if (!rideId) {
      throw new HttpsError('invalid-argument', 'rideId required');
    }

    const rideRef = db.collection('rides').doc(rideId);
    const driverRef = db.collection('drivers').doc(uid);

    try {
      await db.runTransaction(async (transaction) => {
        const rideSnap = await transaction.get(rideRef);
        const driverSnap = await transaction.get(driverRef);

        if (!rideSnap.exists) {
          throw new HttpsError('not-found', 'Ride not found');
        }
        if (!driverSnap.exists) {
          throw new HttpsError('not-found', 'Driver profile not found');
        }

        const ride = rideSnap.data();
        const driver = driverSnap.data();

        // GUARD: Check if ride is in valid state
        if (ride?.status === 'cancelled') {
          throw new HttpsError('failed-precondition', 'RIDE_CANCELLED: This ride has been cancelled');
        }
        if (ride?.status === 'completed') {
          throw new HttpsError('failed-precondition', 'RIDE_COMPLETED: This ride is already completed');
        }
        if (ride?.driverId && ride?.driverId !== uid) {
          throw new HttpsError('failed-precondition', 'RIDE_TAKEN: This ride has already been accepted by another driver');
        }
        if (ride?.status !== 'requested' && ride?.status !== 'offered') {
          throw new HttpsError('failed-precondition', `INVALID_STATUS: Ride is ${ride?.status}, cannot accept`);
        }

        // GUARD: Check if driver is available
        if (driver?.isBusy) {
          throw new HttpsError('failed-precondition', 'DRIVER_BUSY: You are already busy with another ride');
        }
        if (!driver?.isOnline) {
          throw new HttpsError('failed-precondition', 'DRIVER_OFFLINE: You must be online to accept rides');
        }
        if (!driver?.approved) {
          throw new HttpsError('permission-denied', 'DRIVER_NOT_APPROVED: Your driver account is not approved');
        }

        const now = Date.now();

        // Update ride - set payment status to requires_authorization
        transaction.update(rideRef, {
          status: 'accepted',
          driverId: uid,
          acceptedAtMs: now,
          paymentStatus: 'requires_authorization',
          updatedAtMs: now,
        });

        // Update driver
        transaction.update(driverRef, {
          isBusy: true,
          currentRideId: rideId,
          currentRideStatus: 'accepted',
          updatedAtMs: now,
        });
      });

      // After transaction: Mark all other pending offers as taken
      // (This is best-effort cleanup, not in transaction to avoid conflicts)
      const afterTxnNow = Date.now();
      try {
        const otherOffers = await rideRef.collection('offers').where('status', '==', 'pending').get();
        const batch = db.batch();
        otherOffers.docs.forEach((offerDoc) => {
          // Don't update the accepted driver's offer
          if (offerDoc.id !== uid) {
            batch.update(offerDoc.ref, {
              status: 'taken_by_other',
              takenAtMs: afterTxnNow,
              updatedAtMs: afterTxnNow,
            });
          }
        });
        if (!otherOffers.empty) {
          await batch.commit();
          console.log(`[acceptRide] Marked ${otherOffers.size - 1} other offers as taken_by_other`);
        }
      } catch (error) {
        console.error('[acceptRide] Failed to mark other offers as taken:', error);
        // Don't fail the whole operation if this cleanup fails
      }

      // Log event after successful transaction
      await logRideEvent(rideId, 'ride_accepted', { driverId: uid });

      return { ok: true };
    } catch (error: any) {
      if (error.code) throw error;
      throw new HttpsError('internal', error.message || 'Transaction failed');
    }
  }
);

/**
 * declineOffer - Driver declines a ride offer
 */
export const declineOffer = onCall<{ rideId: string }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { rideId } = request.data;
    if (!rideId) {
      throw new HttpsError('invalid-argument', 'rideId required');
    }

    const offerRef = db.collection('rides').doc(rideId).collection('offers').doc(uid);
    const offerSnap = await offerRef.get();

    if (!offerSnap.exists) {
      throw new HttpsError('not-found', 'Offer not found');
    }

    const offer = offerSnap.data();
    
    // Only allow declining pending offers
    if (offer?.status !== 'pending') {
      throw new HttpsError('failed-precondition', `Offer is ${offer?.status}, cannot decline`);
    }

    const now = Date.now();

    // Update offer to declined
    await offerRef.update({
      status: 'declined',
      declinedAtMs: now,
      updatedAtMs: now,
    });

    return { ok: true };
  }
);

/**
 * startRide - Driver starts the ride (picks up customer)
 */
export const startRide = onCall<{ rideId: string }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { rideId } = request.data;
    if (!rideId) {
      throw new HttpsError('invalid-argument', 'rideId required');
    }

    const rideRef = db.collection('rides').doc(rideId);

    try {
      await db.runTransaction(async (transaction) => {
        const rideSnap = await transaction.get(rideRef);

        if (!rideSnap.exists) {
          throw new HttpsError('not-found', 'Ride not found');
        }

        const ride = rideSnap.data();

        // Verify driver is assigned to this ride
        if (ride?.driverId !== uid) {
          throw new HttpsError('permission-denied', 'Not authorized to start this ride');
        }

        // Check if ride is in correct status
        if (ride?.status !== 'accepted') {
          throw new HttpsError('failed-precondition', `Ride is ${ride?.status}, must be accepted to start`);
        }

        // GUARD: Check if payment is authorized
        const paymentStatus = ride?.paymentStatus;
        if (paymentStatus !== 'authorized') {
          throw new HttpsError(
            'failed-precondition',
            `PAYMENT_NOT_AUTHORIZED: Payment must be authorized before starting ride. Current status: ${paymentStatus || 'none'}`
          );
        }

        // GUARD: Driver must be near pickup with fresh location
        const driverRef = db.collection('drivers').doc(uid);
        const driverSnap = await transaction.get(driverRef);
        const driverData = driverSnap.data();
        const lastLocationMs = getDriverLocationFreshness(driverData);
        if (!lastLocationMs) {
          throw new HttpsError('failed-precondition', 'STALE_DRIVER_LOCATION: No recent driver location available');
        }
        const ageMs = Date.now() - lastLocationMs;
        if (ageMs > DRIVER_LOCATION_MAX_AGE_MS) {
          throw new HttpsError(
            'failed-precondition',
            `STALE_DRIVER_LOCATION: Last update ${Math.round(ageMs / 1000)}s ago`
          );
        }
        if (!driverData?.location?.lat || !driverData?.location?.lng) {
          throw new HttpsError('failed-precondition', 'MISSING_DRIVER_LOCATION: Driver location missing');
        }
        if (!ride?.pickup?.lat || !ride?.pickup?.lng) {
          throw new HttpsError('failed-precondition', 'MISSING_PICKUP: Ride pickup missing');
        }
        const distanceToPickupM = calculateDistanceMeters(
          driverData.location.lat,
          driverData.location.lng,
          ride.pickup.lat,
          ride.pickup.lng
        );
        if (distanceToPickupM > START_RADIUS_M) {
          throw new HttpsError(
            'failed-precondition',
            `TOO_FAR_FROM_PICKUP: ${Math.round(distanceToPickupM)}m from pickup`
          );
        }

        const now = Date.now();

        // Update ride to started
        transaction.update(rideRef, {
          status: 'started',
          startedAtMs: now,
          updatedAtMs: now,
        });

        // Update driver status
        transaction.update(driverRef, {
          currentRideStatus: 'started',
          updatedAtMs: now,
        });
      });

      // Log event
      await logRideEvent(rideId, 'ride_started', { driverId: uid });

      console.log('[startRide] Ride started:', { rideId, driverId: uid });
      return { ok: true, status: 'started' };
    } catch (error: any) {
      console.error('[startRide] Error:', error);
      if (error.code) throw error;
      throw new HttpsError('internal', error.message || 'Transaction failed');
    }
  }
);

/**
 * progressRide - Transition ride to in_progress (driver begins driving to dropoff)
 */
export const progressRide = onCall<{ rideId: string }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { rideId } = request.data;
    if (!rideId) {
      throw new HttpsError('invalid-argument', 'rideId required');
    }

    const rideRef = db.collection('rides').doc(rideId);

    try {
      await db.runTransaction(async (transaction) => {
        const rideSnap = await transaction.get(rideRef);

        if (!rideSnap.exists) {
          throw new HttpsError('not-found', 'Ride not found');
        }

        const ride = rideSnap.data();

        // Verify driver is assigned to this ride
        if (ride?.driverId !== uid) {
          throw new HttpsError('permission-denied', 'Not authorized to update this ride');
        }

        // Check if ride is in correct status
        if (ride?.status !== 'started') {
          throw new HttpsError('failed-precondition', `Ride is ${ride?.status}, must be started to progress`);
        }

        const now = Date.now();

        // Update ride to in_progress
        transaction.update(rideRef, {
          status: 'in_progress',
          inProgressAtMs: now,
          updatedAtMs: now,
        });

        // Update driver status
        const driverRef = db.collection('drivers').doc(uid);
        transaction.update(driverRef, {
          currentRideStatus: 'in_progress',
          updatedAtMs: now,
        });
      });

      // Log event
      await logRideEvent(rideId, 'ride_in_progress', { driverId: uid });

      console.log('[progressRide] Ride progressed to in_progress:', { rideId, driverId: uid });
      return { ok: true, status: 'in_progress' };
    } catch (error: any) {
      console.error('[progressRide] Error:', error);
      if (error.code) throw error;
      throw new HttpsError('internal', error.message || 'Transaction failed');
    }
  }
);

/**
 * updateRideStatus - Update ride to in_progress (after starting trip)
 */
export const updateRideStatus = onCall<{ rideId: string; status: 'in_progress' | 'completed' }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { rideId, status } = request.data;
    if (!rideId || !status) {
      throw new HttpsError('invalid-argument', 'rideId and status required');
    }

    const rideRef = db.collection('rides').doc(rideId);

    try {
      await db.runTransaction(async (transaction) => {
        const rideSnap = await transaction.get(rideRef);

        if (!rideSnap.exists) {
          throw new HttpsError('not-found', 'Ride not found');
        }

        const ride = rideSnap.data();

        // Verify driver is assigned to this ride
        if (ride?.driverId !== uid) {
          throw new HttpsError('permission-denied', 'Not authorized to update this ride');
        }

        // Validate status transitions
        const validTransitions: Record<string, string[]> = {
          'accepted': ['started'],
          'started': ['in_progress'],
          'in_progress': ['completed'],
        };

        if (!validTransitions[ride?.status || '']?.includes(status)) {
          throw new HttpsError(
            'failed-precondition',
            `Cannot transition from ${ride?.status} to ${status}`
          );
        }

        const now = Date.now();
        const updates: any = {
          status,
          updatedAtMs: now,
        };

        // Add timestamp for specific statuses
        if (status === 'in_progress' && !ride?.inProgressAtMs) {
          updates.inProgressAtMs = now;
        } else if (status === 'completed') {
          updates.completedAtMs = now;
        }

        // Update ride
        transaction.update(rideRef, updates);

        // Update driver status
        const driverRef = db.collection('drivers').doc(uid);
        if (status === 'completed') {
          // Release driver
          transaction.update(driverRef, {
            isBusy: false,
            currentRideId: null,
            currentRideStatus: null,
            updatedAtMs: now,
          });
        } else {
          transaction.update(driverRef, {
            currentRideStatus: status,
            updatedAtMs: now,
          });
        }
      });

      console.log('[updateRideStatus] Ride updated:', { rideId, status, driverId: uid });
      return { ok: true, status };
    } catch (error: any) {
      console.error('[updateRideStatus] Error:', error);
      if (error.code) throw error;
      throw new HttpsError('internal', error.message || 'Transaction failed');
    }
  }
);

/**
 * completeRide - Mark ride as completed and capture payment
 */
export const completeRide = onCall<{ rideId: string }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { rideId } = request.data;
    if (!rideId) {
      throw new HttpsError('invalid-argument', 'rideId required');
    }

    const rideRef = db.collection('rides').doc(rideId);

    try {
      let paymentIntentId: string | null = null;
      let currentPaymentStatus: string | null = null;

      await db.runTransaction(async (transaction) => {
        const rideSnap = await transaction.get(rideRef);

        if (!rideSnap.exists) {
          throw new HttpsError('not-found', 'Ride not found');
        }

        const ride = rideSnap.data();

        // Verify driver is assigned to this ride
        if (ride?.driverId !== uid) {
          throw new HttpsError('permission-denied', 'Not authorized to complete this ride');
        }

        // Check if ride is in progress
        if (ride?.status !== 'in_progress') {
          throw new HttpsError('failed-precondition', `Ride is ${ride?.status}, must be in_progress to complete`);
        }

        // GUARD: Prevent double-completion
        if (ride?.paymentStatus === 'captured') {
          throw new HttpsError(
            'failed-precondition',
            'PAYMENT_ALREADY_CAPTURED: This ride has already been completed and payment captured'
          );
        }

        // GUARD: Check payment is authorized before completing
        currentPaymentStatus = ride?.paymentStatus;
        if (currentPaymentStatus !== 'authorized') {
          throw new HttpsError(
            'failed-precondition',
            `PAYMENT_NOT_AUTHORIZED: Payment must be authorized before completing ride. Current status: ${currentPaymentStatus}`
          );
        }

        // GUARD: Driver must be near dropoff with fresh location
        const driverRef = db.collection('drivers').doc(uid);
        const driverSnap = await transaction.get(driverRef);
        const driverData = driverSnap.data();
        const lastLocationMs = getDriverLocationFreshness(driverData);
        if (!lastLocationMs) {
          throw new HttpsError('failed-precondition', 'STALE_DRIVER_LOCATION: No recent driver location available');
        }
        const ageMs = Date.now() - lastLocationMs;
        if (ageMs > DRIVER_LOCATION_MAX_AGE_MS) {
          throw new HttpsError(
            'failed-precondition',
            `STALE_DRIVER_LOCATION: Last update ${Math.round(ageMs / 1000)}s ago`
          );
        }
        if (!driverData?.location?.lat || !driverData?.location?.lng) {
          throw new HttpsError('failed-precondition', 'MISSING_DRIVER_LOCATION: Driver location missing');
        }
        if (!ride?.dropoff?.lat || !ride?.dropoff?.lng) {
          throw new HttpsError('failed-precondition', 'MISSING_DROPOFF: Ride dropoff missing');
        }
        const distanceToDropoffM = calculateDistanceMeters(
          driverData.location.lat,
          driverData.location.lng,
          ride.dropoff.lat,
          ride.dropoff.lng
        );
        if (distanceToDropoffM > COMPLETE_RADIUS_M) {
          throw new HttpsError(
            'failed-precondition',
            `TOO_FAR_FROM_DROPOFF: ${Math.round(distanceToDropoffM)}m from dropoff`
          );
        }

        paymentIntentId = ride?.stripePaymentIntentId || ride?.paymentIntentId;
        await assertLivePaymentsAllowed(uid, ride);

        const now = Date.now();

        // Calculate final amount (use priceCents if available)
        const priceCents = ride?.priceCents || 0;
        const finalAmountCents = priceCents;

        // Update ride to completed (payment will be captured outside transaction)
        transaction.update(rideRef, {
          status: 'completed',
          completedAtMs: now,
          finalAmountCents,
          updatedAtMs: now,
        });

        // Release driver
        transaction.update(driverRef, {
          isBusy: false,
          currentRideId: null,
          currentRideStatus: null,
          updatedAtMs: now,
        });

        // Create ledger entry for driver earnings
        const ledgerRef = db.collection('drivers').doc(uid).collection('ledger').doc();
        transaction.set(ledgerRef, {
          type: 'trip_earning',
          rideId,
          amountCents: finalAmountCents,
          createdAtMs: now,
          status: 'completed',
          description: `Ride ${rideId.substring(0, 8)}`,
        });
      });

      console.log('[completeRide] Ride completed:', { rideId, driverId: uid });
      
      // Log event
      await logRideEvent(rideId, 'ride_completed', { driverId: uid });
      
      // Capture payment (only if authorized and not already captured)
      if (paymentIntentId && currentPaymentStatus === 'authorized') {
        try {
          const stripe = getStripe();
          const captureResult = await stripe.paymentIntents.capture(paymentIntentId);
          
          console.log('[completeRide] Payment captured:', {
            paymentIntentId,
            status: captureResult.status,
          });

          // Update ride with captured payment status
          await rideRef.update({
            paymentStatus: 'captured',
            'payment.capturedAt': Date.now(),
            updatedAtMs: Date.now(),
          });

          // Fallback: if Connect routing wasn't attached at PI creation, create a transfer now
          try {
            const rideAfterSnap = await rideRef.get();
            const rideAfter = rideAfterSnap.data();
            const connectDestination = rideAfter?.transferDestination || rideAfter?.stripeConnectAccountId;
            const driverPayoutCents = rideAfter?.driverPayoutCents;

            const hasDestinationCharge = !!captureResult.transfer_data?.destination;
            const alreadyTransferred = !!rideAfter?.connectTransferId;

            if (connectDestination && driverPayoutCents && !hasDestinationCharge && !alreadyTransferred) {
              const chargeId = captureResult.charges?.data?.[0]?.id;
              if (chargeId) {
                const transfer = await stripe.transfers.create({
                  amount: driverPayoutCents,
                  currency: 'usd',
                  destination: connectDestination,
                  source_transaction: chargeId,
                  transfer_group: `ride_${rideId}`,
                  metadata: {
                    rideId,
                    driverId: uid,
                  },
                });

                await rideRef.update({
                  connectTransferId: transfer.id,
                  connectTransferCreatedAtMs: Date.now(),
                  updatedAtMs: Date.now(),
                });

                console.log('[completeRide] Created transfer for Connect payout:', {
                  rideId,
                  transferId: transfer.id,
                  destination: connectDestination,
                  amount: driverPayoutCents,
                });
              } else {
                console.warn('[completeRide] No charge ID found; skipping transfer creation', { rideId });
              }
            }
          } catch (transferError: any) {
            console.error('[completeRide] Transfer creation failed:', transferError);
          }
        } catch (error: any) {
          console.error('[completeRide] Payment capture failed:', error);
          // Don't fail the entire completion if capture fails
          // Admin can manually capture later
          await rideRef.update({
            paymentStatus: 'capture_failed',
            'payment.captureError': error.message,
            updatedAtMs: Date.now(),
          });
        }
      }

      return { ok: true, status: 'completed' };
    } catch (error: any) {
      console.error('[completeRide] Error:', error);
      if (error.code) throw error;
      throw new HttpsError('internal', error.message || 'Transaction failed');
    }
  }
);

/**
 * cancelRide - Cancel a ride
 */
export const cancelRide = onCall<{ rideId: string; reason?: string }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { rideId, reason } = request.data;
    if (!rideId) {
      throw new HttpsError('invalid-argument', 'rideId required');
    }

    const rideRef = db.collection('rides').doc(rideId);

    try {
      let paymentIntentId: string | null = null;
      let currentPaymentStatus: string | null = null;

      await db.runTransaction(async (transaction) => {
        const rideSnap = await transaction.get(rideRef);

        if (!rideSnap.exists) {
          throw new HttpsError('not-found', 'Ride not found');
        }

        const ride = rideSnap.data();

        // GUARD: Check if ride can be cancelled
        if (ride?.status === 'completed') {
          throw new HttpsError('failed-precondition', 'RIDE_COMPLETED: Cannot cancel a completed ride');
        }
        if (ride?.status === 'cancelled') {
          throw new HttpsError('failed-precondition', 'RIDE_ALREADY_CANCELLED: Ride is already cancelled');
        }

        // GUARD: Check permissions (customer can't cancel after ride started)
        const isCustomer = ride?.customerId === uid;
        const isDriver = ride?.driverId === uid;

        if (!isCustomer && !isDriver) {
          throw new HttpsError('permission-denied', 'NOT_AUTHORIZED: Not authorized to cancel this ride');
        }

        // GUARD: Customer cannot cancel after ride has started
        if (isCustomer && (ride?.status === 'started' || ride?.status === 'in_progress')) {
          throw new HttpsError(
            'permission-denied',
            'RIDE_STARTED: Customer cannot cancel after passenger is in the ride'
          );
        }

        paymentIntentId = ride?.stripePaymentIntentId || ride?.paymentIntentId;
        currentPaymentStatus = ride?.paymentStatus;

        const now = Date.now();

        // Update ride
        transaction.update(rideRef, {
          status: 'cancelled',
          cancelReason: reason || 'user_cancelled',
          cancelledBy: uid,
          cancelledAtMs: now,
          paymentStatus: 'cancelled',
          updatedAtMs: now,
        });

        // If driver was assigned, release them
        if (ride?.driverId) {
          const driverRef = db.collection('drivers').doc(ride.driverId);
          transaction.update(driverRef, {
            isBusy: false,
            currentRideId: null,
            currentRideStatus: null,
            updatedAtMs: now,
          });
        }
      });

      // Cancel payment intent if it exists and hasn't been captured
      if (paymentIntentId && currentPaymentStatus !== 'captured') {
        try {
          const stripe = getStripe();
          
          // Check if PI is in a cancellable state
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          
          // Only cancel if not already in terminal state
          const canCancel = 
            paymentIntent.status !== 'succeeded' &&
            paymentIntent.status !== 'canceled';
          
          if (canCancel) {
            await stripe.paymentIntents.cancel(paymentIntentId, {
              cancellation_reason: reason === 'user_cancelled' ? 'requested_by_customer' : 'abandoned',
            });
            
            console.log('[cancelRide] Payment intent cancelled:', { 
              paymentIntentId, 
              rideId,
              reason: reason || 'user_cancelled',
              previousStatus: paymentIntent.status
            });
            
            // Log payment cancellation event
            await logRideEvent(rideId, 'payment_cancelled', {
              reason: reason || 'user_cancelled',
              cancelledBy: uid,
              paymentIntentId,
              previousStatus: paymentIntent.status,
            });
          } else {
            console.log('[cancelRide] Payment intent already in terminal state:', { 
              paymentIntentId,
              status: paymentIntent.status 
            });
          }
        } catch (error: any) {
          console.error('[cancelRide] Payment cancellation failed:', {
            error: error.message,
            paymentIntentId,
            rideId,
          });
          // Don't fail ride cancellation if payment cancel fails
          // The PI will auto-expire or be handled by cleanup job
        }
      }

      // Log ride cancellation event
      await logRideEvent(rideId, 'ride_cancelled', {
        reason: reason || 'user_cancelled',
        cancelledBy: uid,
      });

      return { ok: true };
    } catch (error: any) {
      if (error.code) throw error;
      throw new HttpsError('internal', error.message || 'Transaction failed');
    }
  }
);

/**
 * cancelActiveRide - Cancel a ride that is already in progress
 * Handles cancellation during 'started' or 'in_progress' status
 * Triggers refund if payment was captured
 */
export const cancelActiveRide = onCall<{ rideId: string; reason: string }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { rideId, reason } = request.data;
    if (!rideId || !reason) {
      throw new HttpsError('invalid-argument', 'rideId and reason required');
    }

    const rideRef = db.collection('rides').doc(rideId);

    try {
      let paymentIntentId: string | null = null;
      let currentPaymentStatus: string | null = null;
      let amountCaptured: number | null = null;

      await db.runTransaction(async (transaction) => {
        const rideSnap = await transaction.get(rideRef);

        if (!rideSnap.exists) {
          throw new HttpsError('not-found', 'Ride not found');
        }

        const ride = rideSnap.data();

        // GUARD: Check if ride can be cancelled
        if (ride?.status === 'completed') {
          throw new HttpsError('failed-precondition', 'Cannot cancel a completed ride');
        }
        if (ride?.status === 'cancelled') {
          throw new HttpsError('failed-precondition', 'Ride is already cancelled');
        }

        // GUARD: Check permissions
        const isCustomer = ride?.customerId === uid;
        const isDriver = ride?.driverId === uid;

        if (!isCustomer && !isDriver) {
          throw new HttpsError('permission-denied', 'Not authorized to cancel this ride');
        }

        // GUARD: Only allow cancellation of started/in_progress rides
        if (ride?.status !== 'started' && ride?.status !== 'in_progress') {
          throw new HttpsError(
            'failed-precondition',
            'This function is only for canceling active rides. Use cancelRide for other statuses.'
          );
        }

        paymentIntentId = ride?.stripePaymentIntentId || ride?.paymentIntentId;
        currentPaymentStatus = ride?.paymentStatus;
        amountCaptured = ride?.totalChargeCents || null;

        const now = Date.now();

        // Update ride
        transaction.update(rideRef, {
          status: 'cancelled',
          cancelReason: reason,
          cancelledBy: uid,
          cancelledAtMs: now,
          paymentStatus: currentPaymentStatus === 'captured' ? 'refunding' : 'cancelled',
          updatedAtMs: now,
        });

        // Release driver
        if (ride?.driverId) {
          const driverRef = db.collection('drivers').doc(ride.driverId);
          transaction.update(driverRef, {
            isBusy: false,
            currentRideId: null,
            currentRideStatus: null,
            updatedAtMs: now,
          });
        }
      });

      // Handle payment refund if payment was captured
      if (paymentIntentId && currentPaymentStatus === 'captured' && amountCaptured) {
        try {
          const stripe = getStripe();
          
          // Create refund
          const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
            reason: 'requested_by_customer',
          });
          
          console.log('[cancelActiveRide] Refund created:', {
            refundId: refund.id,
            paymentIntentId,
            amount: refund.amount,
            status: refund.status,
          });
          
          // Update ride with refund info
          await rideRef.update({
            paymentStatus: 'refunded',
            refundId: refund.id,
            refundedAtMs: Date.now(),
            refundAmountCents: refund.amount,
          });
          
          // Log refund event
          await logRideEvent(rideId, 'payment_refunded', {
            refundId: refund.id,
            amount: refund.amount,
            reason,
            cancelledBy: uid,
          });
        } catch (error: any) {
          console.error('[cancelActiveRide] Refund failed:', {
            error: error.message,
            paymentIntentId,
            rideId,
          });
          
          // Update status to indicate refund is pending/failed
          await rideRef.update({
            paymentStatus: 'refund_failed',
            refundError: error.message,
          });
          
          throw new HttpsError('internal', `Ride cancelled but refund failed: ${error.message}`);
        }
      } else if (paymentIntentId && currentPaymentStatus !== 'captured') {
        // Payment not captured yet, just cancel it
        try {
          const stripe = getStripe();
          await stripe.paymentIntents.cancel(paymentIntentId, {
            cancellation_reason: 'requested_by_customer',
          });
          
          await logRideEvent(rideId, 'payment_cancelled', {
            reason,
            cancelledBy: uid,
            paymentIntentId,
          });
        } catch (error: any) {
          console.error('[cancelActiveRide] Payment cancellation failed:', {
            error: error.message,
            paymentIntentId,
          });
          // Don't fail the cancellation
        }
      }

      // Log ride cancellation event
      await logRideEvent(rideId, 'ride_cancelled', {
        reason,
        cancelledBy: uid,
        wasActive: true,
      });

      return { 
        ok: true,
        refunded: currentPaymentStatus === 'captured',
      };
    } catch (error: any) {
      if (error.code) throw error;
      throw new HttpsError('internal', error.message || 'Cancellation failed');
    }
  }
);

/**
 * getRideEvents - Get events for a ride
 */
export const getRideEvents = onCall<{ rideId: string }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { rideId } = request.data;
    if (!rideId) {
      throw new HttpsError('invalid-argument', 'rideId required');
    }

    // Verify user has access to this ride
    const rideRef = db.collection('rides').doc(rideId);
    const rideSnap = await rideRef.get();

    if (!rideSnap.exists) {
      throw new HttpsError('not-found', 'Ride not found');
    }

    const ride = rideSnap.data();
    if (ride?.customerId !== uid && ride?.driverId !== uid) {
      throw new HttpsError('permission-denied', 'Not authorized to view this ride');
    }

    // Get events subcollection
    const eventsSnap = await rideRef.collection('events').orderBy('atMs', 'asc').get();
    
    const events = eventsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { events };
  }
);

/**
 * getRideHistory - Get customer's ride history
 */
interface HistoricalRide {
  rideId: string;
  status: string;
  priceCents: number;
  finalAmountCents?: number;
  paymentStatus?: string;
  serviceClass?: string;
  createdAtMs: number;
  cancelReason?: string;
  pickup?: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number };
  completedAtMs?: number;
  cancelledAtMs?: number;
}

export const getRideHistory = onCall<{ limit?: number }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const limit = request.data?.limit || 10;

    // Query rides for this customer
    const ridesSnapshot = await db
      .collection('rides')
      .where('customerId', '==', uid)
      .orderBy('createdAtMs', 'desc')
      .limit(limit)
      .get();

    const rides: HistoricalRide[] = [];

    ridesSnapshot.forEach((doc) => {
      const data = doc.data();
      const ride: HistoricalRide = {
        rideId: doc.id,
        status: data.status || 'unknown',
        priceCents: data.priceCents || data.estimatedFareCents || 0,
        finalAmountCents: data.finalAmountCents,
        paymentStatus: data.paymentStatus || data.payment?.status,
        serviceClass: data.serviceClass || data.vehicleClass,
        createdAtMs: data.createdAtMs || 0,
        cancelReason: data.cancelReason,
        pickup: data.pickup,
        dropoff: data.dropoff,
        completedAtMs: data.completedAtMs,
        cancelledAtMs: data.cancelledAtMs,
      };
      rides.push(ride);
    });

    return { rides };
  }
);

