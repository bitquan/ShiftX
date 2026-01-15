import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getInitializedClient } from '@shiftx/driver-client';
import { calculateDriverEarnings } from '../utils/earnings';

interface RateCard {
  baseFareCents: number;
  perMileCents: number;
  perMinuteCents: number;
  minimumFareCents: number;
}

interface DriverRates {
  shiftx?: RateCard;
  shift_lx?: RateCard;
  shift_black?: RateCard;
}

interface UseDriverEarningsResult {
  estimatedEarnings: number | null;
  serviceClass: 'shiftx' | 'shift_lx' | 'shift_black' | null;
  loading: boolean;
}

/**
 * Hook to calculate driver earnings for a ride offer.
 * Loads driver's current rate card and applies to the trip distance/time.
 * 
 * @param driverId Driver's UID
 * @param rideServiceClass Service class from the ride offer
 * @param distanceMeters Route distance in meters (from OSRM)
 * @param durationSeconds Route duration in seconds (from OSRM)
 * @returns Estimated earnings in cents
 */
export function useDriverEarnings(
  driverId: string | null,
  rideServiceClass: 'shiftx' | 'shift_lx' | 'shift_black' | undefined,
  distanceMeters: number | null,
  durationSeconds: number | null
): UseDriverEarningsResult {
  const [rates, setRates] = useState<DriverRates | null>(null);
  const [vehicleClass, setVehicleClass] = useState<'shiftx' | 'shift_lx' | 'shift_black' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) {
      setLoading(false);
      return;
    }

    const loadDriverRates = async () => {
      try {
        const { firestore } = getInitializedClient();
        const docRef = doc(firestore, 'drivers', driverId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setRates(data.rates || null);
          setVehicleClass(data.vehicleClass || 'shiftx');
        }
      } catch (error) {
        console.error('[useDriverEarnings] Failed to load rates:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDriverRates();
  }, [driverId]);

  // Calculate earnings based on ride service class and driver's rates
  const estimatedEarnings = calculateDriverEarnings(
    distanceMeters,
    durationSeconds,
    (rideServiceClass && rates?.[rideServiceClass]) || null
  );

  return {
    estimatedEarnings,
    serviceClass: vehicleClass,
    loading,
  };
}
