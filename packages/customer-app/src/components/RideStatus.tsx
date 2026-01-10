import { useEffect, useState, useMemo, useRef } from 'react';
import { useToast } from './Toast';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, functions } from '../firebase';
import { RideTimeline } from './RideTimeline';
import { SharedMap } from './map/SharedMap';
import { TripCard } from './ui/TripCard';
import { useRoutePolyline } from '../hooks/useRoutePolyline';
import 'leaflet/dist/leaflet.css';

interface Ride {
  id: string;
  status: string;
  riderId: string;
  driverId?: string;
  pickup?: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number };
  driverLocation?: { lat: number; lng: number };
  priceCents?: number;
  createdAtMs?: number;
  searchStartedAtMs?: number;
  searchExpiresAtMs?: number;
  acceptedAtMs?: number;
  startedAtMs?: number;
  completedAtMs?: number;
  cancelledAtMs?: number;
  cancelReason?: string;
}

interface RideStatusProps {
  rideId: string;
  onRideCompleted: () => void;
  onRideRetry?: (newRideId: string) => void;
}

const RIDE_TIMELINE = ['requested', 'dispatching', 'offered', 'accepted', 'started', 'in_progress', 'completed'] as const;
const CANCELLABLE_STATES = ['requested', 'dispatching', 'offered'];

