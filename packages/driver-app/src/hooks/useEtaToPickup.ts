import { useState, useEffect, useRef } from 'react';
import { haversineDistance } from '../utils/haversine';

interface LatLng {
  lat: number;
  lng: number;
}

interface EtaResult {
  miles?: number;
  minutes?: number;
  loading: boolean;
  error?: string;
}

// Cache OSRM results to avoid repeated API calls
const etaCache = new Map<string, { miles: number; minutes: number }>();

/**
 * Hook to calculate ETA (miles + minutes) from driver location to pickup location.
 * Uses OSRM for accurate routing, falls back to Haversine + estimated speed if OSRM fails.
 */
export function useEtaToPickup(
  driverLat?: number | null,
  driverLng?: number | null,
  pickupLat?: number | null,
  pickupLng?: number | null
): { miles?: number; minutes?: number; loading: boolean; error?: string } {
  const [miles, setMiles] = useState<number | undefined>(undefined);
  const [minutes, setMinutes] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous requests
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset if missing coordinates
    if (
      !driverLat || !driverLng || !pickupLat || !pickupLng ||
      driverLat === null || driverLng === null || pickupLat === null || pickupLng === null
    ) {
      setMiles(undefined);
      setMinutes(undefined);
      setLoading(false);
      setError(undefined);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Fallback function using Haversine
    const useFallback = () => {
      const straightLineMiles = haversineDistance(driverLat, driverLng, pickupLat, pickupLng);
      const estimatedMinutes = Math.round((straightLineMiles / 25) * 60); // Assume 25 mph average
      
      if (!controller.signal.aborted) {
        setMiles(straightLineMiles);
        setMinutes(estimatedMinutes);
        setLoading(false);
        setError('Using straight-line estimate');
      }
    };

    const fetchRoute = async () => {
      setLoading(true);
      setError(undefined);

      try {
        // Try OSRM first
        const url = `https://router.project-osrm.org/route/v1/driving/${driverLng},${driverLat};${pickupLng},${pickupLat}?overview=false`;
        
        const response = await fetch(url, { signal: controller.signal });
        
        if (!response.ok) {
          throw new Error('OSRM request failed');
        }

        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distanceMeters = route.distance;
          const durationSeconds = route.duration;
          
          if (!controller.signal.aborted) {
            setMiles(distanceMeters / 1609.34); // meters to miles
            setMinutes(Math.ceil(durationSeconds / 60));
            setLoading(false);
          }
        } else {
          // No route found, use fallback
          useFallback();
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('OSRM ETA error:', err);
          useFallback();
        }
      }
    };

    // Debounce the request
    timeoutRef.current = setTimeout(() => {
      fetchRoute();
    }, 500);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [driverLat, driverLng, pickupLat, pickupLng]);

  return { miles, minutes, loading, error };
}
