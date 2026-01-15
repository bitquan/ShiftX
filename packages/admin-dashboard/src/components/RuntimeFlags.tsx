import { useEffect, useState } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface RuntimeFlags {
  disablePayments: boolean;
  disableNewRequests: boolean;
  disableDriverOnline: boolean;
  disableAcceptRide: boolean;
  enableStripeConnect: boolean;
  maintenanceMessage: string;
  updatedAtMs?: number;
  updatedBy?: string;
}

const DEFAULT_FLAGS: RuntimeFlags = {
  disablePayments: false,
  disableNewRequests: false,
  disableDriverOnline: false,
  disableAcceptRide: false,
  enableStripeConnect: false,
  maintenanceMessage: '',
};

export function RuntimeFlags() {
  const [flags, setFlags] = useState<RuntimeFlags>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Subscribe to runtime flags
  useEffect(() => {
    const flagsRef = doc(db, 'config', 'runtimeFlags');
    
    const unsubscribe = onSnapshot(
      flagsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setFlags({
            ...DEFAULT_FLAGS,
            ...snapshot.data() as RuntimeFlags,
          });
        } else {
          setFlags(DEFAULT_FLAGS);
        }
        setLoading(false);
      },
      (error) => {
        console.error('[RuntimeFlags] Error:', error);
        setLoading(false);
        setMessage({ text: 'Failed to load flags', type: 'error' });
      }
    );

    return () => unsubscribe();
  }, []);

  const logAdminAction = async (action: string, details: any) => {
    try {
      const adminLogsRef = doc(db, 'adminLogs', `${Date.now()}_${auth.currentUser?.uid}`);
      await setDoc(adminLogsRef, {
        adminUid: auth.currentUser?.uid,
        adminEmail: auth.currentUser?.email,
        action,
        details,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('[RuntimeFlags] Failed to log action:', error);
    }
  };

  const handleToggle = async (flagName: keyof RuntimeFlags) => {
    if (saving) return;

    const newValue = !flags[flagName];
    const oldFlags = { ...flags };
    
    // Optimistic update
    setFlags({ ...flags, [flagName]: newValue });
    setSaving(true);
    setMessage(null);

    try {
      const flagsRef = doc(db, 'config', 'runtimeFlags');
      await setDoc(
        flagsRef,
        {
          [flagName]: newValue,
          updatedAtMs: Date.now(),
          updatedBy: auth.currentUser?.email || auth.currentUser?.uid || 'unknown',
        },
        { merge: true }
      );

      // Log the change
      await logAdminAction('toggle_runtime_flag', {
        flag: flagName,
        oldValue: oldFlags[flagName],
        newValue,
      });

      setMessage({ text: `${flagName} updated successfully`, type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('[RuntimeFlags] Failed to update:', error);
      setFlags(oldFlags); // Revert
      setMessage({ text: `Failed to update: ${error.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleMessageChange = async (newMessage: string) => {
    if (saving) return;

    const oldMessage = flags.maintenanceMessage;
    
    // Optimistic update
    setFlags({ ...flags, maintenanceMessage: newMessage });
    setSaving(true);
    setMessage(null);

    try {
      const flagsRef = doc(db, 'config', 'runtimeFlags');
      await setDoc(
        flagsRef,
        {
          maintenanceMessage: newMessage,
          updatedAtMs: Date.now(),
          updatedBy: auth.currentUser?.email || auth.currentUser?.uid || 'unknown',
        },
        { merge: true }
      );

      // Log the change
      await logAdminAction('update_maintenance_message', {
        oldMessage,
        newMessage,
      });

      setMessage({ text: 'Maintenance message updated', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('[RuntimeFlags] Failed to update message:', error);
      setFlags({ ...flags, maintenanceMessage: oldMessage }); // Revert
      setMessage({ text: `Failed to update: ${error.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="runtime-flags">
        <h2>⚡ Runtime Flags</h2>
        <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.6)' }}>
          Loading flags...
        </div>
      </div>
    );
  }

  return (
    <div className="runtime-flags">
      <div style={{ marginBottom: '1.5rem' }}>
        <h2>⚡ Runtime Flags</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Control system features in real-time without redeploying
        </p>
      </div>

      {message && (
        <div
          style={{
            padding: '12px 16px',
            marginBottom: '1rem',
            borderRadius: '6px',
            backgroundColor: message.type === 'success' ? 'rgba(0,255,140,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${message.type === 'success' ? 'rgba(0,255,140,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: message.type === 'success' ? 'rgba(0,255,140,0.95)' : '#ef4444',
          }}
        >
          {message.text}
        </div>
      )}

      <div className="flags-grid" style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Disable Payments */}
        <div className="flag-card" style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', marginBottom: '0.5rem' }}>
                💳 Disable Payments
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', margin: 0 }}>
                Prevents customers from authorizing payments for rides
              </p>
            </div>
            <button
              onClick={() => handleToggle('disablePayments')}
              disabled={saving}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
                backgroundColor: flags.disablePayments ? '#ef4444' : '#10b981',
                color: 'white',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {flags.disablePayments ? 'DISABLED' : 'ENABLED'}
            </button>
          </div>
        </div>

        {/* Disable New Requests */}
        <div className="flag-card" style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', marginBottom: '0.5rem' }}>
                🚫 Disable New Requests
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', margin: 0 }}>
                Prevents customers from requesting new rides
              </p>
            </div>
            <button
              onClick={() => handleToggle('disableNewRequests')}
              disabled={saving}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
                backgroundColor: flags.disableNewRequests ? '#ef4444' : '#10b981',
                color: 'white',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {flags.disableNewRequests ? 'DISABLED' : 'ENABLED'}
            </button>
          </div>
        </div>

        {/* Disable Driver Online */}
        <div className="flag-card" style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', marginBottom: '0.5rem' }}>
                🚗 Disable Driver Online
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', margin: 0 }}>
                Prevents drivers from going online to accept rides
              </p>
            </div>
            <button
              onClick={() => handleToggle('disableDriverOnline')}
              disabled={saving}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
                backgroundColor: flags.disableDriverOnline ? '#ef4444' : '#10b981',
                color: 'white',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {flags.disableDriverOnline ? 'DISABLED' : 'ENABLED'}
            </button>
          </div>
        </div>

        {/* Disable Accept Ride */}
        <div className="flag-card" style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', marginBottom: '0.5rem' }}>
                ⛔ Disable Accept Ride
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', margin: 0 }}>
                Prevents drivers from accepting ride offers
              </p>
            </div>
            <button
              onClick={() => handleToggle('disableAcceptRide')}
              disabled={saving}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
                backgroundColor: flags.disableAcceptRide ? '#ef4444' : '#10b981',
                color: 'white',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {flags.disableAcceptRide ? 'DISABLED' : 'ENABLED'}
            </button>
          </div>
        </div>

        {/* Enable Stripe Connect */}
        <div className="flag-card" style={{
          background: flags.enableStripeConnect ? 'rgba(0,255,140,0.05)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${flags.enableStripeConnect ? 'rgba(0,255,140,0.2)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: '8px',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', marginBottom: '0.5rem' }}>
                💸 Enable Stripe Connect
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', margin: 0 }}>
                Enables direct driver payouts with platform fees ($1.50 rider + $1.50 driver)
              </p>
              {flags.enableStripeConnect && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(251,191,36,0.1)',
                  border: '1px solid rgba(251,191,36,0.2)',
                  fontSize: '0.75rem',
                  color: 'rgba(251,191,36,0.95)',
                }}>
                  ⚠️ Only drivers with active Connect accounts will receive payouts
                </div>
              )}
            </div>
            <button
              onClick={() => handleToggle('enableStripeConnect')}
              disabled={saving}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
                backgroundColor: flags.enableStripeConnect ? '#10b981' : 'rgba(255,255,255,0.1)',
                color: 'white',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {flags.enableStripeConnect ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        </div>
      </div>

      {/* Maintenance Message */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '1.5rem',
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem', marginBottom: '0.5rem' }}>
          📢 Maintenance Message
        </h3>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Displayed as a banner in all apps (customer, driver, admin)
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <input
            type="text"
            value={flags.maintenanceMessage}
            onChange={(e) => setFlags({ ...flags, maintenanceMessage: e.target.value })}
            placeholder="Enter maintenance message..."
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.3)',
              color: 'white',
              fontSize: '0.9rem',
            }}
          />
          <button
            onClick={() => handleMessageChange(flags.maintenanceMessage)}
            disabled={saving}
            style={{
              padding: '12px 24px',
              borderRadius: '6px',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem',
              backgroundColor: 'rgba(0,255,140,0.95)',
              color: '#000',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Update'}
          </button>
        </div>
      </div>

      {flags.updatedAtMs && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          textAlign: 'center',
          fontSize: '0.8rem',
          color: 'rgba(255,255,255,0.5)',
        }}>
          Last updated: {new Date(flags.updatedAtMs).toLocaleString()}
          {flags.updatedBy && ` by ${flags.updatedBy}`}
        </div>
      )}
    </div>
  );
}
