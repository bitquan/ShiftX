import { Polyline } from 'react-leaflet';

interface RouteLineProps {
  coords: [number, number][] | null;
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
export function RouteLine({ coords }: RouteLineProps) {
  if (!coords || coords.length === 0) {
    return null;
  }

  return (
    <>
      {/* Glow layer */}
      <Polyline
        positions={coords}
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
        positions={coords}
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
