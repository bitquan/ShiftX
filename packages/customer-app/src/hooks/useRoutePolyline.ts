import { useState, useEffect, useRef } from 'react';
import { fetchOsrmRoute } from '../lib/routing';

interface LatLng {
  lat: number;
  lng: number;
}

interface RoutePolylineResult {
  coords: [number, number][] | null;
  loading: boolean;
  error?: string;
  distanceMeters?: number;
}

export function useRoutePolyline(
  pickup?: LatLng | null,
  dropoff?: LatLng | null
): RoutePolylineResult {
  const [coords, setCoords] = useState<[number, number][] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [distanceMeters, setDistanceMeters] = useState<number | undefined>(undefined);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastKeyRef = useRef<string>('');

  useEffect(() => {
    if (!pickup || !dropoff) {
      setCoords(null);
      setLoading(false);
      setError(undefined);
      setDistanceMeters(undefined);
      lastKeyRef.current = '';
      return;
    }

    // Create stable key to prevent refetch on same coordinates
    const key = `${pickup.lat},${pickup.lng}-${dropoff.lat},${dropoff.lng}`;
    if (key === lastKeyRef.current) {
      return; // Already fetched this route
    }
    lastKeyRef.current = key;

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      setError(undefined);
      
      try {
        const route = await fetchOsrmRoute(pickup, dropoff);
        
        if (!controller.signal.aborted) {
          console.log('OSRM route points', route.latlngs.length);
          setCoords(route.latlngs);
          setDistanceMeters(route.distanceMeters);
          setLoading(false);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('OSRM route failed', err);
          setError(err instanceof Error ? err.message : 'Route fetch failed');
          setDistanceMeters(undefined);
          // Fallback to straight line
          const straightLine: [number, number][] = [
            [pickup.lat, pickup.lng],
            [dropoff.lat, dropoff.lng],
          ];
          setCoords(straightLine);
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [pickup, dropoff]);

  return { coords, loading, error, distanceMeters };
}
