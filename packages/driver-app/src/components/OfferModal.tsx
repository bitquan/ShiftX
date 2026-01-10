import React, { useEffect, useRef, useState } from 'react';
import { RideOffer, Ride, tripAccept, tripDecline, watchRide } from '@shiftx/driver-client';
import { useToast } from './Toast';

interface OfferModalProps {
  rideId: string;
  offer: RideOffer;
  onAccepted: () => void;
  onExpired: () => void;
}

const OFFER_TTL_MS = 60_000; // 60 seconds

export function OfferModal({ rideId, offer, onAccepted, onExpired }: OfferModalProps) {
  const { show } = useToast();
  const [timeLeft, setTimeLeft] = useState(OFFER_TTL_MS);
  const [isAccepting, setIsAccepting] = useState(false);
  const [ride, setRide] = useState<Ride | null>(null);
  const hasShownExpiredToastRef = useRef(false);
  const hasCalledOnExpiredRef = useRef(false);

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

  const secondsLeft = Math.ceil(timeLeft / 1000);
  const progressPercent = (timeLeft / OFFER_TTL_MS) * 100;
  const isExpiringSoon = secondsLeft <= 10;

  return (
    <div className="modal-overlay">
      <div className="offer-modal">
        <div className="offer-header">
          <h2>New Ride Offer!</h2>
          <p className="ride-id">Ride: <code>{rideId.slice(0, 8)}...</code></p>
        </div>

        <div className="offer-details">
          {ride ? (
            <>
              <div className="detail-row">
                <span className="label">Pickup</span>
                <span className="value">{ride.pickup.lat.toFixed(4)}, {ride.pickup.lng.toFixed(4)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Dropoff</span>
                <span className="value">{ride.dropoff.lat.toFixed(4)}, {ride.dropoff.lng.toFixed(4)}</span>
              </div>
              <div className="detail-row">
                <span className="label">Estimated fare</span>
                <span className="value">${((ride.priceCents ?? 0) / 100).toFixed(2)}</span>
              </div>
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
            {secondsLeft}s remaining
          </p>
        </div>

        <div className="offer-actions">
          <button
            onClick={handleReject}
            disabled={isAccepting || secondsLeft <= 0}
            className="reject-button secondary-button"
          >
            {isAccepting ? 'Rejecting...' : 'Reject'}
          </button>
          <button
            onClick={handleAccept}
            disabled={isAccepting || secondsLeft <= 0}
            className="accept-button primary-button"
          >
            {isAccepting ? 'Accepting...' : 'Accept Ride'}
          </button>
        </div>
      </div>
    </div>
  );
}
