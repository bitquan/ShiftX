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
      console.log('[useRoutePolyline] No pickup or dropoff:', { pickup, dropoff });
      setCoords(null);
      setLoading(false);
      setError(undefined);
      setDistanceMeters(undefined);
      lastKeyRef.current = '';
      return;
    }

    // Create stable key to prevent refetch on same coordinates
    const key = `${pickup.lat},${pickup.lng}-${dropoff.lat},${dropoff.lng}`;
    console.log('[useRoutePolyline] Route key:', key);
    if (key === lastKeyRef.current) {
      console.log('[useRoutePolyline] Already fetched this route, skipping');
      return; // Already fetched this route
    }
    
    // DON'T set lastKeyRef yet - only after successful fetch

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timeoutId = setTimeout(async () => {
      console.log('[useRoutePolyline] Starting route fetch for:', pickup, '->', dropoff);
      setLoading(true);
      setError(undefined);
      
      try {
        const route = await fetchOsrmRoute(pickup, dropoff);
        
        if (!controller.signal.aborted) {
          console.log('[useRoutePolyline] OSRM route success:', route.latlngs.length, 'points');
          setCoords(route.latlngs);
          setDistanceMeters(route.distanceMeters);
          setLoading(false);
          // NOW set lastKeyRef after successful fetch
          lastKeyRef.current = key;
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('[useRoutePolyline] OSRM route failed:', err);
          setError(err instanceof Error ? err.message : 'Route fetch failed');
          setDistanceMeters(undefined);
          // Fallback to straight line
          const straightLine: [number, number][] = [
            [pickup.lat, pickup.lng],
            [dropoff.lat, dropoff.lng],
          ];
          console.log('[useRoutePolyline] Using straight line fallback');
          setCoords(straightLine);
          setLoading(false);
          // Set lastKeyRef even on error (with fallback coords)
          lastKeyRef.current = key;
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
