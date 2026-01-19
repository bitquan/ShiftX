import { ReactNode } from 'react';
import './mapShell.css';

interface MapShellProps {
  map: ReactNode;
  topLeft?: ReactNode;
  topCenter?: ReactNode;
  topRight?: ReactNode;
  rightStack?: ReactNode;
  bottomPanel?: ReactNode;
  bottomNav?: ReactNode;
}

/**
 * MapShell - Full-screen map with floating UI overlay (Driver App)
 * 
 * Layout structure:
 * - Map layer fills entire screen (z-index: 0, pointer-events: auto)
 * - UI layer overlays map (z-index: 10+, pointer-events: none by default)
 * - Interactive elements have pointer-events: auto
 * - Respects safe-area insets
 * 
 * Phase 1: Simple overlays, no draggable sheets yet
 */
export function MapShell({ 
  map, 
  topLeft,
  topCenter,
  topRight, 
  rightStack,
  bottomPanel,
  bottomNav
}: MapShellProps) {
  return (
    <div className="map-shell">
      {/* Map fills entire screen - always in background, interactable */}
      <div className="map-layer">
        {map}
      </div>

      {/* UI overlay - floating elements */}
      <div className="ui-layer">
        {/* Top left (menu button) */}
        {topLeft && (
          <div className="ui-top-left">
            {topLeft}
          </div>
        )}

        {/* Top center (env badge) */}
        {topCenter && (
          <div className="ui-top-center">
            {topCenter}
          </div>
        )}

        {/* Top right (badges, diagnostics) */}
        {topRight && (
          <div className="ui-top-right">
            {topRight}
          </div>
        )}

        {/* Right side vertical stack (locate, zoom controls) */}
        {rightStack && (
          <div className="ui-right-stack">
            {rightStack}
          </div>
        )}

        {/* Bottom panel (fixed status card for now) */}
        {bottomPanel && (
          <div className="ui-bottom-panel">
            {bottomPanel}
          </div>
        )}

        {/* Bottom navigation */}
        {bottomNav && (
          <div className="ui-bottom-nav">
            {bottomNav}
          </div>
        )}
      </div>
    </div>
  );
}
