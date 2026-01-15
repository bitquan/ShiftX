import React, { useEffect, useState } from 'react';
import { RideOffer, Ride, tripAccept, tripDecline, watchRide } from '@shiftx/driver-client';
import { auth } from '../firebase';
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
  status: 'pending' | 'expired' | 'taken' | 'cancelled';
}

export function AvailableRides({ offers, onOfferAccepted, onOfferDeclined }: AvailableRidesProps) {
  const { show } = useToast();
  const [offersWithRides, setOffersWithRides] = useState<OfferWithRide[]>([]);
  const [acceptingRide, setAcceptingRide] = useState<string | null>(null);
  const [decliningRide, setDecliningRide] = useState<string | null>(null);
  const [currentDriverId, setCurrentDriverId] = useState<string | null>(null);

  // Get current driver ID
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      setCurrentDriverId(uid);
    }
  }, []);

  // Watch all rides for the pending offers
  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    const ridesMap = new Map<string, Ride | null>();
    const now = Date.now();

    offers.forEach((offer, rideId) => {
      // Skip expired offers at subscription time
      const expiresAtMs = offer.expiresAtMs || 0;
      if (expiresAtMs <= now) {
        console.log(`[AvailableRides] Skipping expired offer for ride ${rideId}`);
        return;
      }
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
      const now = Date.now();
      
      offers.forEach((offer, rideId) => {
        const ride = ridesMap.get(rideId);
        
        // Determine offer status
        let status: 'pending' | 'expired' | 'taken' | 'cancelled' = 'pending';
        
        // Check if expired
        if (offer.status !== 'pending' || now > (offer.expiresAtMs || 0)) {
          status = 'expired';
        }
        
        // Check if ride is cancelled
        else if (ride && ride.status === 'cancelled') {
          status = 'cancelled';
        }
        
        // Check if taken by another driver
        else if (ride && ['accepted', 'started', 'in_progress', 'completed'].includes(ride.status)) {
          if (ride.driverId && ride.driverId !== currentDriverId) {
            status = 'taken';
          }
        }
        
        combined.push({
          rideId,
          offer,
          ride: ride || null,
          status,
        });
      });
      
      // Sort: pending first, then by expiry time
      combined.sort((a, b) => {
        // Pending items first
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        
        // Then sort by expiry
        return (a.offer.expiresAtMs || 0) - (b.offer.expiresAtMs || 0);
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

  // Separate pending and non-pending offers
  const pendingOffers = offersWithRides.filter(o => o.status === 'pending');
  const nonPendingOffers = offersWithRides.filter(o => o.status !== 'pending');

  const handleClearExpired = () => {
    nonPendingOffers.forEach(({ rideId }) => {
      onOfferDeclined(rideId);
    });
    show(`Cleared ${nonPendingOffers.length} expired offer(s)`, 'success');
  };

  return (
    <div className="available-rides">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Available Rides ({pendingOffers.length})</h2>
        {nonPendingOffers.length > 0 && (
          <button
            onClick={handleClearExpired}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Clear {nonPendingOffers.length} expired
          </button>
        )}
      </div>
      <div className="rides-list">
        {offersWithRides.map(({ rideId, offer, ride, status }) => {
          const timeRemaining = getTimeRemaining(offer.expiresAtMs || 0);
          const isAccepting = acceptingRide === rideId;
          const isDeclining = decliningRide === rideId;
          const isPending = status === 'pending';

          // Status badge config
          const statusConfig = {
            pending: { label: 'Pending', color: '#4ade80', bgColor: 'rgba(74,222,128,0.1)' },
            expired: { label: 'Expired', color: '#9ca3af', bgColor: 'rgba(156,163,175,0.1)' },
            taken: { label: 'Taken by another driver', color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' },
            cancelled: { label: 'Cancelled', color: '#9ca3af', bgColor: 'rgba(156,163,175,0.1)' },
          };
          const statusInfo = statusConfig[status];

          return (
            <div
              key={rideId}
              className="ride-card"
              style={{
                opacity: isPending ? 1 : 0.6,
                border: isPending ? undefined : '1px solid rgba(156,163,175,0.3)',
              }}
            >
              <div className="ride-header">
                <span className="ride-id">{rideId.slice(0, 8)}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {isPending && (
                    <span className="time-badge">
                      {timeRemaining}
                    </span>
                  )}
                  <span
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      color: statusInfo.color,
                      backgroundColor: statusInfo.bgColor,
                      border: `1px solid ${statusInfo.color}40`,
                      borderRadius: '4px',
                    }}
                  >
                    {statusInfo.label}
                  </span>
                </div>
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
                {isPending ? (
                  <>
                    <button
                      onClick={() => handleDecline(rideId)}
                      disabled={isDeclining || isAccepting}
                      className="decline-button"
                    >
                      {isDeclining ? 'Declining...' : 'Decline'}
                    </button>
                    <button
                      onClick={() => handleAccept(rideId)}
                      disabled={isAccepting || isDeclining}
                      className="accept-button"
                    >
                      {isAccepting ? 'Accepting...' : 'Accept'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onOfferDeclined(rideId)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: 'rgba(156,163,175,0.1)',
                      border: '1px solid rgba(156,163,175,0.3)',
                      color: '#9ca3af',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
