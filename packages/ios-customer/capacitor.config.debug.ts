import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration - DEBUG MODE
 * 
 * For local development and testing:
 * - Loads customer app from LOCAL dev server (http://127.0.0.1:5173)
 * - Uses TEST Stripe keys (pk_test_...)
 * - Connects to Firebase Emulator Suite (if running)
 * 
 * To use this config:
 * 1. Start customer dev server: cd ../customer-app && npm run dev
 * 2. Start Firebase emulators (optional): npm run emulators
 * 3. Sync to iOS: npm run cap:sync:debug
 * 4. Open Xcode: npm run ios:open
 * 5. Select Debug scheme and run (Cmd+R)
 */

const config: CapacitorConfig = {
  appId: 'com.shiftx.customer',
  appName: 'ShiftX Customer (Dev)',
  webDir: '../customer-app/dist',
  server: {
    url: 'http://127.0.0.1:5173',
    cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
  }
};

export default config;
