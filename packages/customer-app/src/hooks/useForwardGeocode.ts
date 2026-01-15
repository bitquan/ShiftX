import { useState, useEffect, useRef } from 'react';

export interface GeoFeature {
  place_name: string;
  center: [number, number]; // [lng, lat]
  id?: string;
  relevance?: number;
}

interface ForwardGeocodeResult {
  results: GeoFeature[];
  loading: boolean;
  error?: string;
}

// Global cache to persist across component instances
const forwardGeocodeCache = new Map<string, GeoFeature[]>();

/**
 * Hook to forward geocode address queries to Mapbox suggestions.
 * Caches results and debounces requests to avoid spamming Mapbox API.
 */
export function useForwardGeocode(query: string | null | undefined): ForwardGeocodeResult {
  const [results, setResults] = useState<GeoFeature[]>([]);
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

    // Reset if no query or query is too short
    if (!query || query.trim().length < 3) {
      setResults([]);
      setLoading(false);
      setError(undefined);
      return;
    }

    const trimmedQuery = query.trim();

    // Check cache first
    const cached = forwardGeocodeCache.get(trimmedQuery);
    if (cached) {
      setResults(cached);
      setLoading(false);
      setError(undefined);
      return;
    }

    // Debounce request (300ms)
    timeoutRef.current = setTimeout(async () => {
      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      if (!token) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(undefined);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const endpoint = 'https://api.mapbox.com/geocoding/v5/mapbox.places';
        const encodedQuery = encodeURIComponent(trimmedQuery);
        const url = `${endpoint}/${encodedQuery}.json?access_token=${token}&autocomplete=true&limit=5&types=address,poi,place`;

        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok) {
          throw new Error(`Forward geocoding failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.features && Array.isArray(data.features)) {
          const features: GeoFeature[] = data.features.map((f: any) => ({
            place_name: f.place_name,
            center: f.center,
            id: f.id,
            relevance: f.relevance,
          }));

          forwardGeocodeCache.set(trimmedQuery, features);

          if (!controller.signal.aborted) {
            setResults(features);
            setLoading(false);
          }
        } else {
          // No results
          forwardGeocodeCache.set(trimmedQuery, []);
          if (!controller.signal.aborted) {
            setResults([]);
            setLoading(false);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Forward geocode error:', err);
          setError(err instanceof Error ? err.message : 'Geocoding failed');
          setResults([]);
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query]);

  return { results, loading, error };
}
