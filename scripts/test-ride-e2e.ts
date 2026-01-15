#!/usr/bin/env ts-node

/**
 * End-to-End Ride Flow Test
 * Tests the complete ride lifecycle and validates Timeline events
 */

import * as admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../service-account-key.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount),
  projectId: 'shiftx-95c4b',
});

const auth = getAuth();
const db = getFirestore();

interface TestResult {
  step: string;
  success: boolean;
  error?: string;
  data?: any;
}

const results: TestResult[] = [];

function logResult(step: string, success: boolean, error?: string, data?: any) {
  results.push({ step, success, error, data });
  const icon = success ? '✅' : '❌';
  console.log(`${icon} ${step}`);
  if (error) console.error(`   Error: ${error}`);
  if (data) console.log(`   Data:`, JSON.stringify(data, null, 2));
}

async function createTestUser(email: string, role: 'customer' | 'driver'): Promise<string> {
  try {
    // Try to get existing user
    let user;
    try {
      user = await auth.getUserByEmail(email);
      console.log(`   Using existing ${role}: ${user.uid}`);
    } catch {
      // Create new user
      user = await auth.createUser({
        email,
        password: 'test123456',
        displayName: `Test ${role}`,
      });
      console.log(`   Created ${role}: ${user.uid}`);
    }

    // Create/update profile
    if (role === 'customer') {
      await db.collection('users').doc(user.uid).set({
        email,
        displayName: `Test Customer`,
        role: 'customer',
        createdAtMs: Date.now(),
      }, { merge: true });
    } else {
      await db.collection('drivers').doc(user.uid).set({
        email,
        displayName: `Test Driver`,
        isOnline: true,
        isBusy: false,
        location: {
          lat: 38.8780,
          lng: -77.1114,
        },
        createdAtMs: Date.now(),
        lastSeenAtMs: Date.now(),
      }, { merge: true });
    }

    return user.uid;
  } catch (error: any) {
    throw new Error(`Failed to create ${role}: ${error.message}`);
  }
}

async function requestRide(customerId: string): Promise<string> {
  try {
    const rideRef = db.collection('rides').doc();
    const now = Date.now();

    await rideRef.set({
      customerId,
      status: 'requested',
      pickup: {
        lat: 38.8780,
        lng: -77.1114,
        address: '4200 North Carlin Springs Road, Arlington, VA 22203',
      },
      dropoff: {
        lat: 38.8712,
        lng: -77.1242,
        address: '864 North Jefferson Street, Arlington, VA 22205',
      },
      priceCents: 1500,
      estimatedFareCents: 1500,
      distanceMeters: 2000,
      durationSeconds: 300,
      serviceClass: 'shiftx',
      createdAtMs: now,
      updatedAtMs: now,
      searchStartedAtMs: now,
      searchExpiresAtMs: now + 120000,
    });

    console.log(`   Ride created: ${rideRef.id}`);
    return rideRef.id;
  } catch (error: any) {
    throw new Error(`Failed to request ride: ${error.message}`);
  }
}

async function createOffer(rideId: string, driverId: string): Promise<void> {
  try {
    const offerRef = db.collection('rides').doc(rideId).collection('offers').doc(driverId);
    const now = Date.now();

    await offerRef.set({
      driverId,
      status: 'pending',
      createdAtMs: now,
      expiresAtMs: now + 30000,
      distanceMeters: 1000,
    });

    // Update ride to offered status
    await db.collection('rides').doc(rideId).update({
      status: 'offered',
      updatedAtMs: now,
    });

    console.log(`   Offer created for driver ${driverId}`);
  } catch (error: any) {
    throw new Error(`Failed to create offer: ${error.message}`);
  }
}

async function acceptRide(rideId: string, driverId: string): Promise<void> {
  try {
    const now = Date.now();

    // Use transaction to accept ride
    await db.runTransaction(async (transaction) => {
      const rideRef = db.collection('rides').doc(rideId);
      const driverRef = db.collection('drivers').doc(driverId);

      transaction.update(rideRef, {
        status: 'accepted',
        driverId,
        acceptedAtMs: now,
        updatedAtMs: now,
      });

      transaction.update(driverRef, {
        isBusy: true,
        currentRideId: rideId,
        currentRideStatus: 'accepted',
        updatedAtMs: now,
      });
    });

    // Log event manually (since we're not calling the cloud function)
    await db.collection('rides').doc(rideId).collection('events').add({
      type: 'ride_accepted',
      atMs: now,
      meta: { driverId },
    });

    console.log(`   Ride accepted by driver ${driverId}`);
  } catch (error: any) {
    throw new Error(`Failed to accept ride: ${error.message}`);
  }
}

async function startRide(rideId: string, driverId: string): Promise<void> {
  try {
    const now = Date.now();

    await db.runTransaction(async (transaction) => {
      const rideRef = db.collection('rides').doc(rideId);
      const driverRef = db.collection('drivers').doc(driverId);

      transaction.update(rideRef, {
        status: 'started',
        startedAtMs: now,
        updatedAtMs: now,
      });

      transaction.update(driverRef, {
        currentRideStatus: 'started',
        updatedAtMs: now,
      });
    });

    // Log event
    await db.collection('rides').doc(rideId).collection('events').add({
      type: 'ride_started',
      atMs: now,
      meta: { driverId },
    });

    console.log(`   Ride started by driver ${driverId}`);
  } catch (error: any) {
    throw new Error(`Failed to start ride: ${error.message}`);
  }
}

