import { useEffect, useState, useMemo } from 'react';
import { useToast } from './Toast';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, functions } from '../firebase';
import { RideTimeline } from './RideTimeline';
import { SharedMap } from './map/SharedMap';
import { TripCard } from './ui/TripCard';
import { PaymentAuthorize } from './PaymentAuthorize';
import { Receipt } from './Receipt';
import { useRoutePolyline } from '../hooks/useRoutePolyline';
import { useDriverEta } from '../hooks/useDriverEta';
import { RuntimeFlags } from '../utils/runtimeFlags';
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
  finalAmountCents?: number;
  createdAtMs?: number;
  searchStartedAtMs?: number;
  searchExpiresAtMs?: number;
  acceptedAtMs?: number;
  startedAtMs?: number;
  completedAtMs?: number;
  cancelledAtMs?: number;
  cancelledBy?: string;
  cancelReason?: string;
  paymentStatus?: string;
  paymentIntentId?: string;
  paymentAuthorizedAtMs?: number;
  paymentCapturedAtMs?: number;
}

interface RideStatusProps {
  rideId: string;
  onRideCompleted: () => void;
  onRideRetry?: (newRideId: string) => void;
  runtimeFlags: RuntimeFlags | null;
}

const RIDE_TIMELINE = ['requested', 'dispatching', 'offered', 'accepted', 'started', 'in_progress', 'completed'] as const;
const CANCELLABLE_STATES = ['requested', 'dispatching', 'offered', 'accepted'];
const ACTIVE_CANCELLABLE_STATES = ['started', 'in_progress'];

