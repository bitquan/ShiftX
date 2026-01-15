export type LatLng = { lat: number; lng: number };

function getCurrentPositionP(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

export async function getBestEffortPosition(): Promise<{
  coords?: LatLng;
  source: "gps_low" | "gps_high" | "cache" | "none";
  error?: GeolocationPositionError;
}> {
  if (!("geolocation" in navigator)) {
    return { source: "none" };
  }

  // 1) Fast try (works more often on desktop)
  try {
    const pos = await getCurrentPositionP({
      enableHighAccuracy: false,
      timeout: 4000,
      maximumAge: 10 * 60 * 1000, // 10 min
    });
    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    localStorage.setItem("shiftx:lastLocation", JSON.stringify({ ...coords, ts: Date.now() }));
    return { coords, source: "gps_low" };
  } catch (e) {
    // fall through
  }

  // 2) Slower high accuracy try
  try {
    const pos = await getCurrentPositionP({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    });
    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    localStorage.setItem("shiftx:lastLocation", JSON.stringify({ ...coords, ts: Date.now() }));
    return { coords, source: "gps_high" };
  } catch (e) {
    const err = e as GeolocationPositionError;
    // 3) Cache fallback (only if fresh - within 24 hours)
    try {
      const cached = localStorage.getItem("shiftx:lastLocation");
      if (cached) {
        const parsed = JSON.parse(cached);
        const age = Date.now() - (parsed.ts || 0);
        if (age < 24 * 60 * 60 * 1000) { // 24 hours
          return { coords: { lat: parsed.lat, lng: parsed.lng }, source: "cache", error: err };
        }
      }
    } catch {
      // ignore
    }
    return { source: "none", error: err };
  }
}
