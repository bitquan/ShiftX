import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useToast } from './Toast';
import { RuntimeFlags } from '../utils/runtimeFlags';

interface StripeConnectProps {
  runtimeFlags: RuntimeFlags | null;
}

export function StripeConnect({ runtimeFlags }: StripeConnectProps) {
  const { show } = useToast();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState<{
    hasAccount: boolean;
    status: string;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
    requiresAction?: boolean;
  } | null>(null);

  const loadStatus = async () => {
    if (!runtimeFlags?.enableStripeConnect) {
      setLoading(false);
      return;
    }

    try {
      const getStatusFn = httpsCallable(functions, 'getConnectStatus');
      const result = await getStatusFn({});
      const data = result.data as any;
      setStatus(data);
    } catch (error: any) {
      console.error('Failed to load Connect status:', error);
      if (error.code !== 'functions/failed-precondition') {
        show('Failed to load payout status', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [runtimeFlags?.enableStripeConnect]);

  const handleCreateAccount = async () => {
    setCreating(true);
    try {
      const createFn = httpsCallable(functions, 'createConnectAccount');
      await createFn({});
      show('Stripe account created!', 'success');
      await loadStatus();
    } catch (error: any) {
      console.error('Failed to create Connect account:', error);
      show(error.message || 'Failed to create payout account', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleStartOnboarding = async () => {
    try {
      const getLinkFn = httpsCallable(functions, 'getConnectOnboardingLink');
      const result = await getLinkFn({
        returnUrl: window.location.origin + '/profile',
        refreshUrl: window.location.origin + '/profile',
      });
      const data = result.data as any;
      
      // Open onboarding in new window
      window.open(data.url, '_blank');
      show('Onboarding opened in new window', 'success');
    } catch (error: any) {
      console.error('Failed to get onboarding link:', error);
      show(error.message || 'Failed to start onboarding', 'error');
    }
  };

  const handleRefreshStatus = async () => {
    setLoading(true);
    await loadStatus();
  };

  // Feature not enabled
  if (!runtimeFlags?.enableStripeConnect) {
    return (
      <div style={{
        padding: '1.5rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        marginTop: '1.5rem',
      }}>
        <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>💰</span> Driver Payouts
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
          Direct payouts coming soon! You'll be able to receive your earnings automatically.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        padding: '1.5rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        marginTop: '1.5rem',
        textAlign: 'center',
      }}>
        <p style={{ color: 'rgba(255,255,255,0.6)' }}>Loading payout status...</p>
      </div>
    );
  }

  // No account yet
  if (!status?.hasAccount) {
    return (
      <div style={{
        padding: '1.5rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        marginTop: '1.5rem',
      }}>
        <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>💰</span> Driver Payouts
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1rem' }}>
          Set up your payout account to receive earnings automatically after each ride.
        </p>
        <button
          onClick={handleCreateAccount}
          disabled={creating}
          style={{
            width: '100%',
            padding: '12px',
            background: creating ? '#666' : 'linear-gradient(135deg, rgba(0,255,140,0.95) 0%, rgba(0,200,120,0.9) 100%)',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            fontSize: '0.9rem',
            fontWeight: '600',
            cursor: creating ? 'not-allowed' : 'pointer',
          }}
        >
          {creating ? 'Creating...' : '🚀 Setup Payout Account'}
        </button>
      </div>
    );
  }

  // Account exists - show status
  const getStatusColor = () => {
    switch (status.status) {
      case 'active': return 'rgba(0,255,140,0.95)';
      case 'submitted': return 'rgba(255,165,0,0.95)';
      default: return 'rgba(255,255,255,0.6)';
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'active': return '✓ Active - Ready to receive payouts';
      case 'submitted': return '⏳ Under Review';
      case 'pending': return '⚠️ Action Required';
      default: return '○ Setup Incomplete';
    }
  };

  return (
    <div style={{
      padding: '1.5rem',
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${status.status === 'active' ? 'rgba(0,255,140,0.3)' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: '12px',
      marginTop: '1.5rem',
    }}>
      <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>💰</span> Driver Payouts
      </h3>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
      }}>
        <div style={{ fontSize: '0.85rem', fontWeight: '600', color: getStatusColor() }}>
          {getStatusText()}
        </div>
        <button
          onClick={handleRefreshStatus}
          style={{
            padding: '4px 8px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {status.requiresAction && (
        <>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1rem' }}>
            Complete your verification to start receiving automatic payouts after each ride.
          </p>
          <button
            onClick={handleStartOnboarding}
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, rgba(0,255,140,0.95) 0%, rgba(0,200,120,0.9) 100%)',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            ✓ Complete Verification
          </button>
        </>
      )}

      {status.status === 'active' && (
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
          Your payout account is active. Earnings will be transferred automatically.
        </p>
      )}

      {status.status === 'submitted' && (
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
          Your account is under review. This typically takes 1-2 business days.
        </p>
      )}
    </div>
  );
}
