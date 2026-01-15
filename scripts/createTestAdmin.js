#!/usr/bin/env node

/**
 * Create a test admin user and add them to the admins list
 */

const { initializeApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'demo',
  authDomain: 'demo-no-project.firebaseapp.com',
  projectId: 'shiftx-95c4b',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig, 'admin-setup-script');
const auth = getAuth(app);
const db = getFirestore(app);

// Connect to emulators
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8081);

console.log('Connected to Firebase Emulators');

const adminEmail = 'admin@shiftx.com';
const adminPassword = 'admin123';

async function createTestAdmin() {
  try {
    console.log('\n=== Creating Test Admin User ===\n');
    
    // Create user in Auth
    console.log(`Creating user: ${adminEmail}`);
    const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
    const uid = userCredential.user.uid;
    
    console.log(`✓ User created with UID: ${uid}`);
    
    // Add to config/admins
    const configRef = doc(db, 'config', 'admins');
    const configDoc = await getDoc(configRef);
    
    let adminUids = [];
    if (configDoc.exists()) {
      adminUids = configDoc.data().uids || [];
    }
    
    if (!adminUids.includes(uid)) {
      adminUids.push(uid);
      await setDoc(configRef, {
        uids: adminUids,
        updatedAtMs: Date.now()
      }, { merge: true });
      console.log('✓ Added to admin list');
    } else {
      console.log('✓ Already in admin list');
    }
    
    // Create user document
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      email: adminEmail,
      role: 'admin',
      createdAtMs: Date.now()
    });
    console.log('✓ User document created');
    
    console.log('\n=== Admin Created Successfully! ===\n');
    console.log('Login credentials:');
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Password: ${adminPassword}`);
    console.log(`  UID: ${uid}`);
    console.log('\nYou can now sign in to the admin dashboard at http://localhost:5174\n');
    
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('\n⚠️  User already exists. Fetching UID...\n');
      
      // User exists, just make sure they're in admin list
      const { signInWithEmailAndPassword } = require('firebase/auth');
      const userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      const uid = userCredential.user.uid;
      
      const configRef = doc(db, 'config', 'admins');
      const configDoc = await getDoc(configRef);
      
      let adminUids = [];
      if (configDoc.exists()) {
        adminUids = configDoc.data().uids || [];
      }
      
      if (!adminUids.includes(uid)) {
        adminUids.push(uid);
        await setDoc(configRef, {
          uids: adminUids,
          updatedAtMs: Date.now()
        }, { merge: true });
        console.log('✓ Added existing user to admin list');
      } else {
        console.log('✓ User is already an admin');
      }
      
      console.log('\n=== Admin Ready! ===\n');
      console.log('Login credentials:');
      console.log(`  Email: ${adminEmail}`);
      console.log(`  Password: ${adminPassword}`);
      console.log(`  UID: ${uid}`);
      console.log('\nYou can now sign in to the admin dashboard at http://localhost:5174\n');
      
      process.exit(0);
    } else {
      console.error('Error creating admin:', error);
      process.exit(1);
    }
  }
}

createTestAdmin();
