import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration - PRODUCTION MODE
 * 
 * For production deployment:
 * - Loads driver app from Firebase Hosting (HTTPS)
 * - Uses LIVE Stripe keys
 * - Connects to production Firebase
 * 
 * To activate:
 * npm run ios:prod
 */

const config: CapacitorConfig = {
  appId: 'com.shiftx.driver',
  appName: 'ShiftX Driver',
  webDir: '../driver-app/dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://shiftx-95c4b-driver.web.app',
  },
};

export default config;
