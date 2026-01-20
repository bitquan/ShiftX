import { useMemo, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { RouteLine } from '../RouteLine';
import { DualRouteLine } from '../DualRouteLine';
import { FitBoundsOnce } from './FitBoundsOnce';
import { RotatableDriverMarker } from './RotatableDriverMarker';
import { pickupCircleIcon, dropoffCircleIcon } from '../../utils/mapIcons';
import { useSmoothLocation } from '../../hooks/useSmoothLocation';
import 'leaflet/dist/leaflet.css';
import type { LatLngBounds } from 'leaflet';

interface LatLng {
  lat: number;
  lng: number;
  heading?: number;
}

interface SharedMapProps {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  driver?: LatLng | null;
  driverLocation?: LatLng | null; // Alias for driver
  routeCoords?: [number, number][] | null;
  // Phase 4G: Dual-leg routing
  legA?: [number, number][] | null;
  legB?: [number, number][] | null;
  activeLeg?: 'A' | 'B' | null;
  shouldFit?: boolean;
  fitKey?: string;
  center?: LatLng;
  cameraMode?: 'follow' | 'overview'; // Camera behavior control
  children?: React.ReactNode;
}

/**
 * Unified map component for driver app.
 * Matches customer app styling for consistent route visualization.
 * Phase 4G: Supports dual-leg routing (driver→pickup + pickup→dropoff)
 */
export function SharedMap({
  pickup,
  dropoff,
  driver,
  driverLocation,
  routeCoords,
  legA,
  legB,
  activeLeg,
  shouldFit = true,
  fitKey = '',
  center: centerProp,
  cameraMode = 'follow',
  children,
}: SharedMapProps) {
  // Calculate center point - Phase 2C-1: use provided center, no DC fallback
  const center = useMemo(() => {
    if (centerProp) return { lat: centerProp.lat, lng: centerProp.lng };
    if (pickup) return { lat: pickup.lat, lng: pickup.lng };
    // Use driver location if available, otherwise initial map center
    const driverPos = driver || driverLocation;
    if (driverPos) return { lat: driverPos.lat, lng: driverPos.lng };
    return { lat: 38.9072, lng: -77.0369 }; // Only for initial render
  }, [centerProp, pickup, driver, driverLocation]);

  // Calculate bounds for fitBounds
  const mapBounds = useMemo((): LatLngBounds | null => {
    const L = (window as any).L;
    if (!L) return null;

    // Phase 4G: Use dual-leg coords if available, otherwise single routeCoords
    const coordsToFit: [number, number][] = [];

    if (legA && legA.length > 0) coordsToFit.push(...legA);
    if (legB && legB.length > 0) coordsToFit.push(...legB);
    if (!legA && !legB && routeCoords && routeCoords.length > 0) {
      coordsToFit.push(...routeCoords);
    }

    // Add pickup/dropoff if available
    if (pickup) coordsToFit.push([pickup.lat, pickup.lng]);
    if (dropoff) coordsToFit.push([dropoff.lat, dropoff.lng]);

    if (coordsToFit.length === 0) return null;

    return L.latLngBounds(coordsToFit);
  }, [pickup, dropoff, routeCoords, legA, legB]);

  // Get Mapbox token from env
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

  // Support both driver and driverLocation prop names for compatibility
  const driverPos = driver || driverLocation;

  // Phase 3E: Apply smooth location with noise filtering
  const smoothDriverPos = useSmoothLocation(driverPos || null, {
    minDistanceMeters: 5, // Filter GPS noise < 5m
    transitionDuration: 800, // 800ms smooth movement
  });

  // Debug logging
  console.log('[SharedMap] Render with:', {
    hasPickup: !!pickup,
    hasDropoff: !!dropoff,
    hasRoute: !!routeCoords,
    routeLength: routeCoords?.length || 0,
    hasLegA: !!legA,
    hasLegB: !!legB,
    legALength: legA?.length || 0,
    legBLength: legB?.length || 0,
    activeLeg,
    hasDriver: !!driverPos,
    hasSmoothDriver: !!smoothDriverPos,
    heading: smoothDriverPos?.heading,
    fitKey
  });

  // Phase 2C-1: Camera follow component
  function CameraFollow({ position }: { position: LatLng | null }) {
    const map = useMap();
    
    useEffect(() => {
      if (!position) return;
      
      const hasGpsFix = !!(position.lat && position.lng && 
        !Number.isNaN(position.lat) && !Number.isNaN(position.lng));
      
      if (hasGpsFix) {
        console.log('[CameraFollow] Following GPS:', position);
        // Use zoom level 17 for close following view
        map.setView([position.lat, position.lng], 17, { animate: true });
      }
    }, [position, map]);
    
    return null;
  }

  // Phase 4G: Fit bounds for overview mode
  function FitBoundsOnce({ bounds, fitKey }: { bounds: LatLngBounds | null; fitKey: string }) {
    const map = useMap();
    const lastFitKeyRef = useRef<string>('');
    
    useEffect(() => {
      if (!bounds || !fitKey || fitKey === lastFitKeyRef.current) return;
      
      console.log('[FitBoundsOnce] Fitting to bounds, fitKey:', fitKey);
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
      lastFitKeyRef.current = fitKey;
    }, [bounds, fitKey, map]);
    
    return null;
  }

  return (
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

      {/* Phase 2C-1: Follow driver GPS when in follow mode */}
      {cameraMode === 'follow' && <CameraFollow position={smoothDriverPos} />}

      {/* Phase 4G: Fit bounds when in overview mode */}
      {cameraMode === 'overview' && mapBounds && <FitBoundsOnce bounds={mapBounds} fitKey={fitKey} />}

      {children}

      {/* Phase 4G: Dual-leg routing (driver → pickup + pickup → dropoff) */}
      {(legA || legB) && (
        <DualRouteLine legA={legA || null} legB={legB || null} activeLeg={activeLeg || null} />
      )}

      {/* Fallback: Single route polyline (legacy support) */}
      {!legA && !legB && routeCoords && (
        <RouteLine coords={routeCoords} driverLocation={smoothDriverPos} />
      )}

      {/* Pickup marker */}
      {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pickupCircleIcon} />}

      {/* Dropoff marker */}
      {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffCircleIcon} />}

      {/* Phase 3E: Driver live location with smooth movement and rotation */}
      {smoothDriverPos && (
        <RotatableDriverMarker
          position={[smoothDriverPos.lat, smoothDriverPos.lng]}
          heading={smoothDriverPos.heading}
        />
      )}
    </MapContainer>
  );
}
