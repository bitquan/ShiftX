# ShiftX - Solo Driver Rideshare Platform

A minimal viable rideshare platform with customer and driver web apps, Firebase backend, and real-time GPS tracking.

## Architecture Overview

**Monorepo Structure:**
```
shiftx/
├── packages/
│   ├── customer-app/     # React customer web app (Vite + TypeScript)
│   ├── driver-app/       # React driver web app (Vite + TypeScript)
│   ├── driver-client/    # Shared Firebase client utilities
│   └── rules-tests/      # Firestore security rules tests
├── functions/            # Firebase Cloud Functions (Node.js/TypeScript)
├── firestore.rules       # Firestore security rules
└── docs/                 # Detailed documentation
```

**Tech Stack:**
- **Frontend:** React 18.3 + TypeScript 5.3 + Vite 5.0
- **Maps:** React Leaflet 4.x + Leaflet + OSRM routing
- **Backend:** Firebase Cloud Functions + Firestore + Cloud Scheduler
- **Auth:** Firebase Auth (anonymous mode)
- **Real-time:** Firestore snapshots for live ride updates
- **GPS:** Geolocation API with throttled heartbeat (5s/20m)

---

## Core Features

### Customer App
- **Tap-to-Set Ride Requests:** Tap map to set pickup/dropoff
- **Road-Following Routes:** OSRM integration with glowing blue polyline
- **Real-Time Tracking:** Live driver location and ride status
- **Scheduled Rides:** Book rides for future times with timezone validation
- **Preferred Driver:** QR code invites to connect with specific drivers

### Driver App
- **Bottom Navigation:** Home (availability) / Active Ride / Settings
- **Availability Management:** Set hourly availability (12-hour format)
- **Live GPS Tracking:** Throttled location updates (5s OR 20m movement)
- **Active Ride Map:** Road-following route with pickup/dropoff markers
- **Apple Maps Integration:** Navigate button opens Apple Maps
- **Trip Management:** Accept → Start → Complete workflow

### Backend (Cloud Functions)
- **Ride Management:** `createRide`, `cancelRide`, `acceptRide`, `startRide`, `completeRide`
- **Driver Features:** `setDriverAvailability`, `setPreferredDriver`, `driverHeartbeat`
- **Scheduling:** `scheduleRide`, `activateScheduledRides` (Cloud Scheduler Pub/Sub)
- **Events:** `getRideEvents` for real-time status polling

---

## Maps & Routing

### Unified Route System
All maps use the same road-following polyline rendering:

**Hook:** `useRoutePolyline(pickup, dropoff)`
- Fetches OSRM route with 250ms debounce
- Returns `{ coords, loading, error, distanceMeters }`
- Memoizes routes by pickup/dropoff key
- Falls back to straight line on error

