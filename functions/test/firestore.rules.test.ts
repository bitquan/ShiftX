import * as fs from 'fs';
import { expect } from 'chai';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

describe('Firestore rules (rides)', function () {
  let testEnv: any;

  before(async () => {
    // Prefer existing FIRESTORE_EMULATOR_HOST env var (format host:port), else default to localhost:8080
    const hostEnv = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
    const [host, portStr] = hostEnv.split(':');
    const port = Number(portStr) || 8080;

    testEnv = await initializeTestEnvironment({
      projectId: 'demo-no-project',
      firestore: { host, port, rules: fs.readFileSync('../firestore.rules', 'utf8') },
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it('allows rider to create a requested ride', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(alice.collection('rides').add({
      riderId: 'alice',
      status: 'requested',
      priceCents: 100,
      pickup: { lat: 0, lng: 0 },
    }));
  });

  it('prevents rider from creating a ride with status accepted', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(alice.collection('rides').add({
      riderId: 'alice',
      status: 'accepted',
      priceCents: 100,
    }));
  });

  it('prevents rider from updating status field', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const ref = await aliceDb.collection('rides').add({
      riderId: 'alice',
      status: 'requested',
      priceCents: 100,
    });

    await assertFails(ref.update({ status: 'accepted' }));
  });

  it('prevents driver from setting driverId/status directly', async () => {
    const bobDb = testEnv.authenticatedContext('bob').firestore();
    // Simulate server creating the ride (admin) bypassing security rules
    // Create a deterministic test id and seed via admin (server-side) helper
    const id = `test_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
      const adminDb = ctx.firestore();
      await adminDb.doc(`rides/${id}`).set({
        riderId: 'someone',
        status: 'requested',
        priceCents: 100,
      });
    });

    // driver trying to claim it should fail
    await assertFails(bobDb.collection('rides').doc(id).update({ driverId: 'bob', status: 'accepted' }));
  });

  it('allows reading rides for signed in users', async () => {
    const aliceDb = testEnv.authenticatedContext('alice').firestore();
    const ref = await aliceDb.collection('rides').add({
      riderId: 'alice',
      status: 'requested',
      priceCents: 100,
    });

    await assertSucceeds(aliceDb.doc(ref.path).get());
  });
});
