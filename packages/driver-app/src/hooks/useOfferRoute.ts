import { useState, useEffect } from 'react';
import { fetchOsrmRoute } from '../lib/routing';

interface LatLng {
  lat: number;
  lng: number;
}

interface UseOfferRouteResult {
  distanceMeters: number | null;
  durationSeconds: number | null;
  loading: boolean;
}

/**
 * Hook to fetch OSRM route data for a ride offer.
 * Used to calculate estimated earnings for the driver.
 * 
 * @param pickup Pickup location
 * @param dropoff Dropoff location
 * @returns Distance in meters and duration in seconds
 */
export function useOfferRoute(
  pickup: LatLng | null | undefined,
  dropoff: LatLng | null | undefined
): UseOfferRouteResult {
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pickup || !dropoff) {
      setDistanceMeters(null);
      setDurationSeconds(null);
      return;
    }

    const key = `${pickup.lat},${pickup.lng}-${dropoff.lat},${dropoff.lng}`;
    let isCancelled = false;

    const fetchRoute = async () => {
      setLoading(true);
      try {
        const route = await fetchOsrmRoute(pickup, dropoff);
        if (!isCancelled) {
          setDistanceMeters(route.distanceMeters);
          setDurationSeconds(route.durationSeconds);
        }
      } catch (error) {
        console.error('[useOfferRoute] Failed to fetch route:', error);
        if (!isCancelled) {
          setDistanceMeters(null);
          setDurationSeconds(null);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchRoute();

    return () => {
      isCancelled = true;
    };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  return { distanceMeters, durationSeconds, loading };
}
