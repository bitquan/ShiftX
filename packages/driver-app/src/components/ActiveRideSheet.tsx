import React, { useState, useEffect, useMemo } from 'react';
import { tripUpdateStatus, TripUpdateStatus, getInitializedClient } from '@shiftx/driver-client';
import { doc, onSnapshot } from 'firebase/firestore';
import { useToast } from './Toast';
import { logEvent } from '../utils/eventLog';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import ShiftXNavigation from '../native/ShiftXNavigation';

interface LatLng {
  lat: number;
  lng: number;
}

interface RideData {
  pickup?: LatLng;
  dropoff?: LatLng;
  status?: string;
  driverLocation?: LatLng;
  payment?: {
    authorized?: boolean;
    authorizedAt?: number;
    status?: string;
    intentId?: string;
  };
  paymentStatus?: string;
  paymentAuthorized?: boolean;
  updatedAtMs?: number;
  riderId?: string;
}

type RideState = 'accepted' | 'started' | 'in_progress' | 'completed';

interface ActiveRideSheetProps {
  rideId: string;
  currentStatus: RideState;
  onStatusUpdate: (newStatus: RideState | null) => void;
  onCancelled?: () => void;
  driverLocation: LatLng | null;
}

const statusConfig: Record<RideState, { label: string; color: string; actionLabel: string | null }> = {
  accepted: { label: 'Accepted', color: '#4ade80', actionLabel: 'Start Ride' },
  started: { label: 'Started', color: '#60a5fa', actionLabel: 'Begin Trip' },
  in_progress: { label: 'In Progress', color: '#fbbf24', actionLabel: 'Complete Ride' },
  completed: { label: 'Completed', color: '#8b5cf6', actionLabel: null },
};

/**
 * Phase 3A: Active ride content for bottom sheet
 * Replaces the full-screen ActiveRide component
 */
