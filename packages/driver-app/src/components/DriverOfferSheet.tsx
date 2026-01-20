import React, { useEffect, useRef, useState } from 'react';
import { RideOffer, Ride, tripAccept, tripDecline, watchRide, getInitializedClient } from '@shiftx/driver-client';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useToast } from './Toast';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { logEvent } from '../utils/eventLog';
import { useEtaToPickup } from '../hooks/useEtaToPickup';
import { useOfferRoute } from '../hooks/useOfferRoute';
import { RuntimeFlags } from '../utils/runtimeFlags';

interface DriverOfferSheetProps {
  rideId: string;
  offer: RideOffer;
  onAccepted: () => void;
  onExpired: () => void;
  runtimeFlags: RuntimeFlags | null;
  driverLocation: { lat: number; lng: number } | null;
}

const OFFER_TTL_MS = 60_000; // 60 seconds

export function DriverOfferSheet({ rideId, offer, onAccepted, onExpired, runtimeFlags, driverLocation }: DriverOfferSheetProps) {
  const { show } = useToast();
  const [timeLeft, setTimeLeft] = useState(OFFER_TTL_MS);
  const [isAccepting, setIsAccepting] = useState(false);
  const [ride, setRide] = useState<Ride | null>(null);
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const hasShownExpiredToastRef = useRef(false);
  const hasCalledOnExpiredRef = useRef(false);
  const hasDismissedForCancellationRef = useRef(false);

  // Reset refs when rideId changes (new offer)
  useEffect(() => {
    hasShownExpiredToastRef.current = false;
    hasCalledOnExpiredRef.current = false;
    hasDismissedForCancellationRef.current = false;
    logEvent('offer', 'Offer shown to driver', { rideId, expiresAtMs: offer.expiresAtMs });
    console.log(`[DriverOfferSheet] Reset refs for new offer ${rideId}`);
  }, [rideId, offer.expiresAtMs]);

  // Subscribe to ride document for pickup/dropoff/price
  useEffect(() => {
    if (!rideId) return;

    const unsubscribe = watchRide(
      rideId,
      (rideData) => {
        setRide(rideData as Ride | null);
        
        // Auto-dismiss if ride is cancelled or completed (only once)
        if ((rideData?.status === 'cancelled' || rideData?.status === 'completed') && !hasDismissedForCancellationRef.current) {
          hasDismissedForCancellationRef.current = true;
          console.log(`[DriverOfferSheet] Ride ${rideId} is ${rideData.status}, auto-dismissing offer`);
          // Don't show toast here - let the parent handle it
          setTimeout(() => {
            console.log('[DriverOfferSheet] Calling onExpired due to cancellation');
            onExpired();
          }, 100); // Reduced from 500ms for faster response
        }
      },
      (error) => {
        console.error('[DriverOfferSheet] Error watching ride:', error);
        show('Failed to load ride details', 'error');
      }
    );

    return () => unsubscribe();
  }, [rideId, show, onExpired]);

  // Load customer profile when riderId is available
  useEffect(() => {
    if (!ride?.riderId) {
      setCustomerProfile(null);
      return;
    }

    const { firestore } = getInitializedClient();
    const userRef = doc(firestore, 'users', ride.riderId);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setCustomerProfile(snap.data());
      }
    });

    return () => unsubscribe();
  }, [ride?.riderId]);

  // Timer for offer expiration
  useEffect(() => {
    if (!offer.expiresAtMs) return;

    const now = Date.now();
    const initialRemaining = Math.max(0, offer.expiresAtMs - now);
    
    if (initialRemaining === 0 && !hasCalledOnExpiredRef.current) {
      hasCalledOnExpiredRef.current = true;
      logEvent('offer', 'Offer expired', { rideId });
      if (!hasShownExpiredToastRef.current) {
        hasShownExpiredToastRef.current = true;
        show('Offer expired', 'warning');
      }
      setTimeout(() => onExpired(), 100);
      return;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, offer.expiresAtMs! - now);
      setTimeLeft(remaining);

      if (remaining === 0 && !hasCalledOnExpiredRef.current) {
        hasCalledOnExpiredRef.current = true;
        clearInterval(timer);
        logEvent('offer', 'Offer expired', { rideId });
        if (!hasShownExpiredToastRef.current) {
          hasShownExpiredToastRef.current = true;
          show('Offer expired', 'warning');
        }
        setTimeout(() => onExpired(), 500);
      }
    }, 100);

    return () => {
      clearInterval(timer);
    };
  }, [offer.expiresAtMs, rideId, onExpired, show]);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await tripAccept(rideId);
      logEvent('offer', 'Offer accepted', { rideId });
      show('Ride accepted', 'success');
      onAccepted();
    } catch (error) {
      const errorMsg = (error as Error).message;
      logEvent('error', 'Failed to accept offer', { rideId, error: errorMsg });
      if (errorMsg.includes('expired')) {
        show('Offer already expired', 'warning');
        onExpired();
      } else if (errorMsg.includes('no longer')) {
        show('Offer no longer available', 'warning');
        onExpired();
      } else {
        show(`Failed to accept offer: ${errorMsg}`, 'error');
      }
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    setIsAccepting(true);
    try {
      await tripDecline(rideId);
      logEvent('offer', 'Offer declined', { rideId });
      show('Offer declined', 'info');
      onExpired();
    } catch (error) {
      logEvent('error', 'Failed to decline offer', { rideId, error: (error as Error).message });
      show(`Failed to decline offer: ${(error as Error).message}`, 'error');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleBlockCustomer = async () => {
    if (!ride?.riderId) {
      show('Cannot block: customer ID not available', 'error');
      return;
    }

    const reason = prompt('Why are you blocking this customer? (optional)');
    if (reason === null) return;

    try {
      const { functions } = getInitializedClient();
      const blockFn = httpsCallable(functions, 'driverBlockCustomer');
      await blockFn({ customerId: ride.riderId, reason: reason || '' });
      show('Customer blocked successfully', 'success');
      
      await tripDecline(rideId);
      onExpired();
    } catch (error) {
      show(`Failed to block customer: ${(error as Error).message}`, 'error');
    }
  };

  const handleReportCustomer = async () => {
    if (!ride?.riderId) {
      show('Cannot report: customer ID not available', 'error');
      return;
    }

    const reason = prompt('What would you like to report about this customer?');
    if (!reason || reason.trim().length === 0) {
      show('Report cancelled', 'info');
      return;
    }

    try {
      const { functions } = getInitializedClient();
      const reportFn = httpsCallable(functions, 'createReport');
      await reportFn({
        targetUid: ride.riderId,
        targetRole: 'customer',
        rideId: rideId,
        reason: reason.trim(),
        category: 'safety',
      });
      show('Report submitted to admin', 'success');
    } catch (error) {
      show(`Failed to submit report: ${(error as Error).message}`, 'error');
    }
  };

  // Reverse geocode pickup and dropoff
  const pickupGeocode = useReverseGeocode(ride?.pickup?.lat, ride?.pickup?.lng);
  const dropoffGeocode = useReverseGeocode(ride?.dropoff?.lat, ride?.dropoff?.lng);

  // Calculate ETA to pickup
  const etaToPickup = useEtaToPickup(
    driverLocation?.lat,
    driverLocation?.lng,
    ride?.pickup?.lat,
    ride?.pickup?.lng
  );

  // Get trip route data
  const { distanceMeters, durationSeconds } = useOfferRoute(ride?.pickup, ride?.dropoff);

  const secondsLeft = Math.ceil(timeLeft / 1000);
  const progressPercent = (timeLeft / OFFER_TTL_MS) * 100;
  const isExpiringSoon = secondsLeft <= 10;

  return (
    <div style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>New Ride Offer</h2>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
            ID: {rideId.slice(0, 8)}
          </span>
        </div>
      </div>

      {/* Customer Identity Card */}
      {ride && customerProfile && (
        <div style={{
          padding: '0.75rem',
          marginBottom: '1rem',
          backgroundColor: 'rgba(96,165,250,0.1)',
          border: '1px solid rgba(96,165,250,0.3)',
          borderRadius: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              overflow: 'hidden',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '2px solid rgba(96,165,250,0.5)',
              flexShrink: 0,
            }}>
              {customerProfile.photoURL ? (
                <img src={customerProfile.photoURL} alt="Customer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem' }}>
                  👤
                </div>
              )}
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.875rem', marginBottom: '0.125rem', color: '#60a5fa' }}>
                Passenger
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                {customerProfile.displayName ? customerProfile.displayName.split(' ')[0] : customerProfile.email ? customerProfile.email.split('@')[0] : 'Customer'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offer Details */}
      <div style={{ marginBottom: '1rem' }}>
        {ride ? (
          <>
            {/* To Pickup */}
            <div style={{
              padding: '0.75rem',
              marginBottom: '0.5rem',
              backgroundColor: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '6px',
            }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.25rem' }}>
                📍 To Pickup
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#10b981' }}>
                {etaToPickup.loading ? (
                  'Calculating...'
                ) : etaToPickup.miles && etaToPickup.minutes ? (
                  `${etaToPickup.miles.toFixed(1)} mi • ~${etaToPickup.minutes} min`
                ) : (
                  'Location needed'
                )}
              </div>
            </div>

            {/* Pickup Address */}
            <div style={{ padding: '0.75rem', marginBottom: '0.5rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.25rem' }}>
                Pickup
              </div>
              <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.9)' }}>
                {pickupGeocode.loading ? (
                  'Resolving address...'
                ) : pickupGeocode.label || (ride.pickup ? `${ride.pickup.lat.toFixed(4)}, ${ride.pickup.lng.toFixed(4)}` : 'Unknown')}
              </div>
            </div>

            {/* Dropoff Address */}
            <div style={{ padding: '0.75rem', marginBottom: '0.5rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.25rem' }}>
                Dropoff
              </div>
              <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.9)' }}>
                {dropoffGeocode.loading ? (
                  'Resolving address...'
                ) : dropoffGeocode.label || (ride.dropoff ? `${ride.dropoff.lat.toFixed(4)}, ${ride.dropoff.lng.toFixed(4)}` : 'Unknown')}
              </div>
            </div>

            {/* Trip Distance & Duration */}
            {distanceMeters != null && durationSeconds != null && (
              <div style={{ padding: '0.75rem', marginBottom: '0.5rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.25rem' }}>
                  Trip
                </div>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.9)' }}>
                  {(distanceMeters / 1609.34).toFixed(1)} mi • {Math.ceil(durationSeconds / 60)} min
                </div>
              </div>
            )}

            {/* Earnings */}
            {ride.priceCents != null && (
              <div style={{
                padding: '0.75rem',
                marginBottom: '0.5rem',
                backgroundColor: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: '6px',
              }}>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.25rem' }}>
                  💰 You Earn
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#22c55e' }}>
                  ${(ride.priceCents / 100).toFixed(2)}
                </div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem' }}>
                  Ride ID: {rideId.slice(0, 8)} | Price: {ride.priceCents}¢
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            Loading ride details...
          </div>
        )}
      </div>

      {/* Countdown Timer */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{
          height: '4px',
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: '2px',
          overflow: 'hidden',
          marginBottom: '0.5rem',
        }}>
          <div style={{
            height: '100%',
            width: `${progressPercent}%`,
            backgroundColor: isExpiringSoon ? '#ef4444' : '#3b82f6',
            transition: 'width 0.1s linear',
          }}></div>
        </div>
        <div style={{
          fontSize: '0.875rem',
          textAlign: 'center',
          color: isExpiringSoon ? '#ef4444' : 'rgba(255,255,255,0.7)',
          fontWeight: isExpiringSoon ? '600' : '400',
        }}>
          Expires in {secondsLeft}s
        </div>
      </div>

      {/* Safety Actions */}
      {ride?.riderId && (
        <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button
            onClick={handleBlockCustomer}
            disabled={isAccepting}
            style={{
              padding: '0.5rem 0.75rem',
              fontSize: '0.75rem',
              background: 'rgba(239,68,68,0.2)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '6px',
              cursor: isAccepting ? 'not-allowed' : 'pointer',
              fontWeight: '500',
            }}
          >
            🚫 Block
          </button>
          <button
            onClick={handleReportCustomer}
            disabled={isAccepting}
            style={{
              padding: '0.5rem 0.75rem',
              fontSize: '0.75rem',
              background: 'rgba(251,146,60,0.2)',
              color: '#fb923c',
              border: '1px solid rgba(251,146,60,0.3)',
              borderRadius: '6px',
              cursor: isAccepting ? 'not-allowed' : 'pointer',
              fontWeight: '500',
            }}
          >
            ⚠️ Report
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={handleReject}
          disabled={isAccepting || secondsLeft <= 0}
          style={{
            flex: 1,
            padding: '0.875rem',
            fontSize: '1rem',
            fontWeight: '600',
            background: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            cursor: (isAccepting || secondsLeft <= 0) ? 'not-allowed' : 'pointer',
            opacity: (isAccepting || secondsLeft <= 0) ? 0.5 : 1,
          }}
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          disabled={isAccepting || secondsLeft <= 0 || runtimeFlags?.disableAcceptRide}
          style={{
            flex: 1,
            padding: '0.875rem',
            fontSize: '1rem',
            fontWeight: '600',
            background: (runtimeFlags?.disableAcceptRide || isAccepting || secondsLeft <= 0) ? 'rgba(96,165,250,0.3)' : '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: (runtimeFlags?.disableAcceptRide || isAccepting || secondsLeft <= 0) ? 'not-allowed' : 'pointer',
            opacity: (runtimeFlags?.disableAcceptRide || secondsLeft <= 0) ? 0.5 : 1,
          }}
        >
          {isAccepting ? 'Accepting...' : runtimeFlags?.disableAcceptRide ? 'Disabled' : 'Accept Ride'}
        </button>
      </div>
    </div>
  );
}
