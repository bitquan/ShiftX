import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration - PROD MODE
 * 
 * For production builds and App Store releases:
 * - Loads customer app from HOSTED web app (https://shiftx-95c4b-customer.web.app)
 * - Uses LIVE Stripe keys (pk_live_...)
 * - Connects to production Firebase backend
 * 
 * To activate:
 * npm run ios:prod
 * 
 * Benefits:
 * - Proper HTTPS origin for Stripe
 * - No CORS issues
 * - Live keys work correctly
 * - Instant updates without App Store review (web app changes)
 */

const config: CapacitorConfig = {
  appId: 'com.shiftx.customer',
  appName: 'ShiftX Customer',
  webDir: '../customer-app/dist',
  ios: {
    contentInset: 'automatic',
  }
};

export default config;
