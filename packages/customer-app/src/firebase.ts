/// <reference types="vite/client" />
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'demo',
  authDomain: 'demo-no-project.firebaseapp.com',
  projectId: 'demo-no-project',
};

// Singleton pattern - only initialize once
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig, 'shiftx-customer-app');

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app); // No region for emulator compatibility

// Connect emulators ONCE (important with Vite HMR)
const g = globalThis as any;
if (import.meta.env.DEV && !g.__CUSTOMER_EMULATORS_CONNECTED__) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8081);
  connectFunctionsEmulator(functions, '127.0.0.1', 5002);
  g.__CUSTOMER_EMULATORS_CONNECTED__ = true;
}

