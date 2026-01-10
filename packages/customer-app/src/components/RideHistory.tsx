import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useToast } from './Toast';

interface HistoricalRide {
  rideId: string;
  status: string;
  priceCents: number;
  createdAtMs: number;
  cancelReason?: string;
  pickup?: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number };
  completedAtMs?: number;
  cancelledAtMs?: number;
}

interface RideHistoryProps {
  onSelectRide: (rideId: string) => void;
}

export function RideHistory({ onSelectRide }: RideHistoryProps) {
  const { show } = useToast();
  const [rides, setRides] = useState<HistoricalRide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const getRideHistoryFn = httpsCallable(functions, 'getRideHistory');
      const result = await getRideHistoryFn({ limit: 10 });
      const data = result.data as { rides: HistoricalRide[] };
      setRides(data.rides);
    } catch (error: any) {
      show(`Failed to load ride history: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      completed: '#4caf50',
      cancelled: '#f44336',
      requested: '#2196f3',
      dispatching: '#2196f3',
      offered: '#ff9800',
      accepted: '#9c27b0',
      started: '#ff5722',
      in_progress: '#ff5722',
    };
    return colors[status] || '#e1e6ef';
  };

  const getStatusLabel = (ride: HistoricalRide): string => {
    if (ride.status === 'cancelled') {
      if (ride.cancelReason === 'no_drivers') return 'No Drivers';
      if (ride.cancelReason === 'search_timeout') return 'Timed Out';
      return 'Cancelled';
    }
    return ride.status.charAt(0).toUpperCase() + ride.status.slice(1);
  };

  const formatDate = (ms: number): string => {
    const date = new Date(ms);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const rideDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (rideDate.getTime() === today.getTime()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (rideDate.getTime() === yesterday.getTime()) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="card">
        <h2>Ride History</h2>
        <div className="spinner">Loading...</div>
      </div>
    );
  }

  if (rides.length === 0) {
    return (
      <div className="card">
        <h2>Ride History</h2>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '2rem' }}>
          No rides yet. Request your first ride!
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Ride History</h2>
        <button 
          onClick={loadHistory}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Refresh
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {rides.map((ride) => (
          <div
            key={ride.rideId}
            onClick={() => onSelectRide(ride.rideId)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '0.5rem',
              padding: '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
              <div>
                <div style={{ 
                  display: 'inline-block',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '1rem',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  backgroundColor: getStatusColor(ride.status),
                  color: 'white',
                  marginBottom: '0.5rem'
                }}>
                  {getStatusLabel(ride)}
                </div>
                <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                  {formatDate(ride.createdAtMs)}
                </div>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>
                ${(ride.priceCents / 100).toFixed(2)}
              </div>
            </div>

            {ride.pickup && ride.dropoff && (
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                <div>📍 {ride.pickup.lat.toFixed(4)}, {ride.pickup.lng.toFixed(4)}</div>
                <div>🏁 {ride.dropoff.lat.toFixed(4)}, {ride.dropoff.lng.toFixed(4)}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