async function progressRide(rideId: string, driverId: string): Promise<void> {
  try {
    const now = Date.now();

    await db.runTransaction(async (transaction) => {
      const rideRef = db.collection('rides').doc(rideId);
      const driverRef = db.collection('drivers').doc(driverId);

      transaction.update(rideRef, {
        status: 'in_progress',
        updatedAtMs: now,
      });

      transaction.update(driverRef, {
        currentRideStatus: 'in_progress',
        updatedAtMs: now,
      });
    });

    // Log event
    await db.collection('rides').doc(rideId).collection('events').add({
      type: 'ride_started',
      atMs: now,
      meta: { driverId, status: 'in_progress' },
    });

    console.log(`   Ride progressed to in_progress`);
  } catch (error: any) {
    throw new Error(`Failed to progress ride: ${error.message}`);
  }
}

async function completeRide(rideId: string, driverId: string): Promise<void> {
  try {
    const now = Date.now();

    await db.runTransaction(async (transaction) => {
      const rideRef = db.collection('rides').doc(rideId);
      const driverRef = db.collection('drivers').doc(driverId);

      transaction.update(rideRef, {
        status: 'completed',
        completedAtMs: now,
        updatedAtMs: now,
      });

      transaction.update(driverRef, {
        isBusy: false,
        currentRideId: null,
        currentRideStatus: null,
        updatedAtMs: now,
      });
    });

    // Log event
    await db.collection('rides').doc(rideId).collection('events').add({
      type: 'ride_completed',
      atMs: now,
      meta: { driverId },
    });

    console.log(`   Ride completed`);
  } catch (error: any) {
    throw new Error(`Failed to complete ride: ${error.message}`);
  }
}

async function verifyEvents(rideId: string, expectedEventCount: number): Promise<boolean> {
  try {
    const eventsSnap = await db
      .collection('rides')
      .doc(rideId)
      .collection('events')
      .orderBy('atMs', 'asc')
      .get();

    const events = eventsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as { type: string; atMs: number; [key: string]: any },
    }));

    console.log(`   Found ${events.length} events (expected ${expectedEventCount})`);
    
    if (events.length !== expectedEventCount) {
      console.log(`   ⚠️  Event count mismatch!`);
      console.log(`   Events:`, JSON.stringify(events, null, 2));
      return false;
    }

    console.log(`   Events:`);
    events.forEach(event => {
      console.log(`     - ${event.type} at ${new Date(event.atMs).toLocaleTimeString()}`);
    });

    return true;
  } catch (error: any) {
    throw new Error(`Failed to verify events: ${error.message}`);
  }
}

async function runE2ETest() {
  console.log('\n🚀 Starting End-to-End Ride Flow Test\n');
  console.log('=' .repeat(60));

  let customerId: string = '';
  let driverId: string = '';
  let rideId: string = '';

  try {
    // Step 1: Create test users
    console.log('\n📝 Step 1: Creating test users...');
    try {
      customerId = await createTestUser('test-customer@shiftx.com', 'customer');
      logResult('Create customer', true, undefined, { customerId });
    } catch (error: any) {
      logResult('Create customer', false, error.message);
      return;
    }

    try {
      driverId = await createTestUser('test-driver@shiftx.com', 'driver');
      logResult('Create driver', true, undefined, { driverId });
    } catch (error: any) {
      logResult('Create driver', false, error.message);
      return;
    }

    // Step 2: Request ride
    console.log('\n📝 Step 2: Requesting ride...');
    try {
      rideId = await requestRide(customerId);
      logResult('Request ride', true, undefined, { rideId });
    } catch (error: any) {
      logResult('Request ride', false, error.message);
      return;
    }

    // Step 3: Create offer
    console.log('\n📝 Step 3: Creating offer...');
    try {
      await createOffer(rideId, driverId);
      logResult('Create offer', true);
    } catch (error: any) {
      logResult('Create offer', false, error.message);
      return;
    }

    // Step 4: Accept ride
    console.log('\n📝 Step 4: Accepting ride...');
    try {
      await acceptRide(rideId, driverId);
      logResult('Accept ride', true);
    } catch (error: any) {
      logResult('Accept ride', false, error.message);
      return;
    }

    // Step 5: Start ride
    console.log('\n📝 Step 5: Starting ride...');
    try {
      await startRide(rideId, driverId);
      logResult('Start ride', true);
    } catch (error: any) {
      logResult('Start ride', false, error.message);
      return;
    }

    // Step 6: Progress ride
    console.log('\n📝 Step 6: Progressing ride to in_progress...');
    try {
      await progressRide(rideId, driverId);
      logResult('Progress ride', true);
    } catch (error: any) {
      logResult('Progress ride', false, error.message);
      return;
    }

    // Step 7: Complete ride
    console.log('\n📝 Step 7: Completing ride...');
    try {
      await completeRide(rideId, driverId);
      logResult('Complete ride', true);
    } catch (error: any) {
      logResult('Complete ride', false, error.message);
      return;
    }

    // Step 8: Verify events
    console.log('\n📝 Step 8: Verifying Timeline events...');
    try {
      const eventsValid = await verifyEvents(rideId, 4); // accept, start, progress, complete
      logResult('Verify events', eventsValid, eventsValid ? undefined : 'Event count mismatch');
    } catch (error: any) {
      logResult('Verify events', false, error.message);
      return;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary\n');
    
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
    
    console.log(`\n🔗 View ride in Firebase Console:`);
    console.log(`https://console.firebase.google.com/project/shiftx-95c4b/firestore/data/rides/${rideId}`);
    
    console.log(`\n👀 View Timeline in customer app:`);
    console.log(`https://shiftx-95c4b-customer.web.app?rideId=${rideId}`);

  } catch (error: any) {
    console.error('\n❌ Test failed with unexpected error:', error);
  }

  const failed = results.filter(r => !r.success).length;
  process.exit(failed > 0 ? 1 : 0);
}

// Run the test
runE2ETest().catch(console.error);
