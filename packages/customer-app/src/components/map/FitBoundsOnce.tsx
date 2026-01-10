import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLngBounds } from 'leaflet';

interface FitBoundsOnceProps {
  bounds: LatLngBounds | null;
  fitKey: string;
}

/**
 * Fits map bounds exactly once per unique fitKey.
 * Prevents infinite loops and Chrome freezes from repeated fitBounds calls.
 */
export function FitBoundsOnce({ bounds, fitKey }: FitBoundsOnceProps) {
  const map = useMap();
  const lastFitKeyRef = useRef<string>('');

  useEffect(() => {
    if (bounds && fitKey && fitKey !== lastFitKeyRef.current) {
      map.fitBounds(bounds, { padding: [50, 50] });
      lastFitKeyRef.current = fitKey;
    }
  }, [bounds, fitKey, map]);

  return null;
}
