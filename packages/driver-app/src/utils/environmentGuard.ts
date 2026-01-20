/**
 * Phase 3F: Safety Rails - Environment Guards
 * 
 * Ensures drivers don't accidentally use emulators in production
 * or production backend in development.
 */

interface EnvironmentCheck {
  isProduction: boolean;
  isEmulator: boolean;
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Check if we're connected to Firebase emulators
 */
export function isUsingEmulator(): boolean {
  // Check if any emulator environment variables are set
  const hasEmulatorEnv = !!(
    import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST ||
    import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST ||
    import.meta.env.VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST
  );

  // Check if on localhost (strong indicator of emulator usage)
  const isLocalhost = 
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  // Check if in dev mode
  const isDevMode = import.meta.env.DEV;

  return hasEmulatorEnv || (isDevMode && isLocalhost);
}

/**
 * Check if we're in production environment
 */
export function isProductionEnvironment(): boolean {
  return import.meta.env.PROD;
}

/**
 * Validate environment configuration
 */
export function validateEnvironment(): EnvironmentCheck {
  const isProduction = isProductionEnvironment();
  const isEmulator = isUsingEmulator();
  const warnings: string[] = [];
  const errors: string[] = [];

  // CRITICAL: Emulators in production is BLOCKED
  if (isProduction && isEmulator) {
    errors.push('🚨 CRITICAL: Emulators detected in production build!');
    errors.push('This should NEVER happen. Check your build configuration.');
    errors.push('Refusing to connect to emulators in production.');
  }

  // WARNING: Production backend in dev mode
  if (!isProduction && !isEmulator) {
    warnings.push('⚠️ WARNING: Development mode but NOT using emulators');
    warnings.push('You may be connected to PRODUCTION Firebase!');
    warnings.push('All changes will affect LIVE data.');
    warnings.push('Start emulators or switch to production build.');
  }

  const isValid = errors.length === 0;

  return {
    isProduction,
    isEmulator,
    isValid,
    warnings,
    errors,
  };
}

/**
 * Log environment status on startup
 */
export function logEnvironmentStatus(): EnvironmentCheck {
  const check = validateEnvironment();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔐 [Safety Check] Environment Validation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Production: ${check.isProduction}`);
  console.log(`   Emulators: ${check.isEmulator}`);
  console.log(`   Valid: ${check.isValid ? '✅' : '❌'}`);

  if (check.errors.length > 0) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ERRORS:');
    check.errors.forEach(err => console.error(`   ${err}`));
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  if (check.warnings.length > 0) {
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.warn('⚠️ WARNINGS:');
    check.warnings.forEach(warn => console.warn(`   ${warn}`));
    console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return check;
}

/**
 * Block emulator usage in production
 */
export function blockEmulatorInProduction(): void {
  const check = validateEnvironment();

  if (!check.isValid && check.errors.length > 0) {
    // Show full-screen error
    document.body.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, #1e1e1e 0%, #2d1414 100%);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        z-index: 999999;
      ">
        <div style="
          max-width: 600px;
          padding: 3rem;
          background: rgba(0,0,0,0.5);
          border-radius: 16px;
          border: 2px solid rgba(239,68,68,0.5);
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        ">
          <div style="
            font-size: 4rem;
            text-align: center;
            margin-bottom: 1rem;
          ">🚨</div>
          <h1 style="
            font-size: 2rem;
            margin: 0 0 1rem 0;
            text-align: center;
            color: #ef4444;
          ">Critical Configuration Error</h1>
          <div style="
            background: rgba(239,68,68,0.1);
            border-left: 4px solid #ef4444;
            padding: 1rem;
            margin: 1rem 0;
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 0.9rem;
            line-height: 1.6;
          ">
            ${check.errors.map(err => `<div>• ${err}</div>`).join('')}
          </div>
          <p style="
            margin: 1.5rem 0 0 0;
            text-align: center;
            color: rgba(255,255,255,0.7);
            font-size: 0.9rem;
          ">
            This app has been blocked for safety. Contact your development team.
          </p>
        </div>
      </div>
    `;

    // Throw error to stop execution
    throw new Error('BLOCKED: ' + check.errors.join(' | '));
  }
}