export function ActiveRideSheet({ rideId, currentStatus, onStatusUpdate, onCancelled, driverLocation }: ActiveRideSheetProps) {
  const { show } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [rideData, setRideData] = useState<RideData | null>(null);
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  
  const config = statusConfig[currentStatus];

  // Phase 4B: Listen for native navigation events
  useEffect(() => {
    const navStartedListener = ShiftXNavigation.addListener('navStarted', (event) => {
      console.log('[ActiveRideSheet] Navigation started:', event);
      logEvent('navigation', 'Native navigation started', { rideId, timestamp: event.timestamp });
    });

    const navEndedListener = ShiftXNavigation.addListener('navEnded', (event) => {
      console.log('[ActiveRideSheet] Navigation ended:', event);
      logEvent('navigation', 'Native navigation ended', { rideId, timestamp: event.timestamp });
      show('Navigation ended', 'info');
    });

    const navErrorListener = ShiftXNavigation.addListener('navError', (event) => {
      console.error('[ActiveRideSheet] Navigation error:', event);
      logEvent('error', 'Native navigation error', { rideId, error: event.error, code: event.code });
      show(`Navigation error: ${event.error}`, 'error');
    });

    return () => {
      navStartedListener.then(l => l?.remove?.());
      navEndedListener.then(l => l?.remove?.());
      navErrorListener.then(l => l?.remove?.());
    };
  }, [rideId, show]);

  // Fetch ride data and monitor for backend state changes
  useEffect(() => {
    const { firestore } = getInitializedClient();
    const unsubscribe = onSnapshot(doc(firestore, 'rides', rideId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as RideData;
        setRideData(data);
        
        // Auto-dismiss sheet if ride is cancelled or completed from backend
        if (data.status === 'cancelled' || data.status === 'completed') {
          console.log('[ActiveRideSheet] Ride ended:', data.status);
          // Delay slightly to allow UI to update before dismissing
          setTimeout(() => {
            if (data.status === 'cancelled' && onCancelled) {
              onCancelled();
            } else if (data.status === 'completed') {
              onStatusUpdate(null); // Clear active ride
              if (onCancelled) {
                onCancelled(); // Trigger cleanup
              }
            }
          }, 1000);
        }
      }
    });

    return () => unsubscribe();
  }, [rideId, onStatusUpdate, onCancelled]);

  // Load customer profile
  useEffect(() => {
    if (!rideData?.riderId) {
      setCustomerProfile(null);
      return;
    }

    const { firestore } = getInitializedClient();
    const userRef = doc(firestore, 'users', rideData.riderId);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setCustomerProfile(snap.data());
      }
    });

    return () => unsubscribe();
  }, [rideData?.riderId]);

  // Reverse geocode pickup and dropoff
  const pickupGeocode = useReverseGeocode(rideData?.pickup?.lat, rideData?.pickup?.lng);
  const dropoffGeocode = useReverseGeocode(rideData?.dropoff?.lat, rideData?.dropoff?.lng);

  const pickupDisplay = useMemo(() => {
    if (pickupGeocode.loading) return 'Loading...';
    if (pickupGeocode.label) return pickupGeocode.label;
    if (rideData?.pickup) return `${rideData.pickup.lat.toFixed(4)}, ${rideData.pickup.lng.toFixed(4)}`;
    return 'Unknown';
  }, [pickupGeocode, rideData?.pickup]);

  const dropoffDisplay = useMemo(() => {
    if (dropoffGeocode.loading) return 'Loading...';
    if (dropoffGeocode.label) return dropoffGeocode.label;
    if (rideData?.dropoff) return `${rideData.dropoff.lat.toFixed(4)}, ${rideData.dropoff.lng.toFixed(4)}`;
    return 'Unknown';
  }, [dropoffGeocode, rideData?.dropoff]);

  const paymentAuthorized = rideData?.paymentStatus === 'authorized' || rideData?.payment?.authorized || rideData?.paymentAuthorized;
  const waitingForPayment = currentStatus === 'accepted' && !paymentAuthorized;

  const handleAction = async () => {
    if (!config.actionLabel || isUpdating || waitingForPayment) return;

    const statusMap: Record<string, TripUpdateStatus> = {
      'Start Ride': 'started',
      'Begin Trip': 'in_progress',
      'Complete Ride': 'completed',
    };

    const nextStatus = statusMap[config.actionLabel];
    if (!nextStatus) return;

    setIsUpdating(true);
    try {
      await tripUpdateStatus(rideId, nextStatus);
      logEvent('ride', `Ride ${nextStatus}`, { rideId, status: nextStatus });
      show(`Ride ${nextStatus}`, 'success');
      
      if (nextStatus === 'completed') {
        // Ride completed - trigger cleanup after short delay
        onStatusUpdate(null);
        setTimeout(() => {
          if (onCancelled) {
            onCancelled();
          }
        }, 1000);
      } else {
        onStatusUpdate(nextStatus as RideState);
      }
    } catch (error) {
      logEvent('error', 'Failed to update ride status', { rideId, error: (error as Error).message });
      show(`Failed to update: ${(error as Error).message}`, 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNavigate = async () => {
    // Determine destination based on ride state:
    // - accepted/started (pre-trip): navigate to pickup
    // - in_progress (on-trip): navigate to dropoff
    const isPreTrip = currentStatus === 'accepted' || currentStatus === 'started';
    const destination = isPreTrip ? rideData?.pickup : rideData?.dropoff;
    const destinationLabel = isPreTrip ? 'Pickup' : 'Dropoff';
    
    if (!destination) {
      show(`${destinationLabel} location not available`, 'error');
      return;
    }

    // Phase 4B: Try native Mapbox navigation first
    try {
      const { available } = await ShiftXNavigation.isAvailable();
      
      if (available) {
        // Use native navigation
        const result = await ShiftXNavigation.start({
          lat: destination.lat,
          lng: destination.lng,
          label: destinationLabel,
          mode: 'driving'
        });
        
        if (result.started) {
          logEvent('navigation', `Started native navigation to ${destinationLabel}`, { 
            rideId, 
            destination, 
            method: 'native' 
          });
          console.log(`[ActiveRideSheet] Started native navigation to ${destinationLabel}:`, destination);
          return;
        }
      }
    } catch (error) {
      console.warn('[ActiveRideSheet] Native navigation failed, falling back to external maps:', error);
      logEvent('navigation', `Native navigation failed, using fallback`, { 
        rideId, 
        destination, 
        error: (error as Error).message 
      });
    }

    // Fallback: External maps deep links
    // Detect platform for appropriate deep link
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isMacOS = /Macintosh/.test(navigator.userAgent);
    
    let url: string;
    
    if (isIOS || isMacOS) {
      // Apple Maps deep link (works on iOS and macOS)
      // Format: maps://?daddr=lat,lng&dirflg=d
      url = `maps://?daddr=${destination.lat},${destination.lng}&dirflg=d`;
      
      // Fallback to web if app not installed
      const fallbackUrl = `https://maps.apple.com/?daddr=${destination.lat},${destination.lng}&dirflg=d`;
      
      // Try to open Apple Maps, fallback to web
      const opened = window.open(url, '_blank');
      if (!opened) {
        window.open(fallbackUrl, '_blank');
      }
    } else {
      // Google Maps deep link (works on Android and web)
      // Format: google.navigation:q=lat,lng (Android) or web URL
      const isAndroid = /Android/.test(navigator.userAgent);
      
      if (isAndroid) {
        // Android Google Maps navigation deep link
        url = `google.navigation:q=${destination.lat},${destination.lng}&mode=d`;
        window.open(url, '_blank');
      } else {
        // Web fallback: Google Maps directions
        url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`;
        window.open(url, '_blank');
      }
    }
    
    logEvent('navigation', `Opened external navigation to ${destinationLabel}`, { 
      rideId, 
      destination, 
      method: 'external' 
    });
    console.log(`[ActiveRideSheet] Opening external navigation to ${destinationLabel}:`, destination);
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this ride?')) return;

    setIsCancelling(true);
    try {
      const { functions } = getInitializedClient();
      const { httpsCallable } = await import('firebase/functions');
      const cancelRideFn = httpsCallable(functions, 'cancelRide');
      await cancelRideFn({ rideId, reason: 'driver_cancelled' });
      logEvent('ride', 'Ride cancelled by driver', { rideId });
      show('Ride cancelled', 'success');
      onStatusUpdate(null);
      if (onCancelled) {
        setTimeout(() => onCancelled(), 1000);
      }
    } catch (error) {
      logEvent('error', 'Failed to cancel ride', { rideId, error: (error as Error).message });
      show(`Failed to cancel: ${(error as Error).message}`, 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div style={{ padding: '1rem' }}>
      {/* Status Badge */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '999px',
            backgroundColor: `${config.color}20`,
            color: config.color,
            fontSize: '0.875rem',
            fontWeight: '600',
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: config.color }}></span>
          {config.label}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
          ID: {rideId.slice(0, 8)}
        </span>
      </div>

      {/* Customer Info */}
      {customerProfile && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem',
          marginBottom: '1rem',
          backgroundColor: 'rgba(96,165,250,0.1)',
          border: '1px solid rgba(96,165,250,0.3)',
          borderRadius: '8px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.1)',
            border: '2px solid rgba(96,165,250,0.5)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {customerProfile.photoURL ? (
              <img src={customerProfile.photoURL} alt="Customer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '1.25rem' }}>👤</span>
            )}
          </div>
          <div>
            <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#60a5fa' }}>
              {customerProfile.displayName?.split(' ')[0] || customerProfile.email?.split('@')[0] || 'Customer'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>Your passenger</div>
          </div>
        </div>
      )}

      {/* Addresses */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem', marginTop: '0.125rem' }}>🟢</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.25rem' }}>Pickup</div>
            <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>{pickupDisplay}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem', marginTop: '0.125rem' }}>🔴</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.25rem' }}>Dropoff</div>
            <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>{dropoffDisplay}</div>
          </div>
        </div>
      </div>

      {/* Payment Warning */}
      {waitingForPayment && (
        <div style={{
          padding: '0.75rem',
          marginBottom: '1rem',
          backgroundColor: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: '8px',
          fontSize: '0.875rem',
          color: '#fbbf24',
        }}>
          ⏳ Waiting for customer payment authorization...
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {config.actionLabel && (
          <button
            onClick={handleAction}
            disabled={isUpdating || waitingForPayment}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '8px',
              border: 'none',
              background: waitingForPayment ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #ffb703, #fb8b24)',
              color: waitingForPayment ? 'rgba(255,255,255,0.3)' : '#020409',
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: waitingForPayment || isUpdating ? 'not-allowed' : 'pointer',
              opacity: isUpdating ? 0.5 : 1,
            }}
          >
            {isUpdating ? 'Updating...' : config.actionLabel}
          </button>
        )}
        <button
          onClick={handleNavigate}
          style={{
            flex: 1,
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid rgba(96,165,250,0.5)',
            background: 'rgba(96,165,250,0.1)',
            color: '#60a5fa',
            fontWeight: '600',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Navigate
        </button>
        {currentStatus !== 'completed' && (
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(239,68,68,0.5)',
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              fontWeight: '600',
              fontSize: '0.875rem',
              cursor: isCancelling ? 'not-allowed' : 'pointer',
              opacity: isCancelling ? 0.5 : 1,
            }}
          >
            {isCancelling ? '...' : 'Cancel'}
          </button>
        )}
      </div>
    </div>
  );
}
