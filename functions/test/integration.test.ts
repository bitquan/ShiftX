import { expect } from 'chai';
import 'mocha';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';

// Import handlers from compiled lib
let tripRequestHandler: any;
let acceptRideHandler: any;
let declineOfferHandler: any;
let cancelRideHandler: any;
let runCleanupJobs: any;

// Ensure emulator env
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-no-project';
process.env.SEARCH_TIMEOUT_MS = '5000'; // 5 seconds for faster tests

/**
 * Integration tests for complete ride workflows
 * These test the most critical user-facing scenarios end-to-end
 */
describe('Integration Tests: Critical Ride Workflows', function () {
  this.timeout(30000); // 30 second timeout for integration tests

  let db: any;

  before(async () => {
    // @ts-ignore: import compiled JS build
    const mod = await import('../lib/index.js');
    tripRequestHandler = mod.tripRequestHandler;
    acceptRideHandler = mod.acceptRideHandler;
    declineOfferHandler = mod.declineOfferHandler;
    cancelRideHandler = mod.cancelRideHandler;
    
    const cleanupMod = await import('../lib/cleanup.js');
    runCleanupJobs = cleanupMod.runCleanupJobs;
  });

  beforeEach(async () => {
    if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
    db = getFirestore();
    
    // Clean slate before each test
    const drivers = await db.collection('drivers').listDocuments();
    await Promise.all(drivers.map((d: any) => d.delete()));
    
    const rides = await db.collection('rides').listDocuments();
    await Promise.all(rides.map((r: any) => {
      return db.recursiveDelete(r);
    }));
    
    const users = await db.collection('users').listDocuments();
    await Promise.all(users.map((u: any) => u.delete()));
    
    const eventLogs = await db.collection('eventLog').listDocuments();
    await Promise.all(eventLogs.map((e: any) => e.delete()));
  });

  after(async () => {
    // Emulator handles cleanup
  });

  // Helper to create a driver with role
  async function ensureDriver(driverId: string, online = true) {
    await db.collection('users').doc(driverId).set({
      role: 'driver',
      uid: driverId,
    });
    await db.collection('drivers').doc(driverId).set({
      isOnline: online,
      isBusy: false,
      lastHeartbeatMs: Date.now(),
      updatedAtMs: Date.now(),
    });
  }

  // Helper to create a rider
  async function ensureRider(riderId: string) {
    await db.collection('users').doc(riderId).set({
      role: 'rider',
      uid: riderId,
    });
  }

  // Mock context
  function mockContext(uid: string): functions.https.CallableContext {
    return {
      auth: { uid, token: {} as any },
      app: undefined,
      instanceIdToken: undefined,
      rawRequest: {} as any,
    };
  }

  /**
   * TEST 1: No drivers available → cancels with search_timeout
   */
  describe('Test 1: No drivers → search_timeout', () => {
    it('should cancel ride when no drivers available and search times out', async function () {
      this.timeout(15000);
      
      const riderId = 'rider-no-drivers';
      await ensureRider(riderId);

      const riderCtx = mockContext(riderId);
      const { rideId } = await tripRequestHandler({
        pickup: { lat: 37.7749, lng: -122.4194 },
        dropoff: { lat: 37.8049, lng: -122.4094 },
        priceCents: 1500,
      }, riderCtx, db);

      // Wait for search timeout (5 seconds + buffer)
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Run cleanup job to cancel stuck ride
      await runCleanupJobs(db);

      const ride = (await db.collection('rides').doc(rideId).get()).data();
      expect(ride.status).to.equal('cancelled');
      expect(ride.cancelReason).to.equal('search_timeout');

      // Check event log
      const events = await db.collection('eventLog')
        .where('rideId', '==', rideId)
        .where('event', '==', 'search_timeout')
        .get();
      expect(events.empty).to.be.false;
    });
  });

  /**
   * TEST 2: One driver online → offer → accept → ride accepted
   */
  describe('Test 2: One driver → offer → accept', () => {
    it('should successfully match rider with single driver and accept', async function () {
      this.timeout(10000);
      
      const riderId = 'rider-single';
      const driverId = 'driver-single';
      
      await ensureRider(riderId);
      await ensureDriver(driverId, true);

      // Rider requests ride
      const riderCtx = mockContext(riderId);
      const { rideId } = await tripRequestHandler({
        pickup: { lat: 37.7749, lng: -122.4194 },
        dropoff: { lat: 37.8049, lng: -122.4094 },
        priceCents: 1500,
      }, riderCtx, db);

      // Small delay for matching to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check ride status is 'offered'
      let ride = (await db.collection('rides').doc(rideId).get()).data();
      expect(ride.status).to.equal('offered');

      // Check offer was created
      const offerSnap = await db.collection('rides').doc(rideId)
        .collection('offers').doc(driverId).get();
      expect(offerSnap.exists).to.be.true;
      expect(offerSnap.data()?.status).to.equal('pending');

      // Driver accepts
      const driverCtx = mockContext(driverId);
      await acceptRideHandler({ rideId }, driverCtx, db);

      // Verify ride is accepted
      ride = (await db.collection('rides').doc(rideId).get()).data();
      expect(ride.status).to.equal('accepted');
      expect(ride.driverId).to.equal(driverId);

      // Verify driver is busy
      const driver = (await db.collection('drivers').doc(driverId).get()).data();
      expect(driver.isBusy).to.be.true;
      expect(driver.currentRideId).to.equal(rideId);

      // Verify offer is accepted
      const offer = (await db.collection('rides').doc(rideId)
        .collection('offers').doc(driverId).get()).data();
      expect(offer.status).to.equal('accepted');
    });
  });

  /**
   * TEST 3: Three drivers ignore → offers expire → retry → cancels correctly
   */
  describe('Test 3: Three drivers ignore → expire → retry → cancel', () => {
    it('should retry matching and eventually cancel when all drivers ignore', async function () {
      this.timeout(15000);
      
      const riderId = 'rider-ignored';
      const driver1 = 'driver-ignore-1';
      const driver2 = 'driver-ignore-2';
      const driver3 = 'driver-ignore-3';
      
      await ensureRider(riderId);
      await ensureDriver(driver1, true);
      await ensureDriver(driver2, true);
      await ensureDriver(driver3, true);

      // Rider requests ride
      const riderCtx = mockContext(riderId);
      const { rideId } = await tripRequestHandler({
        pickup: { lat: 37.7749, lng: -122.4194 },
        dropoff: { lat: 37.8049, lng: -122.4094 },
        priceCents: 1500,
      }, riderCtx, db);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify offers were created (up to 3)
      const offersSnap = await db.collection('rides').doc(rideId).collection('offers').get();
      expect(offersSnap.size).to.be.at.least(1);
      expect(offersSnap.size).to.be.at.most(3);

      // Wait for offers to expire (60 seconds + buffer)
      await new Promise(resolve => setTimeout(resolve, 62000));

      // Run cleanup to expire offers
      await runCleanupJobs(db);

      // Check that ride gets cancelled after max attempts
      const ride = (await db.collection('rides').doc(rideId).get()).data();
      expect(ride.status).to.equal('cancelled');
      expect(['search_timeout', 'no_drivers', 'no_driver_available']).to.include(ride.cancelReason);
    });
  });

  /**
   * TEST 4: Driver declines → re-dispatch to a different driver
   */
  describe('Test 4: Driver declines → re-dispatch', () => {
    it('should re-dispatch to second driver when first declines', async function () {
      this.timeout(10000);
      
      const riderId = 'rider-decline';
      const driver1 = 'driver-decline-1';
      const driver2 = 'driver-decline-2';
      
      await ensureRider(riderId);
      await ensureDriver(driver1, true);
      await ensureDriver(driver2, true);

      // Rider requests ride
      const riderCtx = mockContext(riderId);
      const { rideId } = await tripRequestHandler({
        pickup: { lat: 37.7749, lng: -122.4194 },
        dropoff: { lat: 37.8049, lng: -122.4094 },
        priceCents: 1500,
      }, riderCtx, db);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check offers created
      let offersSnap = await db.collection('rides').doc(rideId).collection('offers').get();
      expect(offersSnap.empty).to.be.false;

      // First driver who got offer declines
      const firstOfferId = offersSnap.docs[0].id;
      const driver1Ctx = mockContext(firstOfferId);
      await declineOfferHandler({ rideId }, driver1Ctx, db);

      // Wait for re-matching
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify attemptedDriverIds includes declined driver
      const ride = (await db.collection('rides').doc(rideId).get()).data();
      expect(ride.attemptedDriverIds).to.include(firstOfferId);

      // Verify new offers were created (excluding first driver)
      offersSnap = await db.collection('rides').doc(rideId).collection('offers')
        .where('status', '==', 'pending').get();
      
      // Should have at least one pending offer for a different driver
      const pendingDrivers = offersSnap.docs.map((d: any) => d.id);
      const hasNewDriver = pendingDrivers.some((id: string) => id !== firstOfferId);
      expect(hasNewDriver).to.be.true;
    });
  });

  /**
   * TEST 5: Double accept race → only one wins (transaction)
   */
  describe('Test 5: Double accept race condition', () => {
    it('should handle race condition where two drivers try to accept simultaneously', async function () {
      this.timeout(10000);
      
      const riderId = 'rider-race';
      const driver1 = 'driver-race-1';
      const driver2 = 'driver-race-2';
      
      await ensureRider(riderId);
      await ensureDriver(driver1, true);
      await ensureDriver(driver2, true);

      // Rider requests ride
      const riderCtx = mockContext(riderId);
      const { rideId } = await tripRequestHandler({
        pickup: { lat: 37.7749, lng: -122.4194 },
        dropoff: { lat: 37.8049, lng: -122.4094 },
        priceCents: 1500,
      }, riderCtx, db);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get offered drivers
      const offersSnap = await db.collection('rides').doc(rideId).collection('offers')
        .where('status', '==', 'pending').get();
      
      if (offersSnap.size < 2) {
        // Need at least 2 offers for this test
        this.skip();
        return;
      }

      const driver1Id = offersSnap.docs[0].id;
      const driver2Id = offersSnap.docs[1].id;

      const driver1Ctx = mockContext(driver1Id);
      const driver2Ctx = mockContext(driver2Id);

      // Both drivers try to accept simultaneously
      const results = await Promise.allSettled([
        acceptRideHandler({ rideId }, driver1Ctx, db),
        acceptRideHandler({ rideId }, driver2Ctx, db),
      ]);

      // One should succeed, one should fail
      const succeeded = results.filter((r: any) => r.status === 'fulfilled').length;
      const failed = results.filter((r: any) => r.status === 'rejected').length;

      expect(succeeded).to.equal(1);
      expect(failed).to.equal(1);

      // Verify only one driver got the ride
      const ride = (await db.collection('rides').doc(rideId).get()).data();
      expect(ride.status).to.equal('accepted');
      expect([driver1Id, driver2Id]).to.include(ride.driverId);

      // Verify only winning driver is busy
      const winningDriverId = ride.driverId;
      const losingDriverId = winningDriverId === driver1Id ? driver2Id : driver1Id;

      const winningDriver = (await db.collection('drivers').doc(winningDriverId).get()).data();
      const losingDriver = (await db.collection('drivers').doc(losingDriverId).get()).data();

      expect(winningDriver.isBusy).to.be.true;
      expect(losingDriver.isBusy).to.be.false;
    });
  });

  /**
   * TEST 6: Rider cancels while offers pending → driver accept fails
   */
  describe('Test 6: Rider cancels → driver accept fails', () => {
    it('should reject driver accept attempt after rider cancels', async function () {
      this.timeout(10000);
      
      const riderId = 'rider-cancel';
      const driverId = 'driver-cancel';
      
      await ensureRider(riderId);
      await ensureDriver(driverId, true);

      // Rider requests ride
      const riderCtx = mockContext(riderId);
      const { rideId } = await tripRequestHandler({
        pickup: { lat: 37.7749, lng: -122.4194 },
        dropoff: { lat: 37.8049, lng: -122.4094 },
        priceCents: 1500,
      }, riderCtx, db);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify offer exists
      const offerSnap = await db.collection('rides').doc(rideId)
        .collection('offers').doc(driverId).get();
      expect(offerSnap.exists).to.be.true;

      // Rider cancels
      await cancelRideHandler({ rideId, reason: 'changed_mind' }, riderCtx, db);

      // Verify ride is cancelled
      let ride = (await db.collection('rides').doc(rideId).get()).data();
      expect(ride.status).to.equal('cancelled');

      // Driver tries to accept
      const driverCtx = mockContext(driverId);
      let error: any;
      try {
        await acceptRideHandler({ rideId }, driverCtx, db);
      } catch (e) {
        error = e;
      }

      // Should fail with precondition error
      expect(error).to.exist;
      expect(error.code).to.equal('failed-precondition');

      // Verify driver is still not busy
      const driver = (await db.collection('drivers').doc(driverId).get()).data();
      expect(driver.isBusy).to.be.false;
    });
  });

  /**
   * TEST 7: Cleanup job tests
   */
  describe('Test 7: Cleanup jobs (janitor)', () => {
    it('should cancel rides stuck past searchExpiresAtMs', async function () {
      this.timeout(10000);
      
      const riderId = 'rider-stuck';
      await ensureRider(riderId);

      // Create a stuck ride manually
      const now = Date.now();
      const rideId = 'stuck-ride-1';
      await db.collection('rides').doc(rideId).set({
        riderId,
        status: 'requested',
        pickup: { lat: 37.7749, lng: -122.4194 },
        dropoff: { lat: 37.8049, lng: -122.4094 },
        priceCents: 1500,
        createdAtMs: now - 10000,
        searchStartedAtMs: now - 10000,
        searchExpiresAtMs: now - 1000, // Expired 1 second ago
        updatedAtMs: now - 10000,
      });

      // Run cleanup
      const results = await runCleanupJobs(db);
      expect(results.cancelledRides).to.be.at.least(1);

      // Verify ride was cancelled
      const ride = (await db.collection('rides').doc(rideId).get()).data();
      expect(ride.status).to.equal('cancelled');
      expect(ride.cancelReason).to.equal('search_timeout');
    });

    it('should expire pending offers past expiresAtMs', async function () {
      this.timeout(10000);
      
      const riderId = 'rider-expire';
      const driverId = 'driver-expire';
      await ensureRider(riderId);
      await ensureDriver(driverId, true);

      const now = Date.now();
      const rideId = 'expired-offer-ride';

      // Create ride with expired offer
      await db.collection('rides').doc(rideId).set({
        riderId,
        status: 'offered',
        pickup: { lat: 37.7749, lng: -122.4194 },
        dropoff: { lat: 37.8049, lng: -122.4094 },
        priceCents: 1500,
        createdAtMs: now - 120000,
        offerExpiresAtMs: now - 1000, // Expired
        updatedAtMs: now - 120000,
      });

      await db.collection('rides').doc(rideId).collection('offers').doc(driverId).set({
        driverId,
        status: 'pending',
        expiresAtMs: now - 1000, // Expired
        createdAtMs: now - 120000,
      });

      // Run cleanup
      const results = await runCleanupJobs(db);
      expect(results.expiredOffers).to.be.at.least(1);

      // Verify offer was expired
      const offer = (await db.collection('rides').doc(rideId)
        .collection('offers').doc(driverId).get()).data();
      expect(offer.status).to.equal('expired');
    });

    it('should mark ghost drivers as offline', async function () {
      this.timeout(10000);
      
      const driverId = 'ghost-driver';
      await ensureDriver(driverId, true);

      const now = Date.now();
      const staleHeartbeat = now - 150000; // 2.5 minutes ago (>2 min timeout)

      // Update driver with stale heartbeat
      await db.collection('drivers').doc(driverId).set({
        isOnline: true,
        isBusy: false,
        lastHeartbeatMs: staleHeartbeat,
        updatedAtMs: staleHeartbeat,
      });

      // Run cleanup
      const results = await runCleanupJobs(db);
      expect(results.offlineDrivers).to.be.at.least(1);

      // Verify driver is offline
      const driver = (await db.collection('drivers').doc(driverId).get()).data();
      expect(driver.isOnline).to.be.false;
    });
  });
});
