/// <reference types="vite/client" />
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// Production-ready Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCi9fz_lpRJh1dEnmRekGVh3Jc9JAyYHnU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'shiftx-95c4b.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'shiftx-95c4b',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'shiftx-95c4b.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '928827778230',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:928827778230:web:ac7b78dcf4d7b93d22f217',
};

console.log('[Firebase] Initializing with config:', {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  apiKey: firebaseConfig.apiKey?.substring(0, 10) + '...',
});

// Singleton pattern - only initialize once
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig, 'shiftx-admin-dashboard');

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Connect emulators ONLY in development mode AND on localhost
const g = globalThis as any;
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
if (import.meta.env.DEV && isLocalhost && !g.__ADMIN_EMULATORS_CONNECTED__) {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    console.log('[Firebase] Connected to Auth emulator: http://127.0.0.1:9099');
    
    connectFirestoreEmulator(db, '127.0.0.1', 8081);
    console.log('[Firebase] Connected to Firestore emulator: http://127.0.0.1:8081');
    
    connectFunctionsEmulator(functions, '127.0.0.1', 5002);
    console.log('[Firebase] Connected to Functions emulator: http://127.0.0.1:5002');
    
    g.__ADMIN_EMULATORS_CONNECTED__ = true;
  } catch (error) {
    console.error('[Firebase] Error connecting to emulators:', error);
  }
}
