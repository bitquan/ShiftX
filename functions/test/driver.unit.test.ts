import { expect } from 'chai';
import 'mocha';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let setDriverOnlineHandler: any;
let driverHeartbeatHandler: any;
let acceptRideHandler: any;
let startRideHandler: any;
let completeRideHandler: any;

// Ensure emulator env
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-no-project';

describe('Driver lifecycle (server authoritative)', function () {
  this.timeout(10000);

  let db: any;

  before(async () => {
    // Ensure emulator env vars
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-no-project';
    // import compiled functions
    // @ts-ignore: import compiled JS build without type declarations
    const mod = await import('../lib/index.js');
    setDriverOnlineHandler = mod.setDriverOnlineHandler;
    driverHeartbeatHandler = mod.driverHeartbeatHandler;
    acceptRideHandler = mod.acceptRideHandler;
    startRideHandler = mod.startRideHandler;
    completeRideHandler = mod.completeRideHandler;
  });

  beforeEach(async () => {
    if (!getApps().length) initializeApp({ projectId: process.env.GCLOUD_PROJECT });
    db = getFirestore();
    // clean
    const drivers = await db.collection('drivers').listDocuments();
    await Promise.all(drivers.map((d: any) => d.delete()));
    const rides = await db.collection('rides').listDocuments();
    await Promise.all(rides.map((d: any) => d.delete()));
  });

  after(async () => {
    // no special cleanup required; emulator lifecycle handled by CI
  });

  it('driver can go online when idle and cannot go offline while busy', async () => {
    await db.collection('drivers').doc('drv1').set({ isOnline: false, isBusy: false });

    const ctx = { auth: { uid: 'drv1' } } as any;
    const resOn = await setDriverOnlineHandler({ online: true }, ctx, db);
    expect(resOn).to.deep.equal({ ok: true });
    const d = (await db.collection('drivers').doc('drv1').get()).data();
    expect(d.isOnline).to.equal(true);

    // Simulate driver busy via server (admin)
    await db.collection('drivers').doc('drv1').set({ isBusy: true, currentRideId: 'r1' }, { merge: true });

    try {
      await setDriverOnlineHandler({ online: false }, ctx, db);
      throw new Error('expected failure');
    } catch (e: any) {
      expect(e).to.have.property('code', 'failed-precondition');
    }
  });

  it('accept -> driver busy invariant and complete clears it', async () => {
    // seed
    await db.collection('drivers').doc('d1').set({ isBusy: false });
    await db.collection('rides').doc('rideX').set({ riderId: 'r', status: 'requested' });

    const ctx = { auth: { uid: 'd1' } } as any;
    await acceptRideHandler({ rideId: 'rideX' }, ctx, db);

    let driver = (await db.collection('drivers').doc('d1').get()).data();
    expect(driver.isBusy).to.equal(true);
    expect(driver.currentRideId).to.equal('rideX');

    // start then complete
    await startRideHandler({ rideId: 'rideX' }, ctx, db);
    await completeRideHandler({ rideId: 'rideX' }, ctx, db);

    driver = (await db.collection('drivers').doc('d1').get()).data();
    expect(driver.isBusy).to.equal(false);
    expect(driver.currentRideId).to.equal(null);
  });

  it('heartbeat updates lastSeenAtMs', async () => {
    await db.collection('drivers').doc('hb1').set({ isOnline: true });
    const ctx = { auth: { uid: 'hb1' } } as any;
    const res = await driverHeartbeatHandler({}, ctx, db);
    expect(res).to.deep.equal({ ok: true });
    const d = (await db.collection('drivers').doc('hb1').get()).data();
    expect(d).to.have.property('lastSeenAtMs');
  });

  it('unauthenticated calls rejected', async () => {
    const ctx = { auth: null } as any;
    try {
      await setDriverOnlineHandler({ online: true }, ctx, db);
      throw new Error('expected unauthenticated');
    } catch (e: any) {
      expect(e).to.have.property('code', 'unauthenticated');
    }
  });
});