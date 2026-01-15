import { app } from '../firebase';

interface ConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateProductionConfig(): ConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Only validate in production builds
  if (import.meta.env.DEV) {
    return { valid: true, errors, warnings };
  }

  // Critical: Firebase config
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || app.options.apiKey;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || app.options.projectId;
  
  if (!apiKey || apiKey === 'demo') {
    errors.push('VITE_FIREBASE_API_KEY is missing or invalid');
  }
  
  if (!projectId || projectId === 'demo-no-project') {
    errors.push('VITE_FIREBASE_PROJECT_ID is missing or invalid');
  }

  // Critical: Mapbox token
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!mapboxToken || mapboxToken.includes('example')) {
    errors.push('VITE_MAPBOX_TOKEN is missing or placeholder');
  }

  // Warning: Stripe key
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!stripeKey || stripeKey.includes('YOUR_')) {
    warnings.push('VITE_STRIPE_PUBLISHABLE_KEY is missing or placeholder');
  }

  // Check if accidentally connecting to emulator in production
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // We're in production - ensure no emulator config is active
    if (window.location.hostname.includes('firebaseapp.com') && import.meta.env.DEV) {
      errors.push('DEV mode detected on production domain');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function showConfigErrorModal(validation: ConfigValidation) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: #1a1a1a;
    border: 2px solid #dc2626;
    border-radius: 12px;
    padding: 32px;
    max-width: 600px;
    color: #fff;
  `;

  content.innerHTML = `
    <h1 style="margin: 0 0 16px 0; color: #dc2626; font-size: 24px;">
      ⚠️ Configuration Error
    </h1>
    <p style="margin: 0 0 24px 0; color: #d1d5db; line-height: 1.6;">
      This app cannot start due to missing or invalid environment configuration.
    </p>
    ${validation.errors.length > 0 ? `
      <div style="background: rgba(220, 38, 38, 0.1); border-left: 3px solid #dc2626; padding: 16px; margin-bottom: 16px; border-radius: 4px;">
        <strong style="display: block; margin-bottom: 8px; color: #fca5a5;">Critical Errors:</strong>
        <ul style="margin: 0; padding-left: 20px; color: #fecaca;">
          ${validation.errors.map(e => `<li style="margin: 4px 0;">${e}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    ${validation.warnings.length > 0 ? `
      <div style="background: rgba(251, 191, 36, 0.1); border-left: 3px solid #fbbf24; padding: 16px; margin-bottom: 16px; border-radius: 4px;">
        <strong style="display: block; margin-bottom: 8px; color: #fcd34d;">Warnings:</strong>
        <ul style="margin: 0; padding-left: 20px; color: #fde68a;">
          ${validation.warnings.map(w => `<li style="margin: 4px 0;">${w}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    <div style="background: #2d2d2d; padding: 16px; border-radius: 4px; font-family: monospace; font-size: 13px; margin-bottom: 16px;">
      <strong style="display: block; margin-bottom: 8px;">To fix:</strong>
      <p style="margin: 4px 0; color: #9ca3af;">1. Update <code>.env.production</code> with real values</p>
      <p style="margin: 4px 0; color: #9ca3af;">2. Rebuild: <code>npm run build</code></p>
      <p style="margin: 4px 0; color: #9ca3af;">3. Redeploy: <code>firebase deploy --only hosting</code></p>
    </div>
    <p style="margin: 0; font-size: 13px; color: #6b7280;">
      For more info, check the browser console or contact your administrator.
    </p>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  // Log to console for debugging
  console.error('Configuration validation failed:', validation);
}
