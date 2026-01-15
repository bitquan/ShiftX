#!/usr/bin/env node

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyCi9fz_lpRJh1dEnmRekGVh3Jc9JAyYHnU',
  authDomain: 'shiftx-95c4b.firebaseapp.com',
  projectId: 'shiftx-95c4b',
  storageBucket: 'shiftx-95c4b.firebasestorage.app',
  messagingSenderId: '928827778230',
  appId: '1:928827778230:web:ac7b78dcf4d7b93d22f217',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initRuntimeFlags() {
  console.log('🚀 Initializing runtime flags in Firestore...');
  
  try {
    const flagsRef = doc(db, 'config', 'runtimeFlags');
    
    await setDoc(flagsRef, {
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
    console.log('\n📍 View in Firebase Console:');
    console.log('   https://console.firebase.google.com/project/shiftx-95c4b/firestore/data/~2Fconfig~2FruntimeFlags');
    console.log('\n🔧 Available flags:');
    console.log('   - disablePayments: false ✅');
    console.log('   - disableNewRequests: false ✅');
    console.log('   - disableDriverOnline: false ✅');
    console.log('   - disableAcceptRide: false ✅');
    console.log('   - maintenanceMessage: "" ✅');
    console.log('\n🎉 Kill switches are ready! Toggle them in Firebase Console.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nThis script uses Firestore security rules.');
    console.error('Make sure you have admin access in Firebase Console.');
    process.exit(1);
  }
}

initRuntimeFlags();
