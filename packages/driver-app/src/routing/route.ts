interface LatLng {
  lat: number;
  lng: number;
}

interface RouteOptions {
  pickup: LatLng;
  dropoff: LatLng;
}

const PROVIDERS = ['google', 'mapbox', 'osrm', 'none'] as const;
type Provider = typeof PROVIDERS[number];

// Decode Google polyline
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

async function fetchGoogleRoute(options: RouteOptions, apiKey: string): Promise<LatLng[]> {
  const { pickup, dropoff } = options;
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.lat},${pickup.lng}&destination=${dropoff.lat},${dropoff.lng}&key=${apiKey}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== 'OK' || !data.routes?.[0]?.overview_polyline?.points) {
    throw new Error(`Google Directions API error: ${data.status}`);
  }
  
  return decodePolyline(data.routes[0].overview_polyline.points);
}

async function fetchMapboxRoute(options: RouteOptions, apiKey: string): Promise<LatLng[]> {
  const { pickup, dropoff } = options;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?geometries=polyline&access_token=${apiKey}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (!data.routes?.[0]?.geometry) {
    throw new Error('Mapbox Directions API error');
  }
  
  return decodePolyline(data.routes[0].geometry);
}

async function fetchOSRMRoute(options: RouteOptions, baseUrl: string): Promise<LatLng[]> {
  const { pickup, dropoff } = options;
  const url = `${baseUrl}/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.code !== 'Ok' || !data.routes?.[0]?.geometry?.coordinates) {
    throw new Error('OSRM routing error');
  }
  
  // OSRM returns [lng, lat] format, convert to {lat, lng}
  return data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));
}

function getStraightLine(options: RouteOptions): LatLng[] {
  return [options.pickup, options.dropoff];
}

export async function getRoutePoints(options: RouteOptions): Promise<LatLng[]> {
  const provider = (import.meta.env.VITE_ROUTING_PROVIDER || 'none') as Provider;
  const apiKey = import.meta.env.VITE_ROUTING_API_KEY || '';
  const osrmBaseUrl = import.meta.env.VITE_OSRM_BASE_URL || 'http://localhost:5005';

  try {
    switch (provider) {
      case 'google':
        if (!apiKey) throw new Error('Missing API key');
        return await fetchGoogleRoute(options, apiKey);
      
      case 'mapbox':
        if (!apiKey) throw new Error('Missing API key');
        return await fetchMapboxRoute(options, apiKey);
      
      case 'osrm':
        return await fetchOSRMRoute(options, osrmBaseUrl);
      
      case 'none':
      default:
        return getStraightLine(options);
    }
  } catch (error) {
    console.warn('Routing failed, falling back to straight line:', error);
    return getStraightLine(options);
  }
}

export function calculateDistance(points: LatLng[]): number {
  if (points.length < 2) return 0;
  
  let distance = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    
    // Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    distance += R * c;
  }
  
  return distance;
}
