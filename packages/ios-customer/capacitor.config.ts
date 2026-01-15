import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shiftx.customer',
  appName: 'ShiftX Customer',
  webDir: '../customer-app/dist',
  server: {
    // For development, you can enable live reload:
    // url: 'http://localhost:5173',
    // cleartext: true
  },
  ios: {
    contentInset: 'automatic',
  }
};

export default config;
