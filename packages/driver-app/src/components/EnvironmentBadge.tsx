import { useEffect, useState } from 'react';

type Environment = 'DEV' | 'PROD';

interface EnvironmentInfo {
  env: Environment;
  hostname: string;
  stripeMode: 'TEST' | 'LIVE';
  firebaseMode: 'EMULATOR' | 'PRODUCTION';
}

export function EnvironmentBadge() {
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null);

  useEffect(() => {
    const hostname = window.location.hostname;
    const isDev = hostname === '127.0.0.1' || hostname === 'localhost';
    
    // Detect Stripe mode from publishable key
    const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
    const isTestStripe = stripeKey.startsWith('pk_test_');
    
    // Detect Firebase emulator
    const isEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

    setEnvInfo({
      env: isDev ? 'DEV' : 'PROD',
      hostname,
      stripeMode: isTestStripe ? 'TEST' : 'LIVE',
      firebaseMode: isEmulator ? 'EMULATOR' : 'PRODUCTION',
    });
  }, []);

  if (!envInfo) return null;

  const isDev = envInfo.env === 'DEV';
  const isTestMode = envInfo.stripeMode === 'TEST';

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top) + 8px)',
        right: 'calc(env(safe-area-inset-right) + 80px)',
        zIndex: 10001,
        fontSize: '11px',
        fontWeight: 'bold',
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: isDev ? '#10b981' : '#ef4444',
        color: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        fontFamily: 'monospace',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      title={`Hostname: ${envInfo.hostname}\nStripe: ${envInfo.stripeMode}\nFirebase: ${envInfo.firebaseMode}`}
    >
      {isDev ? '🟢 DEV' : '🔴 PROD'}
      {' | '}
      {isTestMode ? 'TEST' : '⚠️ LIVE'}
    </div>
  );
}
