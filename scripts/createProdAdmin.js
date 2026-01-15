#!/usr/bin/env node

/**
 * Create a production admin user using Firebase Admin SDK
 * Requires service account credentials
 */

const admin = require('firebase-admin');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createProdAdmin() {
  console.log('\n🔐 Production Admin Setup\n');
  
  // Check for service account
  let serviceAccount;
  try {
    serviceAccount = require('../serviceAccountKey.json');
  } catch (error) {
    console.error('❌ Error: serviceAccountKey.json not found');
    console.log('\nTo get your service account key:');
    console.log('1. Go to: https://console.firebase.google.com/project/shiftx-95c4b/settings/serviceaccounts/adminsdk');
    console.log('2. Click "Generate new private key"');
    console.log('3. Save as serviceAccountKey.json in the project root\n');
    process.exit(1);
  }

  // Initialize Firebase Admin
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
  });

  const auth = admin.auth();
  const db = admin.firestore();

  // Get admin credentials
  const email = await question('Admin email (default: admin@shiftx.com): ') || 'admin@shiftx.com';
  const password = await question('Admin password (default: admin123): ') || 'admin123';

  console.log('\nCreating admin user...');

  try {
    // Check if user exists
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`✓ User already exists with UID: ${userRecord.uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        userRecord = await auth.createUser({
          email,
          password,
          emailVerified: true,
        });
        console.log(`✓ User created with UID: ${userRecord.uid}`);
      } else {
        throw error;
      }
    }

    const uid = userRecord.uid;

    // Add to admin list
    const configRef = db.collection('config').doc('admins');
    const configSnap = await configRef.get();

    let adminUids = [];
    if (configSnap.exists) {
      adminUids = configSnap.data().uids || [];
    }

    if (!adminUids.includes(uid)) {
      adminUids.push(uid);
      await configRef.set({
        uids: adminUids,
        updatedAtMs: Date.now(),
      }, { merge: true });
      console.log('✓ Added to admin list');
    } else {
      console.log('✓ Already in admin list');
    }

    // Create user document
    const userRef = db.collection('users').doc(uid);
    await userRef.set({
      email,
      role: 'admin',
      createdAtMs: Date.now(),
    }, { merge: true });
    console.log('✓ User document created');

    console.log('\n✅ Admin setup complete!\n');
    console.log('Login credentials:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  UID: ${uid}`);
    console.log('\nAdmin Dashboard: https://shiftx-95c4b-admin.web.app\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

createProdAdmin();
