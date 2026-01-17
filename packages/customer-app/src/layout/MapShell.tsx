import { ReactNode } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import '../styles/mapShell.css';

interface MapShellProps {
  map: ReactNode;
  topRight?: ReactNode;
  bottomRight?: ReactNode;
  topBar?: ReactNode;
  panel?: ReactNode;
  bottomNav?: ReactNode;
  defaultSnap?: 'collapsed' | 'mid' | 'expanded';
}

/**
 * MapShell - Full-screen map with floating UI overlay
 * 
 * Layout structure:
 * - Map layer fills entire screen (z-index: 0, pointer-events: auto)
 * - UI layer overlays map (z-index: 10+, pointer-events: none by default)
 * - Interactive elements have pointer-events: auto
 * - Respects safe-area insets
 * - Bottom sheet is draggable with snap points
 */
export function MapShell({ 
  map, 
  topRight, 
  bottomRight,
  topBar, 
  panel, 
  bottomNav,
  defaultSnap = 'mid'
}: MapShellProps) {
  return (
    <div className="map-shell">
      {/* Map fills entire screen - always in background, interactable */}
      <div className="map-layer">
        {map}
      </div>

      {/* UI overlay - floating elements */}
      <div className="ui-layer">
        {/* Top bar (header if needed) */}
        {topBar && (
          <div className="ui-top">
            {topBar}
          </div>
        )}

        {/* Top right (badges) */}
        {topRight && (
          <div className="ui-top-right">
            {topRight}
          </div>
        )}

        {/* Bottom right (diagnostics) */}
        {bottomRight && (
          <div className="ui-bottom-right">
            {bottomRight}
          </div>
        )}

        {/* Bottom navigation */}
        {bottomNav && (
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 150, pointerEvents: 'auto' }}>
            {bottomNav}
          </div>
        )}
      </div>

      {/* Draggable bottom sheet */}
      {panel && (
        <BottomSheet defaultSnap={defaultSnap}>
          {panel}
        </BottomSheet>
      )}
    </div>
  );
}
