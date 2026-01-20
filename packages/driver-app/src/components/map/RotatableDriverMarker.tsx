import { useEffect, useRef } from 'react';
import { Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

interface RotatableDriverMarkerProps {
  position: [number, number];
  heading?: number; // 0 = north, 90 = east, 180 = south, 270 = west
}

/**
 * Phase 3E: Rotatable driver marker with smooth transitions
 * 
 * Features:
 * - Rotates car icon based on GPS heading
 * - Smooth rotation transitions
 * - Maintains visibility and shadow
 */
export function RotatableDriverMarker({ position, heading }: RotatableDriverMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const map = useMap();

  // Create rotatable icon
  const createRotatedIcon = (rotation: number = 0) => {
    return L.divIcon({
      className: '',
      html: `
        <div style="
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.3s ease-out;
          transform: rotate(${rotation}deg);
        ">
          <div style="
            width: 34px;
            height: 34px;
            border-radius: 999px;
            background: rgba(255,255,255,0.95);
            box-shadow: 0 6px 16px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid rgba(0,0,0,0.15);
          ">
            <div style="font-size:18px; line-height:18px;">🚗</div>
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  };

  // Update icon rotation when heading changes
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const rotation = heading !== undefined ? heading : 0;
    const icon = createRotatedIcon(rotation);
    marker.setIcon(icon);
  }, [heading]);

  return (
    <Marker
      position={position}
      icon={createRotatedIcon(heading)}
      ref={markerRef}
    />
  );
}
