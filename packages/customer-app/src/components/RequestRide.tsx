import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToast } from './Toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useMapEvents } from 'react-leaflet';
import { useRoutePolyline } from '../hooks/useRoutePolyline';
import { useReverseGeocode } from '../hooks/useReverseGeocode';
import { SharedMap } from './map/SharedMap';
import 'leaflet/dist/leaflet.css';

interface LatLng {
  lat: number;
  lng: number;
}

interface RequestRideProps {
  onRideRequested: (rideId: string) => void;
}

function MapClickHandler({ 
  pickup, 
  onSetPickup, 
  onSetDropoff 
}: { 
  pickup: LatLng | null; 
  dropoff: LatLng | null; 
  onSetPickup: (coords: LatLng) => void; 
  onSetDropoff: (coords: LatLng) => void; 
}) {
  useMapEvents({
    click: (e) => {
      const coords = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (!pickup) {
        onSetPickup(coords);
      } else {
        onSetDropoff(coords);
      }
    },
  });
  return null;
}

export function RequestRide({ onRideRequested }: RequestRideProps) {
  const { show } = useToast();
  const [loading, setLoading] = useState(false);
  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [priceCents, setPriceCents] = useState('2500'); // Default to $25
  const [metadata, setMetadata] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Route polyline (using shared hook)
  const { coords: routeLatLngs, loading: routeLoading, distanceMeters, error: routeError } = useRoutePolyline(pickup, dropoff);
  
  // Reverse geocode pickup and dropoff
  const pickupGeocode = useReverseGeocode(pickup?.lat, pickup?.lng);
  const dropoffGeocode = useReverseGeocode(dropoff?.lat, dropoff?.lng);
  
  // Compute stable route key for fitBounds
  const routeKey = useMemo(() => {
    if (!pickup || !dropoff) return '';
    return `${pickup.lat},${pickup.lng}-${dropoff.lat},${dropoff.lng}`;
  }, [pickup, dropoff]);

  const handleUseDemoCoordinates = () => {
    // DC area coordinates (pickup: near Union Station, dropoff: near Georgetown)
    const demoPickup = { lat: 38.8976, lng: -77.0369 };
    const demoDropoff = { lat: 38.9072, lng: -77.0589 };
    setPickup(demoPickup);
    setDropoff(demoDropoff);
  };

  const handleClear = () => {
    setPickup(null);
    setDropoff(null);
  };

  const handleSwap = () => {
    if (pickup && dropoff) {
      setPickup(dropoff);
      setDropoff(pickup);
    }
  };

  const formatPrice = (cents: string): string => {
    const num = parseInt(cents);
    if (isNaN(num)) return '$0.00';
    return `$${(num / 100).toFixed(2)}`;
  };

  const handleRequestRide = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!pickup || !dropoff) {
      show('Please set pickup and dropoff locations on the map', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        pickup,
        dropoff,
        ...(priceCents && { priceCents: parseInt(priceCents) }),
        ...(metadata && { metadata: JSON.parse(metadata) }),
      };

      let rideId: string;

      if (isScheduled) {
        if (!scheduledDate || !scheduledTime) {
          show('Please select a date and time for scheduled ride', 'error');
          setLoading(false);
          return;
        }

        const scheduledForMs = new Date(`${scheduledDate}T${scheduledTime}`).getTime();
        
        if (scheduledForMs < Date.now()) {
          show('Scheduled time must be in the future', 'error');
          setLoading(false);
          return;
        }

        const scheduleRideFn = httpsCallable(functions, 'scheduleRide');
        const result = await scheduleRideFn({ ...payload, scheduledForMs });
        rideId = (result.data as any).rideId;
        show(`Ride scheduled for ${new Date(scheduledForMs).toLocaleString()}`, 'success');
      } else {
        const tripRequestFn = httpsCallable(functions, 'tripRequest');
        const result = await tripRequestFn(payload);
        rideId = (result.data as any).rideId;
        show(`Ride requested! ID: ${rideId}`, 'success');
      }

      localStorage.setItem('rideId', rideId);
      onRideRequested(rideId);
    } catch (error) {
      const err = error as { message: string };
      show(`Failed to ${isScheduled ? 'schedule' : 'request'} ride: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const center: LatLng = pickup || dropoff || { lat: 38.8976, lng: -77.0369 };

  return (
    <div className="screen-container">
      <div className="card">
        <h2>Request a Ride</h2>
        
        <div className="demo-button-container" style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={handleUseDemoCoordinates}
            className="btn-demo"
          >
            Use Demo Coordinates (DC Area)
          </button>
        </div>

        <form onSubmit={handleRequestRide}>
          {/* Ride Type Toggle */}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={!isScheduled}
                onChange={() => setIsScheduled(false)}
                style={{ marginRight: '0.5rem' }}
              />
              Immediate
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                checked={isScheduled}
                onChange={() => setIsScheduled(true)}
                style={{ marginRight: '0.5rem' }}
              />
              Scheduled
            </label>
          </div>

          {/* Location Display */}
          <div style={{ marginBottom: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
            <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: 'rgba(0,255,140,0.95)' }}>📍 Pickup:</strong>{' '}
                {pickup ? (
                  <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                    {pickupGeocode.loading ? 'Loading address...' : pickupGeocode.label}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)' }}>
                    (tap map to set)
                  </span>
                )}
              </div>
              {distanceMeters && distanceMeters > 0 && (
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                  {(distanceMeters / 1609.34).toFixed(1)} mi
                </span>
              )}
            </div>
            <div>
              <strong style={{ color: 'rgba(80,160,255,0.95)' }}>📍 Dropoff:</strong>{' '}
              {dropoff ? (
                <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                  {dropoffGeocode.loading ? 'Loading address...' : dropoffGeocode.label}
                </span>
              ) : (
                <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)' }}>
                  (tap map to set)
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <button
                type="button"
                onClick={handleClear}
                disabled={!pickup && !dropoff}
                className="secondary-button"
                style={{ fontSize: '0.8rem', padding: '4px 12px' }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSwap}
                disabled={!pickup || !dropoff}
                className="secondary-button"
                style={{ fontSize: '0.8rem', padding: '4px 12px' }}
              >
                ⇄ Swap
              </button>
            </div>
          </div>

          {/* Map */}
          <div style={{ 
            height: '300px', 
            borderRadius: '8px', 
            overflow: 'hidden',
            marginBottom: '1rem',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <SharedMap
              pickup={pickup}
              dropoff={dropoff}
              routeCoords={routeLatLngs}
              shouldFit={true}
              fitKey={routeKey}
            >
              <MapClickHandler 
                pickup={pickup}
                dropoff={dropoff}
                onSetPickup={setPickup}
                onSetDropoff={setDropoff}
              />
            </SharedMap>
          </div>

          {/* Route Status */}
          {pickup && dropoff && (
            <div style={{ 
              fontSize: '0.85rem', 
              color: routeError ? 'rgba(255,100,100,0.8)' : 'rgba(255,255,255,0.5)', 
              marginTop: '0.5rem',
              textAlign: 'center'
            }}>
              {routeLoading ? 'Calculating route…' : routeError ? 'Route unavailable' : ''}
            </div>
          )}

          {/* Price */}
          <div className="form-group">
            <label>
              Price (cents){' '}
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                {formatPrice(priceCents)}
              </span>
            </label>
            <input
              type="number"
              placeholder="e.g., 2500"
              value={priceCents}
              onChange={(e) => setPriceCents(e.target.value)}
            />
          </div>

          {/* Scheduled Ride Fields */}
          {isScheduled && (
            <>
              <div className="form-group">
                <label>Scheduled Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  required={isScheduled}
                />
              </div>
              <div className="form-group">
                <label>Scheduled Time</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  required={isScheduled}
                />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
                Requires a preferred driver with available hours
              </p>
            </>
          )}

          {/* Advanced Section */}
          <div style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              {showAdvanced ? '▼' : '▶'} Advanced (Metadata)
            </button>
            {showAdvanced && (
              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label>Metadata (JSON)</label>
                <textarea
                  placeholder='e.g., {"notes": "Handle with care"}'
                  value={metadata}
                  onChange={(e) => setMetadata(e.target.value)}
                  style={{ minHeight: '80px' }}
                />
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={loading || !pickup || !dropoff} 
            className="button-primary"
          >
            {loading ? (isScheduled ? 'Scheduling...' : 'Requesting...') : (isScheduled ? 'Schedule Ride' : 'Request Ride')}
          </button>
        </form>
      </div>
    </div>
  );
}
