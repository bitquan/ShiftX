/**
 * Phase 4G: Driver Route Polylines Hook
 * 
 * Manages two-leg routing for active offers/rides:
 * - Leg A: driver → pickup (bright/primary)
 * - Leg B: pickup → dropoff (dim/dashed preview)
 * 
 * Features:
 * - Throttled updates (3-5s + 10m distance threshold)
 * - Automatic leg switching based on ride state
 * - Camera fit bounds (once per state change)
 */

import { useState, useEffect, useRef } from 'react';
import { fetchOsrmRoute } from '../lib/routing';
import { logEvent } from '../utils/eventLog';

interface LatLng {
  lat: number;
  lng: number;
}

export interface DriverRoutesResult {
  // Leg A: driver → pickup (or driver → dropoff if no pickup)
  legA: [number, number][] | null;
  // Leg B: pickup → dropoff (preview)
  legB: [number, number][] | null;
  // Combined for camera bounds
  allCoords: [number, number][] | null;
  // Loading states
  loading: boolean;
  error?: string;
  // Distance info
  legADistanceMeters?: number;
  legBDistanceMeters?: number;
  // State tracking
  activeLeg: 'A' | 'B' | null;
}

interface UseDriverRoutesOptions {
  /**
   * Current driver location
   */
  driverLocation: LatLng | null;
  /**
   * Pickup location
   */
  pickup: LatLng | null;
  /**
   * Dropoff location
   */
  dropoff: LatLng | null;
  /**
   * Current ride state - determines active leg
   * - 'accepted'/'started': leg A active (driver → pickup)
   * - 'in_progress': leg B active (pickup → dropoff)
   */
  rideStatus: 'accepted' | 'started' | 'in_progress' | null;
  /**
   * Minimum distance (meters) driver must move before refetching leg A
   * Default: 10m
   */
  updateThresholdMeters?: number;
  /**
   * Minimum time (ms) between route updates
   * Default: 3000ms (3 seconds)
   */
  throttleMs?: number;
}

/**
 * Calculate Haversine distance in meters
 */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useDriverRoutes({
  driverLocation,
  pickup,
  dropoff,
  rideStatus,
  updateThresholdMeters = 10,
  throttleMs = 3000,
}: UseDriverRoutesOptions): DriverRoutesResult {
  const [legA, setLegA] = useState<[number, number][] | null>(null);
  const [legB, setLegB] = useState<[number, number][] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [legADistanceMeters, setLegADistanceMeters] = useState<number | undefined>(undefined);
  const [legBDistanceMeters, setLegBDistanceMeters] = useState<number | undefined>(undefined);

  const lastDriverLocationRef = useRef<LatLng | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Determine active leg based on ride status
  const activeLeg: 'A' | 'B' | null = !rideStatus
    ? null
    : rideStatus === 'in_progress'
    ? 'B'
    : 'A';

  // Clear routes when no active ride
  useEffect(() => {
    if (!rideStatus) {
      setLegA(null);
      setLegB(null);
      setLegADistanceMeters(undefined);
      setLegBDistanceMeters(undefined);
      lastDriverLocationRef.current = null;
      console.log('[useDriverRoutes] Ride ended, clearing all routes');
    }
  }, [rideStatus]);

  // Effect: Fetch Leg B (pickup → dropoff) - only when pickup/dropoff change
  useEffect(() => {
    if (!pickup || !dropoff) {
      setLegB(null);
      setLegBDistanceMeters(undefined);
      return;
    }

    const fetchLegB = async () => {
      try {
        const route = await fetchOsrmRoute(pickup, dropoff);
        setLegB(route.latlngs);
        setLegBDistanceMeters(route.distanceMeters);
        logEvent('navigation', 'Route polyline set (pickup→dropoff preview)', {
          pickup,
          dropoff,
          distance: route.distanceMeters,
          duration: route.durationSeconds,
        });
      } catch (err) {
        console.warn('[useDriverRoutes] Leg B route failed, using straight line:', err);
        const straightLine: [number, number][] = [
          [pickup.lat, pickup.lng],
          [dropoff.lat, dropoff.lng],
        ];
        setLegB(straightLine);
        setLegBDistanceMeters(undefined);
      }
    };

    fetchLegB();
  }, [pickup, dropoff]);

  // Effect: Fetch Leg A (driver → destination) with throttling
  useEffect(() => {
    // Determine destination for leg A
    const destination = rideStatus === 'in_progress' ? dropoff : pickup;

    if (!driverLocation || !destination) {
      setLegA(null);
      setLegADistanceMeters(undefined);
      lastDriverLocationRef.current = null;
      return;
    }

    // Check if driver moved enough to trigger update
    const lastLocation = lastDriverLocationRef.current;
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

    if (lastLocation) {
      const distanceMoved = distanceMeters(
        lastLocation.lat,
        lastLocation.lng,
        driverLocation.lat,
        driverLocation.lng
      );

      // Skip update if driver hasn't moved enough OR not enough time elapsed
      if (distanceMoved < updateThresholdMeters || timeSinceLastUpdate < throttleMs) {
        console.log(
          `[useDriverRoutes] Skipping leg A update: moved ${distanceMoved.toFixed(1)}m, elapsed ${timeSinceLastUpdate}ms`
        );
        return;
      }
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchLegA = async () => {
      setLoading(true);
      setError(undefined);

      try {
        const route = await fetchOsrmRoute(driverLocation, destination);

        if (!controller.signal.aborted) {
          setLegA(route.latlngs);
          setLegADistanceMeters(route.distanceMeters);
          setLoading(false);

          // Update refs
          lastDriverLocationRef.current = driverLocation;
          lastUpdateTimeRef.current = Date.now();

          const destinationType = rideStatus === 'in_progress' ? 'dropoff' : 'pickup';
          logEvent('navigation', `Route polyline set (driver→${destinationType})`, {
            driverLocation,
            destination,
            destinationType,
            distance: route.distanceMeters,
            duration: route.durationSeconds,
          });

          console.log(
            `[useDriverRoutes] Leg A updated: ${route.distanceMeters.toFixed(0)}m, ${route.durationSeconds.toFixed(0)}s`
          );
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.warn('[useDriverRoutes] Leg A route failed, using straight line:', err);
          const straightLine: [number, number][] = [
            [driverLocation.lat, driverLocation.lng],
            [destination.lat, destination.lng],
          ];
          setLegA(straightLine);
          setLegADistanceMeters(undefined);
          setError(err instanceof Error ? err.message : 'Route fetch failed');
          setLoading(false);

          // Update refs even on error
          lastDriverLocationRef.current = driverLocation;
          lastUpdateTimeRef.current = Date.now();
        }
      }
    };

    fetchLegA();

    return () => {
      controller.abort();
    };
  }, [driverLocation, pickup, dropoff, rideStatus, updateThresholdMeters, throttleMs]);

  // Log leg switching
  useEffect(() => {
    if (activeLeg === 'B' && rideStatus === 'in_progress') {
      logEvent('navigation', 'Route switched (pickup→dropoff)', {
        pickup,
        dropoff,
      });
      console.log('[useDriverRoutes] Switched to leg B: pickup → dropoff');
    }
  }, [activeLeg, rideStatus]);

  // Combine all coords for camera bounds
  const allCoords = (() => {
    if (!legA && !legB) return null;
    const combined: [number, number][] = [];
    if (legA) combined.push(...legA);
    if (legB) combined.push(...legB);
    return combined.length > 0 ? combined : null;
  })();

  return {
    legA,
    legB,
    allCoords,
    loading,
    error,
    legADistanceMeters,
    legBDistanceMeters,
    activeLeg,
  };
}
