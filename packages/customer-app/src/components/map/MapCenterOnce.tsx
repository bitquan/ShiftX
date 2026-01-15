import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

interface LatLng {
  lat: number;
  lng: number;
}

interface MapCenterOnceProps {
  center: LatLng;
  centerKey: string;
  zoom?: number;
}

/**
 * Centers map exactly once per unique centerKey.
 * Used when there's no route to fit bounds to.
 */
export function MapCenterOnce({ center, centerKey, zoom = 13 }: MapCenterOnceProps) {
  const map = useMap();
  const lastCenterKeyRef = useRef<string>('');

  useEffect(() => {
    if (centerKey && centerKey !== lastCenterKeyRef.current) {
      map.setView([center.lat, center.lng], zoom);
      lastCenterKeyRef.current = centerKey;
    }
  }, [center, centerKey, zoom, map]);

  return null;
}
