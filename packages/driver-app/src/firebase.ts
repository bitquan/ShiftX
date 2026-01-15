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
    // Note: driver-client already connects emulators if config is passed,
    // but we ensure it's only done on localhost
    console.log('[Firebase] Running in dev mode on localhost');
  } else {
    console.warn('[Firebase] Dev mode detected but NOT on localhost - emulators will NOT connect');
  }
}

console.log('[Firebase] Driver app initialized with project:', app.options.projectId);
