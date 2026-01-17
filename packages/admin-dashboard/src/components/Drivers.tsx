import { useEffect, useState } from 'react';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

interface Driver {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  approved: boolean;
  isOnline: boolean;
  vehicleClass?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  licensePlate?: string;
  rating?: number;
  stripeConnectAccountId?: string;
  stripeConnectStatus?: 'none' | 'pending' | 'active' | 'disabled';
  connectEnabledOverride?: boolean;
}

export function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending' | 'online'>('all');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    try {
      setLoading(true);
      const listDrivers = httpsCallable(functions, 'listDrivers');
      const result = await listDrivers();
      const driversData = result.data as { drivers: Driver[] };
      setDrivers(driversData.drivers);
    } catch (error) {
      console.error('Error loading drivers:', error);
      alert('Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (uid: string, approve: boolean) => {
    if (!window.confirm(`${approve ? 'Approve' : 'Disable'} this driver?`)) {
      return;
    }

    try {
      setProcessing(uid);
      const approveDriver = httpsCallable(functions, 'approveDriver');
      await approveDriver({ driverId: uid, approved: approve });
      
      // Update local state
      setDrivers(drivers.map(d => 
        d.uid === uid ? { ...d, approved: approve } : d
      ));
    } catch (error) {
      console.error('Error updating driver:', error);
      alert('Failed to update driver');
    } finally {
      setProcessing(null);
    }
  };

  const handleTogglePilot = async (uid: string, currentValue: boolean) => {
    const action = currentValue ? 'disable' : 'enable';
    if (!window.confirm(`${action === 'enable' ? 'Enable' : 'Disable'} Stripe Connect for this driver?\n\nThis controls whether they receive direct payouts via Stripe Connect.`)) {
      return;
    }

    try {
      setProcessing(uid);
      const toggleConnectPilot = httpsCallable(functions, 'toggleConnectPilot');
      await toggleConnectPilot({ driverId: uid, enabled: !currentValue });
      
      // Update local state
      setDrivers(drivers.map(d => 
        d.uid === uid ? { ...d, connectEnabledOverride: !currentValue } : d
      ));
    } catch (error: any) {
      console.error('Error toggling pilot:', error);
      alert(error?.message || 'Failed to toggle pilot status');
    } finally {
      setProcessing(null);
    }
  };

  const filteredDrivers = drivers.filter(driver => {
    if (filter === 'approved') return driver.approved;
    if (filter === 'pending') return !driver.approved;
    if (filter === 'online') return driver.isOnline;
    return true;
  });

  if (loading) {
    return <div className="loading">Loading drivers...</div>;
  }

  return (
    <div className="drivers-screen">
      <div className="screen-header">
        <h2>Drivers Management</h2>
        <div className="filter-buttons">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All ({drivers.length})
          </button>
          <button
            className={filter === 'approved' ? 'active' : ''}
            onClick={() => setFilter('approved')}
          >
            Approved ({drivers.filter(d => d.approved).length})
          </button>
          <button
            className={filter === 'pending' ? 'active' : ''}
            onClick={() => setFilter('pending')}
          >
            Pending ({drivers.filter(d => !d.approved).length})
          </button>
          <button
            className={filter === 'online' ? 'active' : ''}
            onClick={() => setFilter('online')}
          >
            Online ({drivers.filter(d => d.isOnline).length})
          </button>
        </div>
      </div>

      <div className="drivers-list">
        {filteredDrivers.length === 0 ? (
          <div className="empty-state">No drivers found</div>
        ) : (
          filteredDrivers.map(driver => (
            <div key={driver.uid} className="driver-card">
              <div className="driver-info">
                {driver.photoURL ? (
                  <img src={driver.photoURL} alt={driver.displayName} className="driver-photo" />
                ) : (
                  <div className="driver-photo-placeholder">
                    {driver.displayName?.charAt(0) || driver.email.charAt(0)}
                  </div>
                )}
                
                <div className="driver-details">
                  <div className="driver-name">
                    {driver.displayName || driver.email.split('@')[0]}
                    {driver.isOnline && <span className="online-badge">🟢 Online</span>}
                  </div>
                  <div className="driver-email">{driver.email}</div>
                  {driver.phoneNumber && (
                    <div className="driver-phone">{driver.phoneNumber}</div>
                  )}
                  {driver.vehicleClass && (
                    <div className="driver-vehicle">
                      {driver.vehicleClass} • {driver.vehicleMake} {driver.vehicleModel} • {driver.vehicleColor}
                      {driver.licensePlate && ` • ${driver.licensePlate}`}
                    </div>
                  )}
                  {driver.rating && (
                    <div className="driver-rating">⭐ {driver.rating.toFixed(1)}</div>
                  )}
                  {driver.stripeConnectStatus && driver.stripeConnectStatus !== 'none' && (
                    <div style={{ marginTop: '6px' }}>
                      <div className="driver-connect" style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        backgroundColor: driver.stripeConnectStatus === 'active' ? 'rgba(0,255,140,0.1)' : driver.stripeConnectStatus === 'pending' ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)',
                        color: driver.stripeConnectStatus === 'active' ? 'rgba(0,255,140,0.95)' : driver.stripeConnectStatus === 'pending' ? 'rgba(251,191,36,0.95)' : '#ef4444',
                        border: `1px solid ${driver.stripeConnectStatus === 'active' ? 'rgba(0,255,140,0.2)' : driver.stripeConnectStatus === 'pending' ? 'rgba(251,191,36,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      }}>
                        {driver.stripeConnectStatus === 'active' ? '💸 Payouts Active' : driver.stripeConnectStatus === 'pending' ? '⏳ Payout Setup Pending' : '⚠️ Payouts Disabled'}
                      </div>
                      {driver.stripeConnectAccountId && (
                        <div style={{
                          fontSize: '0.7rem',
                          color: 'rgba(255,255,255,0.4)',
                          marginTop: '4px',
                          fontFamily: 'monospace',
                        }}>
                          Stripe: {driver.stripeConnectAccountId}
                        </div>
                      )}
                      {/* Pilot Toggle - only show if Connect account exists */}
                      {driver.stripeConnectAccountId && driver.stripeConnectStatus === 'active' && (
                        <button
                          onClick={() => handleTogglePilot(driver.uid, driver.connectEnabledOverride || false)}
                          disabled={processing === driver.uid}
                          style={{
                            marginTop: '8px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.7rem',
                            fontWeight: '600',
                            cursor: processing === driver.uid ? 'not-allowed' : 'pointer',
                            backgroundColor: driver.connectEnabledOverride 
                              ? 'rgba(0,255,140,0.15)' 
                              : 'rgba(139,92,246,0.15)',
                            border: `1px solid ${driver.connectEnabledOverride 
                              ? 'rgba(0,255,140,0.3)' 
                              : 'rgba(139,92,246,0.3)'}`,
                            color: driver.connectEnabledOverride 
                              ? 'rgba(0,255,140,0.95)' 
                              : 'rgba(139,92,246,0.95)',
                          }}
                        >
                          {driver.connectEnabledOverride ? '🚀 Pilot Enabled' : '🧪 Enable Pilot'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="driver-actions">
                {driver.approved ? (
                  <>
                    <span className="status-badge approved">✓ Approved</span>
                    <button
                      className="btn-disable"
                      onClick={() => handleApprove(driver.uid, false)}
                      disabled={processing === driver.uid}
                    >
                      {processing === driver.uid ? 'Processing...' : 'Disable'}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="status-badge pending">⏳ Pending</span>
                    <button
                      className="btn-approve"
                      onClick={() => handleApprove(driver.uid, true)}
                      disabled={processing === driver.uid}
                    >
                      {processing === driver.uid ? 'Processing...' : 'Approve'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
