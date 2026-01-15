#!/usr/bin/env node

/**
 * Create test accounts for production smoke testing
 * This script creates a customer and driver account that can be used for smoke tests
 */

const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyCi9fz_lpRJh1dEnmRekGVh3Jc9JAyYHnU',
  authDomain: 'shiftx-95c4b.firebaseapp.com',
  projectId: 'shiftx-95c4b',
};

const customerEmail = 'smoketest-customer@shiftx.test';
const driverEmail = 'smoketest-driver@shiftx.test';
const password = process.env.TEST_PASSWORD || 'SmokeTest2026!';

async function createAccounts() {
  console.log('🔧 Creating test accounts for smoke testing...\n');
  
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    // Create customer
    console.log('Creating customer account...');
    const customerCred = await createUserWithEmailAndPassword(auth, customerEmail, password);
    console.log(`✓ Customer created: ${customerCred.user.uid}`);
    console.log(`  Email: ${customerEmail}`);

    // Create driver
    console.log('\nCreating driver account...');
    const driverCred = await createUserWithEmailAndPassword(auth, driverEmail, password);
    console.log(`✓ Driver created: ${driverCred.user.uid}`);
    console.log(`  Email: ${driverEmail}`);

    // Create driver document
    await setDoc(doc(db, 'drivers', driverCred.user.uid), {
      email: driverEmail,
      displayName: 'Smoke Test Driver',
      approved: true,
      isOnline: false,
      isBusy: false,
      location: { lat: 38.9419, lng: -77.4558 }, // Dulles Airport
      vehicleClass: 'shiftx',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      createdBy: 'smoke-test-setup',
    });
    console.log('✓ Driver document created');

    console.log('\n✅ Test accounts created successfully!\n');
    console.log('To run production smoke test, use:');
    console.log(`export TEST_CUSTOMER_EMAIL="${customerEmail}"`);
    console.log(`export TEST_DRIVER_EMAIL="${driverEmail}"`);
    console.log(`export TEST_PASSWORD="${password}"`);
    console.log('node scripts/smokeTest.js --mode production\n');

  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('\n✓ Accounts already exist - you can use them for testing\n');
      console.log('Use these credentials:');
      console.log(`export TEST_CUSTOMER_EMAIL="${customerEmail}"`);
      console.log(`export TEST_DRIVER_EMAIL="${driverEmail}"`);
      console.log(`export TEST_PASSWORD="${password}"`);
      console.log('node scripts/smokeTest.js --mode production\n');
    } else {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }

  process.exit(0);
}

createAccounts();
