import { useEffect, useRef, useState } from 'react';

interface Location {
  lat: number;
  lng: number;
  heading?: number; // degrees, 0 = north, 90 = east
}

interface SmoothLocationOptions {
  // Minimum distance to consider a real move (filters GPS jitter)
  minDistanceMeters?: number;
  // Animation duration for smooth transitions (ms)
  transitionDuration?: number;
  // How often to update during transition (ms)
  updateInterval?: number;
}

/**
 * Phase 3E: Smooth location updates with noise filtering
 * 
 * Features:
 * - Filters out GPS jitter (< minDistance)
 * - Smoothly interpolates between positions
 * - Preserves heading for rotation
 * - Avoids jumpy marker movement
 */
export function useSmoothLocation(
  rawLocation: Location | null,
  options: SmoothLocationOptions = {}
): Location | null {
  const {
    minDistanceMeters = 5, // Ignore moves < 5m (GPS noise)
    transitionDuration = 800, // 800ms smooth transition
    updateInterval = 16, // ~60fps
  } = options;

  const [smoothLocation, setSmoothLocation] = useState<Location | null>(null);
  const lastValidLocationRef = useRef<Location | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startLocationRef = useRef<Location | null>(null);
  const targetLocationRef = useRef<Location | null>(null);

  // Calculate distance between two points (Haversine formula)
  const getDistance = (from: Location, to: Location): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (from.lat * Math.PI) / 180;
    const φ2 = (to.lat * Math.PI) / 180;
    const Δφ = ((to.lat - from.lat) * Math.PI) / 180;
    const Δλ = ((to.lng - from.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Linear interpolation
  const lerp = (start: number, end: number, t: number): number => {
    return start + (end - start) * t;
  };

  // Ease-out cubic for smooth deceleration
  const easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  };

  useEffect(() => {
    if (!rawLocation) {
      setSmoothLocation(null);
      lastValidLocationRef.current = null;
      return;
    }

    // First location - set immediately, no animation
    if (!lastValidLocationRef.current) {
      console.log('[useSmoothLocation] Initial location set');
      lastValidLocationRef.current = rawLocation;
      setSmoothLocation(rawLocation);
      return;
    }

    // Check if location changed significantly
    const distance = getDistance(lastValidLocationRef.current, rawLocation);

    if (distance < minDistanceMeters) {
      // GPS noise - ignore this update, but keep heading if it changed significantly
      const headingChanged = rawLocation.heading !== undefined &&
        lastValidLocationRef.current.heading !== undefined &&
        Math.abs(rawLocation.heading - lastValidLocationRef.current.heading) > 10;

      if (headingChanged) {
        // Update heading only
        const updated = {
          ...lastValidLocationRef.current,
          heading: rawLocation.heading,
        };
        lastValidLocationRef.current = updated;
        setSmoothLocation(updated);
      }
      return;
    }

    // Significant move - start animation
    console.log(`[useSmoothLocation] Moving ${distance.toFixed(1)}m - animating`);

    // Cancel previous animation
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Set up animation
    startTimeRef.current = Date.now();
    startLocationRef.current = lastValidLocationRef.current;
    targetLocationRef.current = rawLocation;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - (startTimeRef.current || now);
      const progress = Math.min(elapsed / transitionDuration, 1);
      const easedProgress = easeOutCubic(progress);

      const start = startLocationRef.current!;
      const target = targetLocationRef.current!;

      const interpolated: Location = {
        lat: lerp(start.lat, target.lat, easedProgress),
        lng: lerp(start.lng, target.lng, easedProgress),
        heading: target.heading, // Use target heading immediately for rotation
      };

      setSmoothLocation(interpolated);

      if (progress < 1) {
        // Continue animation
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        lastValidLocationRef.current = target;
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [rawLocation, minDistanceMeters, transitionDuration]);

  return smoothLocation;
}
