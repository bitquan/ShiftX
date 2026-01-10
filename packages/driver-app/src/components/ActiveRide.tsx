import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { tripUpdateStatus, TripUpdateStatus, getInitializedClient } from '@shiftx/driver-client';
import { doc, onSnapshot } from 'firebase/firestore';
import { useToast } from './Toast';
import { useRoutePolyline } from '../hooks/useRoutePolyline';
import { RouteLine } from './RouteLine';
import { useHeartbeat } from '../hooks/useHeartbeat';
import { driverCarIcon, pickupCircleIcon, dropoffCircleIcon } from '../utils/mapIcons';
import 'leaflet/dist/leaflet.css';
import type { LatLngBounds } from 'leaflet';

// Component to fit map bounds (with guard to prevent repeated calls)
function FitBounds({ bounds, shouldFit, onFit }: { bounds: LatLngBounds | null; shouldFit: boolean; onFit: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && shouldFit) {
      map.fitBounds(bounds, { padding: [50, 50] });
      onFit();
    }
  }, [bounds, map, shouldFit, onFit]);
  return null;
}

interface LatLng {
  lat: number;
  lng: number;
}

interface RideData {
  pickup?: LatLng;
  dropoff?: LatLng;
  status?: string;
  driverLocation?: LatLng;
}

type RideState = 'accepted' | 'started' | 'in_progress' | 'completed';

interface ActiveRideProps {
  rideId: string;
  currentStatus: RideState;
  onStatusUpdate: (newStatus: RideState) => void;
}

export function ActiveRide({ rideId, currentStatus, onStatusUpdate }: ActiveRideProps) {
  const { show } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [rideData, setRideData] = useState<RideData | null>(null);
  const [mapBounds, setMapBounds] = useState<LatLngBounds | null>(null);
  const didFitRef = useRef(false);
  const lastRouteKeyRef = useRef<string>('');
  
  // Get Mapbox token from env
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
  
  // Stable callback to mark bounds as fitted
  const handleFit = useCallback(() => {
    didFitRef.current = true;
  }, []);
  
  // Get current driver location from heartbeat
  const driverLocation = useHeartbeat(true);
  
  // Route polyline (using shared hook) - only depends on pickup/dropoff
  const { coords: routePoints, distanceMeters: distance } = useRoutePolyline(rideData?.pickup, rideData?.dropoff);

  // Fetch ride data
  useEffect(() => {
    const { firestore } = getInitializedClient();
    const unsubscribe = onSnapshot(doc(firestore, 'rides', rideId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as RideData;
        setRideData(data);
      }
    });

    return () => unsubscribe();
  }, [rideId]);

  // Calculate map bounds when route changes (only once per route)
  useEffect(() => {
    if (!rideData?.pickup || !rideData?.dropoff || !routePoints || routePoints.length === 0) {
      return;
    }

    const routeKey = `${rideData.pickup.lat},${rideData.pickup.lng}-${rideData.dropoff.lat},${rideData.dropoff.lng}`;
    if (routeKey !== lastRouteKeyRef.current) {
      didFitRef.current = false; // Reset flag for new route
      lastRouteKeyRef.current = routeKey;
    }

    const L = (window as any).L;
    if (L) {
      const bounds = L.latLngBounds([
        [rideData.pickup.lat, rideData.pickup.lng],
        [rideData.dropoff.lat, rideData.dropoff.lng],
        ...routePoints,
      ]);
      setMapBounds(bounds);
    }
  }, [rideData?.pickup, rideData?.dropoff, routePoints]);

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
      } else {
        show(`Failed to update status: ${errorMsg}`, 'error');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="active-ride" style={{ paddingBottom: '80px' }}>
      {/* Status Strip */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.8)',
        padding: '12px',
        borderRadius: '8px',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Active Ride</h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
              ID: <code>{rideId.slice(0, 12)}...</code>
            </p>
          </div>
          <div style={{ 
            backgroundColor: status.color,
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '0.85rem',
            fontWeight: '600'
          }}>
            {status.label}
          </div>
        </div>
        
        {rideData?.pickup && rideData?.dropoff && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
            <div>
              📍 Pickup → Dropoff
              {distance > 0 && (
                <span style={{ marginLeft: '8px', color: 'rgba(255,255,255,0.6)' }}>
                  ({(distance / 1000).toFixed(1)} km)
                </span>
              )}
            </div>
            <button
              onClick={handleNavigate}
              className="secondary-button"
              style={{ fontSize: '0.8rem', padding: '4px 12px' }}
            >
              🧭 Navigate
            </button>
          </div>
        )}
      </div>

      {/* Map */}
      {center && rideData?.pickup && rideData?.dropoff && (
        <div style={{ 
          height: '300px', 
          borderRadius: '8px', 
          overflow: 'hidden',
          marginBottom: '16px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url={
                mapboxToken
                  ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`
                  : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
              }
              attribution={
                mapboxToken
                  ? '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              }
              tileSize={512}
              zoomOffset={-1}
              className="map-tiles-dark"
            />
            
            <FitBounds bounds={mapBounds} shouldFit={!didFitRef.current} onFit={handleFit} />
            
            <Marker position={[rideData.pickup.lat, rideData.pickup.lng]} icon={pickupCircleIcon}>
              <Popup>Pickup Location</Popup>
            </Marker>
            
            <Marker position={[rideData.dropoff.lat, rideData.dropoff.lng]} icon={dropoffCircleIcon}>
              <Popup>Dropoff Location</Popup>
            </Marker>
            
            {/* Driver location pin - use live location or fallback to ride.driverLocation */}
            {(driverLocation || rideData.driverLocation) && (
              <Marker 
                position={[
                  driverLocation?.lat || rideData.driverLocation!.lat,
                  driverLocation?.lng || rideData.driverLocation!.lng
                ]}
                icon={driverCarIcon}
              >
                <Popup>Driver Location</Popup>
              </Marker>
            )}
            
            <RouteLine coords={routePoints} />
            <FitBounds 
              bounds={mapBounds} 
              shouldFit={!didFitRef.current} 
              onFit={handleFit}
            />
          </MapContainer>
        </div>
      )}

      {/* Actions */}
      <div className="ride-header">
        <div className="ride-actions">
          {action ? (
            <button
              onClick={handleAction}
              disabled={isUpdating}
              className="primary-button action-button"
              style={{ width: '100%' }}
            >
              {isUpdating ? 'Updating...' : action.label}
            </button>
          ) : (
            <div className="completion-message">
              <p>✓ Ride completed successfully</p>
            </div>
          )}
        </div>
      </div>

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
