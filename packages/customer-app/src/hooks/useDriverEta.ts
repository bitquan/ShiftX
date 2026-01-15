import { useState, useEffect } from 'react';

interface Coords {
  lat: number;
  lng: number;
}

export function useDriverEta(
  driverLocation: Coords | null | undefined,
  pickupLocation: Coords | null | undefined
) {
  const [eta, setEta] = useState<{
    minutes: number | null;
    miles: number | null;
    loading: boolean;
  }>({ minutes: null, miles: null, loading: false });

  useEffect(() => {
    if (!driverLocation || !pickupLocation) {
      setEta({ minutes: null, miles: null, loading: false });
      return;
    }

    let cancelled = false;
    setEta(prev => ({ ...prev, loading: true }));

    const calculateEta = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${driverLocation.lng},${driverLocation.lat};${pickupLocation.lng},${pickupLocation.lat}?overview=false`;
        
        const response = await fetch(url);
        if (cancelled) return;
        
        if (!response.ok) {
          throw new Error(`OSRM API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (cancelled) return;

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const durationSeconds = route.duration;
          const distanceMeters = route.distance;
          
          setEta({
            minutes: Math.ceil(durationSeconds / 60),
            miles: distanceMeters / 1609.34, // meters to miles
            loading: false,
          });
        } else {
          setEta({ minutes: null, miles: null, loading: false });
        }
      } catch (error) {
        console.error('Error calculating ETA:', error);
        if (!cancelled) {
          setEta({ minutes: null, miles: null, loading: false });
        }
      }
    };

    calculateEta();

    return () => {
      cancelled = true;
    };
  }, [
    driverLocation?.lat,
    driverLocation?.lng,
    pickupLocation?.lat,
    pickupLocation?.lng,
  ]);

  return eta;
}
