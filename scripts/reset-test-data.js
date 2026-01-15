#!/usr/bin/env node

/**
 * Test Data Reset Script
 * 
 * Clears Firestore test data for clean QA runs.
 * Works with both emulator and production (use with caution!).
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin
if (process.env.FIRESTORE_EMULATOR_HOST) {
  // Emulator mode
  admin.initializeApp({ projectId: 'demo-no-project' });
  console.log('🔧 Connected to Firestore Emulator');
} else {
  // Production mode - requires service account
  console.log('⚠️  WARNING: Running against PRODUCTION Firestore!');
  admin.initializeApp();
}

const db = admin.firestore();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function question(prompt) {
  return new Promise(resolve => {
    rl.question(prompt, resolve);
  });
}

async function deleteCollection(collectionName, batchSize = 100) {
  const collectionRef = db.collection(collectionName);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject);
  });
}

async function deleteQueryBatch(query, resolve, reject) {
  query.get()
    .then(async snapshot => {
      if (snapshot.size === 0) {
        resolve();
        return;
      }

      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      // Recurse on the next batch
      process.nextTick(() => {
        deleteQueryBatch(query, resolve, reject);
      });
    })
    .catch(reject);
}

async function resetDriverStates() {
  const driversSnapshot = await db.collection('drivers').get();
  const batch = db.batch();

  driversSnapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      isOnline: false,
      isBusy: false,
      currentRideId: null,
    });
  });

  await batch.commit();
  return driversSnapshot.size;
}

async function main() {
  console.log('\n========================================');
  console.log('ShiftX Test Data Reset Script');
  console.log('========================================\n');

  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.log('🚨 You are about to delete data from PRODUCTION Firestore!');
    console.log('   Press Ctrl+C to abort.\n');
    
    const confirm = await question('Type "DELETE PRODUCTION DATA" to continue: ');
    if (confirm !== 'DELETE PRODUCTION DATA') {
      console.log('❌ Aborted.');
      rl.close();
      process.exit(0);
    }
  }

  console.log('\nWhat would you like to reset?\n');
  console.log('1. Reset ALL test data (rides, offers, eventLogs)');
  console.log('2. Reset rides only');
  console.log('3. Reset offers only');
  console.log('4. Reset driver states only (set offline, not busy)');
  console.log('5. Custom selection\n');

  const choice = await question('Enter choice (1-5): ');

  const collectionsToDelete = [];
  let resetDrivers = false;

  switch (choice) {
    case '1':
      collectionsToDelete.push('rides', 'offers', 'eventLogs');
      resetDrivers = true;
      break;
    case '2':
      collectionsToDelete.push('rides');
      break;
    case '3':
      collectionsToDelete.push('offers');
      break;
    case '4':
      resetDrivers = true;
      break;
    case '5':
      const custom = await question('Enter collection names (comma-separated): ');
      collectionsToDelete.push(...custom.split(',').map(s => s.trim()));
      const resetDriversChoice = await question('Reset driver states? (y/n): ');
      resetDrivers = resetDriversChoice.toLowerCase() === 'y';
      break;
    default:
      console.log('Invalid choice. Exiting.');
      rl.close();
      process.exit(1);
  }

  console.log('\n📋 Plan:');
  if (collectionsToDelete.length > 0) {
    console.log(`   - Delete collections: ${collectionsToDelete.join(', ')}`);
  }
  if (resetDrivers) {
    console.log('   - Reset driver states (offline, not busy)');
  }

  const proceed = await question('\nProceed? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    console.log('❌ Aborted.');
    rl.close();
    process.exit(0);
  }

  console.log('\n🔄 Processing...\n');

  // Delete collections
  for (const collectionName of collectionsToDelete) {
    try {
      console.log(`Deleting ${collectionName}...`);
      await deleteCollection(collectionName);
      console.log(`✅ Deleted ${collectionName}`);
    } catch (error) {
      console.error(`❌ Error deleting ${collectionName}:`, error.message);
    }
  }

  // Reset driver states
  if (resetDrivers) {
    try {
      console.log('Resetting driver states...');
      const count = await resetDriverStates();
      console.log(`✅ Reset ${count} drivers`);
    } catch (error) {
      console.error('❌ Error resetting drivers:', error.message);
    }
  }

  console.log('\n========================================');
  console.log('✅ Reset complete!');
  console.log('========================================\n');

  rl.close();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});
