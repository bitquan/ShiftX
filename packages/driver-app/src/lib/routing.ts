interface LatLng {
  lat: number;
  lng: number;
}

interface OsrmRoute {
  latlngs: [number, number][]; // Leaflet format: [lat, lng]
  distanceMeters: number;
  durationSeconds: number;
}

export async function fetchOsrmRoute(pickup: LatLng, dropoff: LatLng): Promise<OsrmRoute> {
  // OSRM wants lng,lat in URL
  const url = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`;
  
  console.log('[fetchOsrmRoute] Fetching route:', url);
  
  const response = await fetch(url);
  const data = await response.json();
  
  console.log('[fetchOsrmRoute] Response:', data.code, data.routes?.length || 0, 'routes');
  
  if (data.code !== 'Ok' || !data.routes?.[0]) {
    throw new Error(`OSRM error: ${data.code}`);
  }
  
  const route = data.routes[0];
  
  // Convert GeoJSON coordinates [lng, lat] to Leaflet format [lat, lng]
  const latlngs: [number, number][] = route.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng]
  );
  
  console.log('[fetchOsrmRoute] Converted', latlngs.length, 'coordinates');
  
  return {
    latlngs,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}
