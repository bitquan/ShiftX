import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration - DEV MODE
 * 
 * For local development and testing:
 * - Loads customer app from LOCAL dev server (http://127.0.0.1:5173)
 * - Uses TEST Stripe keys (pk_test_...)
 * - Connects to Firebase Emulator Suite (if running)
 * 
 * To activate:
 * npm run ios:dev
 * 
 * This copies this file to capacitor.config.ts and syncs iOS project.
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
