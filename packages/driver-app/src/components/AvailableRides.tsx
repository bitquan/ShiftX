import React, { useEffect, useState } from 'react';
import { RideOffer, Ride, tripAccept, tripDecline, watchRide } from '@shiftx/driver-client';
import { useToast } from './Toast';

interface AvailableRidesProps {
  offers: Map<string, RideOffer>;
  onOfferAccepted: (rideId: string) => void;
  onOfferDeclined: (rideId: string) => void;
}

interface OfferWithRide {
  rideId: string;
  offer: RideOffer;
  ride: Ride | null;
}

export function AvailableRides({ offers, onOfferAccepted, onOfferDeclined }: AvailableRidesProps) {
  const { show } = useToast();
  const [offersWithRides, setOffersWithRides] = useState<OfferWithRide[]>([]);
  const [acceptingRide, setAcceptingRide] = useState<string | null>(null);
  const [decliningRide, setDecliningRide] = useState<string | null>(null);

  // Watch all rides for the pending offers
  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    const ridesMap = new Map<string, Ride | null>();

    offers.forEach((offer, rideId) => {
      ridesMap.set(rideId, null);

      const unsubscribe = watchRide(
        rideId,
        (rideData) => {
          ridesMap.set(rideId, rideData as Ride | null);
          updateOffersWithRides();
        },
        (error) => {
          console.error(`Error watching ride ${rideId}:`, error);
        }
      );

      unsubscribes.push(unsubscribe);
    });

    const updateOffersWithRides = () => {
      const combined: OfferWithRide[] = [];
      offers.forEach((offer, rideId) => {
        combined.push({
          rideId,
          offer,
          ride: ridesMap.get(rideId) || null,
        });
      });
      
      // Sort: pending first by soonest expiry, then expired/declined
      combined.sort((a, b) => {
        const aExpired = a.offer.status !== 'pending' || Date.now() > (a.offer.expiresAtMs || 0);
        const bExpired = b.offer.status !== 'pending' || Date.now() > (b.offer.expiresAtMs || 0);
        
        // Pending before expired
        if (!aExpired && bExpired) return -1;
        if (aExpired && !bExpired) return 1;
        
        // Both pending: sort by soonest expiry
        if (!aExpired && !bExpired) {
          return (a.offer.expiresAtMs || 0) - (b.offer.expiresAtMs || 0);
        }
        
        // Both expired: maintain order
        return 0;
      });
      
      setOffersWithRides(combined);
    };

    updateOffersWithRides();

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [offers]);

  const handleAccept = async (rideId: string) => {
    setAcceptingRide(rideId);
    try {
      await tripAccept(rideId);
      show('Ride accepted!', 'success');
      onOfferAccepted(rideId);
    } catch (error) {
      const errorMsg = (error as Error).message.toLowerCase();
      
      // Handle specific error cases with friendly messages
      if (errorMsg.includes('expired')) {
        show('⏱️ This offer has expired', 'warning');
        onOfferDeclined(rideId);
      } else if (errorMsg.includes('no longer pending') || errorMsg.includes('not offered')) {
        show('❌ This ride was taken by another driver', 'warning');
        onOfferDeclined(rideId);
      } else if (errorMsg.includes('busy')) {
        show('⚠️ You already have an active ride', 'warning');
      } else if (errorMsg.includes('not found')) {
        show('🔍 Ride not found', 'error');
        onOfferDeclined(rideId);
      } else {
        show(`Failed to accept ride: ${errorMsg}`, 'error');
      }
    } finally {
      setAcceptingRide(null);
    }
  };

  const handleDecline = async (rideId: string) => {
    setDecliningRide(rideId);
    try {
      await tripDecline(rideId);
      show('Offer declined', 'info');
      onOfferDeclined(rideId);
    } catch (error) {
      const errorMsg = (error as Error).message.toLowerCase();
      
      if (errorMsg.includes('not found')) {
        show('Offer already removed', 'info');
        onOfferDeclined(rideId);
      } else if (errorMsg.includes('not pending')) {
        show('Offer is no longer available', 'info');
        onOfferDeclined(rideId);
      } else {
        show(`Failed to decline: ${errorMsg}`, 'error');
      }
    } finally {
      setDecliningRide(null);
    }
  };

  const getTimeRemaining = (expiresAtMs: number) => {
    const remaining = Math.max(0, expiresAtMs - Date.now());
    const seconds = Math.floor(remaining / 1000);
    if (seconds === 0) return 'Expired';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (offersWithRides.length === 0) {
    return (
      <div className="available-rides-empty">
        <p>No available ride offers</p>
        <p className="subtitle">Offers will appear here when riders request a ride</p>
      </div>
    );
  }

  return (
    <div className="available-rides">
      <h2>Available Rides ({offersWithRides.length})</h2>
      <div className="rides-list">
        {offersWithRides.map(({ rideId, offer, ride }) => {
          const now = Date.now();
          const timeRemaining = getTimeRemaining(offer.expiresAtMs || 0);
          const isExpired = offer.status !== 'pending' || now > (offer.expiresAtMs || 0);
          const canAccept = offer.status === 'pending' && now <= (offer.expiresAtMs || 0);
          const isAccepting = acceptingRide === rideId;
          const isDeclining = decliningRide === rideId;

          return (
            <div key={rideId} className={`ride-card ${isExpired ? 'expired' : ''}`}>
              <div className="ride-header">
                <span className="ride-id">{rideId.slice(0, 8)}</span>
                <span className={`time-badge ${isExpired ? 'expired' : ''}`}>
                  {timeRemaining}
                </span>
              </div>

              {ride ? (
                <div className="ride-details">
                  <div className="detail-row">
                    <span className="label">📍 Pickup</span>
                    <span className="value">{ride.pickup.lat.toFixed(4)}, {ride.pickup.lng.toFixed(4)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">🎯 Dropoff</span>
                    <span className="value">{ride.dropoff.lat.toFixed(4)}, {ride.dropoff.lng.toFixed(4)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">💰 Fare</span>
                    <span className="value">${((ride.priceCents ?? 0) / 100).toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="ride-details">
                  <p className="loading">Loading ride details...</p>
                </div>
              )}

              <div className="ride-actions">
                <button
                  onClick={() => handleDecline(rideId)}
                  disabled={isDeclining || isAccepting}
                  className="decline-button"
                >
                  {isDeclining ? 'Declining...' : 'Decline'}
                </button>
                <button
                  onClick={() => handleAccept(rideId)}
                  disabled={!canAccept || isAccepting || isDeclining}
                  className="accept-button"
                  title={!canAccept ? 'Offer expired or unavailable' : ''}
                >
                  {isAccepting ? 'Accepting...' : isExpired ? 'Expired' : 'Accept'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
