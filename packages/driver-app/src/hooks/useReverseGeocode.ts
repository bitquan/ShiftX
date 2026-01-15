import { useState, useEffect, useRef } from 'react';

interface ReverseGeocodeResult {
  label: string;
  loading: boolean;
  error?: string;
}

// Global cache to persist across component instances
const geocodeCache = new Map<string, string>();

/**
 * Hook to reverse geocode lat/lng coordinates to human-readable address.
 * Caches results and debounces requests to avoid spamming Mapbox API.
 */
export function useReverseGeocode(
  lat?: number | null,
  lng?: number | null
): ReverseGeocodeResult {
  const [label, setLabel] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear previous timeout and abort controller
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Reset if no coordinates
    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      setLabel('');
      setLoading(false);
      setError(undefined);
      return;
    }

    // Create cache key with 5 decimal precision (~1.1m accuracy)
    const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    
    // Check cache first
    const cached = geocodeCache.get(cacheKey);
    if (cached) {
      setLabel(cached);
      setLoading(false);
      setError(undefined);
      return;
    }

    // Fallback label
    const fallbackLabel = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    // Debounce request
    timeoutRef.current = setTimeout(async () => {
      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      if (!token) {
        setLabel(fallbackLabel);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(undefined);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const endpoint = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
        const url = `${endpoint}/${lng},${lat}.json?access_token=${token}&types=address,place,poi&limit=1`;
        
        const response = await fetch(url, { signal: controller.signal });
        
        if (!response.ok) {
          throw new Error(`Geocoding failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          const placeName = data.features[0].place_name || fallbackLabel;
          geocodeCache.set(cacheKey, placeName);
          if (!controller.signal.aborted) {
            setLabel(placeName);
            setLoading(false);
          }
        } else {
          // No results, use fallback
          geocodeCache.set(cacheKey, fallbackLabel);
          if (!controller.signal.aborted) {
            setLabel(fallbackLabel);
            setLoading(false);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Reverse geocode error:', err);
          setError(err instanceof Error ? err.message : 'Geocoding failed');
          setLabel(fallbackLabel);
          // Cache the fallback on error to avoid repeated failures
          geocodeCache.set(cacheKey, fallbackLabel);
          setLoading(false);
        }
      }
    }, 300); // 300ms debounce

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [lat, lng]);

  return { label, loading, error };
}