export function RideStatus({ rideId, onRideCompleted, onRideRetry }: RideStatusProps) {
  const { show } = useToast();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(false);
  const [canCancel, setCanCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [searchTimeRemaining, setSearchTimeRemaining] = useState<number | null>(null);

  // Route polyline (using shared hook)
  const { coords: routeLatLngs, distanceMeters } = useRoutePolyline(ride?.pickup, ride?.dropoff);
  
  // Compute stable route key for fitBounds (only based on pickup/dropoff, not driver location)
  const routeKey = useMemo(() => {
    if (!ride?.pickup || !ride?.dropoff) return '';
    return `${ride.pickup.lat},${ride.pickup.lng}-${ride.dropoff.lat},${ride.dropoff.lng}`;
  }, [ride?.pickup, ride?.dropoff]);
  
  // Memoize driver location to prevent unnecessary re-renders
  const driverLocation = useMemo(() => ride?.driverLocation || null, [ride?.driverLocation]);
  
  // Debounce toasts to prevent jitter
  const lastToastKeyRef = useRef<string>('');

  // Wait for auth to be ready before accessing Firestore
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  // Listen to ride status in real-time (only when auth is ready)
  useEffect(() => {
    if (!authReady) return;

    // If signed out, stop listening
    if (!user) {
      setRide(null);
      return;
    }

    const rideRef = doc(db, 'rides', rideId);

    const unsubscribe = onSnapshot(
      rideRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const rideData = snapshot.data() as Omit<Ride, 'id'>;
          setRide({ ...rideData, id: rideId });

          // Determine if ride can be cancelled: only in specific states
          setCanCancel(CANCELLABLE_STATES.includes(rideData.status as string));
          setCancelError(null); // Clear any previous error when status updates

          // If completed or cancelled (but not no_drivers), notify parent
          if (rideData.status === 'completed') {
            setTimeout(() => onRideCompleted(), 2000);
          } else if (rideData.status === 'cancelled' && rideData.cancelReason !== 'no_drivers') {
            // Only auto-return for cancellations other than no_drivers (which shows retry button)
            setTimeout(() => onRideCompleted(), 2000);
          }
        }
      },
      (error) => {
        show(`Error loading ride: ${error.message}`, 'error');
      }
    );

    return () => unsubscribe();
  }, [authReady, user, rideId, onRideCompleted, show]);

  // Countdown timer for search timeout
  useEffect(() => {
    if (!ride || !['requested', 'dispatching', 'offered'].includes(ride.status)) {
      setSearchTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const expiresAt = ride.searchExpiresAtMs || (ride.createdAtMs! + 120000);
      const remaining = Math.max(0, expiresAt - Date.now());
      setSearchTimeRemaining(remaining);

      if (remaining <= 0) {
        setSearchTimeRemaining(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [ride]);

  const handleCancelRide = async () => {
    if (!canCancel) {
      const msg = 'Cannot cancel ride in current state';
      setCancelError(msg);
      show(msg, 'error');
      return;
    }

    setLoading(true);
    setCancelError(null);
    try {
      const cancelRideFn = httpsCallable(functions, 'cancelRide');
      await cancelRideFn({ rideId, reason: 'Customer cancelled' });
      show('Ride cancellation requested', 'success');
      setCanCancel(false);
    } catch (error: unknown) {
      const err = error as any;
      const errorMsg = err?.message || 'Unknown error';
      // Handle common Firebase/function errors gracefully
      let userMsg = errorMsg;
      if (errorMsg.includes('PERMISSION_DENIED')) {
        userMsg = 'No permission to cancel this ride';
      } else if (errorMsg.includes('NOT_FOUND')) {
        userMsg = 'Ride not found';
      } else if (errorMsg.includes('FAILED_PRECONDITION')) {
        userMsg = 'Ride cannot be cancelled in its current state';
      }
      setCancelError(userMsg);
      show(`Failed to cancel ride: ${userMsg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryRide = async () => {
    setIsRetrying(true);
    try {
      if (!ride) return;
      // Request a new ride with the same coordinates
      const tripRequestFn = httpsCallable(functions, 'tripRequest');
      const result = await tripRequestFn({
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        priceCents: ride.priceCents,
      });
      const rideId = (result.data as any).rideId;
      show(`New ride requested! ID: ${rideId}`, 'success');
      localStorage.setItem('rideId', rideId);
      if (onRideRetry) {
        onRideRetry(rideId);
      }
    } catch (error: unknown) {
      const err = error as any;
      const errorMsg = err?.message || 'Unknown error';
      show(`Failed to request ride: ${errorMsg}`, 'error');
    } finally {
      setIsRetrying(false);
    }
  };

  // Memoize status-derived values
  const statusColor = useMemo(() => {
    const statusColors: Record<string, string> = {
      requested: '#4caf50',
      dispatching: '#2196f3',
      offered: '#ff9800',
      accepted: '#9c27b0',
      started: '#ff5722',
      in_progress: '#ff5722',
      completed: '#4caf50',
      cancelled: '#f44336',
    };
    return statusColors[ride?.status || ''] || '#e1e6ef';
  }, [ride?.status]);

  const getTimelinePosition = (status: string): number => {
    return RIDE_TIMELINE.indexOf(status as any);
  };
  
  // Determine if retry should be shown
  const showRetry = ride?.status === 'cancelled' && (ride?.cancelReason === 'no_drivers' || ride?.cancelReason === 'search_timeout');

  if (!ride) {
    return (
      <div className="screen-container">
        <div className="card">
          <div className="spinner">Loading ride details...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-container">
      <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: '16px' }}>Ride Status</h2>

        {/* Trip Card */}
        <TripCard
          status={ride.status}
          priceCents={ride.priceCents}
          pickup={ride.pickup}
          dropoff={ride.dropoff}
          distanceMeters={distanceMeters}
          canCancel={canCancel}
          showRetry={showRetry}
          loading={loading || isRetrying}
          onCancel={handleCancelRide}
          onRetry={handleRetryRide}
          onNewRide={ride.status === 'completed' ? () => onRideCompleted() : undefined}
        />

        {/* Cancel Error */}
        {cancelError && (
          <div
            style={{
              padding: '12px',
              marginBottom: '16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(244, 67, 54, 0.2)',
              borderLeft: '3px solid #f44336',
              color: '#ff8a80',
              fontSize: '14px',
            }}
          >
            {cancelError}
          </div>
        )}

        {/* Map - show when ride has coordinates and driver is assigned */}
        {ride.pickup && ride.dropoff && ['accepted', 'started', 'in_progress'].includes(ride.status) && (
          <div
            style={{
              height: '350px',
              borderRadius: '8px',
              overflow: 'hidden',
              marginBottom: '16px',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <SharedMap
              pickup={ride.pickup}
              dropoff={ride.dropoff}
              driver={driverLocation}
              routeCoords={routeLatLngs}
              shouldFit={true}
              fitKey={routeKey}
            />
          </div>
        )}

        {/* Status Timeline */}
        <div className="timeline-container" style={{ marginBottom: '24px' }}>
          <div className="timeline">
            {RIDE_TIMELINE.map((status, idx) => {
              const isCompleted = getTimelinePosition(ride?.status || '') >= idx;
              const isCurrent = ride?.status === status;
              const stepColor = isCurrent ? statusColor : isCompleted ? '#4caf50' : '#666';
              return (
                <div key={status} className="timeline-item" style={{ opacity: isCompleted ? 1 : 0.3 }}>
                  <div
                    className="timeline-dot"
                    style={{
                      backgroundColor: stepColor,
                      boxShadow: isCurrent ? `0 0 12px ${stepColor}` : 'none',
                    }}
                  />
                  <span className="timeline-label">{status}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Additional Details */}
        <div className="ride-status-grid">
          {ride.driverId && (
            <div className="status-item">
              <span className="label">Driver ID</span>
              <span className="value">{ride.driverId}</span>
            </div>
          )}

          {/* Show countdown timer while searching */}
          {searchTimeRemaining !== null && searchTimeRemaining > 0 && (
            <div
              className="status-item"
              style={{
                background: 'rgba(33, 150, 243, 0.1)',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(33, 150, 243, 0.3)',
              }}
            >
              <span className="label">⏱️ Searching for drivers...</span>
              <span className="value" style={{ color: '#2196f3', fontWeight: 'bold', fontSize: '1.1rem' }}>
                {Math.floor(searchTimeRemaining / 60000)}:
                {String(Math.floor((searchTimeRemaining % 60000) / 1000)).padStart(2, '0')} remaining
              </span>
            </div>
          )}

          {ride.createdAtMs && (
            <div className="status-item">
              <span className="label">Created</span>
              <span className="value" style={{ fontSize: '0.85rem' }}>
                {new Date(ride.createdAtMs).toLocaleString()}
              </span>
            </div>
          )}

          {ride.acceptedAtMs && (
            <div className="status-item">
              <span className="label">Accepted</span>
              <span className="value" style={{ fontSize: '0.85rem' }}>
                {new Date(ride.acceptedAtMs).toLocaleString()}
              </span>
            </div>
          )}

          {ride.completedAtMs && (
            <div className="status-item">
              <span className="label">Completed</span>
              <span className="value" style={{ fontSize: '0.85rem' }}>
                {new Date(ride.completedAtMs).toLocaleString()}
              </span>
            </div>
          )}

          {ride.cancelledAtMs && (
            <div className="status-item">
              <span className="label">Cancelled</span>
              <span className="value" style={{ fontSize: '0.85rem' }}>
                {new Date(ride.cancelledAtMs).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Event Timeline */}
        <div style={{ marginTop: '24px' }}>
          <RideTimeline rideId={rideId} />
        </div>
      </div>
    </div>
  );
}
