import { useMemo } from 'react';
import { useReverseGeocode } from '../../hooks/useReverseGeocode';

interface TripCardProps {
  status: string;
  priceCents?: number;
  pickup?: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number };
  distanceMeters?: number;
  canCancel: boolean;
  showRetry: boolean;
  loading: boolean;
  onCancel: () => void;
  onRetry: () => void;
  onNewRide?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  dispatching: 'Finding Driver',
  offered: 'Driver Offered',
  accepted: 'Driver Accepted',
  started: 'En Route',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  requested: '#4caf50',
  dispatching: '#2196f3',
  offered: '#ff9800',
  accepted: '#9c27b0',
  started: '#ff5722',
  in_progress: '#ff5722',
  completed: '#4caf50',
  cancelled: '#f44336',
};

export function TripCard({
  status,
  priceCents,
  pickup,
  dropoff,
  distanceMeters,
  canCancel,
  showRetry,
  loading,
  onCancel,
  onRetry,
  onNewRide,
}: TripCardProps) {
  const statusLabel = STATUS_LABELS[status] || status;
  const statusColor = STATUS_COLORS[status] || '#e1e6ef';

  // Reverse geocode pickup and dropoff
  const pickupGeocode = useReverseGeocode(pickup?.lat, pickup?.lng);
  const dropoffGeocode = useReverseGeocode(dropoff?.lat, dropoff?.lng);

  // Compute distance in miles and ETA
  const { distanceMiles, estimatedMinutes } = useMemo(() => {
    if (!distanceMeters) return { distanceMiles: null, estimatedMinutes: null };
    const miles = distanceMeters / 1609.34;
    const minutes = Math.ceil((miles / 25) * 60); // 25 mph average speed
    return { distanceMiles: miles.toFixed(1), estimatedMinutes: minutes };
  }, [distanceMeters]);

  const showCompleted = status === 'completed';

  return (
    <div
      style={{
        background: 'rgba(30, 30, 40, 0.8)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: '600' }}>Trip Status</h3>
        <div
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '16px',
            fontSize: '0.85rem',
            fontWeight: '500',
            backgroundColor: statusColor,
            color: '#fff',
          }}
        >
          {statusLabel}
        </div>
      </div>

      {/* Details Grid */}
      <div
        style={{
          display: 'grid',
          gap: '12px',
          fontSize: '0.9rem',
        }}
      >
        {/* Price */}
        {priceCents !== undefined && (
          <div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Price</div>
            <div style={{ fontWeight: '500', fontSize: '1rem' }}>
              ${(priceCents / 100).toFixed(2)}
            </div>
          </div>
        )}

        {/* Distance + ETA */}
        {distanceMiles && (
          <div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Distance</div>
            <div style={{ fontWeight: '500' }}>
              {distanceMiles} mi {estimatedMinutes && `• ~${estimatedMinutes} min`}
            </div>
          </div>
        )}

        {/* Pickup */}
        {pickup && (
          <div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Pickup</div>
            <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
              {pickupGeocode.loading ? 'Loading address...' : pickupGeocode.label}
            </div>
          </div>
        )}

        {/* Dropoff */}
        {dropoff && (
          <div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Dropoff</div>
            <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
              {dropoffGeocode.loading ? 'Loading address...' : dropoffGeocode.label}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        {canCancel && (
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: loading ? '#666' : '#f44336',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Cancelling...' : 'Cancel Ride'}
          </button>
        )}

        {showRetry && (
          <button
            onClick={onRetry}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: loading ? '#666' : '#2196f3',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Requesting...' : 'Request Again'}
          </button>
        )}

        {showCompleted && onNewRide && (
          <button
            onClick={onNewRide}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: '#4caf50',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            Request New Ride
          </button>
        )}
      </div>
    </div>
  );
}
