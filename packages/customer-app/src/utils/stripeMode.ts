/**
 * Stripe Mode Detection Utility
 * Detects whether the app is running in TEST or LIVE mode based on publishable key
 */

export type StripeMode = 'test' | 'live' | 'unknown';

/**
 * Detect Stripe mode from publishable key prefix
 * pk_test_ = test mode
 * pk_live_ = live mode
 */
export function detectStripeMode(publishableKey?: string): StripeMode {
  if (!publishableKey) return 'unknown';
  
  if (publishableKey.startsWith('pk_test_')) return 'test';
  if (publishableKey.startsWith('pk_live_')) return 'live';
  
  return 'unknown';
}

/**
 * Get current Stripe mode from environment
 */
export function getCurrentStripeMode(): StripeMode {
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  return detectStripeMode(publishableKey);
}

/**
 * Check if current mode is test
 */
export function isTestMode(): boolean {
  return getCurrentStripeMode() === 'test';
}

/**
 * Check if current mode is live
 */
export function isLiveMode(): boolean {
  return getCurrentStripeMode() === 'live';
}

/**
 * Get display text for current mode
 */
export function getStripeModeDisplay(): string {
  const mode = getCurrentStripeMode();
  
  switch (mode) {
    case 'test':
      return 'TEST MODE';
    case 'live':
      return 'LIVE MODE';
    default:
      return 'UNKNOWN MODE';
  }
}

/**
 * Get color for current mode (for UI indicators)
 */
export function getStripeModeColor(): string {
  const mode = getCurrentStripeMode();
  
  switch (mode) {
    case 'test':
      return '#ff9800'; // Orange for test
    case 'live':
      return '#4caf50'; // Green for live
    default:
      return '#f44336'; // Red for unknown
  }
}

/**
 * Log Stripe mode on app initialization
 * Call this once when the app starts
 */
export function logStripeMode(): void {
  const mode = getCurrentStripeMode();
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  
  console.group('🔐 Stripe Configuration');
  console.log('Mode:', mode.toUpperCase());
  console.log('Publishable Key:', publishableKey ? `${publishableKey.substring(0, 20)}...` : 'NOT SET');
  console.log('Is Test Mode:', isTestMode());
  console.log('Is Live Mode:', isLiveMode());
  console.groupEnd();
  
  // Warning if mode is unknown or misconfigured
  if (mode === 'unknown') {
    console.warn('⚠️ Stripe publishable key is not set or invalid!');
  }
  
  // Warning if production build is using test keys
  if (import.meta.env.PROD && isTestMode()) {
    console.error('❌ CRITICAL: Production build is using TEST Stripe keys!');
  }
  
  // Warning if dev build is using live keys
  if (import.meta.env.DEV && isLiveMode()) {
    console.warn('⚠️ WARNING: Development build is using LIVE Stripe keys!');
  }
}
