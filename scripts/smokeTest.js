#!/usr/bin/env node

/**
 * End-to-end smoke test for production deployment
 * Tests the complete ride flow from request to completion
 * 
 * Usage:
 *   # Emulator mode (creates test users)
 *   node scripts/smokeTest.js --mode emulator
 * 
 *   # Production mode (uses existing accounts - SAFE)
 *   export TEST_CUSTOMER_EMAIL=customer@example.com
 *   export TEST_DRIVER_EMAIL=driver@example.com
 *   export TEST_PASSWORD=your_password
 *   node scripts/smokeTest.js --mode production
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, connectAuthEmulator } = require('firebase/auth');
const { getFirestore, doc, setDoc, getDoc, getDocs, collection, deleteDoc, updateDoc, connectFirestoreEmulator } = require('firebase/firestore');
const { getFunctions, httpsCallable, connectFunctionsEmulator } = require('firebase/functions');
const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
const modeIndex = args.indexOf('--mode');
const MODE = modeIndex >= 0 && args[modeIndex + 1] ? args[modeIndex + 1] : 'emulator';

const USE_EMULATOR = MODE === 'emulator';
const USE_PRODUCTION = MODE === 'production';
const FIREBASE_PROJECT_ID = 'shiftx-95c4b';
const TEST_RUN_ID = `test-${Date.now()}`;

// Validate production mode requirements
if (USE_PRODUCTION) {
  if (!process.env.TEST_CUSTOMER_EMAIL || !process.env.TEST_DRIVER_EMAIL || !process.env.TEST_PASSWORD) {
    console.error('\n❌ Production mode requires environment variables:');
    console.error('   TEST_CUSTOMER_EMAIL');
    console.error('   TEST_DRIVER_EMAIL');
    console.error('   TEST_PASSWORD\n');
    process.exit(1);
  }
}

const firebaseConfig = {
  apiKey: USE_EMULATOR ? 'demo-api-key' : (process.env.FIREBASE_API_KEY || 'AIzaSyCi9fz_lpRJh1dEnmRekGVh3Jc9JAyYHnU'),
  authDomain: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: FIREBASE_PROJECT_ID,
};

console.log(`\n🧪 ShiftX Smoke Test`);
console.log(`Mode: ${MODE.toUpperCase()}`);
console.log(`Test Run ID: ${TEST_RUN_ID}`);
if (USE_PRODUCTION) {
  console.log(`⚠️  PRODUCTION MODE - Using existing accounts`);
  console.log(`   Customer: ${process.env.TEST_CUSTOMER_EMAIL}`);
  console.log(`   Driver: ${process.env.TEST_DRIVER_EMAIL}`);
}
console.log('\n');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'us-central1');

if (USE_EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8081);
  connectFunctionsEmulator(functions, '127.0.0.1', 5002);
  console.log('🔌 Connected to emulators\n');
}

// Test data
const customerEmail = USE_PRODUCTION ? process.env.TEST_CUSTOMER_EMAIL : `customer-${TEST_RUN_ID}@test.com`;
const driverEmail = USE_PRODUCTION ? process.env.TEST_DRIVER_EMAIL : `driver-${TEST_RUN_ID}@test.com`;
const testPassword = USE_PRODUCTION ? process.env.TEST_PASSWORD : 'test123456';

const testLocations = {
  pickup: { lat: 38.9419, lng: -77.4558, address: 'Dulles Airport' },
  dropoff: { lat: 38.8895, lng: -77.0353, address: 'Pentagon' },
};

// Test state
let customerUid, driverUid, rideId;
const stepTimings = {};
const report = {
  testRunId: TEST_RUN_ID,
  mode: MODE,
  startedAt: Date.now(),
  steps: [],
  success: false,
  error: null,
};

// Helper: retry with exponential backoff
async function retryUntil(conditionFn, options = {}) {
  const {
    timeoutMs = 30000,
    initialDelayMs = 500,
    maxDelayMs = 5000,
    backoffMultiplier = 1.5,
    description = 'condition',
  } = options;

  const startTime = Date.now();
  let delay = initialDelayMs;
  let attempts = 0;

  while (Date.now() - startTime < timeoutMs) {
    attempts++;
    try {
      const result = await conditionFn();
      if (result) {
        return result;
      }
    } catch (error) {
      // Ignore errors, keep retrying
    }

    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * backoffMultiplier, maxDelayMs);
  }

  throw new Error(`Timeout waiting for ${description} after ${attempts} attempts`);
}


// Helper: record step timing
function recordStep(name, success, error = null, data = {}) {
  const step = {
    name,
    success,
    error: error ? error.message : null,
    data,
    timestamp: Date.now(),
  };
  report.steps.push(step);
  if (!success) {
    report.error = error ? error.message : 'Unknown error';
  }
}

// Step 0: Clean up old test data
async function cleanupOldTestData() {
  console.log('🧹 Step 0: Cleaning up old test data...');
  
  if (!USE_EMULATOR) {
    console.log('  ⚠️  Skipping cleanup in production mode\n');
    return;
  }
  
  try {
    // Set all online drivers to offline (emulator only)
    const driversSnap = await getDocs(collection(db, 'drivers'));
    const batch = [];
    
    for (const driverDoc of driversSnap.docs) {
      const driver = driverDoc.data();
      if (driver.isOnline || driver.testRunId) {
        batch.push(
          setDoc(doc(db, 'drivers', driverDoc.id), {
            ...driver,
            isOnline: false,
            isBusy: false,
            updatedAtMs: Date.now(),
          })
        );
      }
    }
    
    if (batch.length > 0) {
      await Promise.all(batch);
      console.log(`  ✓ Set ${batch.length} drivers offline\n`);
    } else {
      console.log('  ✓ No cleanup needed\n');
    }
  } catch (error) {
    console.log(`  ⚠️  Cleanup warning: ${error.message}\n`);
  }
}

// Step 1: Create test users (or sign in existing in production mode)
async function createTestUsers() {
  const stepStart = Date.now();
  console.log('📝 Step 1: Preparing test users...');
  
  try {
    if (USE_PRODUCTION) {
      // Production mode: sign in with existing accounts
      console.log('  🔒 Production mode: Using existing accounts');
      
      const customerCred = await signInWithEmailAndPassword(auth, customerEmail, testPassword);
      customerUid = customerCred.user.uid;
      console.log(`  ✓ Customer signed in: ${customerUid}`);
      
      await signOut(auth);
      
      const driverCred = await signInWithEmailAndPassword(auth, driverEmail, testPassword);
      driverUid = driverCred.user.uid;
      console.log(`  ✓ Driver signed in: ${driverUid}`);
      
      console.log(`  ✓ Production accounts ready\n`);
    } else {
      // Emulator mode: create new test users
      const customerCred = await createUserWithEmailAndPassword(auth, customerEmail, testPassword);
      customerUid = customerCred.user.uid;
      console.log(`  ✓ Customer created: ${customerUid}`);
      
      await signOut(auth);
      
      const driverCred = await createUserWithEmailAndPassword(auth, driverEmail, testPassword);
      driverUid = driverCred.user.uid;
      console.log(`  ✓ Driver created: ${driverUid}`);
      
      // Create driver document with location
      await setDoc(doc(db, 'drivers', driverUid), {
        email: driverEmail,
        displayName: 'Test Driver',
        approved: true,
        isOnline: false,
        isBusy: false,
        location: testLocations.pickup, // Set location immediately
        vehicleClass: 'shiftx', // Match service class
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
        testRunId: TEST_RUN_ID,
        createdBy: 'smoke-test',
      });
      
      console.log(`  ✓ Test users ready\n`);
    }
    
    stepTimings.createUsers = Date.now() - stepStart;
    recordStep('createTestUsers', true, null, { customerUid, driverUid });
  } catch (error) {
    recordStep('createTestUsers', false, error);
    throw error;
  }
}

// Step 2: Driver goes online
async function driverGoesOnline() {
  const stepStart = Date.now();
  console.log('🚗 Step 2: Driver going online...');
  
  try {
    await signInWithEmailAndPassword(auth, driverEmail, testPassword);
    
    const setOnline = httpsCallable(functions, 'driverSetOnline');
    await setOnline({
      location: testLocations.pickup,
      online: true,
    });
    
    // Send heartbeat to ensure location is set
    const heartbeat = httpsCallable(functions, 'driverHeartbeat');
    await heartbeat({
      location: testLocations.pickup,
    });
    
    console.log('  ✓ Driver is online with location\n');
    stepTimings.driverOnline = Date.now() - stepStart;
    recordStep('driverGoesOnline', true);
  } catch (error) {
    recordStep('driverGoesOnline', false, error);
    throw error;
  }
}

// Step 3: Customer requests ride
async function customerRequestsRide() {
  const stepStart = Date.now();
  console.log('🙋 Step 3: Customer requesting ride...');
  
  try {
    await signOut(auth);
    await signInWithEmailAndPassword(auth, customerEmail, testPassword);
    
    const tripRequest = httpsCallable(functions, 'tripRequest');
    const result = await tripRequest({
      pickup: testLocations.pickup,
      dropoff: testLocations.dropoff,
      serviceClass: 'shiftx', // Use valid enum value
      estimatedFareCents: 1500, // $15.00
    });
    
    rideId = result.data.rideId;
    console.log(`  ✓ Ride requested: ${rideId}\n`);
    stepTimings.requestRide = Date.now() - stepStart;
    recordStep('customerRequestsRide', true, null, { rideId });
    return rideId;
  } catch (error) {
    recordStep('customerRequestsRide', false, error);
    throw error;
  }
}

// Step 4: Driver accepts offer
async function driverAcceptsOffer() {
  const stepStart = Date.now();
  console.log('✋ Step 4: Driver accepting offer...');
  
  try {
    await signOut(auth);
    await signInWithEmailAndPassword(auth, driverEmail, testPassword);
    
    console.log('  ⏳ Waiting for offer...');
    console.log(`  📍 Looking for: rides/${rideId}/offers/${driverUid}`);
    
    // Wait for offer to appear in rides/{rideId}/offers/{driverId}
    const offerDocRef = doc(db, 'rides', rideId, 'offers', driverUid);
    const offerDoc = await retryUntil(
      async () => {
        const snap = await getDoc(offerDocRef);
        if (snap.exists()) {
          console.log(`  ℹ️  Offer found: status=${snap.data().status}`);
          if (snap.data().status === 'pending') {
            return snap;
          }
        }
        return null;
      },
      {
        timeoutMs: 30000,
        initialDelayMs: 1000, // Wait 1s before first check
        description: 'offer to appear',
      }
    );
    
    console.log(`  ✓ Offer received for driver ${driverUid}`);
    
    const acceptRide = httpsCallable(functions, 'acceptRide');
    await acceptRide({ rideId });
    
    console.log('  ✓ Offer accepted\n');
    stepTimings.acceptOffer = Date.now() - stepStart;
    recordStep('driverAcceptsOffer', true);
  } catch (error) {
    recordStep('driverAcceptsOffer', false, error);
    throw error;
  }
}

// Step 5: Customer authorizes payment
async function customerAuthorizesPayment() {
  const stepStart = Date.now();
  console.log('💳 Step 5: Customer authorizing payment...');
  
  try {
    await signOut(auth);
    await signInWithEmailAndPassword(auth, customerEmail, testPassword);
    
    // Check payment state
    const getPaymentState = httpsCallable(functions, 'getPaymentState');
    const stateResult = await getPaymentState({ rideId });
    
    console.log(`  ℹ️  Payment state: ${stateResult.data.paymentStatus}`);
    
    if (stateResult.data.paymentStatus === 'none') {
      const confirmPayment = httpsCallable(functions, 'customerConfirmPayment');
      const confirmResult = await confirmPayment({ rideId });
      console.log(`  ✓ PaymentIntent created: ${confirmResult.data.status}`);
    }
    
    if (USE_EMULATOR) {
      // Emulator: use shortcut
      const setAuthorized = httpsCallable(functions, 'setPaymentAuthorized');
      await setAuthorized({ rideId });
      console.log('  ✓ Payment authorized (emulator shortcut)\n');
    } else {
      // Production: verify payment is required
      console.log('  ℹ️  In production, user would complete Stripe payment here');
      console.log('  ⚠️  Skipping payment authorization in prod mode\n');
    }
    
    stepTimings.authorizePayment = Date.now() - stepStart;
    recordStep('customerAuthorizesPayment', true);
  } catch (error) {
    recordStep('customerAuthorizesPayment', false, error);
    throw error;
  }
}

// Step 6: Driver starts ride
async function driverStartsRide() {
  const stepStart = Date.now();
  console.log('🚦 Step 6: Driver starting ride...');
  
  try {
    await signOut(auth);
    await signInWithEmailAndPassword(auth, driverEmail, testPassword);
    
    if (USE_EMULATOR) {
      // Wait for payment authorization
      console.log('  ⏳ Waiting for payment authorization...');
      await retryUntil(
        async () => {
          const rideSnap = await getDoc(doc(db, 'rides', rideId));
          const data = rideSnap.data();
          return data?.paymentStatus === 'authorized' || data?.paymentAuthorized;
        },
        {
          timeoutMs: 15000,
          description: 'payment authorization',
        }
      );
      
      const startRide = httpsCallable(functions, 'startRide');
      await startRide({ rideId });
      
      console.log('  ✓ Ride started\n');
      stepTimings.startRide = Date.now() - stepStart;
      recordStep('driverStartsRide', true);
    } else {
      // Production: verify startRide is blocked without payment
      console.log('  ℹ️  Testing that startRide is blocked without payment...');
      try {
        const startRide = httpsCallable(functions, 'startRide');
        await startRide({ rideId });
        throw new Error('startRide should have been blocked without payment authorization');
      } catch (error) {
        if (error.code === 'functions/failed-precondition') {
          console.log('  ✓ Confirmed: startRide correctly blocked without payment\n');
          stepTimings.startRide = Date.now() - stepStart;
          recordStep('driverStartsRide', true, null, { blockedCorrectly: true });
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    recordStep('driverStartsRide', false, error);
    throw error;
  }
}

// Step 7: Driver completes ride
async function driverCompletesRide() {
  const stepStart = Date.now();
  console.log('🏁 Step 7: Driver completing ride...');
  
  try {
    // First, progress the ride to in_progress status
    const progressRide = httpsCallable(functions, 'progressRide');
    await progressRide({ rideId });
    console.log('  ✓ Ride progressed to in_progress');
    
    const completeRide = httpsCallable(functions, 'completeRide');
    await completeRide({ rideId });
    
    console.log('  ✓ Ride completed\n');
    stepTimings.completeRide = Date.now() - stepStart;
    recordStep('driverCompletesRide', true);
  } catch (error) {
    recordStep('driverCompletesRide', false, error);
    throw error;
  }
}


// Step 8: Verify final state
async function verifyFinalState() {
  const stepStart = Date.now();
  console.log('🔍 Step 8: Verifying final state...');
  
  try {
    const rideSnap = await getDoc(doc(db, 'rides', rideId));
    
    if (!rideSnap.exists()) {
      throw new Error('Ride document not found');
    }
    
    const ride = rideSnap.data();
    
    const checks = [
      { name: 'Ride status', actual: ride.status, expected: 'completed', pass: ride.status === 'completed' },
      { name: 'Payment captured', actual: ride.paymentStatus, expected: 'captured', pass: ride.paymentStatus === 'captured' },
      { name: 'Driver assigned', actual: !!ride.driverId, expected: true, pass: !!ride.driverId },
      { name: 'Completion time', actual: !!ride.completedAtMs, expected: true, pass: !!ride.completedAtMs },
    ];
    
    console.log('  Final state checks:');
    checks.forEach(check => {
      const icon = check.pass ? '✓' : '✗';
      console.log(`    ${icon} ${check.name}: ${check.actual} ${check.pass ? '' : `(expected: ${check.expected})`}`);
    });
    
    const allPassed = checks.every(c => c.pass);
    console.log(allPassed ? '\n✅ All checks passed!\n' : '\n❌ Some checks failed\n');
    
    stepTimings.verify = Date.now() - stepStart;
    recordStep('verifyFinalState', allPassed, allPassed ? null : new Error('Some checks failed'), { checks });
    
    return allPassed;
  } catch (error) {
    recordStep('verifyFinalState', false, error);
    throw error;
  }
}

// Cleanup function
async function cleanup() {
  console.log('🧹 Cleaning up...');
  
  try {
    // Cancel ride if not completed
    if (rideId) {
      const rideSnap = await getDoc(doc(db, 'rides', rideId));
      if (rideSnap.exists()) {
        const ride = rideSnap.data();
        if (ride.status !== 'completed' && ride.status !== 'cancelled') {
          try {
            await signOut(auth);
            await signInWithEmailAndPassword(auth, customerEmail, testPassword);
            const cancelRide = httpsCallable(functions, 'cancelRide');
            await cancelRide({ rideId });
            console.log('  ✓ Ride cancelled');
          } catch (error) {
            console.log(`  ⚠️  Could not cancel ride: ${error.message}`);
          }
        }
        
        // Delete ride document only in emulator mode
        if (!USE_PRODUCTION && (ride.testRunId === TEST_RUN_ID || ride.createdBy === 'smoke-test')) {
          try {
            await deleteDoc(doc(db, 'rides', rideId));
            console.log('  ✓ Ride document deleted');
          } catch (error) {
            console.log(`  ⚠️  Could not delete ride: ${error.message}`);
          }
        }
      }
    }
    
    // Set driver offline
    if (driverUid) {
      try {
        await signOut(auth);
        await signInWithEmailAndPassword(auth, driverEmail, testPassword);
        const setOnline = httpsCallable(functions, 'driverSetOnline');
        await setOnline({ location: testLocations.pickup, online: false });
        console.log('  ✓ Driver set offline');
      } catch (error) {
        console.log(`  ⚠️  Could not set driver offline: ${error.message}`);
      }
      
      // Delete driver document only in emulator mode
      if (!USE_PRODUCTION) {
        const driverSnap = await getDoc(doc(db, 'drivers', driverUid));
        if (driverSnap.exists()) {
          const driver = driverSnap.data();
          if (driver.testRunId === TEST_RUN_ID || driver.createdBy === 'smoke-test') {
            try {
              await deleteDoc(doc(db, 'drivers', driverUid));
              console.log('  ✓ Driver document deleted');
            } catch (error) {
              console.log(`  ⚠️  Could not delete driver: ${error.message}`);
            }
          }
        }
      }
    }
    
    console.log('✓ Cleanup complete\n');
  } catch (error) {
    console.log(`⚠️  Cleanup failed: ${error.message}\n`);
  }
}

// Print final report
function printReport() {
  report.completedAt = Date.now();
  report.durationMs = report.completedAt - report.startedAt;
  report.timings = stepTimings;
  report.rideId = rideId;
  report.customerUid = customerUid;
  report.driverUid = driverUid;
  
  console.log('📊 Test Report:');
  console.log(JSON.stringify(report, null, 2));
  
  // Write JSON report to file
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const filename = `smoke-test-${USE_PRODUCTION ? 'production' : 'emulator'}-${timestamp}.json`;
  const reportPath = path.join(__dirname, '..', 'test-reports', filename);
  
  try {
    // Ensure directory exists
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);
  } catch (error) {
    console.warn(`⚠️  Failed to save report file: ${error.message}`);
  }
  
  console.log('');
}

// Main test runner
async function runSmokeTest() {
  try {
    if (!USE_EMULATOR) {
      await createTestUsers();
      await driverGoesOnline();
      await customerRequestsRide();
      await driverAcceptsOffer();
      await customerAuthorizesPayment();
      await driverStartsRide();
      
      console.log('⚠️  Production mode: Skipping complete ride and verification');
      console.log('✅ Payment authorization gate verified successfully\n');
      
      report.success = true;
    } else {
      await cleanupOldTestData();
      await createTestUsers();
      await driverGoesOnline();
      await customerRequestsRide();
      await driverAcceptsOffer();
      await customerAuthorizesPayment();
      await driverStartsRide();
      await driverCompletesRide();
      const passed = await verifyFinalState();
      
      report.success = passed;
    }
    
    return report.success;
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    report.success = false;
    report.error = error.message;
    return false;
  } finally {
    await cleanup();
    printReport();
  }
}

// Run the test
runSmokeTest()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

