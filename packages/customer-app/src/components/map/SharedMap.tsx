import { useMemo } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { RouteLine } from './RouteLine';
import { FitBoundsOnce } from './FitBoundsOnce';
import { pickupCircleIcon, dropoffCircleIcon, driverCarIcon } from '../../utils/mapIcons';
import 'leaflet/dist/leaflet.css';
import type { LatLngBounds } from 'leaflet';

interface LatLng {
  lat: number;
  lng: number;
}

interface SharedMapProps {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  driver?: LatLng | null;
  routeCoords?: [number, number][] | null;
  shouldFit?: boolean;
  fitKey?: string;
  children?: React.ReactNode;
}

/**
 * Unified map component for customer app.
 * Handles pickup/dropoff/driver markers, route polyline, and auto-fit bounds.
 */
export function SharedMap({
  pickup,
  dropoff,
  driver,
  routeCoords,
  shouldFit = true,
  fitKey = '',
  children,
}: SharedMapProps) {
  // Calculate center point
  const center = useMemo(() => {
    if (pickup) return { lat: pickup.lat, lng: pickup.lng };
    return { lat: 38.9072, lng: -77.0369 }; // DC default
  }, [pickup]);

  // Calculate bounds for fitBounds
  const mapBounds = useMemo((): LatLngBounds | null => {
    if (!pickup || !dropoff || !routeCoords || routeCoords.length === 0) {
      return null;
    }

    const L = (window as any).L;
    if (!L) return null;

    return L.latLngBounds([
      [pickup.lat, pickup.lng],
      [dropoff.lat, dropoff.lng],
      ...routeCoords,
    ]);
  }, [pickup, dropoff, routeCoords]);

  // Get Mapbox token from env
  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

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

      {children}

      {/* Route polyline */}
      <RouteLine coords={routeCoords} />

      {/* Pickup marker */}
      {pickup && <Marker position={[pickup.lat, pickup.lng]} icon={pickupCircleIcon} />}

      {/* Dropoff marker */}
      {dropoff && <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffCircleIcon} />}

      {/* Driver marker */}
      {driver && <Marker position={[driver.lat, driver.lng]} icon={driverCarIcon} />}

      {/* Fit bounds once per route */}
      {shouldFit && <FitBoundsOnce bounds={mapBounds} fitKey={fitKey} />}
    </MapContainer>
  );
}