export function RideStatus({ rideId, onRideCompleted, onRideRetry, runtimeFlags }: RideStatusProps) {
  const { show } = useToast();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(false);
  const [canCancel, setCanCancel] = useState(false);
  const [canCancelActive, setCanCancelActive] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [searchTimeRemaining, setSearchTimeRemaining] = useState<number | null>(null);
  const [showPaymentUI, setShowPaymentUI] = useState(false);
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [driverUser, setDriverUser] = useState<any>(null);

  // Route polyline (using shared hook)
  const { coords: routeLatLngs, distanceMeters } = useRoutePolyline(ride?.pickup, ride?.dropoff);
  
  // Compute stable route key for fitBounds (only based on pickup/dropoff, not driver location)
  const routeKey = useMemo(() => {
    if (!ride?.pickup || !ride?.dropoff) return '';
    return `${ride.pickup.lat},${ride.pickup.lng}-${ride.dropoff.lat},${ride.dropoff.lng}`;
  }, [ride?.pickup, ride?.dropoff]);
  
  // Memoize driver location to prevent unnecessary re-renders
  const driverLocation = useMemo(() => ride?.driverLocation || null, [ride?.driverLocation]);
  
  // Calculate driver ETA to pickup (only when accepted/started, before in_progress)
  const shouldShowEta = ride?.status === 'accepted' || ride?.status === 'started';
  const driverEta = useDriverEta(
    shouldShowEta ? driverLocation : null,
    shouldShowEta ? ride?.pickup : null
  );

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
          setCanCancelActive(ACTIVE_CANCELLABLE_STATES.includes(rideData.status as string));
          setCancelError(null); // Clear any previous error when status updates
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

  // Load driver profile when driverId is available
  useEffect(() => {
    if (!ride?.driverId) {
      setDriverProfile(null);
      return;
    }

    const driverRef = doc(db, 'drivers', ride.driverId);
    const unsubscribe = onSnapshot(driverRef, (snap) => {
      if (snap.exists()) {
        setDriverProfile(snap.data());
      }
    });

    return () => unsubscribe();
  }, [ride?.driverId]);

  // Load driver user profile for name/email
  useEffect(() => {
    if (!ride?.driverId) {
      setDriverUser(null);
      return;
    }

    const userRef = doc(db, 'users', ride.driverId);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setDriverUser(snap.data());
      }
    });

    return () => unsubscribe();
  }, [ride?.driverId]);

  const handleCancelRide = async () => {
    if (!canCancel) {
      const msg = 'Cannot cancel ride in current state';
      setCancelError(msg);
      show(msg, 'error');
      return;
    }

    // Confirm cancellation
    if (!window.confirm('Cancel this ride?')) {
      return;
    }

    setLoading(true);
    setCancelError(null);
    try {
      const cancelRideFn = httpsCallable(functions, 'cancelRide');
      await cancelRideFn({ rideId, reason: 'Changed plans' });
      show('Ride cancelled', 'success');
      setCanCancel(false);
    } catch (error: unknown) {
      const err = error as any;
      const errorMsg = err?.message || 'Unknown error';
      // Handle common Firebase/function errors gracefully
      let userMsg = errorMsg;
      if (errorMsg.includes('permission-denied') || errorMsg.includes('PERMISSION_DENIED')) {
        userMsg = 'No permission to cancel this ride';
      } else if (errorMsg.includes('not-found') || errorMsg.includes('NOT_FOUND')) {
        userMsg = 'Ride not found';
      } else if (errorMsg.includes('failed-precondition') || errorMsg.includes('FAILED_PRECONDITION')) {
        userMsg = 'Ride cannot be cancelled in its current state';
      }
      setCancelError(userMsg);
      show(`Failed to cancel ride: ${userMsg}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelActiveRide = async () => {
    if (!canCancelActive) {
      const msg = 'Cannot cancel ride in current state';
      setCancelError(msg);
      show(msg, 'error');
      return;
    }

    // Confirm cancellation with warning
    if (!window.confirm(
      'Cancel this active ride?\n\n' +
      'The ride will be cancelled and you will receive a full refund.\n\n' +
      'Are you sure you want to cancel?'
    )) {
      return;
    }

    setLoading(true);
    setCancelError(null);
    try {
      const cancelActiveRideFn = httpsCallable(functions, 'cancelActiveRide');
      const result = await cancelActiveRideFn({ 
        rideId, 
        reason: 'Customer no longer needs ride' 
      }) as any;
      
      if (result.data.refunded) {
        show('Ride cancelled. You will receive a full refund.', 'success');
      } else {
        show('Ride cancelled', 'success');
      }
      setCanCancelActive(false);
    } catch (error: unknown) {
      const err = error as any;
      const errorMsg = err?.message || 'Unknown error';
      // Handle common Firebase/function errors gracefully
      let userMsg = errorMsg;
      if (errorMsg.includes('permission-denied') || errorMsg.includes('PERMISSION_DENIED')) {
        userMsg = 'No permission to cancel this ride';
      } else if (errorMsg.includes('not-found') || errorMsg.includes('NOT_FOUND')) {
        userMsg = 'Ride not found';
      } else if (errorMsg.includes('failed-precondition') || errorMsg.includes('FAILED_PRECONDITION')) {
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

        {/* Payment Authorization UI */}
        {ride.status === 'accepted' && 
         ride.paymentStatus !== 'authorized' && 
         ride.paymentStatus !== 'captured' && 
         !showPaymentUI && (
          <div style={{
            padding: '1.5rem',
            marginBottom: '1rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(255,193,7,0.1)',
            border: '1px solid rgba(255,193,7,0.3)',
          }}>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255,193,7,0.95)' }}>
              ⚠️ Payment Authorization Required
            </div>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1rem' }}>
              Please authorize payment to begin your ride.
            </p>
            <button
              onClick={() => setShowPaymentUI(true)}
              style={{
                padding: '12px 24px',
                backgroundColor: 'rgba(0,255,140,0.95)',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Authorize Payment
            </button>
          </div>
        )}

        {showPaymentUI && ride.priceCents && (
          <div style={{
            marginBottom: '1rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <PaymentAuthorize
              rideId={ride.id}
              amount={ride.priceCents}
              onSuccess={() => {
                setShowPaymentUI(false);
                show('Payment authorized! Your ride will begin soon.', 'success');
              }}
              disabled={runtimeFlags?.disablePayments || false}
            />
          </div>
        )}

        {/* Cancel Active Ride Button */}
        {canCancelActive && (
          <div style={{
            marginBottom: '1rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(239,68,68,0.05)',
            border: '1px solid rgba(239,68,68,0.2)',
            padding: '1.5rem',
          }}>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(239,68,68,0.95)' }}>
              ⚠️ Need to Cancel?
            </div>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1rem' }}>
              You can cancel this active ride. You will receive a full refund if payment was already captured.
            </p>
            <button
              onClick={handleCancelActiveRide}
              disabled={loading}
              style={{
                padding: '12px 24px',
                backgroundColor: loading ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.95)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Cancelling...' : 'Cancel Active Ride'}
            </button>
          </div>
        )}

        {/* Receipt - shown when ride is completed */}
        {ride.status === 'completed' && ride.finalAmountCents && (
          <div style={{ marginBottom: '1rem' }}>
            <Receipt
              rideId={ride.id}
              pickup={ride.pickup}
              dropoff={ride.dropoff}
              finalAmountCents={ride.finalAmountCents}
              paymentStatus={ride.paymentStatus}
              completedAtMs={ride.completedAtMs}
              driverId={ride.driverId}
            />
          </div>
        )}

        {/* Cancellation Receipt - shown when ride is cancelled */}
        {ride.status === 'cancelled' && (
          <div style={{
            padding: '1.5rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: '1rem',
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '1.5rem',
              paddingBottom: '1rem',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>❌</div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', color: '#fff' }}>
                Ride Cancelled
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                {ride.cancelledAtMs && new Date(ride.cancelledAtMs).toLocaleDateString()} • {ride.cancelledAtMs && new Date(ride.cancelledAtMs).toLocaleTimeString()}
              </p>
            </div>

            {/* Trip Details */}
            {(ride.pickup || ride.dropoff) && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  marginBottom: '1rem',
                }}>
                  <div style={{
                    width: '32px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    paddingTop: '4px',
                  }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(0,255,140,0.95)',
                      marginBottom: '4px',
                    }} />
                    <div style={{
                      width: '2px',
                      flex: 1,
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      marginBottom: '4px',
                    }} />
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '2px',
                      backgroundColor: '#ef4444',
                    }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    {ride.pickup && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                          Pickup
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#fff' }}>
                          {ride.pickup.lat.toFixed(4)}, {ride.pickup.lng.toFixed(4)}
                        </div>
                      </div>
                    )}
                    {ride.dropoff && (
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                          Dropoff
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#fff' }}>
                          {ride.dropoff.lat.toFixed(4)}, {ride.dropoff.lng.toFixed(4)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Cancellation Details */}
            <div style={{
              padding: '1rem',
              borderRadius: '8px',
              backgroundColor: 'rgba(239,68,68,0.05)',
              border: '1px solid rgba(239,68,68,0.2)',
              marginBottom: '1rem',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.5rem',
              }}>
                <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                  Cancelled By
                </span>
                <span style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#fff',
                  textTransform: 'capitalize',
                }}>
                  {ride.cancelledBy || 'Unknown'}
                </span>
              </div>
              {ride.cancelReason && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.5rem',
                }}>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                    Reason
                  </span>
                  <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
                    {ride.cancelReason}
                  </span>
                </div>
              )}
              {ride.paymentStatus === 'cancelled' && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                    Payment Status
                  </span>
                  <span style={{
                    fontSize: '0.9rem',
                    color: '#10b981',
                    fontWeight: '500',
                  }}>
                    ✓ Authorization Released
                  </span>
                </div>
              )}
            </div>

            {/* Ride ID */}
            <div style={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.4)',
              textAlign: 'center',
            }}>
              Ride ID: {ride.id.slice(0, 8)}...
            </div>
          </div>
        )}

        {/* Driver ETA Display - show when accepted/started */}
        {shouldShowEta && driverLocation && (
          <div style={{
            marginBottom: '1rem',
            padding: '16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(96,165,250,0.1)',
            border: '1px solid rgba(96,165,250,0.3)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '4px' }}>
                  🚗 Driver is on the way
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#60a5fa' }}>
                  {driverEta.loading ? (
                    'Calculating...'
                  ) : driverEta.minutes != null ? (
                    `${driverEta.minutes} min away`
                  ) : (
                    'Arriving soon'
                  )}
                </div>
                {driverEta.miles != null && !driverEta.loading && (
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                    {driverEta.miles.toFixed(1)} mi
                  </div>
                )}
              </div>
              <div style={{ fontSize: '2rem' }}>📍</div>
            </div>
          </div>
        )}

        {/* Payment Status Badge */}
        {ride.paymentStatus && ride.status === 'accepted' && (
          <div style={{
            marginBottom: '1rem',
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: ride.paymentStatus === 'authorized' ? 'rgba(0,255,140,0.1)' : 'rgba(255,193,7,0.1)',
            border: ride.paymentStatus === 'authorized' ? '1px solid rgba(0,255,140,0.3)' : '1px solid rgba(255,193,7,0.3)',
          }}>
            <div style={{
              fontSize: '0.85rem',
              color: ride.paymentStatus === 'authorized' ? 'rgba(0,255,140,0.95)' : 'rgba(255,193,7,0.95)',
            }}>
              {ride.paymentStatus === 'authorized' && '✅ Payment Authorized - Waiting for driver to start'}
              {ride.paymentStatus === 'requires_payment_method' && '⏳ Waiting for payment authorization'}
              {ride.paymentStatus === 'requires_action' && '⚠️ Payment requires action'}
              {ride.paymentStatus === 'failed' && '❌ Payment failed'}
            </div>
          </div>
        )}

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
          {ride.driverId && driverProfile && (
            <div className="status-item" style={{
              gridColumn: '1 / -1',
              padding: '1rem',
              backgroundColor: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Driver Photo */}
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '2px solid rgba(34,197,94,0.5)',
                  flexShrink: 0,
                }}>
                  {driverProfile.photoURL ? (
                    <img src={driverProfile.photoURL} alt="Driver" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                      👤
                    </div>
                  )}
                </div>

                {/* Driver Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                    {driverUser?.displayName ? driverUser.displayName.split(' ')[0] : driverUser?.email ? driverUser.email.split('@')[0] : 'Your Driver'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                    ID: {ride.driverId.slice(0, 8)}
                  </div>
                  {driverProfile.ratingAvg && driverProfile.ratingCount && driverProfile.ratingCount > 0 && (
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.25rem' }}>
                      ⭐ {driverProfile.ratingAvg.toFixed(1)} ({driverProfile.ratingCount} rides)
                    </div>
                  )}
                </div>

                {/* Vehicle Info */}
                {driverProfile.vehicleInfo && (
                  <div style={{
                    padding: '0.75rem',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>🚗 Vehicle</div>
                    <div>{driverProfile.vehicleInfo.color} {driverProfile.vehicleInfo.make} {driverProfile.vehicleInfo.model}</div>
                    <div style={{ color: 'rgba(255,255,255,0.7)', marginTop: '0.25rem' }}>
                      {driverProfile.vehicleInfo.plate}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {ride.driverId && !driverProfile && (
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
        </div>

        {/* Event Timeline - Render with stable rideId key */}
        <div style={{ marginTop: '24px' }}>
          <RideTimeline key={rideId} rideId={rideId} />
        </div>
      </div>
    </div>
  );
}
