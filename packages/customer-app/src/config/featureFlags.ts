/**
 * Production Feature Flags
 * 
 * This module controls production-ready behaviors and dev tools.
 * Use environment variables to configure different deployment environments.
 */

interface FeatureFlags {
  // Development Tools
  enableDevTools: boolean;        // Show dev seed buttons, test data creators
  enableDebugPanel: boolean;      // Show debug info panel
  verboseLogging: boolean;        // Detailed console logs
  
  // Feature Toggles
  enableScheduledCleanup: boolean; // Auto-cancel stale rides
  enablePayments: boolean;         // Stripe payment processing
  enableDriverWallet: boolean;     // Driver earnings/ledger
  enableSavedPayments: boolean;    // Save payment methods
  
  // Operational
  singleDriverMode: boolean;       // Single driver for testing
  skipEmulatorCheck: boolean;      // Skip emulator connection warnings
}

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// Feature flags with sensible defaults
export const featureFlags: FeatureFlags = {
  // Dev tools - only in development
  enableDevTools: import.meta.env.VITE_ENABLE_DEV_TOOLS === 'true' || isDevelopment,
  enableDebugPanel: import.meta.env.VITE_ENABLE_DEBUG_PANEL === 'true' || isDevelopment,
  verboseLogging: import.meta.env.VITE_VERBOSE_LOGGING === 'true' || isDevelopment,
  
  // Features - on by default
  enableScheduledCleanup: import.meta.env.VITE_ENABLE_SCHEDULED_CLEANUP !== 'false',
  enablePayments: import.meta.env.VITE_ENABLE_PAYMENTS !== 'false',
  enableDriverWallet: import.meta.env.VITE_ENABLE_DRIVER_WALLET !== 'false',
  enableSavedPayments: import.meta.env.VITE_ENABLE_SAVED_PAYMENTS !== 'false',
  
  // Operational
  singleDriverMode: import.meta.env.VITE_SINGLE_DRIVER_MODE === 'true',
  skipEmulatorCheck: import.meta.env.VITE_SKIP_EMULATOR_CHECK === 'true',
};

// Log configuration in development
if (isDevelopment && featureFlags.verboseLogging) {
  console.log('[FeatureFlags] Configuration:', featureFlags);
}

// Helper to check if we're in emulator mode
export const isEmulatorMode = isDevelopment && !featureFlags.skipEmulatorCheck;

// Helper for conditional logging
export function log(...args: any[]) {
  if (featureFlags.verboseLogging) {
    console.log(...args);
  }
}

export function warn(...args: any[]) {
  if (featureFlags.verboseLogging || isProduction) {
    console.warn(...args);
  }
}

export function error(...args: any[]) {
  console.error(...args);
}
