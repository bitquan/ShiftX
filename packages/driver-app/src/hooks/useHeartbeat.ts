import { useEffect, useRef, useState, useCallback } from 'react';
import { driverHeartbeat } from '@shiftx/driver-client';

// Calculate distance between two points in meters (Haversine formula)
function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function geoErrorToMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) return 'Permission denied';
  if (err.code === err.POSITION_UNAVAILABLE) return 'Unavailable';
  if (err.code === err.TIMEOUT) return 'Timeout';
  return 'Unknown error';
}

interface HeartbeatResult {
  currentLocation: { lat: number; lng: number } | null;
  gpsError: string | null;
  lastFixAtMs: number | null;
  retryGps: () => void;
}

export function useHeartbeat(enabled: boolean, interval: number = 5000): HeartbeatResult {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const sessionIdRef = useRef(0); // Race condition protection
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lastFixAtMs, setLastFixAtMs] = useState<number | null>(null);
  const [retryCounter, setRetryCounter] = useState(0); // Force effect re-run
  const lastSentLocationRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);

  useEffect(() => {
    if (!enabled) {
      // TELEMETRY: Going offline
      console.log('[useHeartbeat] Stopping: enabled=false');
      
      // Cleanup heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
        console.log('[useHeartbeat] Heartbeat interval cleared');
      }
      
      // Cleanup GPS watch
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
        console.log('[useHeartbeat] GPS watcher cleared');
      }
      
      // Increment session to invalidate stale callbacks
      sessionIdRef.current++;
      
      // Reset state
      setCurrentLocation(null);
      setGpsError(null);
      lastSentLocationRef.current = null;
      return;
    }

    // Check if geolocation is available
    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation not supported');
      console.error('[useHeartbeat] Geolocation not supported');
      return;
    }

    // TELEMETRY: Starting
    const currentSession = ++sessionIdRef.current;
    console.log(`[useHeartbeat] Starting session ${currentSession}`);

    // Track whether we got initial position
    let hasInitialPosition = false;

    const onPosition = (position: GeolocationPosition, session: number) => {
      // Ignore stale callbacks
      if (session !== sessionIdRef.current) {
        console.log(`[useHeartbeat] Ignoring stale position callback (session ${session} vs ${sessionIdRef.current})`);
        return;
      }

      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      
      if (!hasInitialPosition) {
        console.log(`[useHeartbeat] Initial position acquired:`, location);
        hasInitialPosition = true;
      }
      
      setCurrentLocation(location);
      setGpsError(null);
      setLastFixAtMs(Date.now());
      
      // Throttle: send if moved > 20m OR 5s elapsed
      const now = Date.now();
      const lastSent = lastSentLocationRef.current;
      
      if (!lastSent) {
        // First location, send immediately
        console.log('[useHeartbeat] Sending first heartbeat');
        driverHeartbeat(location).catch((err) => console.error('[useHeartbeat] Heartbeat failed:', err));
        lastSentLocationRef.current = { ...location, timestamp: now };
      } else {
        const distance = getDistanceMeters(lastSent.lat, lastSent.lng, location.lat, location.lng);
        const elapsed = now - lastSent.timestamp;
        
        // Send if moved > 20m OR 5s elapsed
        if (distance > 20 || elapsed >= 5000) {
          console.log(`[useHeartbeat] Sending heartbeat (moved ${distance.toFixed(1)}m, elapsed ${elapsed}ms)`);
          driverHeartbeat(location).catch((err) => console.error('[useHeartbeat] Heartbeat failed:', err));
          lastSentLocationRef.current = { ...location, timestamp: now };
        }
      }
    };

    const startWatchPosition = (session: number) => {
      if (watchIdRef.current !== null) {
        console.warn('[useHeartbeat] watchPosition already running, clearing first');
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      console.log('[useHeartbeat] Starting watchPosition');
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => onPosition(pos, session),
        (err) => {
          console.error('[useHeartbeat] watchPosition error:', geoErrorToMessage(err), err);
          if (session === sessionIdRef.current) {
            setGpsError(geoErrorToMessage(err));
            // Stop watching on persistent errors
            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(watchIdRef.current);
              watchIdRef.current = null;
              console.log('[useHeartbeat] GPS watcher stopped due to error');
            }
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 5000,
        }
      );
    };

    // Acquire initial position with retry logic
    const acquireInitialPosition = async () => {
      console.log('[useHeartbeat] Acquiring initial position (low accuracy)...');
      
      try {
        // Try 1: Low accuracy, fast
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
              enableHighAccuracy: false,
              timeout: 8000,
              maximumAge: 60000,
            }
          );
        });
        
        console.log('[useHeartbeat] Initial position acquired (low accuracy)');
        onPosition(pos, currentSession);
        hasInitialPosition = true;
        startWatchPosition(currentSession);
        return;
      } catch (err) {
        const geoErr = err as GeolocationPositionError;
        console.warn('[useHeartbeat] Low accuracy failed:', geoErrorToMessage(geoErr));
        
        // Try 2: High accuracy if timeout
        if (geoErr.code === 3) {
          console.log('[useHeartbeat] Retrying with high accuracy...');
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                {
                  enableHighAccuracy: true,
                  timeout: 20000,
                  maximumAge: 0,
                }
              );
            });
            
            console.log('[useHeartbeat] Initial position acquired (high accuracy)');
            onPosition(pos, currentSession);
            hasInitialPosition = true;
            startWatchPosition(currentSession);
            return;
          } catch (err2) {
            const geoErr2 = err2 as GeolocationPositionError;
            console.error('[useHeartbeat] High accuracy also failed:', geoErrorToMessage(geoErr2));
            setGpsError(geoErrorToMessage(geoErr2));
            // Start watching anyway, it might succeed
            startWatchPosition(currentSession);
            return;
          }
        } else {
          // Permission denied or unavailable - don't retry
          console.error('[useHeartbeat] Cannot acquire position:', geoErrorToMessage(geoErr));
          setGpsError(geoErrorToMessage(geoErr));
          return;
        }
      }
    };

    acquireInitialPosition();

    // Fallback heartbeat interval
    console.log('[useHeartbeat] Starting heartbeat interval');
    heartbeatRef.current = setInterval(() => {
      // Only send if we haven't sent recently (avoid double-sending)
      const lastSent = lastSentLocationRef.current;
      if (!lastSent || (Date.now() - lastSent.timestamp) >= interval) {
        const loc = currentLocation;
        if (loc) {
          console.log('[useHeartbeat] Sending interval heartbeat');
          driverHeartbeat(loc).catch((err) => console.error('[useHeartbeat] Heartbeat failed:', err));
          lastSentLocationRef.current = { ...loc, timestamp: Date.now() };
        } else {
          console.log('[useHeartbeat] Skipping interval heartbeat (no location yet)');
        }
      }
    }, interval);

    return () => {
      console.log(`[useHeartbeat] Cleanup for session ${currentSession}`);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, interval, retryCounter]);

  // Retry GPS function
  const retryGps = useCallback(() => {
    console.log('[useHeartbeat] Manual GPS retry triggered');
    setGpsError(null);
    setRetryCounter(prev => prev + 1); // Trigger effect to restart GPS
  }, []);

  return { currentLocation, gpsError, lastFixAtMs, retryGps };
}
