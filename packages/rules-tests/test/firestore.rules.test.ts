import * as fs from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

describe('Firestore rules (rides)', function () {
  let testEnv: any;

  before(async () => {
    const hostEnv = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081';
    const [host, portStr] = hostEnv.split(':');
    const port = Number(portStr) || 8081;

    testEnv = await initializeTestEnvironment({
      projectId: 'demo-no-project',
      firestore: { host, port, rules: fs.readFileSync('../../firestore.rules', 'utf8') },
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  const seedRide = async (options: {
    rideId: string;
    riderId: string;
    driverOfferId?: string;
    driverId?: string;
  }) => {
    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
      const adminDb = ctx.firestore();
      await adminDb.doc(`rides/${options.rideId}`).set({
        riderId: options.riderId,
        status: 'offered',
        priceCents: 100,
      });
      if (options.driverOfferId && options.driverId) {
        await adminDb.doc(`rides/${options.rideId}/offers/${options.driverOfferId}`).set({
          status: 'pending',
          driverId: options.driverId,
        });
      }
    });
  };

  it('prevents riders from writing rides directly (must use callable)', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(alice.collection('rides').add({
      riderId: 'alice',
      status: 'requested',
      priceCents: 100,
    }));
  });

  it('prevents rider from updating status field', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const rideId = `ride_${Date.now()}_status`;
    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
      const adminDb = ctx.firestore();
      await adminDb.doc(`rides/${rideId}`).set({
        riderId: 'alice',
        status: 'requested',
        priceCents: 100,
      });
    });
    const rideRef = aliceDb.doc(`rides/${rideId}`);
    await assertFails(rideRef.update({ status: 'accepted' }));
  });

  it('prevents driver from setting driverId/status directly', async () => {
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const id = `test_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
      await ctx.firestore().doc(`rides/${id}`).set({
        riderId: 'someone',
        status: 'requested',
        priceCents: 100,
      });
    });
    await assertFails(bobDb.collection('rides').doc(id).update({ driverId: 'bob', status: 'accepted' }));
  });

  it('allows riders to read their own rides', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const rideId = `ride_${Date.now()}`;
    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
      await ctx.firestore().doc(`rides/${rideId}`).set({
        riderId: 'alice',
        status: 'offered',
        priceCents: 100,
      });
    });
    await assertSucceeds(aliceDb.doc(`rides/${rideId}`).get());
  });

  it('prevents drivers from reading rides without an offer', async () => {
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const rideId = `ride_${Date.now()}_private`;
    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
      await ctx.firestore().doc(`rides/${rideId}`).set({
        riderId: 'someone',
        status: 'offered',
        priceCents: 100,
      });
    });
    await assertFails(bobDb.doc(`rides/${rideId}`).get());
  });

  it('allows drivers to read rides when an offer exists', async () => {
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const rideId = `ride_${Date.now()}_offer`;
    await seedRide({ rideId, riderId: 'someone', driverOfferId: 'bob', driverId: 'bob' });
    await assertSucceeds(bobDb.doc(`rides/${rideId}`).get());
  });

  it('allows a driver to read their own offer document', async () => {
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    const rideId = `ride_${Date.now()}_offer_doc`;
    await seedRide({ rideId, riderId: 'someone', driverOfferId: 'bob', driverId: 'bob' });
    await assertSucceeds(bobDb.doc(`rides/${rideId}/offers/bob`).get());
  });

  it('prevents other drivers from reading someone else\'s offer document', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const rideId = `ride_${Date.now()}_offer_doc`;
    await seedRide({ rideId, riderId: 'someone', driverOfferId: 'bob', driverId: 'bob' });
    await assertFails(aliceDb.doc(`rides/${rideId}/offers/bob`).get());
  });

  it('prevents unauthenticated clients from reading driver offers', async () => {
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const rideId = `ride_${Date.now()}_offer_doc`;
    await seedRide({ rideId, riderId: 'someone', driverOfferId: 'bob', driverId: 'bob' });
    await assertFails(unauthDb.doc(`rides/${rideId}/offers/bob`).get());
  });

  it('prevents riders from reading offers (driver-only visibility)', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const rideId = `ride_${Date.now()}_offer_doc`;
    await seedRide({ rideId, riderId: 'alice', driverOfferId: 'bob', driverId: 'bob' });
    await assertFails(aliceDb.doc(`rides/${rideId}/offers/bob`).get());
  });

  it('allows customers to read individual rides they own', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
      const adminDb = ctx.firestore();
      await adminDb.doc(`rides/alice_ride_1`).set({
        riderId: 'alice',
        status: 'completed',
        priceCents: 2500,
        createdAtMs: Date.now(),
      });
    });

    await assertSucceeds(aliceDb.doc('rides/alice_ride_1').get());
  });

  it('prevents customers from reading rides they don\'t own', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
      const adminDb = ctx.firestore();
      await adminDb.doc(`rides/bob_ride_1`).set({
        riderId: 'bob',
        status: 'completed',
        priceCents: 2500,
        createdAtMs: Date.now(),
      });
    });

    await assertFails(aliceDb.doc('rides/bob_ride_1').get());
  });
});
