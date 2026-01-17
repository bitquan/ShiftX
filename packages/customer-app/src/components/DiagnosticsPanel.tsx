import { useState } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from './Toast';

interface DiagnosticsPanelProps {
  user: any;
}

export function DiagnosticsPanel({ user }: DiagnosticsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const { show } = useToast();

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  const handleToggle = async () => {
    if (!isOpen && user) {
      // Fetch user role when opening
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const role = userSnap.exists() ? userSnap.data()?.role : 'unknown';
        setUserRole(role);
      } catch (error) {
        console.error('[Diagnostics] Failed to fetch user role:', error);
        setUserRole('error');
      }
    }
    setIsOpen(!isOpen);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    show(`Copied ${label}`, 'info');
  };

  const projectId = auth.app.options.projectId || 'unknown';
  const functionsRegion = 'us-central1';
  const functionsUrl = import.meta.env.DEV 
    ? 'http://127.0.0.1:5002'
    : `https://${functionsRegion}-${projectId}.cloudfunctions.net`;
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'not-set';
  const stripePrefix = stripeKey.substring(0, 8);

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(320px + env(safe-area-inset-bottom))',
      right: 'calc(16px + env(safe-area-inset-right))',
      zIndex: 9999,
    }}>
      {/* Toggle Button */}
      <button
        onClick={handleToggle}
        style={{
          padding: '8px 12px',
          backgroundColor: 'rgba(96,165,250,0.9)',
          color: '#000',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.85rem',
          fontWeight: '600',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        {isOpen ? '✕ Close Diagnostics' : '🔧 Diagnostics'}
      </button>

      {/* Panel */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '50px',
          right: '0',
          width: '400px',
          maxHeight: '600px',
          overflowY: 'auto',
          backgroundColor: 'rgba(18,18,18,0.98)',
          border: '1px solid rgba(96,165,250,0.3)',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          padding: '16px',
        }}>
          <h3 style={{
            margin: '0 0 16px 0',
            fontSize: '1rem',
            color: 'rgba(96,165,250,0.95)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: '8px',
          }}>
            🔧 Development Diagnostics
          </h3>

          <div style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
            {/* Firebase Project */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '4px' }}>
                Firebase Project
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '4px',
              }}>
                <code style={{ color: 'rgba(0,255,140,0.95)' }}>{projectId}</code>
                <button
                  onClick={() => copyToClipboard(projectId, 'Project ID')}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'rgba(96,165,250,0.2)',
                    border: '1px solid rgba(96,165,250,0.3)',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    color: 'rgba(255,255,255,0.9)',
                    cursor: 'pointer',
                  }}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Functions Region + URL */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '4px' }}>
                Functions Endpoint
              </div>
              <div style={{
                padding: '8px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '4px',
              }}>
                <div style={{ marginBottom: '4px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Region:</span>{' '}
                  <code style={{ color: 'rgba(0,255,140,0.95)' }}>{functionsRegion}</code>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <code style={{
                    color: 'rgba(0,255,140,0.95)',
                    fontSize: '0.75rem',
                    wordBreak: 'break-all',
                    marginRight: '8px',
                  }}>
                    {functionsUrl}
                  </code>
                  <button
                    onClick={() => copyToClipboard(functionsUrl, 'Functions URL')}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'rgba(96,165,250,0.2)',
                      border: '1px solid rgba(96,165,250,0.3)',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      color: 'rgba(255,255,255,0.9)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            {/* Stripe Key Prefix */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '4px' }}>
                Stripe Publishable Key
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '4px',
              }}>
                <code style={{ color: 'rgba(255,193,7,0.95)' }}>
                  {stripePrefix}{'•'.repeat(Math.max(0, stripeKey.length - 8))}
                </code>
                <span style={{
                  fontSize: '0.75rem',
                  color: stripeKey.includes('pk_test_') ? 'rgba(255,193,7,0.95)' : 'rgba(244,67,54,0.95)',
                  fontWeight: '600',
                }}>
                  {stripeKey.includes('pk_test_') ? 'TEST MODE' : stripeKey.includes('pk_live_') ? '⚠️ LIVE MODE' : '⚠️ INVALID'}
                </span>
              </div>
            </div>

            {/* Current User */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '4px' }}>
                Current User
              </div>
              <div style={{
                padding: '8px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '4px',
              }}>
                {user ? (
                  <>
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>UID:</span>{' '}
                      <code style={{ color: 'rgba(0,255,140,0.95)', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                        {user.uid}
                      </code>
                    </div>
                    <div style={{ marginBottom: '4px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>Email:</span>{' '}
                      <code style={{ color: 'rgba(0,255,140,0.95)' }}>{user.email || 'Anonymous'}</code>
                    </div>
                    <div>
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>Role:</span>{' '}
                      <code style={{ color: 'rgba(96,165,250,0.95)' }}>{userRole || '...'}</code>
                    </div>
                  </>
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>Not signed in</span>
                )}
              </div>
            </div>

            {/* Environment Mode */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '4px' }}>
                Environment
              </div>
              <div style={{
                padding: '8px',
                backgroundColor: import.meta.env.DEV ? 'rgba(255,193,7,0.1)' : 'rgba(244,67,54,0.1)',
                border: import.meta.env.DEV ? '1px solid rgba(255,193,7,0.3)' : '1px solid rgba(244,67,54,0.3)',
                borderRadius: '4px',
              }}>
                <span style={{
                  fontWeight: '600',
                  color: import.meta.env.DEV ? 'rgba(255,193,7,0.95)' : 'rgba(244,67,54,0.95)',
                }}>
                  {import.meta.env.DEV ? '🚧 DEVELOPMENT' : '🚀 PRODUCTION'}
                </span>
                {import.meta.env.DEV && (
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                    Using Firebase Emulators (localhost)
                  </div>
                )}
              </div>
            </div>

            {/* Auth Config */}
            <div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', marginBottom: '4px' }}>
                Auth Domain
              </div>
              <div style={{
                padding: '8px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '4px',
              }}>
                <code style={{ color: 'rgba(0,255,140,0.95)', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                  {auth.app.options.authDomain || 'unknown'}
                </code>
              </div>
            </div>
          </div>

          <div style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'center',
          }}>
            This panel only appears in development mode
          </div>
        </div>
      )}
    </div>
  );
}
