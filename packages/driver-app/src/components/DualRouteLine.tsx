/**
 * Phase 4G: Dual-Leg Route Line Component
 * 
 * Renders two route legs with different styling:
 * - Active leg: bright, solid (driver's current destination)
 * - Preview leg: dim, dashed (future destination)
 */

import { Polyline } from 'react-leaflet';

interface DualRouteLineProps {
  /**
   * Leg A coordinates (driver → pickup or driver → dropoff)
   */
  legA: [number, number][] | null;
  /**
   * Leg B coordinates (pickup → dropoff preview)
   */
  legB: [number, number][] | null;
  /**
   * Which leg is active ('A' = en route to pickup, 'B' = en route to dropoff)
   */
  activeLeg: 'A' | 'B' | null;
}

/**
 * Styling for active leg (bright, solid)
 */
const ACTIVE_STYLE = {
  color: '#3b82f6', // Bright blue
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
 * Styling for preview leg (dim, dashed)
 */
const PREVIEW_STYLE = {
  color: '#6b7280', // Gray
  glow: {
    weight: 10,
    opacity: 0.2,
  },
  core: {
    weight: 5,
    opacity: 0.6,
    dashArray: '10, 10' as '10, 10', // Dashed line
  },
  lineCap: 'round' as const,
  lineJoin: 'round' as const,
};

/**
 * Render a single route leg with glow effect
 */
function RouteLeg({
  coords,
  isActive,
}: {
  coords: [number, number][];
  isActive: boolean;
}) {
  const style = isActive ? ACTIVE_STYLE : PREVIEW_STYLE;

  return (
    <>
      {/* Glow layer */}
      <Polyline
        positions={coords}
        pathOptions={{
          color: style.color,
          weight: style.glow.weight,
          opacity: style.glow.opacity,
          lineCap: style.lineCap,
          lineJoin: style.lineJoin,
        }}
      />
      {/* Core line */}
      <Polyline
        positions={coords}
        pathOptions={{
          color: style.color,
          weight: style.core.weight,
          opacity: style.core.opacity,
          lineCap: style.lineCap,
          lineJoin: style.lineJoin,
          dashArray: isActive ? undefined : (style.core as any).dashArray,
        }}
      />
    </>
  );
}

/**
 * Phase 4G: Dual-leg route visualization
 * 
 * Shows driver's current route and preview of next segment.
 * Active leg is bright/solid, preview leg is dim/dashed.
 */
export function DualRouteLine({ legA, legB, activeLeg }: DualRouteLineProps) {
  if (!legA && !legB) return null;

  return (
    <>
      {/* Leg A: driver → pickup (or driver → dropoff if no leg B) */}
      {legA && legA.length > 1 && (
        <RouteLeg
          coords={legA}
          isActive={activeLeg === 'A' || !legB}
        />
      )}

      {/* Leg B: pickup → dropoff (preview) */}
      {legB && legB.length > 1 && (
        <RouteLeg
          coords={legB}
          isActive={activeLeg === 'B'}
        />
      )}
    </>
  );
}