**Component:** `<RouteLine coords={routeCoords} />`
- Two-layer rendering: glow (weight 10, opacity 0.3) + core (weight 6, opacity 0.95)
- Blue color (#60a5fa), rounded caps/joins
- Identical styling across customer and driver apps

**FitBounds Guard:**
- `shouldFit` prop prevents repeated fitBounds calls
- `onFit` callback (useCallback) marks bounds as fitted
- Only resets when pickup/dropoff coordinates change
- Prevents Chrome freeze during live GPS updates

### Map Icons (L.divIcon)
- **Driver:** 🚗 white car emoji in colored circle
- **Pickup:** Green circle
- **Dropoff:** Blue circle
- Uses CSS for styling (no image imports, Vite-friendly)

### Tiles
CARTO Dark tiles with CSS filters:
```css
.map-tiles-enhanced {
  filter: brightness(1.5) contrast(1.15);
}
```

---

## Development Setup

### Prerequisites
- Node.js 18+ (LTS recommended)
- Firebase CLI: `npm install -g firebase-tools`
- Firebase emulators (Java required for Firestore): `brew install --cask temurin`

### Quick Start

1. **Install dependencies:**
```bash
npm install
cd packages/customer-app && npm install && cd ../..
cd packages/driver-app && npm install && cd ../..
cd packages/driver-client && npm install && cd ../..
cd functions && npm install && cd ..
```

2. **Start Firebase emulators:**
```bash
firebase emulators:start --only auth,functions,firestore
```
Emulator ports: Auth (9099), Firestore (8081), Functions (5002)

3. **Start dev servers (in separate terminals):**
```bash
# Customer app
cd packages/customer-app && npm run dev

# Driver app  
cd packages/driver-app && npm run dev
```

4. **Access apps:**
- Customer: http://localhost:5173
- Driver: http://localhost:4173

### VS Code Tasks
Use `.vscode/tasks.json` for convenience:
- **Start All Dev Services:** Runs emulators + both apps in parallel
- **Firebase Emulators:** Auth + Functions + Firestore
- **Driver App Dev Server:** Port 4173
- **Customer App Dev Server:** Port 5173

---

## Key Implementation Details

### GPS Throttling (Driver)
`useHeartbeat(enabled: boolean)` hook:
- Watches geolocation with high accuracy
- Sends heartbeat if: **5 seconds elapsed OR moved >20 meters**
- Uses Haversine distance calculation
- Cleans up watchPosition on unmount

### Scheduled Rides
1. Customer schedules ride with future datetime + timezone
2. Backend validates: must be >30min in future, <30 days out
3. Ride status: `scheduled` (not searchable)
4. Cloud Scheduler runs `activateScheduledRides` every minute via Pub/Sub
5. Activates rides within 30min window → status becomes `requested`
6. Dispatcher picks up and assigns to available drivers

### Preferred Driver Flow
1. Driver generates QR code via Share API (`setPreferredDriver`)
2. Customer scans QR → sets `preferredDriverId` in profile
3. Dispatcher prioritizes preferred driver (if available + accepting rides)
4. Falls back to other drivers if preferred unavailable

### Chrome Freeze Prevention
**Problem:** Repeated `fitBounds()` calls during GPS updates locked UI

**Solution:**
- `didFitRef` tracks if bounds were fitted for current route
- `lastRouteKeyRef` detects pickup/dropoff changes
- `shouldFit` prop only true when route changes
- `onFit` callback (useCallback) prevents infinite useEffect loops
- Route fetching depends ONLY on pickup/dropoff (not driverLocation)

### Firebase Singleton Pattern
HMR-safe emulator connections:
```typescript
const app = getApps().length ? getApp() : initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'us-central1');

// Connect to emulators once
if (!auth.config.emulator) {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8081);
  connectFunctionsEmulator(functions, 'localhost', 5002);
}
```

---

## Backend: Cloud Functions 🔧

Ride state transitions are managed server-side to prevent race conditions.

### Callables
- `createRide` - Create new ride request
- `cancelRide` - Cancel ride (only certain states)
- `acceptRide` - Driver accepts offered ride
- `startRide` - Driver arrives at pickup
- `completeRide` - Ride finished
- `setDriverAvailability` - Set hourly availability
- `setPreferredDriver` - Generate/set preferred driver
- `scheduleRide` - Schedule future ride
- `driverHeartbeat` - Update driver location
- `getRideEvents` - Poll for ride updates

### Scheduled Functions
- `activateScheduledRides` - Pub/Sub cron (every minute)
  - Queries `scheduled` rides within 30min activation window
  - Updates to `requested` status for dispatcher

See `docs/FUNCTIONS.md` for deployment and testing.

---

## Testing

### Build Production
```bash
cd packages/customer-app && npm run build
cd packages/driver-app && npm run build
```

### Preview Production Builds
```bash
cd packages/customer-app && npm run preview  # Port 4173
cd packages/driver-app && npm run preview    # Port 4174
```

### Firestore Rules Tests
```bash
cd packages/rules-tests
npm test
```

---

## Troubleshooting

### Chrome Freezes During Ride
- Ensure `useCallback` is used for `onFit` callbacks
- Check that route hook doesn't depend on `driverLocation`
- Verify `didFitRef` logic resets only on coordinate changes

### Route Not Showing
- Check browser console for OSRM errors
- Verify coordinates are valid (not null/undefined)
- Falls back to straight line if OSRM fails

### Emulator Connection Issues
- Verify emulators running: `firebase emulators:start`
- Check ports not in use: 9099 (Auth), 8081 (Firestore), 5002 (Functions)
- Clear browser cache if Firebase singleton issues persist

### Build Errors
- Delete `node_modules` and reinstall: `npm install`
- Clear Vite cache: `rm -rf packages/*/node_modules/.vite`
- Check TypeScript errors: `npm run build` in each package

---

## Documentation

- **[SETUP.md](docs/SETUP.md)** - Detailed setup instructions
- **[DEVELOPMENT.md](docs/DEVELOPMENT.md)** - Local development guide
- **[FUNCTIONS.md](docs/FUNCTIONS.md)** - Cloud Functions reference
- **[DRIVER-APP-WORKFLOW.md](docs/DRIVER-APP-WORKFLOW.md)** - Driver app flow
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)** - Complete technical summary

---

## Notes

- All ride state transitions are server-side for security
- GPS throttling prevents excessive Firestore writes
- Route polylines cached by pickup/dropoff coordinates
- QR codes use Web Share API (mobile-friendly)
- 12-hour time format throughout UI


