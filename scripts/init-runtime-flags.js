#!/usr/bin/env node
/**
 * Initialize Runtime Flags in Production
 * 
 * This script creates the config/runtimeFlags document with safe defaults.
 * Run once after deployment.
 */

const admin = require('firebase-admin');

// Initialize with application default credentials (uses GOOGLE_APPLICATION_CREDENTIALS)
admin.initializeApp({
  projectId: 'shiftx-95c4b'
});

const db = admin.firestore();

async function initRuntimeFlags() {
  console.log('🚀 Initializing runtime flags...');
  
  const flagsRef = db.collection('config').doc('runtimeFlags');
  
  await flagsRef.set({
    disablePayments: false,
    disableNewRequests: false,
    disableDriverOnline: false,
    disableAcceptRide: false,
    maintenanceMessage: '',
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    updatedBy: 'init-script',
    version: '1.0.0'
  }, { merge: true });
  
  console.log('✅ Runtime flags initialized successfully!');
  console.log('\nCurrent flags:');
  const doc = await flagsRef.get();
  console.log(JSON.stringify(doc.data(), null, 2));
  
  console.log('\n📝 To update flags in production:');
  console.log('   Firebase Console → Firestore → config/runtimeFlags');
  console.log('\n🔧 Available flags:');
  console.log('   - disablePayments: Prevent payment authorization/capture');
  console.log('   - disableNewRequests: Prevent customers from requesting rides');
  console.log('   - disableDriverOnline: Prevent drivers from going online');
  console.log('   - disableAcceptRide: Prevent drivers from accepting rides');
  console.log('   - maintenanceMessage: Banner message for users\n');
  
  process.exit(0);
}

initRuntimeFlags().catch(err => {
  console.error('❌ Error initializing flags:', err);
  console.error('\nMake sure you have Firebase credentials configured:');
  console.error('  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"');
  console.error('  OR run: firebase login');
  process.exit(1);
});
