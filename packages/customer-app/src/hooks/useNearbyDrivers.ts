import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { haversineDistance } from '../lib/distance';

export type VehicleClass = 'shiftx' | 'shift_lx' | 'shift_black';

export interface DriverRate {
  baseFareCents: number;
  perMileCents: number;
  perMinuteCents: number;
  minimumFareCents: number;
}

export interface Driver {
  id: string;
  vehicleClass: VehicleClass;
  location?: { lat: number; lng: number };
  rates?: {
    shiftx?: DriverRate;
    shift_lx?: DriverRate;
    shift_black?: DriverRate;
  };
  isOnline?: boolean;
}

interface NearbyDriversResult {
  drivers: Driver[];
  availableClasses: VehicleClass[];
  countsByClass: { shiftx: number; shift_lx: number; shift_black: number };
  loading: boolean;
  error?: string;
}

const NEARBY_RADIUS_MILES = 10;
const STALE_THRESHOLD_MS = 60 * 1000; // 60 seconds

/**
 * Hook to fetch nearby online drivers and determine available vehicle classes
 */
export function useNearbyDrivers(
  pickupLat?: number | null,
  pickupLng?: number | null
): NearbyDriversResult {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (pickupLat === undefined || pickupLat === null || pickupLng === undefined || pickupLng === null) {
      setDrivers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const q = query(
        collection(db, 'drivers'),
        where('isOnline', '==', true)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const allDrivers: Driver[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Driver[];

          // Filter to nearby drivers only (and not stale)
          const now = Date.now();
          const nearbyDrivers = allDrivers.filter((driver) => {
            if (!driver.location) return false;
            
            // Check if location is stale (last heartbeat too old)
            const lastHeartbeat = (driver as any).lastHeartbeatMs || 0;
            if (now - lastHeartbeat > STALE_THRESHOLD_MS) return false;
            
            const distance = haversineDistance(
              pickupLat,
              pickupLng,
              driver.location.lat,
              driver.location.lng
            );
            return distance <= NEARBY_RADIUS_MILES;
          });

          setDrivers(nearbyDrivers);
          setLoading(false);
        },
        (err) => {
          console.error('Error fetching drivers:', err);
          setError(err instanceof Error ? err.message : 'Failed to fetch drivers');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Setup error:', err);
      setError(err instanceof Error ? err.message : 'Setup error');
      setLoading(false);
    }
  }, [pickupLat, pickupLng]);

  // Determine available vehicle classes based on driver capabilities
  // Rules:
  // - ShiftX driver: offers only ShiftX
  // - Shift LX driver: offers ShiftX + Shift LX
  // - Shift Black driver: offers all three (ShiftX + Shift LX + Shift Black)
  const availableClasses: VehicleClass[] = Array.from(
    new Set(
      drivers.flatMap((d): VehicleClass[] => {
        if (!d.vehicleClass) return [];
        if (d.vehicleClass === 'shift_black') return ['shiftx', 'shift_lx', 'shift_black'];
        if (d.vehicleClass === 'shift_lx') return ['shiftx', 'shift_lx'];
        return ['shiftx'];
      })
    )
  ).sort((a, b) => {
    // Always prefer shiftx first, then shift_lx, then shift_black
    const order: Record<VehicleClass, number> = { shiftx: 0, shift_lx: 1, shift_black: 2 };
    return order[a] - order[b];
  });

  // Count drivers per service class
  const countsByClass = {
    shiftx: drivers.filter(d => d.vehicleClass).length, // All drivers serve ShiftX
    shift_lx: drivers.filter(d => ['shift_lx', 'shift_black'].includes(d.vehicleClass || '')).length,
    shift_black: drivers.filter(d => d.vehicleClass === 'shift_black').length,
  };

  return { drivers, availableClasses, countsByClass, loading, error };
}
