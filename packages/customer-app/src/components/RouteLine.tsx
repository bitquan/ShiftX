import { Polyline } from 'react-leaflet';

interface RouteLineProps {
  coords: [number, number][] | null;
}

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
          color: '#60a5fa',
          weight: 10,
          opacity: 0.3,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {/* Core line */}
      <Polyline
        positions={coords}
        pathOptions={{
          color: '#60a5fa',
          weight: 6,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
          className: 'route-glow',
        }}
      />
    </>
  );
}
