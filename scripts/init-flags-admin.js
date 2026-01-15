#!/usr/bin/env node

// Use the admin SDK from functions/node_modules
const admin = require('../functions/node_modules/firebase-admin');

// Initialize without credentials (uses Application Default Credentials or gcloud auth)
admin.initializeApp({
  projectId: 'shiftx-95c4b'
});

const db = admin.firestore();

async function initRuntimeFlags() {
  console.log('🚀 Initializing runtime flags in production Firestore...');
  console.log('   Project: shiftx-95c4b');
  console.log('   Document: config/runtimeFlags');
  console.log('');
  
  try {
    const flags = {
      disablePayments: false,
      disableNewRequests: false,
      disableDriverOnline: false,
      disableAcceptRide: false,
      maintenanceMessage: '',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      updatedBy: 'automated-init',
      version: '1.0.0'
    };

    await db.collection('config').doc('runtimeFlags').set(flags, { merge: true });
    
    console.log('✅ Runtime flags document created!');
    console.log('');
    
    // Verify
    const doc = await db.collection('config').doc('runtimeFlags').get();
    if (doc.exists) {
      console.log('✅ Verification passed!');
      console.log('');
      console.log('Current flags:');
      console.log(JSON.stringify(doc.data(), null, 2));
      console.log('');
      console.log('🎉 Kill switches are operational!');
      console.log('');
      console.log('Firebase Console URL:');
      console.log('https://console.firebase.google.com/project/shiftx-95c4b/firestore/data/~2Fconfig~2FruntimeFlags');
      console.log('');
      console.log('✅ Phase 25 Production Hardening: COMPLETE');
    } else {
      console.log('⚠️  Warning: Write succeeded but verification failed');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('');
    
    if (error.message.includes('credentials') || error.message.includes('authentication')) {
      console.error('This script needs Firebase authentication.');
      console.error('');
      console.error('Option 1: Use gcloud CLI (recommended)');
      console.error('  gcloud auth application-default login');
      console.error('');
      console.error('Option 2: Use service account');
      console.error('  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"');
      console.error('');
      console.error('Option 3: Manual setup in Firebase Console');
      console.error('  Visit: https://console.firebase.google.com/project/shiftx-95c4b/firestore');
      console.error('  Create document: config/runtimeFlags');
      console.error('  Add fields from DEPLOYMENT_STATUS.md');
    }
    
    process.exit(1);
  }
}

initRuntimeFlags();
