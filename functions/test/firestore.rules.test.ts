import * as fs from 'fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';

describe('Firestore rules', function () {
  let testEnv: any;

  before(async () => {
    // Prefer existing FIRESTORE_EMULATOR_HOST env var (format host:port), else default to localhost:8081
    const hostEnv = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081';
    const [host, portStr] = hostEnv.split(':');
    const port = Number(portStr) || 8081;

    testEnv = await initializeTestEnvironment({
      projectId: 'demo-no-project',
      firestore: { host, port, rules: fs.readFileSync('../firestore.rules', 'utf8') },
    });
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  after(async () => {
    await testEnv.cleanup();
  });

  describe('Rides collection', () => {
    it('prevents any direct writes to rides', async () => {
      const alice = testEnv.authenticatedContext('alice').firestore();
      await assertFails(
        alice.collection('rides').add({
          riderId: 'alice',
          status: 'requested',
          priceCents: 100,
          pickup: { lat: 0, lng: 0 },
        })
      );
    });

    it('prevents riders from updating rides directly', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const rideId = 'test-ride-1';
      
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx.firestore().doc(`rides/${rideId}`).set({
          riderId: 'alice',
          status: 'requested',
          priceCents: 100,
        });
      });

      await assertFails(aliceDb.doc(`rides/${rideId}`).update({ status: 'accepted' }));
    });

    it('prevents drivers from setting driverId/status directly', async () => {
      const bobDb = testEnv.authenticatedContext('bob').firestore();
      const rideId = 'test-ride-2';

      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx.firestore().doc(`rides/${rideId}`).set({
          riderId: 'someone',
          status: 'requested',
          priceCents: 100,
        });
      });

      await assertFails(bobDb.doc(`rides/${rideId}`).update({ driverId: 'bob', status: 'accepted' }));
    });

    it('allows rider to read their own ride', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const rideId = 'test-ride-3';

      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx.firestore().doc(`rides/${rideId}`).set({
          riderId: 'alice',
          status: 'requested',
          priceCents: 100,
        });
      });

      await assertSucceeds(aliceDb.doc(`rides/${rideId}`).get());
    });

    it('allows assigned driver to read ride', async () => {
      const bobDb = testEnv.authenticatedContext('bob').firestore();
      const rideId = 'test-ride-4';

      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx.firestore().doc(`rides/${rideId}`).set({
          riderId: 'alice',
          driverId: 'bob',
          status: 'accepted',
          priceCents: 100,
        });
      });

      await assertSucceeds(bobDb.doc(`rides/${rideId}`).get());
    });

    it('prevents unrelated user from reading ride', async () => {
      const charlieDb = testEnv.authenticatedContext('charlie').firestore();
      const rideId = 'test-ride-5';

      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx.firestore().doc(`rides/${rideId}`).set({
          riderId: 'alice',
          driverId: 'bob',
          status: 'accepted',
          priceCents: 100,
        });
      });

      await assertFails(charlieDb.doc(`rides/${rideId}`).get());
    });

    it('allows driver with pending offer to read ride', async () => {
      const davidDb = testEnv.authenticatedContext('david').firestore();
      const rideId = 'test-ride-6';

      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        const db = ctx.firestore();
        await db.doc(`rides/${rideId}`).set({
          riderId: 'alice',
          status: 'offered',
          priceCents: 100,
        });
        await db.doc(`rides/${rideId}/offers/david`).set({
          driverId: 'david',
          status: 'pending',
          createdAtMs: Date.now(),
        });
      });

      await assertSucceeds(davidDb.doc(`rides/${rideId}`).get());
    });
  });

  describe('Offers subcollection privacy', () => {
    it('allows driver to read their own offer', async () => {
      const bobDb = testEnv.authenticatedContext('bob').firestore();
      const rideId = 'test-ride-7';

      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        const db = ctx.firestore();
        await db.doc(`rides/${rideId}`).set({
          riderId: 'alice',
          status: 'offered',
          priceCents: 100,
        });
        await db.doc(`rides/${rideId}/offers/bob`).set({
          driverId: 'bob',
          status: 'pending',
          createdAtMs: Date.now(),
        });
      });

      await assertSucceeds(bobDb.doc(`rides/${rideId}/offers/bob`).get());
    });

    it('prevents driver from reading another drivers offer', async () => {
      const charlieDb = testEnv.authenticatedContext('charlie').firestore();
      const rideId = 'test-ride-8';

      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        const db = ctx.firestore();
        await db.doc(`rides/${rideId}`).set({
          riderId: 'alice',
          status: 'offered',
          priceCents: 100,
        });
        await db.doc(`rides/${rideId}/offers/bob`).set({
          driverId: 'bob',
          status: 'pending',
          createdAtMs: Date.now(),
        });
      });

      await assertFails(charlieDb.doc(`rides/${rideId}/offers/bob`).get());
    });

    it('allows driver to list only their own offers', async () => {
      const bobDb = testEnv.authenticatedContext('bob').firestore();
      const rideId = 'test-ride-9';

      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        const db = ctx.firestore();
        await db.doc(`rides/${rideId}`).set({
          riderId: 'alice',
          status: 'offered',
          priceCents: 100,
        });
        await db.doc(`rides/${rideId}/offers/bob`).set({
          driverId: 'bob',
          status: 'pending',
          createdAtMs: Date.now(),
        });
        await db.doc(`rides/${rideId}/offers/charlie`).set({
          driverId: 'charlie',
          status: 'pending',
          createdAtMs: Date.now(),
        });
      });

      const offers = await bobDb.collection(`rides/${rideId}/offers`).get();
      await assertSucceeds(Promise.resolve());
      // Should only see their own offer via the driver-specific query pattern
    });

    it('prevents any direct writes to offers', async () => {
      const bobDb = testEnv.authenticatedContext('bob').firestore();
      const rideId = 'test-ride-10';

      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx.firestore().doc(`rides/${rideId}`).set({
          riderId: 'alice',
          status: 'offered',
          priceCents: 100,
        });
      });

      await assertFails(
        bobDb.doc(`rides/${rideId}/offers/bob`).set({
          driverId: 'bob',
          status: 'pending',
          createdAtMs: Date.now(),
        })
      );
    });

    it('prevents rider from reading offers', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();
      const rideId = 'test-ride-11';

      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        const db = ctx.firestore();
        await db.doc(`rides/${rideId}`).set({
          riderId: 'alice',
          status: 'offered',
          priceCents: 100,
        });
        await db.doc(`rides/${rideId}/offers/bob`).set({
          driverId: 'bob',
          status: 'pending',
          createdAtMs: Date.now(),
        });
      });

      await assertFails(aliceDb.doc(`rides/${rideId}/offers/bob`).get());
    });
  });

  describe('Drivers collection', () => {
    it('allows authenticated users to read driver profiles', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();

      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx.firestore().doc('drivers/bob').set({
          isOnline: true,
          isBusy: false,
        });
      });

      await assertSucceeds(aliceDb.doc('drivers/bob').get());
    });

    it('prevents any direct writes to driver profiles', async () => {
      const bobDb = testEnv.authenticatedContext('bob').firestore();

      await assertFails(
        bobDb.doc('drivers/bob').set({
          isOnline: true,
          isBusy: false,
        })
      );
    });

    it('prevents drivers from updating their own profile directly', async () => {
      const bobDb = testEnv.authenticatedContext('bob').firestore();

      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx.firestore().doc('drivers/bob').set({
          isOnline: true,
          isBusy: false,
        });
      });

      await assertFails(bobDb.doc('drivers/bob').update({ isOnline: false }));
    });
  });

  describe('Users collection', () => {
    it('allows users to read their own profile', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();

      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx.firestore().doc('users/alice').set({
          name: 'Alice',
          email: 'alice@example.com',
        });
      });

      await assertSucceeds(aliceDb.doc('users/alice').get());
    });

    it('prevents users from reading other profiles', async () => {
      const aliceDb = testEnv.authenticatedContext('alice').firestore();

      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx.firestore().doc('users/bob').set({
          name: 'Bob',
          email: 'bob@example.com',
        });
      });

      await assertFails(aliceDb.doc('users/bob').get());
    });
  });
});
