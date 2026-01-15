import React, { useMemo } from 'react';
import { useReverseGeocode } from '../hooks/useReverseGeocode';

interface LatLng {
  lat: number;
  lng: number;
}

type RideState = 'accepted' | 'started' | 'in_progress' | 'completed';

interface ActiveRideHeaderProps {
  rideId: string;
  currentStatus: RideState;
  pickup?: LatLng;
  dropoff?: LatLng;
  driverLocation?: LatLng | null;
  gpsError?: string | null;
  paymentAuthorized?: boolean;
  onAction: () => void;
  onNavigate: () => void;
  onCancel?: () => void;
  isUpdating: boolean;
  isCancelling?: boolean;
}

const statusConfig: Record<RideState, { label: string; color: string; actionLabel: string | null }> = {
  accepted: { label: 'Accepted', color: '#4ade80', actionLabel: 'Start Ride' },
  started: { label: 'Started', color: '#60a5fa', actionLabel: 'Begin Trip' },
  in_progress: { label: 'In Progress', color: '#fbbf24', actionLabel: 'Complete Ride' },
  completed: { label: 'Completed', color: '#8b5cf6', actionLabel: null },
};

/**
 * Header card for active ride screen.
 * Shows status, addresses, and primary action button.
 */
export function ActiveRideHeader({
  rideId,
  currentStatus,
  pickup,
  dropoff,
  driverLocation,
  gpsError,
  paymentAuthorized,
  onAction,
  onNavigate,
  onCancel,
  isUpdating,
  isCancelling,
}: ActiveRideHeaderProps) {
  const config = statusConfig[currentStatus];

  // Check if payment is required but not authorized (only for 'accepted' status)
  const waitingForPayment = currentStatus === 'accepted' && !paymentAuthorized;
  
  console.log('[ActiveRideHeader] Payment state:', {
    currentStatus,
    paymentAuthorized,
    waitingForPayment,
  });

  // Reverse geocode pickup and dropoff
  const pickupGeocode = useReverseGeocode(pickup?.lat, pickup?.lng);
  const dropoffGeocode = useReverseGeocode(dropoff?.lat, dropoff?.lng);

  const pickupDisplay = useMemo(() => {
    if (pickupGeocode.loading) return 'Loading...';
    if (pickupGeocode.label) return pickupGeocode.label;
    if (pickup) return `${pickup.lat.toFixed(4)}, ${pickup.lng.toFixed(4)}`;
    return 'Unknown';
  }, [pickupGeocode, pickup]);

  const dropoffDisplay = useMemo(() => {
    if (dropoffGeocode.loading) return 'Loading...';
    if (dropoffGeocode.label) return dropoffGeocode.label;
    if (dropoff) return `${dropoff.lat.toFixed(4)}, ${dropoff.lng.toFixed(4)}`;
    return 'Unknown';
  }, [dropoffGeocode, dropoff]);

  return (
    <div className="active-ride-header">
      {/* Status Badge */}
      <div className="ride-status-row">
        <span
          className="status-pill ride-status-pill"
          style={{ backgroundColor: `${config.color}20`, color: config.color }}
        >
          <span className="status-dot" style={{ backgroundColor: config.color }}></span>
          {config.label}
        </span>
        <span className="ride-id-small">ID: {rideId.slice(0, 8)}</span>
      </div>

      {/* Addresses */}
      <div className="ride-route">
        <div className="route-point">
          <span className="route-icon pickup-icon">🟢</span>
          <div className="route-text">
            <span className="route-label">Pickup</span>
            <span className="route-address">{pickupDisplay}</span>
          </div>
        </div>
        <div className="route-divider"></div>
        <div className="route-point">
          <span className="route-icon dropoff-icon">🔴</span>
          <div className="route-text">
            <span className="route-label">Dropoff</span>
            <span className="route-address">{dropoffDisplay}</span>
          </div>
        </div>
      </div>

      {/* GPS Status */}
      <div className="gps-mini-status">
        {gpsError ? (
          <span className="gps-error">⚠️ GPS: {gpsError}</span>
        ) : driverLocation ? (
          <span className="gps-live">📍 GPS: Live</span>
        ) : (
          <span className="gps-loading">📡 GPS: Getting location...</span>
        )}
      </div>

      {/* Payment Status Banner */}
      {currentStatus === 'accepted' && (
        <div style={{ marginTop: '12px' }}>
          {waitingForPayment ? (
            <div className="payment-waiting-banner" style={{
              padding: '12px',
              backgroundColor: 'rgba(251,191,36,0.1)',
              border: '1px solid rgba(251,191,36,0.3)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{ fontSize: '1.2rem' }}>⏳</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#fbbf24' }}>
                  Waiting for rider to authorize payment
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
                  You'll be able to start once payment is confirmed
                </div>
              </div>
            </div>
          ) : (
            <div className="payment-authorized-banner" style={{
              padding: '12px',
              backgroundColor: 'rgba(74,222,128,0.1)',
              border: '1px solid rgba(74,222,128,0.3)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span style={{ fontSize: '1.2rem' }}>✅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#4ade80' }}>
                  Payment authorized
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginTop: '2px' }}>
                  Ready to start the trip
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="ride-actions-row">
        <button onClick={onNavigate} className="secondary-button navigate-btn">
          📍 Navigate
        </button>
        {config.actionLabel && (
          <button
            onClick={onAction}
            disabled={isUpdating || waitingForPayment}
            className="primary-button action-btn-wide"
            style={waitingForPayment ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            {isUpdating ? '...' : config.actionLabel}
          </button>
        )}
      </div>

      {/* Cancel button - only show when accepted */}
      {currentStatus === 'accepted' && onCancel && (
        <div style={{ marginTop: '12px' }}>
          <button
            onClick={onCancel}
            disabled={isCancelling || isUpdating}
            className="secondary-button"
            style={{ 
              width: '100%', 
              color: '#ef4444',
              borderColor: '#ef4444',
              opacity: (isCancelling || isUpdating) ? 0.5 : 1
            }}
          >
            {isCancelling ? 'Cancelling...' : '✕ Cancel Ride'}
          </button>
        </div>
      )}
    </div>
  );
}
