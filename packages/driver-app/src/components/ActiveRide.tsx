import React, { useState, useEffect, useCallback } from 'react';
import { tripUpdateStatus, TripUpdateStatus, getInitializedClient } from '@shiftx/driver-client';
import { doc, onSnapshot } from 'firebase/firestore';
import { useToast } from './Toast';
import { useRoutePolyline } from '../hooks/useRoutePolyline';
import { useHeartbeat } from '../hooks/useHeartbeat';
import { SharedMap } from './map/SharedMap';
import { ActiveRideHeader } from './ActiveRideHeader';
import 'leaflet/dist/leaflet.css';

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
  paymentStatus?: string; // New payment status field
  paymentAuthorized?: boolean; // Legacy field
  updatedAtMs?: number; // For "last updated" indicator
}

type RideState = 'accepted' | 'started' | 'in_progress' | 'completed';

interface ActiveRideProps {
  rideId: string;
  currentStatus: RideState;
  onStatusUpdate: (newStatus: RideState) => void;
  onCancelled?: () => void;
}

export function ActiveRide({ rideId, currentStatus, onStatusUpdate, onCancelled }: ActiveRideProps) {
  const { show } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [rideData, setRideData] = useState<RideData | null>(null);
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  
  // Get current driver location from heartbeat
  const { currentLocation: driverLocation, gpsError } = useHeartbeat(true);
  
  // Dynamic route based on status:
  // - 'accepted': driver → pickup (to show ETA to pickup)
  // - 'started' / 'in_progress': pickup → dropoff (trip route)
  const routeStart = currentStatus === 'accepted' ? driverLocation : rideData?.pickup;
  const routeEnd = currentStatus === 'accepted' ? rideData?.pickup : rideData?.dropoff;
  
  const { coords: routePoints, distanceMeters: distance } = useRoutePolyline(routeStart, routeEnd);

  // Generate fitKey based on current route endpoints
  const fitKey = routeStart && routeEnd
    ? `${routeStart.lat},${routeStart.lng}-${routeEnd.lat},${routeEnd.lng}`
    : '';

  // Fetch ride data
  useEffect(() => {
    const { firestore } = getInitializedClient();
    const unsubscribe = onSnapshot(doc(firestore, 'rides', rideId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as RideData;
        setRideData(data);
        setLastUpdateTime(Date.now()); // Track when we last got an update
      }
    });

    return () => unsubscribe();
  }, [rideId]);

  // Calculate time since last update for debugging
  const [timeSinceUpdate, setTimeSinceUpdate] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSinceUpdate(Math.floor((Date.now() - lastUpdateTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdateTime]);

  // Load customer profile when riderId is available
  useEffect(() => {
    if (!rideData || !(rideData as any).riderId) {
      setCustomerProfile(null);
      return;
    }

    const { firestore } = getInitializedClient();
    const userRef = doc(firestore, 'users', (rideData as any).riderId);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setCustomerProfile(snap.data());
      }
    });

    return () => unsubscribe();
  }, [rideData]);

  const openAppleMapsNav = (targetLat: number, targetLng: number) => {
    const url = `https://maps.apple.com/?daddr=${targetLat},${targetLng}&dirflg=d`;
    window.open(url, '_blank');
  };

  const handleNavigate = () => {
    if (!rideData) return;
    
    // Navigate to pickup if not started, otherwise to dropoff
    const target = currentStatus === 'accepted' ? rideData.pickup : rideData.dropoff;
    if (target) {
      openAppleMapsNav(target.lat, target.lng);
    }
  };

  const canTransition = (from: RideState, to: RideState): boolean => {
    const transitions: Record<RideState, RideState[]> = {
      accepted: ['started'],
      started: ['in_progress'],
      in_progress: ['completed'],
      completed: [],
    };
    return transitions[from]?.includes(to) ?? false;
  };

  const getNextAction = (status: RideState): { label: string; nextStatus: TripUpdateStatus } | null => {
    const actions: Record<RideState, { label: string; nextStatus: TripUpdateStatus } | null> = {
      accepted: { label: 'Start Ride', nextStatus: 'started' },
      started: { label: 'Begin Trip', nextStatus: 'in_progress' },
      in_progress: { label: 'Complete Ride', nextStatus: 'completed' },
      completed: null,
    };
    return actions[status];
  };

  const center: LatLng | null = rideData?.pickup && rideData?.dropoff
    ? {
        lat: (rideData.pickup.lat + rideData.dropoff.lat) / 2,
        lng: (rideData.pickup.lng + rideData.dropoff.lng) / 2,
      }
    : null;

  const action = getNextAction(currentStatus);
  const statusDisplay: Record<RideState, { label: string; color: string }> = {
    accepted: { label: 'Accepted', color: '#4ade80' },
    started: { label: 'Started', color: '#60a5fa' },
    in_progress: { label: 'In Progress', color: '#fbbf24' },
    completed: { label: 'Completed', color: '#8b5cf6' },
  };

  const status = statusDisplay[currentStatus];

  const handleAction = async () => {
    const nextAction = getNextAction(currentStatus);
    if (!nextAction || !canTransition(currentStatus, nextAction.nextStatus)) {
      show('Invalid action', 'error');
      return;
    }

    setIsUpdating(true);
    try {
      await tripUpdateStatus(rideId, nextAction.nextStatus);
      onStatusUpdate(nextAction.nextStatus);
      show(`Ride ${nextAction.nextStatus}`, 'success');
    } catch (error) {
      const errorMsg = (error as Error).message;
      if (errorMsg.includes('permission')) {
        show('Permission denied', 'error');
      } else if (errorMsg.includes('TOO_FAR_FROM_DROPOFF')) {
        // Parse distance from error message like "TOO_FAR_FROM_DROPOFF: 1960m from dropoff"
        const match = errorMsg.match(/(\d+)m from dropoff/);
        const distance = match ? match[1] : 'too far';
        show(`You must be closer to the drop-off location to complete this ride (${distance}m away)`, 'error');
      } else {
        show(`Failed to update status: ${errorMsg}`, 'error');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = async () => {
    // Determine which cancel function to use based on ride status
    const isActiveRide = currentStatus === 'started' || currentStatus === 'in_progress';
    const cancelFunctionName = isActiveRide ? 'cancelActiveRide' : 'cancelRide';
    
    // Different confirmation messages based on status
    let confirmMsg = 'Cancel this ride? Rider will be notified.';
    if (isActiveRide) {
      confirmMsg = 'Cancel this active ride?\n\nOptions:\n- Passenger no-show\n- Accidentally started\n- Other reason\n\nThe payment will be refunded to the customer.';
    }
    
    if (!window.confirm(confirmMsg)) {
      return;
    }
    
    // For active rides, ask for reason
    let reason = 'Driver cancelled';
    if (isActiveRide) {
      const reasonInput = prompt(
        'Reason for cancellation:\n\n' +
        '1. passenger_no_show\n' +
        '2. accidental_start\n' +
        '3. other\n\n' +
        'Enter 1, 2, or 3:'
      );
      
      const reasons: Record<string, string> = {
        '1': 'passenger_no_show',
        '2': 'accidental_start',
        '3': 'other',
      };
      
      reason = reasons[reasonInput || ''] || 'other';
    }

    setIsCancelling(true);
    try {
      const { functions } = getInitializedClient();
      const { httpsCallable } = await import('firebase/functions');
      const cancelRideFn = httpsCallable(functions, cancelFunctionName);
      const result = await cancelRideFn({ rideId, reason }) as any;
      
      if (result.data?.refunded) {
        show('Ride cancelled. Customer will receive a full refund.', 'success');
      } else {
        show('Ride cancelled', 'success');
      }
      
      // Notify parent to clear active ride
      if (onCancelled) {
        setTimeout(() => onCancelled(), 1000);
      }
    } catch (error) {
      const errorMsg = (error as Error).message;
      if (errorMsg.includes('permission') || errorMsg.includes('not authorized')) {
        show('Not authorized to cancel', 'error');
      } else if (errorMsg.includes('failed-precondition')) {
        show('Cannot cancel ride in current state', 'error');
      } else {
        show(`Failed to cancel: ${errorMsg}`, 'error');
      }
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="active-ride" style={{ 
      paddingTop: 'calc(16px + var(--sat))',
      paddingBottom: 'calc(80px + var(--sab))',
      paddingLeft: 'calc(16px + var(--sal))',
      paddingRight: 'calc(16px + var(--sar))',
    }}>
      {/* Header Card */}
      <ActiveRideHeader
        rideId={rideId}
        currentStatus={currentStatus}
        pickup={rideData?.pickup}
        dropoff={rideData?.dropoff}
        driverLocation={driverLocation}
        gpsError={gpsError}
        paymentAuthorized={rideData?.paymentStatus === 'authorized' || rideData?.payment?.authorized || rideData?.paymentAuthorized}
        onAction={handleAction}
        onNavigate={handleNavigate}
        onCancel={handleCancel}
        isUpdating={isUpdating}
        isCancelling={isCancelling}
      />

      {/* Debug: Last update indicator */}
      {timeSinceUpdate > 0 && (
        <div style={{
          padding: '0.5rem 1rem',
          margin: '0 0 1rem 0',
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.5)',
          textAlign: 'center',
        }}>
          Last updated: {timeSinceUpdate}s ago
          {rideData?.paymentStatus && ` • Payment: ${rideData.paymentStatus}`}
        </div>
      )}

      {/* Customer Identity Card */}
      {customerProfile && (
        <div style={{
          padding: '1rem',
          margin: '0 0 1rem 0',
          backgroundColor: 'rgba(96,165,250,0.1)',
          border: '1px solid rgba(96,165,250,0.3)',
          borderRadius: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Customer Photo */}
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              overflow: 'hidden',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '2px solid rgba(96,165,250,0.5)',
              flexShrink: 0,
            }}>
              {customerProfile.photoURL ? (
                <img src={customerProfile.photoURL} alt="Customer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                  👤
                </div>
              )}
            </div>

            {/* Customer Info */}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '0.25rem', color: '#60a5fa' }}>
                Your Passenger
              </div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                {customerProfile.displayName ? customerProfile.displayName.split(' ')[0] : customerProfile.email ? customerProfile.email.split('@')[0] : 'Customer'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map */}
      {routeStart && routeEnd && (
        <div style={{ 
          height: '350px', 
          borderRadius: '12px', 
          overflow: 'hidden',
          marginBottom: '16px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <SharedMap
            pickup={currentStatus === 'accepted' ? routeEnd : rideData?.pickup}
            dropoff={currentStatus === 'accepted' ? undefined : rideData?.dropoff}
            driverLocation={driverLocation || rideData?.driverLocation || undefined}
            routeCoords={routePoints}
            fitKey={fitKey}
            center={currentStatus === 'accepted' && driverLocation ? driverLocation : undefined}
          />
        </div>
      )}

      {/* Completion Message */}
      {currentStatus === 'completed' && (
        <div className="completion-message">
          <p>✓ Ride completed successfully</p>
        </div>
      )}

      {/* Timeline */}
      <div className="ride-timeline">
        <div className={`timeline-step ${currentStatus === 'accepted' ? 'active' : 'complete'}`}>
          <div className="timeline-dot"></div>
          <span>Accepted</span>
        </div>
        <div className={`timeline-step ${currentStatus === 'started' ? 'active' : currentStatus === 'accepted' ? 'pending' : 'complete'}`}>
          <div className="timeline-dot"></div>
          <span>Started</span>
        </div>
        <div className={`timeline-step ${currentStatus === 'in_progress' ? 'active' : currentStatus === 'accepted' || currentStatus === 'started' ? 'pending' : 'complete'}`}>
          <div className="timeline-dot"></div>
          <span>In Progress</span>
        </div>
        <div className={`timeline-step ${currentStatus === 'completed' ? 'complete' : 'pending'}`}>
          <div className="timeline-dot"></div>
          <span>Completed</span>
        </div>
      </div>
    </div>
  );
}
