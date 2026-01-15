/**
 * Calculate estimated driver earnings based on custom rate card.
 * Uses OSRM route distance + time to compute fare.
 * 
 * @param distanceMeters Distance from OSRM route in meters
 * @param durationSeconds Duration from OSRM route in seconds
 * @param rates Driver's rate card for the service class
 * @returns Estimated earnings in cents
 */
export function calculateDriverEarnings(
  distanceMeters: number | null,
  durationSeconds: number | null,
  rates: {
    baseFareCents: number;
    perMileCents: number;
    perMinuteCents: number;
    minimumFareCents: number;
  } | null
): number | null {
  if (!distanceMeters || !durationSeconds || !rates) {
    return null;
  }

  const miles = distanceMeters / 1609.34;
  const minutes = durationSeconds / 60;

  const baseFare = rates.baseFareCents;
  const distanceFare = miles * rates.perMileCents;
  const timeFare = minutes * rates.perMinuteCents;

  const totalFare = baseFare + distanceFare + timeFare;
  const finalFare = Math.max(totalFare, rates.minimumFareCents);

  return Math.round(finalFare);
}
