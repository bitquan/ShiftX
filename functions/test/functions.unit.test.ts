import { expect } from 'chai';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import 'mocha';
import * as functions from 'firebase-functions';

// Ensure tests run against emulator; set defaults if not provided
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-no-project';

let acceptRideHandler: any, startRideHandler: any, completeRideHandler: any;

describe('Cloud Functions unit tests', function () {
  this.timeout(10000);

  let db: FirebaseFirestore.Firestore;

  beforeEach(async () => {
    // Import handlers after ensuring emulator env is set
    // Import compiled JS from lib/ to avoid ts-node ESM resolution issues.
    // @ts-ignore: import compiled JS build without type declarations
    const mod = await import('../lib/index.js');
    acceptRideHandler = mod.acceptRideHandler;
    startRideHandler = mod.startRideHandler;
    completeRideHandler = mod.completeRideHandler;

    // Initialize admin (should connect to the emulator via env var)
    try {
      if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
    } catch (e: any) {
      // already initialized
    }
    db = getFirestore();

    // clear collections
    const rides = await db.collection('rides').listDocuments();
    await Promise.all(rides.map((d) => d.delete()));
    const drivers = await db.collection('drivers').listDocuments();
    await Promise.all(drivers.map((d) => d.delete()));
  });

  it('happy path: accept -> start -> complete', async () => {
    // seed driver and ride
    await db.collection('drivers').doc('driver1').set({ isBusy: false });
    await db.collection('rides').doc('ride1').set({ riderId: 'r1', status: 'requested' });

    const ctx = { auth: { uid: 'driver1' } } as any as functions.https.CallableContext;

    const res1 = await acceptRideHandler({ rideId: 'ride1' }, ctx, db);
    expect(res1).to.deep.equal({ ok: true });

    const rideSnap = await db.collection('rides').doc('ride1').get();
    const ride = rideSnap.data()!;
    expect(ride.status).to.equal('accepted');
    expect(ride.driverId).to.equal('driver1');

    const res2 = await startRideHandler({ rideId: 'ride1' }, ctx, db);
    expect(res2).to.deep.equal({ ok: true });

    const started = (await db.collection('rides').doc('ride1').get()).data()!;
    expect(started.status).to.equal('started');

    const res3 = await completeRideHandler({ rideId: 'ride1' }, ctx, db);
    expect(res3).to.deep.equal({ ok: true });

    const completed = (await db.collection('rides').doc('ride1').get()).data()!;
    expect(completed.status).to.equal('completed');

    const driver = (await db.collection('drivers').doc('driver1').get()).data()!;
    expect(driver.isBusy).to.equal(false);
  });

  it('double-accept concurrency: only one driver wins', async () => {
    // seed two drivers and one ride
    await db.collection('drivers').doc('d1').set({ isBusy: false });
    await db.collection('drivers').doc('d2').set({ isBusy: false });
    await db.collection('rides').doc('r1').set({ riderId: 'r', status: 'requested' });

    const ctx1 = { auth: { uid: 'd1' } } as any as functions.https.CallableContext;
    const ctx2 = { auth: { uid: 'd2' } } as any as functions.https.CallableContext;

    // Run both accept attempts in parallel
    const p1 = acceptRideHandler({ rideId: 'r1' }, ctx1, db).then(() => ({ ok: true, driver: 'd1' })).catch((e: any) => ({ ok: false, err: e, driver: 'd1' }));
    const p2 = acceptRideHandler({ rideId: 'r1' }, ctx2, db).then(() => ({ ok: true, driver: 'd2' })).catch((e: any) => ({ ok: false, err: e, driver: 'd2' }));

    const results = await Promise.all([p1, p2]);

    // ensure the failed result has the expected HttpsError code
    const failed = results.find(r => !r.ok);
    expect(failed).to.exist;
    const fe = (failed as any).err;
    expect(fe).to.have.property('code');
    expect(['failed-precondition','aborted','already-exists']).to.include(fe.code);

    const successes = results.filter(r => r.ok);
    const fails = results.filter(r => !r.ok);

    expect(successes.length).to.equal(1);
    expect(fails.length).to.equal(1);

    // verify driver doc states
    const d1 = (await db.collection('drivers').doc('d1').get()).data()!;
    const d2 = (await db.collection('drivers').doc('d2').get()).data()!;
    const ride = (await db.collection('rides').doc('r1').get()).data()!;

    const winner = successes[0].driver;
    expect(ride.driverId).to.equal(winner);
    expect([d1.isBusy, d2.isBusy].filter(Boolean).length).to.equal(1);
  });

  it('auth enforcement: unauthenticated accept fails', async () => {
    await db.collection('drivers').doc('d1').set({ isBusy: false });
    await db.collection('rides').doc('r2').set({ riderId: 'r', status: 'requested' });

    const ctx = { auth: null } as any as functions.https.CallableContext;
    try {
      await acceptRideHandler({ rideId: 'r2' }, ctx, db);
      throw new Error('expected unauthenticated');
    } catch (e: any) {
      expect(e).to.have.property('code', 'unauthenticated');
    }
  });

  it('invalid transitions fail (start before accept)', async () => {
    await db.collection('drivers').doc('d3').set({ isBusy: false });
    await db.collection('rides').doc('r3').set({ riderId: 'r', status: 'requested' });

    const ctx = { auth: { uid: 'd3' } } as any as functions.https.CallableContext;
    try {
      await startRideHandler({ rideId: 'r3' }, ctx, db);
      throw new Error('expected failed-precondition');
    } catch (e: any) {
      expect(e).to.have.property('code', 'failed-precondition');
    }
  });

});
