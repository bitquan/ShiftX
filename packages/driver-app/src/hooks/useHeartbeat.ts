import { useEffect, useRef, useState } from 'react';
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

export function useHeartbeat(enabled: boolean, interval: number = 5000) {
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const lastSentLocationRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Stop heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      // Stop GPS watch
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setCurrentLocation(null);
      lastSentLocationRef.current = null;
      return;
    }

    // Start GPS tracking
    if ('geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentLocation(location);
          
          // Throttle: send if moved > 20m OR 5s elapsed
          const now = Date.now();
          const lastSent = lastSentLocationRef.current;
          
          if (!lastSent) {
            // First location, send immediately
            driverHeartbeat(location).catch(console.error);
            lastSentLocationRef.current = { ...location, timestamp: now };
          } else {
            const distance = getDistanceMeters(lastSent.lat, lastSent.lng, location.lat, location.lng);
            const elapsed = now - lastSent.timestamp;
            
            // Send if moved > 20m OR 5s elapsed
            if (distance > 20 || elapsed >= 5000) {
              driverHeartbeat(location).catch(console.error);
              lastSentLocationRef.current = { ...location, timestamp: now };
            }
          }
        },
        (error) => {
          console.error('GPS error:', error);
          // Continue without location if permission denied or error
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        }
      );
    }

    // Fallback: send heartbeat without location every interval
    heartbeatRef.current = setInterval(() => {
      // Only send if we haven't sent recently (avoid double-sending)
      const lastSent = lastSentLocationRef.current;
      if (!lastSent || (Date.now() - lastSent.timestamp) >= interval) {
        driverHeartbeat(currentLocation || undefined).catch(console.error);
        if (currentLocation) {
          lastSentLocationRef.current = { ...currentLocation, timestamp: Date.now() };
        }
      }
    }, interval);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled, interval, currentLocation]);

  return currentLocation;
}
