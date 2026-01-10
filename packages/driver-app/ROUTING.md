# Driver App - Routing Configuration

The driver app supports pluggable routing providers for drawing road-following polylines on active ride maps.

## Configuration

Add these environment variables to `.env` or `.env.local`:

```bash
# Routing provider: google, mapbox, osrm, or none (default: none)
VITE_ROUTING_PROVIDER=none

# API key for Google or Mapbox (required if using those providers)
VITE_ROUTING_API_KEY=

# OSRM base URL (default: http://localhost:5005)
VITE_OSRM_BASE_URL=http://localhost:5005
```

## Supported Providers

### none (default)
- No API key required
- Draws a straight line between pickup and dropoff
- Always available as fallback

### google
- Requires `VITE_ROUTING_API_KEY` with Google Maps Directions API enabled
- Uses encoded polyline from Google Directions API
- URL: `https://maps.googleapis.com/maps/api/directions/json`

### mapbox
- Requires `VITE_ROUTING_API_KEY` with Mapbox access token
- Uses Mapbox Directions API
- URL: `https://api.mapbox.com/directions/v5/mapbox/driving`

### osrm
- Free and open source
- Can run locally or use public instance
- Default: `http://localhost:5005`
- Public instance: `https://router.project-osrm.org`

## Running OSRM Locally (Optional)

```bash
# Download map data
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/your-region.osm.pbf

# Contract data
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-contract /data/your-region.osrm

# Run routing server
docker run -t -i -p 5005:5000 -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld /data/your-region.osrm
```

## Fallback Behavior

If routing fails (API error, missing credentials, network issue), the app automatically falls back to drawing a straight line between locations.
