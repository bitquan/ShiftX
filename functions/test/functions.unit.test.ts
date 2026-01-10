import { expect } from 'chai';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import 'mocha';
import * as functions from 'firebase-functions';

// Ensure tests run against emulator; set defaults if not provided
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-no-project';

let tripRequestHandler: any;
let acceptRideHandler: any;
let startRideHandler: any;
let progressRideHandler: any;
let completeRideHandler: any;
let cancelRideHandler: any;
let processRideOfferTimeout: any;
let processOfferTimeouts: any;

describe('Cloud Functions unit tests', function () {
  this.timeout(10000);

  let db: FirebaseFirestore.Firestore;

  beforeEach(async () => {
    const mod = await import('../lib/index.js');
    tripRequestHandler = mod.tripRequestHandler;
    acceptRideHandler = mod.acceptRideHandler;
    startRideHandler = mod.startRideHandler;
    progressRideHandler = mod.progressRideHandler;
    completeRideHandler = mod.completeRideHandler;
    cancelRideHandler = mod.cancelRideHandler;
    processRideOfferTimeout = mod.processRideOfferTimeout;
    processOfferTimeouts = mod.processOfferTimeouts;

    try {
      if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
    } catch (e: any) {
      // already initialized
    }
    db = getFirestore();

    const rides = await db.collection('rides').listDocuments();
    await Promise.all(rides.map((d) => d.delete()));
    const drivers = await db.collection('drivers').listDocuments();
    await Promise.all(drivers.map((d) => d.delete()));
  });

  const ensureDriver = async (driverId: string) => {
    await db.collection('drivers').doc(driverId).set({
      isOnline: true,
      isBusy: false,
      updatedAtMs: Date.now(),
    });
  };

  it('tripRequest + matching produces offers', async () => {
    await ensureDriver('driver1');
    const riderCtx = { auth: { uid: 'rider1' } } as any as functions.https.CallableContext;
    const { rideId } = await tripRequestHandler({
      pickup: { lat: 0, lng: 0 },
      dropoff: { lat: 1, lng: 1 },
      priceCents: 100,
    }, riderCtx, db);

    const ride = (await db.collection('rides').doc(rideId).get()).data()!;
    expect(ride.status).to.equal('offered');

    const offer = await db.collection('rides').doc(rideId).collection('offers').doc('driver1').get();
    expect(offer.exists).to.equal(true);
    expect(offer.data()?.status).to.equal('pending');
  });

  it('happy path: accept -> start -> progress -> complete', async () => {
    await ensureDriver('driver1');
    const riderCtx = { auth: { uid: 'rider1' } } as any as functions.https.CallableContext;
    const { rideId } = await tripRequestHandler({
      pickup: { lat: 0, lng: 0 },
      dropoff: { lat: 1, lng: 1 },
      priceCents: 100,
    }, riderCtx, db);

    const driverCtx = { auth: { uid: 'driver1' } } as any as functions.https.CallableContext;
    await acceptRideHandler({ rideId }, driverCtx, db);
    await startRideHandler({ rideId }, driverCtx, db);
    await progressRideHandler({ rideId }, driverCtx, db);
    await completeRideHandler({ rideId }, driverCtx, db);

    const finalRide = (await db.collection('rides').doc(rideId).get()).data()!;
    expect(finalRide.status).to.equal('completed');

    const driver = (await db.collection('drivers').doc('driver1').get()).data()!;
    expect(driver.isBusy).to.equal(false);
  });

  it('double-accept concurrency: only one driver wins', async () => {
    await ensureDriver('d1');
    await ensureDriver('d2');
    const riderCtx = { auth: { uid: 'rider2' } } as any as functions.https.CallableContext;
    const { rideId } = await tripRequestHandler({ pickup: { lat: 0, lng: 0 }, dropoff: { lat: 0, lng: 0 }, priceCents: 100 }, riderCtx, db);

    const ctx1 = { auth: { uid: 'd1' } } as any as functions.https.CallableContext;
    const ctx2 = { auth: { uid: 'd2' } } as any as functions.https.CallableContext;

    const p1 = acceptRideHandler({ rideId }, ctx1, db).then(() => ({ ok: true, driver: 'd1' })).catch((e: any) => ({ ok: false, err: e, driver: 'd1' }));
    const p2 = acceptRideHandler({ rideId }, ctx2, db).then(() => ({ ok: true, driver: 'd2' })).catch((e: any) => ({ ok: false, err: e, driver: 'd2' }));

    const results = await Promise.all([p1, p2]);
    const failed = results.find((r) => !r.ok);
    expect(failed).to.exist;
    const fe = (failed as any).err;
    expect(fe).to.have.property('code');
    expect(['failed-precondition', 'aborted', 'already-exists']).to.include(fe.code);

    const successes = results.filter((r) => r.ok);
    expect(successes.length).to.equal(1);

    const riderRide = (await db.collection('rides').doc(rideId).get()).data()!;
    expect(riderRide.driverId).to.equal(successes[0].driver);
  });

  it('tripAccept requires a pending offer', async () => {
    await db.collection('drivers').doc('d3').set({ isOnline: true, isBusy: false });
    await db.collection('rides').doc('r3').set({ riderId: 'rider3', status: 'offered' });

    const ctx = { auth: { uid: 'd3' } } as any as functions.https.CallableContext;
    try {
      await acceptRideHandler({ rideId: 'r3' }, ctx, db);
      throw new Error('expected failed-precondition');
    } catch (e: any) {
      expect(e).to.have.property('code', 'failed-precondition');
    }
  });

  it('tripCancel releases driver lock', async () => {
    await ensureDriver('driver2');
    const riderCtx = { auth: { uid: 'rider4' } } as any as functions.https.CallableContext;
    const { rideId } = await tripRequestHandler({
      pickup: { lat: 0, lng: 0 },
      dropoff: { lat: 0, lng: 0 },
      priceCents: 100,
    }, riderCtx, db);

    const driverCtx = { auth: { uid: 'driver2' } } as any as functions.https.CallableContext;
    await acceptRideHandler({ rideId }, driverCtx, db);
    await cancelRideHandler({ rideId, reason: 'test' }, driverCtx, db);

    const ride = (await db.collection('rides').doc(rideId).get()).data()!;
    expect(ride.status).to.equal('cancelled');

    const driver = (await db.collection('drivers').doc('driver2').get()).data()!;
    expect(driver.isBusy).to.equal(false);
  });

  it('auth enforcement: unauthenticated accept fails', async () => {
    await ensureDriver('d4');
    const riderCtx = { auth: { uid: 'rider5' } } as any as functions.https.CallableContext;
    const { rideId } = await tripRequestHandler({ pickup: { lat: 0, lng: 0 }, dropoff: { lat: 0, lng: 0 }, priceCents: 100 }, riderCtx, db);

    const ctx = { auth: null } as any as functions.https.CallableContext;
    try {
      await acceptRideHandler({ rideId }, ctx, db);
      throw new Error('expected unauthenticated');
    } catch (e: any) {
      expect(e).to.have.property('code', 'unauthenticated');
    }
  });

  it('invalid transitions fail (start before accept)', async () => {
    await ensureDriver('d5');
    const rideId = 'r4';
    await db.collection('rides').doc(rideId).set({ riderId: 'rider6', status: 'requested' });
    const ctx = { auth: { uid: 'd5' } } as any as functions.https.CallableContext;
    try {
      await startRideHandler({ rideId }, ctx, db);
      throw new Error('expected failed-precondition');
    } catch (e: any) {
      expect(e).to.have.property('code', 'failed-precondition');
    }
  });

  describe('Matching logic', () => {
    it('only dispatches to online, non-busy drivers', async () => {
      await db.collection('drivers').doc('d-online-busy').set({ isOnline: true, isBusy: true });
      await db.collection('drivers').doc('d-offline').set({ isOnline: false, isBusy: false });
      await db.collection('drivers').doc('d-online-free').set({ isOnline: true, isBusy: false });

      const riderCtx = { auth: { uid: 'rider7' } } as any as functions.https.CallableContext;
      const { rideId } = await tripRequestHandler({
        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 1, lng: 1 },
        priceCents: 100,
      }, riderCtx, db);

      const offers = await db.collection('rides').doc(rideId).collection('offers').get();
      const offerDrivers = offers.docs.map(d => d.id);
      
      expect(offerDrivers).to.include('d-online-free');
      expect(offerDrivers).to.not.include('d-online-busy');
      expect(offerDrivers).to.not.include('d-offline');
    });

    it('limits offers to OFFERS_PER_BATCH drivers', async () => {
      for (let i = 0; i < 10; i++) {
        await db.collection('drivers').doc(`driver-${i}`).set({ isOnline: true, isBusy: false });
      }

      const riderCtx = { auth: { uid: 'rider8' } } as any as functions.https.CallableContext;
      const { rideId } = await tripRequestHandler({
        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 1, lng: 1 },
        priceCents: 100,
      }, riderCtx, db);

      const offers = await db.collection('rides').doc(rideId).collection('offers').get();
      expect(offers.size).to.be.at.most(3); // OFFERS_PER_BATCH = 3
    });

    it('sets ride status to offered when drivers available', async () => {
      await ensureDriver('d6');
      const riderCtx = { auth: { uid: 'rider9' } } as any as functions.https.CallableContext;
      const { rideId } = await tripRequestHandler({
        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 1, lng: 1 },
        priceCents: 100,
      }, riderCtx, db);

      const ride = (await db.collection('rides').doc(rideId).get()).data()!;
      expect(ride.status).to.equal('offered');
    });

    it('keeps ride in requested status when no drivers available', async () => {
      const riderCtx = { auth: { uid: 'rider10' } } as any as functions.https.CallableContext;
      const { rideId } = await tripRequestHandler({
        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 1, lng: 1 },
        priceCents: 100,
      }, riderCtx, db);

      const ride = (await db.collection('rides').doc(rideId).get()).data()!;
      expect(ride.status).to.equal('requested');
    });

    it('increments dispatchAttempts on each matching run', async () => {
      await ensureDriver('d7');
      const riderCtx = { auth: { uid: 'rider11' } } as any as functions.https.CallableContext;
      const { rideId } = await tripRequestHandler({
        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 1, lng: 1 },
        priceCents: 100,
      }, riderCtx, db);

      const ride = (await db.collection('rides').doc(rideId).get()).data()!;
      expect(ride.dispatchAttempts).to.equal(1);
    });
  });

  describe('Accept side effects', () => {
    it('sets driver isBusy and currentRideId on accept', async () => {
      await ensureDriver('d8');
      const riderCtx = { auth: { uid: 'rider12' } } as any as functions.https.CallableContext;
      const { rideId } = await tripRequestHandler({
        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 1, lng: 1 },
        priceCents: 100,
      }, riderCtx, db);

      const driverCtx = { auth: { uid: 'd8' } } as any as functions.https.CallableContext;
      await acceptRideHandler({ rideId }, driverCtx, db);

      const driver = (await db.collection('drivers').doc('d8').get()).data()!;
      expect(driver.isBusy).to.equal(true);
      expect(driver.currentRideId).to.equal(rideId);
    });

    it('rejects all pending offers when one is accepted', async () => {
      await ensureDriver('d9');
      await ensureDriver('d10');
      await ensureDriver('d11');

      const riderCtx = { auth: { uid: 'rider13' } } as any as functions.https.CallableContext;
      const { rideId } = await tripRequestHandler({
        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 1, lng: 1 },
        priceCents: 100,
      }, riderCtx, db);

      const driverCtx = { auth: { uid: 'd9' } } as any as functions.https.CallableContext;
      await acceptRideHandler({ rideId }, driverCtx, db);

      const offers = await db.collection('rides').doc(rideId).collection('offers').get();
      const acceptedOffer = offers.docs.find(d => d.id === 'd9');
      const rejectedOffers = offers.docs.filter(d => d.id !== 'd9');

      expect(acceptedOffer?.data().status).to.equal('accepted');
      rejectedOffers.forEach(offer => {
        expect(offer.data().status).to.equal('rejected');
      });
    });

    it('sets ride driverId and status to accepted', async () => {
      await ensureDriver('d12');
      const riderCtx = { auth: { uid: 'rider14' } } as any as functions.https.CallableContext;
      const { rideId } = await tripRequestHandler({
        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 1, lng: 1 },
        priceCents: 100,
      }, riderCtx, db);

      const driverCtx = { auth: { uid: 'd12' } } as any as functions.https.CallableContext;
      await acceptRideHandler({ rideId }, driverCtx, db);

      const ride = (await db.collection('rides').doc(rideId).get()).data()!;
      expect(ride.driverId).to.equal('d12');
      expect(ride.status).to.equal('accepted');
    });

    it('releases driver lock on complete', async () => {
      await ensureDriver('d13');
      const riderCtx = { auth: { uid: 'rider15' } } as any as functions.https.CallableContext;
      const { rideId } = await tripRequestHandler({
        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 1, lng: 1 },
        priceCents: 100,
      }, riderCtx, db);

      const driverCtx = { auth: { uid: 'd13' } } as any as functions.https.CallableContext;
      await acceptRideHandler({ rideId }, driverCtx, db);
      await startRideHandler({ rideId }, driverCtx, db);
      await progressRideHandler({ rideId }, driverCtx, db);
      await completeRideHandler({ rideId }, driverCtx, db);

      const driver = (await db.collection('drivers').doc('d13').get()).data()!;
      expect(driver.isBusy).to.equal(false);
      expect(driver.currentRideId).to.be.null;
    });
  });

  describe('Offer TTL expiration', () => {
    it.skip('expires pending offers past their TTL and retries if drivers available', async () => {
      await ensureDriver('d14');
      await ensureDriver('d14b'); // Available for re-matching
      const rideId = 'ride-ttl-1';
      const now = Date.now();
      const expiredTime = now - 1000;

      await db.collection('rides').doc(rideId).set({
        riderId: 'rider16',
        status: 'offered',
        offerExpiresAtMs: expiredTime,
        dispatchAttempts: 1,
        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 1, lng: 1 },
      });

      await db.collection('rides').doc(rideId).collection('offers').doc('d14').set({
        driverId: 'd14',
        status: 'pending',
        expiresAtMs: expiredTime,
        createdAtMs: expiredTime - 60000,
      });

      await processRideOfferTimeout(rideId, db);

      const offer = await db.collection('rides').doc(rideId).collection('offers').doc('d14').get();
      expect(offer.data()?.status).to.equal('expired');
      
      const ride = (await db.collection('rides').doc(rideId).get()).data()!;
      // Should be re-matched since drivers available
      expect(ride.status).to.equal('offered');
      expect(ride.dispatchAttempts).to.equal(2);
    });

    it.skip('retries matching sets ride to requested when no drivers available', async () => {
      // No drivers available
      const rideId = 'ride-ttl-2';
      const now = Date.now();
      const expiredTime = now - 1000;

      await db.collection('rides').doc(rideId).set({
        riderId: 'rider17',
        status: 'offered',
        offerExpiresAtMs: expiredTime,
        dispatchAttempts: 1,
        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 1, lng: 1 },
      });

      await db.collection('rides').doc(rideId).collection('offers').doc('d15').set({
        driverId: 'd15',
        status: 'pending',
        expiresAtMs: expiredTime,
        createdAtMs: expiredTime - 60000,
      });

      await processRideOfferTimeout(rideId, db);

      const ride = (await db.collection('rides').doc(rideId).get()).data()!;
      // Should go back to requested since no drivers
      expect(ride.status).to.equal('requested');
      expect(ride.dispatchAttempts).to.equal(1);
    });

    it('cancels ride when all offers expire and max attempts reached', async () => {
      await ensureDriver('d16');
      const rideId = 'ride-ttl-3';
      const now = Date.now();
      const expiredTime = now - 1000;

      await db.collection('rides').doc(rideId).set({
        riderId: 'rider18',
        status: 'offered',
        offerExpiresAtMs: expiredTime,
        dispatchAttempts: 3, // MAX_DISPATCH_ATTEMPTS
      });

      await db.collection('rides').doc(rideId).collection('offers').doc('d16').set({
        driverId: 'd16',
        status: 'pending',
        expiresAtMs: expiredTime,
        createdAtMs: expiredTime - 60000,
      });

      await processRideOfferTimeout(rideId, db);

      const ride = (await db.collection('rides').doc(rideId).get()).data()!;
      expect(ride.status).to.equal('cancelled');
      expect(ride.cancelReason).to.equal('no_driver_available');
    });

    it('does not expire if at least one offer is still pending', async () => {
      await ensureDriver('d17');
      await ensureDriver('d18');
      const rideId = 'ride-ttl-4';
      const now = Date.now();
      const expiredTime = now - 1000;
      const futureTime = now + 60000;

      await db.collection('rides').doc(rideId).set({
        riderId: 'rider19',
        status: 'offered',
        offerExpiresAtMs: futureTime,
        dispatchAttempts: 1,
      });

      await db.collection('rides').doc(rideId).collection('offers').doc('d17').set({
        driverId: 'd17',
        status: 'pending',
        expiresAtMs: expiredTime,
        createdAtMs: expiredTime - 60000,
      });

      await db.collection('rides').doc(rideId).collection('offers').doc('d18').set({
        driverId: 'd18',
        status: 'pending',
        expiresAtMs: futureTime,
        createdAtMs: now,
      });

      await processRideOfferTimeout(rideId, db);

      const ride = (await db.collection('rides').doc(rideId).get()).data()!;
      expect(ride.status).to.equal('offered'); // Still has pending offer
      
      const expiredOffer = (await db.collection('rides').doc(rideId).collection('offers').doc('d17').get()).data()!;
      const activeOffer = (await db.collection('rides').doc(rideId).collection('offers').doc('d18').get()).data()!;
      
      expect(expiredOffer.status).to.equal('expired');
      expect(activeOffer.status).to.equal('pending');
    });

    it('processOfferTimeouts processes all expired rides', async () => {
      await ensureDriver('d19');
      await ensureDriver('d19b'); // Additional driver for re-matching
      await ensureDriver('d20');
      await ensureDriver('d20b'); // Additional driver for re-matching
      const now = Date.now();
      const expiredTime = now - 1000;

      await db.collection('rides').doc('ride-batch-1').set({
        riderId: 'rider20',
        status: 'offered',
        offerExpiresAtMs: expiredTime,
        dispatchAttempts: 1,
        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 1, lng: 1 },
      });

      await db.collection('rides').doc('ride-batch-1').collection('offers').doc('d19').set({
        driverId: 'd19',
        status: 'pending',
        expiresAtMs: expiredTime,
        createdAtMs: expiredTime - 60000,
      });

      await db.collection('rides').doc('ride-batch-2').set({
        riderId: 'rider21',
        status: 'offered',
        offerExpiresAtMs: expiredTime,
        dispatchAttempts: 1,
        pickup: { lat: 0, lng: 0 },
        dropoff: { lat: 1, lng: 1 },
      });

      await db.collection('rides').doc('ride-batch-2').collection('offers').doc('d20').set({
        driverId: 'd20',
        status: 'pending',
        expiresAtMs: expiredTime,
        createdAtMs: expiredTime - 60000,
      });

      await processOfferTimeouts(db);

      const offer1 = (await db.collection('rides').doc('ride-batch-1').collection('offers').doc('d19').get()).data()!;
      const offer2 = (await db.collection('rides').doc('ride-batch-2').collection('offers').doc('d20').get()).data()!;

      expect(offer1.status).to.equal('expired');
      expect(offer2.status).to.equal('expired');
    });
  });
});
