#!/usr/bin/env node

/**
 * Add admin using Firebase JS SDK (client-side) to match driver app's Firestore instance
 * Usage: node scripts/addAdminClient.js <uid>
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'demo',
  authDomain: 'demo-no-project.firebaseapp.com',
  projectId: 'shiftx-95c4b',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig, 'admin-script');
const db = getFirestore(app);

// Connect to emulator
connectFirestoreEmulator(db, '127.0.0.1', 8081);
console.log('Connected to Firestore Emulator at 127.0.0.1:8081');

async function addAdmin(uid) {
  try {
    const configRef = doc(db, 'config', 'admins');
    const configDoc = await getDoc(configRef);
    
    let adminUids = [];
    if (configDoc.exists()) {
      adminUids = configDoc.data().uids || [];
    }
    
    if (adminUids.includes(uid)) {
      console.log(`✓ ${uid} is already an admin`);
      return;
    }
    
    adminUids.push(uid);
    
    await setDoc(configRef, {
      uids: adminUids,
      updatedAtMs: Date.now()
    }, { merge: true });
    
    console.log(`✓ Added ${uid} as admin`);
    console.log(`Total admins: ${adminUids.length}`);
    console.log('\nRefresh your driver app to see the Admin tab!');
  } catch (error) {
    console.error('Error adding admin:', error);
    process.exit(1);
  }
}

async function listAdmins() {
  try {
    const configRef = doc(db, 'config', 'admins');
    const configDoc = await getDoc(configRef);
    
    if (!configDoc.exists()) {
      console.log('No admins configured');
      return;
    }
    
    const adminUids = configDoc.data().uids || [];
    console.log(`\nCurrent admins (${adminUids.length}):`);
    adminUids.forEach((uid, i) => {
      console.log(`  ${i + 1}. ${uid}`);
    });
  } catch (error) {
    console.error('Error listing admins:', error);
    process.exit(1);
  }
}

async function main() {
  console.log('=== ShiftX Admin Management (Client SDK) ===\n');
  
  const args = process.argv.slice(2);
  const command = args[0];
  const uid = args[1];
  
  if (command === 'list' || !command) {
    await listAdmins();
  } else if (command === 'add') {
    if (!uid) {
      console.error('Usage: node scripts/addAdminClient.js add <uid>');
      process.exit(1);
    }
    await addAdmin(uid);
  } else {
    console.log('Usage:');
    console.log('  node scripts/addAdminClient.js list        # List all admins');
    console.log('  node scripts/addAdminClient.js add <uid>   # Add admin');
  }
  
  process.exit(0);
}

main();
