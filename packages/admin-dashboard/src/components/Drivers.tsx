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
  approvalBypassByAdmin?: boolean;
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
  licensePhotoURL?: string;
  insurancePhotoURL?: string;
  vehiclePhotoURL?: string;
  registrationPhotoURL?: string;
}

export function Drivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending' | 'online' | 'bypass'>('all');
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedDocuments, setExpandedDocuments] = useState<string | null>(null);

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
    

  const handleToggleBypass = async (uid: string, currentValue: boolean) => {
    if (!window.confirm(`${currentValue ? 'Remove' : 'Enable'} approval bypass for this driver?\n\n⚠️ WARNING: Bypass allows drivers to work WITHOUT document verification.\nOnly enable for trusted drivers in exceptional circumstances.`)) {
      return;
    }

    try {
      setProcessing(uid);
      const toggleApprovalBypass = httpsCallable(functions, 'toggleApprovalBypass');
      await toggleApprovalBypass({ driverId: uid, bypass: !currentValue });
      
      // Update local state
      setDrivers(drivers.map(d => 
        d.uid === uid ? { ...d, approvalBypassByAdmin: !currentValue } : d
      ));
    } catch (error: any) {
      console.error('Error toggling bypass:', error);
      alert(error?.message || 'Failed to toggle approval bypass');
    } finally {
      setProcessing(null);
    }
  };}
  };

  const filteredDrivers = drivers.filter(driver => {
    if (filter === 'approved') return driver.approved;
    if (filter === 'pending') return !driver.approved && !driver.approvalBypassByAdmin;
    if (filter === 'online') return driver.isOnline;
    if (filter === 'bypass') return driver.approvalBypassByAdmin;
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
            Pending ({drivers.filter(d => !d.approved && !d.approvalBypassByAdmin).length})
          </button>
          <button
            className={filter === 'bypass' ? 'active' : ''}
            onClick={() => setFilter('bypass')}
          >
            🔓 Bypass ({drivers.filter(d => d.approvalBypassByAdmin).length})
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
                {driver.approvalBypassByAdmin && (
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(251,191,36,0.15)',
                    border: '1px solid rgba(251,191,36,0.3)',
                    color: 'rgba(251,191,36,0.95)',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    marginBottom: '8px',
                    textAlign: 'center',
                  }}>
                    🔓 Approval Bypass Active
                  </div>
                )}
                
                {/* Document Preview - Always show button */}
                <div style={{ marginBottom: '12px' }}>
                  <button
                    onClick={() => setExpandedDocuments(expandedDocuments === driver.uid ? null : driver.uid)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      backgroundColor: 'rgba(139,92,246,0.2)',
                      border: '2px solid rgba(139,92,246,0.5)',
                      color: 'rgba(139,92,246,0.95)',
                    }}
                  >
                    {expandedDocuments === driver.uid ? '📄 Hide Documents' : '📄 Review Documents'}
                  </button>
                  
                  {expandedDocuments === driver.uid && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                      {!driver.licensePhotoURL && !driver.insurancePhotoURL && !driver.vehiclePhotoURL && !driver.registrationPhotoURL ? (
                        <div style={{
                          textAlign: 'center',
                          padding: '2rem',
                          color: 'rgba(255,255,255,0.5)',
                          fontSize: '0.9rem',
                        }}>
                          ⚠️ No documents uploaded yet
                        </div>
                      ) : (
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: '12px',
                        }}>
                          {driver.licensePhotoURL ? (
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                                Driver License
                              </div>
                              <a href={driver.licensePhotoURL} target="_blank" rel="noopener noreferrer">
                                <img 
                                  src={driver.licensePhotoURL} 
                                  alt="License"
                                  style={{
                                    width: '100%',
                                    height: '120px',
                                    objectFit: 'cover',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                  }}
                                />
                              </a>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                                Driver License
                              </div>
                              <div style={{
                                width: '100%',
                                height: '120px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                border: '2px dashed rgba(255,255,255,0.2)',
                                color: 'rgba(255,255,255,0.4)',
                                fontSize: '0.75rem',
                              }}>
                                Not uploaded
                              </div>
                            </div>
                          )}
                          {driver.insurancePhotoURL ? (
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                                Insurance
                              </div>
                              <a href={driver.insurancePhotoURL} target="_blank" rel="noopener noreferrer">
                                <img 
                                  src={driver.insurancePhotoURL} 
                                  alt="Insurance"
                                  style={{
                                    width: '100%',
                                    height: '120px',
                                    objectFit: 'cover',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                  }}
                                />
                              </a>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                                Insurance
                              </div>
                              <div style={{
                                width: '100%',
                                height: '120px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                border: '2px dashed rgba(255,255,255,0.2)',
                                color: 'rgba(255,255,255,0.4)',
                                fontSize: '0.75rem',
                              }}>
                                Not uploaded
                              </div>
                            </div>
                          )}
                          {driver.vehiclePhotoURL ? (
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                                Vehicle Photo
                              </div>
                              <a href={driver.vehiclePhotoURL} target="_blank" rel="noopener noreferrer">
                                <img 
                                  src={driver.vehiclePhotoURL} 
                                  alt="Vehicle"
                                  style={{
                                    width: '100%',
                                    height: '120px',
                                    objectFit: 'cover',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                  }}
                                />
                              </a>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                                Vehicle Photo
                              </div>
                              <div style={{
                                width: '100%',
                                height: '120px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                border: '2px dashed rgba(255,255,255,0.2)',
                                color: 'rgba(255,255,255,0.4)',
                                fontSize: '0.75rem',
                              }}>
                                Not uploaded
                              </div>
                            </div>
                          )}
                          {driver.registrationPhotoURL ? (
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                                Registration
                              </div>
                              <a href={driver.registrationPhotoURL} target="_blank" rel="noopener noreferrer">
                                <img 
                                  src={driver.registrationPhotoURL} 
                                  alt="Registration"
                                  style={{
                                    width: '100%',
                                    height: '120px',
                                    objectFit: 'cover',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                  }}
                                />
                              </a>
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                                Registration
                              </div>
                              <div style={{
                                width: '100%',
                                height: '120px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                border: '2px dashed rgba(255,255,255,0.2)',
                                color: 'rgba(255,255,255,0.4)',
                                fontSize: '0.75rem',
                              }}>
                                Not uploaded
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

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
                
                {/* Approval Bypass Toggle */}
                <button
                  onClick={() => handleToggleBypass(driver.uid, driver.approvalBypassByAdmin || false)}
                  disabled={processing === driver.uid}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: processing === driver.uid ? 'not-allowed' : 'pointer',
                    backgroundColor: driver.approvalBypassByAdmin 
                      ? 'rgba(239,68,68,0.15)' 
                      : 'rgba(251,191,36,0.15)',
                    border: `1px solid ${driver.approvalBypassByAdmin 
                      ? 'rgba(239,68,68,0.3)' 
                      : 'rgba(251,191,36,0.3)'}`,
                    color: driver.approvalBypassByAdmin 
                      ? '#ef4444' 
                      : 'rgba(251,191,36,0.95)',
                  }}
                >
                  {driver.approvalBypassByAdmin ? '🔒 Remove Bypass' : '🔓 Enable Bypass'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
