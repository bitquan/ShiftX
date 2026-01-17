import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getInitializedClient } from '@shiftx/driver-client';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth } from '../firebase';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

interface LedgerEntry {
  rideId: string;
  amountCents: number;
  createdAtMs: number;
  type: string;
  status: string;
}

interface LedgerSummary {
  todayCents: number;
  weekCents: number;
  entries: LedgerEntry[];
}

interface ConnectStatus {
  enabled: boolean;
  status: 'none' | 'pending' | 'active' | 'disabled';
  accountId?: string;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function Wallet() {
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus>({ enabled: false, status: 'none' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);

  useEffect(() => {
    loadWallet();
    
    // Listen to runtime flags and driver connect status
    const { firestore } = getInitializedClient();
    if (!auth.currentUser) return;
    
    const flagsUnsub = onSnapshot(
      doc(firestore, 'config', 'runtimeFlags'),
      (snap) => {
        const enabled = snap.exists() && snap.data()?.enableStripeConnect === true;
        setConnectStatus(prev => ({ ...prev, enabled }));
      }
    );
    
    const driverUnsub = onSnapshot(
      doc(firestore, 'drivers', auth.currentUser.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          // Check mode-specific fields (test in dev, live in production)
          const isDev = import.meta.env.DEV;
          const accountId = isDev 
            ? data?.stripeConnectAccountId_test 
            : data?.stripeConnectAccountId_live;
          const status = isDev
            ? data?.stripeConnectStatus_test
            : data?.stripeConnectStatus_live;
          
          console.log('[Wallet] Connect status update:', { isDev, accountId, status });
          
          setConnectStatus(prev => ({
            ...prev,
            status: status || 'none',
            accountId: accountId,
          }));
        }
      }
    );
    
    return () => {
      flagsUnsub();
      driverUnsub();
    };
  }, []);

  const loadWallet = async () => {
    try {
      setLoading(true);
      setError(null);
      const { functions } = getInitializedClient();
      const getDriverLedgerSummary = httpsCallable(functions, 'getDriverLedgerSummary');
      const result = await getDriverLedgerSummary({});
      setSummary(result.data as LedgerSummary);
    } catch (err: any) {
      console.error('Failed to load wallet:', err);
      setError(err?.message || 'Failed to load earnings');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPayouts = async () => {
    // Prevent double-clicks
    if (connectLoading) {
      console.log('[Wallet] Setup already in progress, ignoring click');
      return;
    }

    console.log('[Wallet] Setup payouts button clicked');
    
    try {
      setConnectLoading(true);
      console.log('[Wallet] Getting Firebase client...');
      const { functions } = getInitializedClient();
      
      // First, create Connect account if needed
      if (!connectStatus.accountId) {
        console.log('[Wallet] Creating Connect account...');
        const createAccount = httpsCallable(functions, 'createConnectAccount');
        const createResult = await createAccount({});
        const accountData = createResult.data as any;
        console.log('[Wallet] Connect account created:', accountData.accountId);
      } else {
        console.log('[Wallet] Using existing account:', connectStatus.accountId);
      }
      
      // Get onboarding link (function will auto-detect localhost vs production URLs)
      console.log('[Wallet] Getting onboarding link...');
      const getLink = httpsCallable(functions, 'getConnectOnboardingLink');
      const linkResult = await getLink({});
      const linkData = linkResult.data as any;
      console.log('[Wallet] Onboarding link received:', linkData.url);
      
      // Open in new window (or use Capacitor Browser plugin on mobile)
      console.log('[Wallet] Opening onboarding link...');
      
      // Use Capacitor Browser for iOS/Android, window.open for web
      if (Capacitor.isNativePlatform()) {
        console.log('[Wallet] Opening in native browser...');
        await Browser.open({ url: linkData.url });
        console.log('[Wallet] Browser opened successfully');
      } else {
        console.log('[Wallet] Opening in web browser...');
        const opened = window.open(linkData.url, '_blank');
        
        if (!opened) {
          console.error('[Wallet] Failed to open window - popup blocked?');
          alert('Please allow popups to continue with payout setup.\n\nLink: ' + linkData.url);
        } else {
          console.log('[Wallet] Window opened successfully');
        }
      }
      
    } catch (err: any) {
      console.error('[Wallet] Error setting up payouts:', err);
      console.error('[Wallet] Error details:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        stack: err?.stack,
      });
      alert(`Failed to setup payouts: ${err?.message || 'Unknown error'}\n\nCheck console for details.`);
    } finally {
      console.log('[Wallet] Setup payouts complete, loading=false');
      setConnectLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        color: 'rgba(255,255,255,0.6)',
      }}>
        Loading wallet...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '1rem',
        margin: '1rem',
        borderRadius: '8px',
        backgroundColor: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.3)',
        color: '#ef4444',
      }}>
        {error}
      </div>
    );
  }

  if (!summary) {
    return (
      <div style={{
        padding: '1rem',
        margin: '1rem',
        color: 'rgba(255,255,255,0.6)',
      }}>
        No earnings data available
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      paddingTop: 'calc(0px + var(--sat))',
      paddingBottom: 'calc(80px + var(--sab))',
      paddingLeft: 'var(--sal)',
      paddingRight: 'var(--sar)',
      backgroundColor: '#0a0e27',
    }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem 1rem',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: '#fff',
          margin: 0,
        }}>
          💰 Earnings
        </h1>
        {/* Debug info */}
        <div style={{
          marginTop: '0.5rem',
          fontSize: '0.7rem',
          color: 'rgba(255,255,255,0.4)',
        }}>
          Connect: {connectStatus.enabled ? 'ON' : 'OFF'} | Status: {connectStatus.status} | Account: {connectStatus.accountId || 'none'}
        </div>
      </div>

      {/* Connect Status Banner */}
      {connectStatus.enabled && connectStatus.status !== 'active' && (
        <div style={{
          margin: '1rem',
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: connectStatus.status === 'pending'
            ? 'rgba(251,191,36,0.05)'
            : 'rgba(139,92,246,0.05)',
          border: `1px solid ${
            connectStatus.status === 'pending'
              ? 'rgba(251,191,36,0.2)'
              : 'rgba(139,92,246,0.2)'
          }`,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <div style={{ fontSize: '1.5rem' }}>
              {connectStatus.status === 'pending' ? '⏳' : '💳'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#fff',
                marginBottom: '4px',
              }}>
                {connectStatus.status === 'pending'
                  ? 'Payout Setup Pending'
                  : 'Direct Payouts Available'}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.6)',
              }}>
                {connectStatus.status === 'pending'
                  ? 'Complete your payout setup to receive automatic transfers'
                  : 'Set up automatic earnings transfers with Stripe'}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              console.log('[Wallet] Test button clicked!');
              alert('Button clicks are working!');
            }}
            style={{
              marginTop: '0.75rem',
              width: '100%',
              padding: '8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            🧪 Test Button Click
          </button>
          <button
            onClick={handleSetupPayouts}
            disabled={connectLoading}
            style={{
              marginTop: '0.5rem',
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0,255,140,0.15)',
              border: '1px solid rgba(0,255,140,0.3)',
              color: 'rgba(0,255,140,0.95)',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: connectLoading ? 'not-allowed' : 'pointer',
              opacity: connectLoading ? 0.5 : 1,
            }}
          >
            {connectLoading ? '⏳ Loading...' : '🚀 Set Up Payouts'}
          </button>
        </div>
      )}

      {/* Active Status Banner */}
      {connectStatus.enabled && connectStatus.status === 'active' && (
        <div style={{
          margin: '1rem',
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: 'rgba(0,255,140,0.05)',
          border: '1px solid rgba(0,255,140,0.2)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <div style={{ fontSize: '1.5rem' }}>✓</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#fff',
                marginBottom: '4px',
              }}>
                Payouts Active
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.6)',
              }}>
                Your earnings are automatically transferred after each completed ride
              </div>
            </div>
          </div>
          <div style={{
            marginTop: '0.75rem',
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.4)',
          }}>
            Platform fees: $1.50 per ride • Net earnings shown below
          </div>
        </div>
      )}

      {/* Coming Soon Banner (when Connect is disabled) */}
      {!connectStatus.enabled && (
        <div style={{
          margin: '1rem',
          padding: '1rem',
          borderRadius: '8px',
          backgroundColor: 'rgba(139,92,246,0.05)',
          border: '1px solid rgba(139,92,246,0.2)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <div style={{ fontSize: '1.5rem' }}>🚀</div>
            <div>
              <div style={{
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#fff',
                marginBottom: '4px',
              }}>
                Direct Payouts Coming Soon
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.6)',
              }}>
                Automatic earnings transfers will be available soon
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{
        padding: '1rem',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1rem',
      }}>
        {/* Today */}
        <div style={{
          padding: '1.5rem',
          borderRadius: '12px',
          backgroundColor: 'rgba(0,255,140,0.05)',
          border: '1px solid rgba(0,255,140,0.2)',
        }}>
          <div style={{
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '0.5rem',
          }}>
            Today
          </div>
          <div style={{
            fontSize: '1.8rem',
            fontWeight: '700',
            color: 'rgba(0,255,140,0.95)',
          }}>
            {formatCents(summary.todayCents)}
          </div>
        </div>

        {/* This Week */}
        <div style={{
          padding: '1.5rem',
          borderRadius: '12px',
          backgroundColor: 'rgba(33,150,243,0.05)',
          border: '1px solid rgba(33,150,243,0.2)',
        }}>
          <div style={{
            fontSize: '0.8rem',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '0.5rem',
          }}>
            This Week
          </div>
          <div style={{
            fontSize: '1.8rem',
            fontWeight: '700',
            color: 'rgba(33,150,243,0.95)',
          }}>
            {formatCents(summary.weekCents)}
          </div>
        </div>
      </div>

      {/* Recent Trips */}
      <div style={{
        padding: '1rem',
      }}>
        <h2 style={{
          fontSize: '1.1rem',
          fontWeight: '600',
          color: '#fff',
          marginBottom: '1rem',
        }}>
          Recent Trips
        </h2>

        {summary.entries.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '0.9rem',
          }}>
            No completed trips yet
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            {summary.entries.map((entry) => {
              const date = new Date(entry.createdAtMs);
              const isToday = date.toDateString() === new Date().toDateString();
              
              return (
                <div
                  key={entry.rideId}
                  style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#fff',
                      marginBottom: '4px',
                    }}>
                      Trip Earnings
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'rgba(255,255,255,0.5)',
                    }}>
                      {isToday ? 'Today' : date.toLocaleDateString()} • {date.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '1.3rem',
                    fontWeight: '700',
                    color: 'rgba(0,255,140,0.95)',
                  }}>
                    {formatCents(entry.amountCents)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div style={{
        padding: '1rem',
        position: 'fixed',
        bottom: 'calc(80px + var(--sab))',
        left: '0',
        right: '0',
        backgroundColor: 'rgba(10,14,39,0.95)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}>
        <button
          onClick={loadWallet}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(33,150,243,0.15)',
            border: '1px solid rgba(33,150,243,0.3)',
            color: 'rgba(33,150,243,0.95)',
            fontSize: '0.9rem',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  );
}
