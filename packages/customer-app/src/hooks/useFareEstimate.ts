import { useMemo } from 'react';
import { Driver, VehicleClass, DriverRate } from './useNearbyDrivers';

export interface FareEstimate {
  estimatedCents: number;
  minimumCents: number;
  baseCents: number;
  durationCents: number;
  distanceCents: number;
}

/**
 * Default rates when no drivers are available
 */
const DEFAULT_RATES: Record<VehicleClass, DriverRate> = {
  shiftx: {
    baseFareCents: 150,
    perMileCents: 125,
    perMinuteCents: 25,
    minimumFareCents: 500,
  },
  shift_lx: {
    baseFareCents: 200,
    perMileCents: 175,
    perMinuteCents: 35,
    minimumFareCents: 750,
  },
  shift_black: {
    baseFareCents: 300,
    perMileCents: 250,
    perMinuteCents: 50,
    minimumFareCents: 1200,
  },
};

/**
 * Get the best available rate for a vehicle class
 * (lowest price among drivers offering that class)
 */
function getBestRate(drivers: Driver[], vehicleClass: VehicleClass): DriverRate {
  // Find drivers that have rates for this vehicle class
  const driversWithClass = drivers.filter(
    (d) => d.rates?.[vehicleClass] !== undefined
  );

  if (driversWithClass.length === 0) {
    // No drivers offer this class, use default
    return DEFAULT_RATES[vehicleClass];
  }

  // Find the cheapest rate among actual drivers
  let bestRate = driversWithClass[0].rates![vehicleClass]!;
  for (let i = 1; i < driversWithClass.length; i++) {
    const driver = driversWithClass[i];
    const rate = driver.rates![vehicleClass]!;
    
    // Compare total estimated cost for a typical trip (10 mi, 15 min)
    const currentCost = bestRate.baseFareCents + (bestRate.perMileCents * 10) + (bestRate.perMinuteCents * 15);
    const newCost = rate.baseFareCents + (rate.perMileCents * 10) + (rate.perMinuteCents * 15);
    
    if (newCost < currentCost) {
      bestRate = rate;
    }
  }

  return bestRate;
}

/**
 * Calculate estimated fare for a service class
 */
export function useFareEstimate(
  vehicleClass: VehicleClass,
  distanceMeters?: number,
  durationSeconds?: number,
  drivers: Driver[] = []
): FareEstimate {
  return useMemo(() => {
    if (!distanceMeters || !durationSeconds) {
      return {
        estimatedCents: 0,
        minimumCents: 0,
        baseCents: 0,
        durationCents: 0,
        distanceCents: 0,
      };
    }

    const rate = getBestRate(drivers, vehicleClass);

    // Convert to miles and minutes
    const distanceMiles = distanceMeters / 1609.34;
    const durationMinutes = durationSeconds / 60;

    // Calculate fare components
    const baseCents = rate.baseFareCents;
    const distanceCents = Math.round(rate.perMileCents * distanceMiles);
    const durationCents = Math.round(rate.perMinuteCents * durationMinutes);

    // Total before minimum
    const subtotal = baseCents + distanceCents + durationCents;

    // Apply minimum
    const estimatedCents = Math.max(subtotal, rate.minimumFareCents);

    return {
      estimatedCents,
      minimumCents: rate.minimumFareCents,
      baseCents,
      distanceCents,
      durationCents,
    };
  }, [vehicleClass, distanceMeters, durationSeconds, drivers]);
}

/**
 * Format cents to currency string
 */
export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
