import React, { useEffect, useRef, useState } from 'react';
import { RideOffer, Ride, tripAccept, tripDecline, watchRide, getInitializedClient } from '@shiftx/driver-client';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useToast } from './Toast';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { useEtaToPickup } from '../hooks/useEtaToPickup';
import { useHeartbeat } from '../hooks/useHeartbeat';
import { useOfferRoute } from '../hooks/useOfferRoute';
import { getAuth } from 'firebase/auth';
import { RuntimeFlags } from '../utils/runtimeFlags';

interface OfferModalProps {
  rideId: string;
  offer: RideOffer;
  onAccepted: () => void;
  onExpired: () => void;
  runtimeFlags: RuntimeFlags | null;
}

const OFFER_TTL_MS = 60_000; // 60 seconds

export function OfferModal({ rideId, offer, onAccepted, onExpired, runtimeFlags }: OfferModalProps) {
  const { app } = getInitializedClient();
  const auth = getAuth(app);
  const driverId = auth.currentUser?.uid || null;
  const { show } = useToast();
  const [timeLeft, setTimeLeft] = useState(OFFER_TTL_MS);
  const [isAccepting, setIsAccepting] = useState(false);
  const [ride, setRide] = useState<Ride | null>(null);
  const [customerProfile, setCustomerProfile] = useState<any>(null);
  const hasShownExpiredToastRef = useRef(false);
  const hasCalledOnExpiredRef = useRef(false);

  // Get driver's current location for ETA calculation
  const { currentLocation: driverLocation } = useHeartbeat(false); // Don't enable heartbeat, just read current location

  // Subscribe to ride document for pickup/dropoff/price
  useEffect(() => {
    if (!rideId) return;

    const unsubscribe = watchRide(
      rideId,
      (rideData) => {
        setRide(rideData as Ride | null);
      },
      (error) => {
        console.error('Error watching ride:', error);
        show('Failed to load ride details', 'error');
      }
    );

    return () => unsubscribe();
  }, [rideId, show]);

  // Load customer profile when riderId is available
  useEffect(() => {
    if (!ride?.riderId) {
      setCustomerProfile(null);
      return;
    }

    console.log('[OfferModal] Loading customer profile for riderId:', ride.riderId);
    const { firestore } = getInitializedClient();
    const userRef = doc(firestore, 'users', ride.riderId);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        console.log('[OfferModal] Customer profile loaded:', snap.data());
        setCustomerProfile(snap.data());
      } else {
        console.log('[OfferModal] Customer profile not found');
      }
    });

    return () => unsubscribe();
  }, [ride?.riderId]);

  useEffect(() => {
    if (!offer.expiresAtMs) return;

    // Check if already expired on mount
    const now = Date.now();
    const initialRemaining = Math.max(0, offer.expiresAtMs - now);
    
    if (initialRemaining === 0 && !hasCalledOnExpiredRef.current) {
      hasCalledOnExpiredRef.current = true;
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
      show('Ride accepted', 'success');
      onAccepted();
    } catch (error) {
      const errorMsg = (error as Error).message;
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
      show('Offer declined', 'info');
      onExpired();
    } catch (error) {
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
    if (reason === null) return; // User cancelled

    try {
      const { functions } = getInitializedClient();
      const blockFn = httpsCallable(functions, 'driverBlockCustomer');
      await blockFn({ customerId: ride.riderId, reason: reason || '' });
      show('Customer blocked successfully', 'success');
      
      // Decline the offer and close modal
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

  // Get trip route data (distance + duration for trip info display)
  const { distanceMeters, durationSeconds } = useOfferRoute(ride?.pickup, ride?.dropoff);

  const secondsLeft = Math.ceil(timeLeft / 1000);
  const progressPercent = (timeLeft / OFFER_TTL_MS) * 100;
  const isExpiringSoon = secondsLeft <= 10;

  return (
    <div className="modal-overlay">
      <div className="offer-modal">
        <div className="offer-header">
          <div>
            <h2>New Ride Offer</h2>
            <p className="ride-id-muted">ID: <code>{rideId.slice(0, 8)}</code></p>
          </div>
        </div>
        {/* Customer Identity Card */}
        {ride && customerProfile && (
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
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                overflow: 'hidden',
                backgroundColor: 'rgba(255,255,255,0.1)',
                border: '2px solid rgba(96,165,250,0.5)',
                flexShrink: 0,
              }}>
                {customerProfile.photoURL ? (
                  <img src={customerProfile.photoURL} alt="Customer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                    👤
                  </div>
                )}
              </div>

              {/* Customer Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '0.25rem', color: '#60a5fa' }}>
                  Passenger
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                  {customerProfile.displayName ? customerProfile.displayName.split(' ')[0] : customerProfile.email ? customerProfile.email.split('@')[0] : 'Customer'}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="offer-details">
          {ride ? (
            <>
              {/* To Pickup (Most important for driver) */}
              <div className="detail-row highlight">
                <span className="label">📍 To Pickup</span>
                <span className="value">
                  {etaToPickup.loading ? (
                    'Calculating...'
                  ) : etaToPickup.miles && etaToPickup.minutes ? (
                    `${etaToPickup.miles.toFixed(1)} mi • ~${etaToPickup.minutes} min`
                  ) : (
                    'Location needed'
                  )}
                </span>
              </div>

              {/* Pickup Address */}
              <div className="detail-row">
                <span className="label">Pickup</span>
                <span className="value address">
                  {pickupGeocode.loading ? (
                    <span className="resolving">Resolving address...</span>
                  ) : pickupGeocode.label ? (
                    pickupGeocode.label
                  ) : ride.pickup ? (
                    <span className="coords-fallback">
                      {ride.pickup.lat.toFixed(4)}, {ride.pickup.lng.toFixed(4)}
                    </span>
                  ) : (
                    <span className="coords-fallback">Unknown</span>
                  )}
                </span>
              </div>

              {/* Dropoff Address */}
              <div className="detail-row">
                <span className="label">Dropoff</span>
                <span className="value address">
                  {dropoffGeocode.loading ? (
                    <span className="resolving">Resolving address...</span>
                  ) : dropoffGeocode.label ? (
                    dropoffGeocode.label
                  ) : ride.dropoff ? (
                    <span className="coords-fallback">
                      {ride.dropoff.lat.toFixed(4)}, {ride.dropoff.lng.toFixed(4)}
                    </span>
                  ) : (
                    <span className="coords-fallback">Unknown</span>
                  )}
                </span>
              </div>

              {/* Trip Distance & Duration */}
              {distanceMeters != null && durationSeconds != null && (
                <div className="detail-row">
                  <span className="label">Trip</span>
                  <span className="value">
                    {(distanceMeters / 1609.34).toFixed(1)} mi • {Math.ceil(durationSeconds / 60)} min
                  </span>
                </div>
              )}

              {/* Driver Earnings (actual ride price) */}
              {ride.priceCents != null && (
                <div className="detail-row highlight-earnings">
                  <span className="label">💰 You Earn</span>
                  <span className="value earnings">${(ride.priceCents / 100).toFixed(2)}</span>
                </div>
              )}
            </>
          ) : (
            <div className="detail-row">
              <span className="value">Loading ride details...</span>
            </div>
          )}
        </div>

        <div className={`countdown ${isExpiringSoon ? 'expiring' : ''}`}>
          <div className="countdown-bar">
            <div className="countdown-progress" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <p className="countdown-text">
            Expires in {secondsLeft}s
          </p>
        </div>
        {/* Block and Report actions */}
        {ride?.riderId && (
          <div className="safety-actions" style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <button
              onClick={handleBlockCustomer}
              disabled={isAccepting}
              className="safety-button"
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem',
                background: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              🚫 Block Rider
            </button>
            <button
              onClick={handleReportCustomer}
              disabled={isAccepting}
              className="safety-button"
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem',
                background: '#ff8800',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ⚠️ Report
            </button>
          </div>
        )}
        <div className="offer-actions">
          <button
            onClick={handleReject}
            disabled={isAccepting || secondsLeft <= 0}
            className="decline-button secondary-button"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={isAccepting || secondsLeft <= 0 || runtimeFlags?.disableAcceptRide}
            className="accept-button primary-button"
            style={{
              opacity: runtimeFlags?.disableAcceptRide ? 0.5 : 1,
              cursor: runtimeFlags?.disableAcceptRide ? 'not-allowed' : 'pointer',
            }}
          >
            {isAccepting ? 'Accepting...' : runtimeFlags?.disableAcceptRide ? 'Disabled' : 'Accept Ride'}
          </button>
        </div>
      </div>
    </div>
  );
}
