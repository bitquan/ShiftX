import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration - DEV MODE
 * 
 * For local development and testing:
 * - Loads driver app from LOCAL dev server (http://localhost:4173)
 * - Uses TEST Stripe keys
 * - Connects to Firebase Emulator Suite (if running)
 * 
 * To activate:
 * npm run ios:dev
 */

const config: CapacitorConfig = {
  appId: 'com.shiftx.driver',
  appName: 'ShiftX Driver (DEV)',
  webDir: '../driver-app/dist',
  bundledWebRuntime: false,
  server: {
    url: 'http://127.0.0.1:5174',
    cleartext: true,
  },
};

export default config;
