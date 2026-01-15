/**
 * Centralized CORS configuration for all Cloud Functions
 * 
 * This ensures consistent CORS settings across all callable functions
 * and prevents "CORS origin not allowed" errors in production.
 */

export const CORS_ORIGINS = [
  // Production custom domains
  'https://shiftx-customer.web.app',
  'https://shiftx-driver.web.app',
  'https://shiftx-admin.web.app',
  
  // Firebase hosting (project-specific)
  'https://shiftx-95c4b-customer.web.app',
  'https://shiftx-95c4b-driver.web.app',
  'https://shiftx-95c4b-admin.web.app',
  'https://shiftx-95c4b.web.app', // Default hosting
  
  // Local development
  'http://localhost:5173', // customer-app dev
  'http://localhost:5174', // driver-app dev
  'http://localhost:5175', // admin-app dev
  'http://localhost:3000', // alternative port
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
];

export const callableOptions = {
  region: 'us-central1' as const,
  memory: '128MiB' as const,
  cors: CORS_ORIGINS,
};
