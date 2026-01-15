import { useMemo } from 'react';
import { Polyline } from 'react-leaflet';

interface LatLng {
  lat: number;
  lng: number;
}

interface RouteLineProps {
  coords: [number, number][] | null;
  driverLocation?: LatLng | null;
}

/**
 * Shared route line styling constants for consistency across apps
 */
export const ROUTE_STYLE = {
  color: '#3b82f6', // Brighter blue for better contrast on dark maps
  glow: {
    weight: 12,
    opacity: 0.4,
  },
  core: {
    weight: 7,
    opacity: 1,
  },
  lineCap: 'round' as const,
  lineJoin: 'round' as const,
};

/**
 * Unified route polyline component with glowing effect.
 * Renders two layers:
 * 1. Glow layer (wider, more transparent)
 * 2. Core line (thinner, more opaque)
 */
export function RouteLine({ coords, driverLocation }: RouteLineProps) {
  const remainingCoords = useMemo(() => {
    if (!coords || coords.length === 0) return null;
    if (!driverLocation) return coords;

    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < coords.length; i += 1) {
      const [lat, lng] = coords[i];
      const distance = distanceMeters(driverLocation.lat, driverLocation.lng, lat, lng);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }

    return coords.slice(closestIndex);
  }, [coords, driverLocation?.lat, driverLocation?.lng]);

  if (!remainingCoords || remainingCoords.length === 0) {
    console.log('[RouteLine] No coords or empty array:', coords);
    return null;
  }

  console.log('[RouteLine] Rendering route with', remainingCoords.length, 'points');
  console.log('[RouteLine] First coord:', remainingCoords[0], 'Last coord:', remainingCoords[remainingCoords.length - 1]);

  return (
    <>
      {/* Glow layer */}
      <Polyline
        positions={remainingCoords}
        pathOptions={{
          color: ROUTE_STYLE.color,
          weight: ROUTE_STYLE.glow.weight,
          opacity: ROUTE_STYLE.glow.opacity,
          lineCap: ROUTE_STYLE.lineCap,
          lineJoin: ROUTE_STYLE.lineJoin,
        }}
      />
      {/* Core line */}
      <Polyline
        positions={remainingCoords}
        pathOptions={{
          color: ROUTE_STYLE.color,
          weight: ROUTE_STYLE.core.weight,
          opacity: ROUTE_STYLE.core.opacity,
          lineCap: ROUTE_STYLE.lineCap,
          lineJoin: ROUTE_STYLE.lineJoin,
          className: 'route-glow',
        }}
      />
    </>
  );
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
