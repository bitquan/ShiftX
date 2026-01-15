import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { callableOptions } from './cors';

const db = admin.firestore();
const auth = admin.auth();

interface SmokeTestSetupRequest {
  testRunId: string;
  customerEmail?: string;
  driverEmail?: string;
}

interface SmokeTestCleanupRequest {
  testRunId: string;
}

/**
 * smokeTestSetup - Create test users and data for smoke tests
 * This bypasses Firestore security rules by using Admin SDK
 */
export const smokeTestSetup = onCall<SmokeTestSetupRequest>(
  callableOptions,
  async (request) => {
    const { testRunId, customerEmail, driverEmail } = request.data;

    if (!testRunId) {
      throw new HttpsError('invalid-argument', 'testRunId is required');
    }

    // Only allow in non-production or with explicit flag
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];
    const origin = request.rawRequest.headers.origin || '';
    
    if (!allowedOrigins.includes(origin)) {
      throw new HttpsError('permission-denied', 'Smoke tests only allowed from localhost');
    }

    try {
      const customerUid = `smoke-test-customer-${testRunId}`;
      const driverUid = `smoke-test-driver-${testRunId}`;
      
      // Create customer user
      const customerAuthEmail = customerEmail || `customer-${testRunId}@smoketest.local`;
      try {
        await auth.createUser({
          uid: customerUid,
          email: customerAuthEmail,
          password: 'smoketest123',
          emailVerified: true,
        });
      } catch (error: any) {
        if (error.code !== 'auth/uid-already-exists') {
          throw error;
        }
      }

      // Create driver user
      const driverAuthEmail = driverEmail || `driver-${testRunId}@smoketest.local`;
      try {
        await auth.createUser({
          uid: driverUid,
          email: driverAuthEmail,
          password: 'smoketest123',
          emailVerified: true,
        });
      } catch (error: any) {
        if (error.code !== 'auth/uid-already-exists') {
          throw error;
        }
      }

      // Create customer document
      await db.collection('users').doc(customerUid).set({
        email: customerAuthEmail,
        role: 'customer',
        onboardingStatus: 'active',
        createdAtMs: Date.now(),
        testRunId,
        createdBy: 'smoke-test',
      });

      // Create driver document
      await db.collection('drivers').doc(driverUid).set({
        isOnline: false,
        isBusy: false,
        approved: true,
        vehicleClass: 'shiftx',
        location: {
          lat: 40.7580,
          lng: -73.9855,
        },
        updatedAtMs: Date.now(),
        testRunId,
        createdBy: 'smoke-test',
      });

      await db.collection('users').doc(driverUid).set({
        email: driverAuthEmail,
        role: 'driver',
        onboardingStatus: 'active',
        createdAtMs: Date.now(),
        testRunId,
        createdBy: 'smoke-test',
      });

      return {
        success: true,
        customerUid,
        driverUid,
        customerEmail: customerAuthEmail,
        driverEmail: driverAuthEmail,
      };
    } catch (error: any) {
      console.error('Smoke test setup failed:', error);
      throw new HttpsError('internal', `Setup failed: ${error.message}`);
    }
  }
);

/**
 * smokeTestCleanup - Remove test users and data
 */
export const smokeTestCleanup = onCall<SmokeTestCleanupRequest>(
  callableOptions,
  async (request) => {
    const { testRunId } = request.data;

    if (!testRunId) {
      throw new HttpsError('invalid-argument', 'testRunId is required');
    }

    // Only allow from localhost
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];
    const origin = request.rawRequest.headers.origin || '';
    
    if (!allowedOrigins.includes(origin)) {
      throw new HttpsError('permission-denied', 'Smoke tests only allowed from localhost');
    }

    try {
      const customerUid = `smoke-test-customer-${testRunId}`;
      const driverUid = `smoke-test-driver-${testRunId}`;

      // Delete auth users
      try {
        await auth.deleteUser(customerUid);
      } catch (error: any) {
        if (error.code !== 'auth/user-not-found') {
          console.warn('Failed to delete customer auth user:', error);
        }
      }

      try {
        await auth.deleteUser(driverUid);
      } catch (error: any) {
        if (error.code !== 'auth/user-not-found') {
          console.warn('Failed to delete driver auth user:', error);
        }
      }

      // Delete Firestore documents
      const batch = db.batch();
      
      batch.delete(db.collection('users').doc(customerUid));
      batch.delete(db.collection('users').doc(driverUid));
      batch.delete(db.collection('drivers').doc(driverUid));

      // Delete any rides created by this test run
      const ridesSnapshot = await db.collection('rides')
        .where('testRunId', '==', testRunId)
        .get();
      
      for (const rideDoc of ridesSnapshot.docs) {
        batch.delete(rideDoc.ref);
        
        // Delete offers subcollection
        const offersSnapshot = await rideDoc.ref.collection('offers').get();
        for (const offerDoc of offersSnapshot.docs) {
          batch.delete(offerDoc.ref);
        }
        
        // Delete events subcollection
        const eventsSnapshot = await rideDoc.ref.collection('events').get();
        for (const eventDoc of eventsSnapshot.docs) {
          batch.delete(eventDoc.ref);
        }
      }

      await batch.commit();

      return { success: true, cleaned: true };
    } catch (error: any) {
      console.error('Smoke test cleanup failed:', error);
      throw new HttpsError('internal', `Cleanup failed: ${error.message}`);
    }
  }
);
