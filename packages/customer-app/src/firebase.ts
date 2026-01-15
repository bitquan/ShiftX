/// <reference types="vite/client" />
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Production-ready Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCi9fz_lpRJh1dEnmRekGVh3Jc9JAyYHnU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'shiftx-95c4b.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'shiftx-95c4b',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'shiftx-95c4b.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '928827778230',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:928827778230:web:ac7b78dcf4d7b93d22f217',
};

// Singleton pattern - only initialize once
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig, 'shiftx-customer-app');

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
export const storage = getStorage(app);

// Connect emulators ONLY in development mode AND on localhost
const g = globalThis as any;
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
if (import.meta.env.DEV && isLocalhost && !g.__CUSTOMER_EMULATORS_CONNECTED__) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8081);
  connectFunctionsEmulator(functions, '127.0.0.1', 5002);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  g.__CUSTOMER_EMULATORS_CONNECTED__ = true;
  console.log('[Customer] Connected to Firebase Emulators');
}

