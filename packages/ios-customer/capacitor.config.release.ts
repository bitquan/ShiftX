import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration - RELEASE MODE
 * 
 * For production builds and App Store releases:
 * - Loads customer app from HOSTED web app (https://shiftx-95c4b-customer.web.app)
 * - Uses LIVE Stripe keys (pk_live_...)
 * - Connects to production Firebase backend
 * 
 * Benefits:
 * - Proper HTTPS origin for Stripe
 * - No CORS issues
 * - Live keys work correctly
 * - Instant updates without App Store review (web app changes)
 * 
 * To use this config:
 * 1. Deploy customer app: cd ../customer-app && npm run build && firebase deploy --only hosting:customer
 * 2. Sync to iOS: npm run cap:sync:release
 * 3. Open Xcode: npm run ios:open
 * 4. Select Release scheme and build for App Store
 */

const config: CapacitorConfig = {
  appId: 'com.shiftx.customer',
  appName: 'ShiftX Customer',
  webDir: '../customer-app/dist',
  server: {
    url: 'https://shiftx-95c4b-customer.web.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  }
};

export default config;
