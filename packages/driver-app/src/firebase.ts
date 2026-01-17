/**
 * Centralized Firebase initialization for Driver App
 * 
 * IMPORTANT: This file MUST be imported before any Firebase usage.
 * The driver-client initializes Firebase with a named app 'shiftx-driver-client',
 * so we must always use the instances from that app, never call getAuth() etc. without an app.
 */

import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { initDriverClient, DEFAULT_EMULATOR_CONFIG } from '@shiftx/driver-client';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCi9fz_lpRJh1dEnmRekGVh3Jc9JAyYHnU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'shiftx-95c4b.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'shiftx-95c4b',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'shiftx-95c4b.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '928827778230',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:928827778230:web:ac7b78dcf4d7b93d22f217',
};

// Initialize driver client (creates named Firebase app)
const emulatorConfig = import.meta.env.DEV ? DEFAULT_EMULATOR_CONFIG : undefined;
const driverClient = initDriverClient({ 
  firebaseConfig, 
  emulator: emulatorConfig 
});

// Export Firebase instances from the driver client app
export const app = driverClient.app;
export const auth = getAuth(app);
export const db = driverClient.firestore;
export const functions = driverClient.functions;
export const storage = driverClient.storage;

// Connect emulators only in dev mode on localhost
if (import.meta.env.DEV) {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (isLocalhost) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [Firebase] EMULATOR MODE ACTIVE');
    console.log('   Environment: DEV + LOCALHOST');
    console.log('   Auth Emulator: 127.0.0.1:9099');
    console.log('   Firestore Emulator: 127.0.0.1:8081');
    console.log('   Functions Emulator: 127.0.0.1:5002');
    console.log('   Storage Emulator: 127.0.0.1:9199');
    console.log('   ⚠️  All data is LOCAL - not touching production!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } else {
    console.warn('[Firebase] Dev mode detected but NOT on localhost - emulators will NOT connect');
  }
} else {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 [Firebase] PRODUCTION MODE');
  console.log('   Environment: PRODUCTION');
  console.log('   Target: LIVE Firebase Project');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

console.log('[Firebase] Driver app initialized with project:', app.options.projectId);
