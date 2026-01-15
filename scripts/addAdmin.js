#!/usr/bin/env node

/**
 * Add an admin user to the Firestore config
 * Usage: node scripts/addAdmin.js <uid>
 */

const admin = require('firebase-admin');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Check if running against emulator
const useEmulator = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8081';

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_EMULATOR) {
    console.log('Using Firebase Emulator at', useEmulator);
    admin.initializeApp({
      projectId: 'shiftx-95c4b'
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log('Connected to Firestore Emulator');
}

async function addAdmin(uid) {
  try {
    const configRef = db.collection('config').doc('admins');
    const configDoc = await configRef.get();
    
    let adminUids = [];
    if (configDoc.exists) {
      adminUids = configDoc.data().uids || [];
    }
    
    if (adminUids.includes(uid)) {
      console.log(`✓ ${uid} is already an admin`);
      return;
    }
    
    adminUids.push(uid);
    
    await configRef.set({
      uids: adminUids,
      updatedAtMs: Date.now()
    }, { merge: true });
    
    console.log(`✓ Added ${uid} as admin`);
    console.log(`Total admins: ${adminUids.length}`);
  } catch (error) {
    console.error('Error adding admin:', error);
    process.exit(1);
  }
}

async function listAdmins() {
  try {
    const configRef = db.collection('config').doc('admins');
    const configDoc = await configRef.get();
    
    if (!configDoc.exists) {
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

async function removeAdmin(uid) {
  try {
    const configRef = db.collection('config').doc('admins');
    const configDoc = await configRef.get();
    
    if (!configDoc.exists) {
      console.log('No admins configured');
      return;
    }
    
    let adminUids = configDoc.data().uids || [];
    
    if (!adminUids.includes(uid)) {
      console.log(`${uid} is not an admin`);
      return;
    }
    
    adminUids = adminUids.filter(id => id !== uid);
    
    await configRef.set({
      uids: adminUids,
      updatedAtMs: Date.now()
    }, { merge: true });
    
    console.log(`✓ Removed ${uid} from admins`);
    console.log(`Total admins: ${adminUids.length}`);
  } catch (error) {
    console.error('Error removing admin:', error);
    process.exit(1);
  }
}

async function getCurrentUserUid() {
  return new Promise((resolve) => {
    rl.question('\nEnter your Firebase Auth UID (or press Enter to list admins): ', (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('=== ShiftX Admin Management ===\n');
  
  const args = process.argv.slice(2);
  const command = args[0];
  const uid = args[1];
  
  if (command === 'list' || !command) {
    await listAdmins();
  } else if (command === 'add') {
    if (!uid) {
      const inputUid = await getCurrentUserUid();
      if (!inputUid) {
        await listAdmins();
      } else {
        await addAdmin(inputUid);
      }
    } else {
      await addAdmin(uid);
    }
  } else if (command === 'remove') {
    if (!uid) {
      console.error('Usage: node scripts/addAdmin.js remove <uid>');
      process.exit(1);
    }
    await removeAdmin(uid);
  } else {
    console.log('Usage:');
    console.log('  node scripts/addAdmin.js list              # List all admins');
    console.log('  node scripts/addAdmin.js add <uid>         # Add admin');
    console.log('  node scripts/addAdmin.js remove <uid>      # Remove admin');
    console.log('\nFor emulator: FIRESTORE_EMULATOR_HOST=localhost:8081 node scripts/addAdmin.js add <uid>');
  }
  
  rl.close();
  process.exit(0);
}

main();
