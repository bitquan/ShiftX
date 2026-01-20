# ShiftX Driver App Documentation

## Overview

The ShiftX Driver App is a mobile-first Progressive Web App (PWA) that enables drivers to receive ride requests, navigate to pickup and dropoff locations, and manage their earnings. Built with modern web technologies and compiled for iOS using Capacitor.

### Purpose
- **Ride Management**: Accept/decline ride offers, manage active rides through completion
- **Real-time Navigation**: GPS tracking, live location updates, route visualization  
- **Earnings Tracking**: View ride history, earnings, and Stripe Connect integration
- **Profile Management**: Upload photos, view approval status, manage availability

### Tech Stack
- **Frontend**: React 18.3 + TypeScript 5.3
- **Build Tool**: Vite 5.0 (fast HMR, optimized builds)
- **Mobile Runtime**: Capacitor 8.0 (native iOS wrapper)
- **Mapping**: Leaflet 1.9 + React-Leaflet 4.2 (OpenStreetMap/Mapbox tiles)
- **Backend**: Firebase (Auth, Firestore, Functions, Storage)
- **State Management**: React hooks, Firestore real-time listeners
- **Routing**: Mapbox Directions API (via driver-client)
- **Navigation**: Native Mapbox SDK (Phase 4 - planned)

### Architecture
The driver app follows a layered architecture:
```
┌─────────────────────────────────────────┐
│         App.tsx (Root State)            │
│  ├─ Auth & Profile Listeners            │
│  ├─ Offer Management                    │
│  └─ Navigation State Machine            │
└─────────────────────────────────────────┘
                  │
┌─────────────────────────────────────────┐
│       DriverHome (Map Interface)        │
│  ├─ MapShell (Layout)                   │
│  ├─ SharedMap (Leaflet)                 │
│  └─ BottomSheet (Driver UI)             │
└─────────────────────────────────────────┘
                  │
┌─────────────────────────────────────────┐
│    Sheet Content (State-Driven)         │
│  ├─ Collapsed: Quick status             │
│  ├─ Expanded: Full details              │
│  ├─ Offer: Accept/decline               │
│  └─ Active Ride: Trip controls          │
└─────────────────────────────────────────┘
```

---

## Package Structure

```
packages/driver-app/
├── src/
│   ├── components/          # React components
│   │   ├── map/            # Map-specific components
│   │   │   ├── SharedMap.tsx          # Unified Leaflet map
│   │   │   ├── RotatableDriverMarker.tsx  # Driver icon with heading
│   │   │   └── FitBoundsOnce.tsx      # Auto-fit bounds utility
│   │   ├── ActiveRideSheet.tsx        # Active ride UI (bottom sheet)
│   │   ├── AuthGate.tsx               # Authentication wrapper
│   │   ├── AvailableRides.tsx         # Ride list (deprecated)
│   │   ├── BottomNav.tsx              # Bottom navigation bar
│   │   ├── BottomSheet.tsx            # Draggable sheet component
│   │   ├── CameraToggle.tsx           # Map camera controls
│   │   ├── DebugPanel.tsx             # Dev diagnostics
│   │   ├── DiagnosticsPanel.tsx       # GPS debug overlay
│   │   ├── DriverBottomPanel.tsx      # Bottom panel wrapper
│   │   ├── DriverHeader.tsx           # Top header bar
│   │   ├── DriverHome.tsx             # Main driver interface
│   │   ├── DriverOfferSheet.tsx       # Ride offer modal
│   │   ├── DriverSheetCollapsed.tsx   # Collapsed sheet state
│   │   ├── DriverSheetExpanded.tsx    # Expanded sheet state
│   │   ├── DriverStatusCard.tsx       # Online/offline toggle
│   │   ├── DualRouteLine.tsx          # Two-leg route rendering
│   │   ├── EnvironmentBadge.tsx       # Dev/prod indicator
│   │   ├── EnvironmentWarningBanner.tsx  # Prod warning
│   │   ├── ErrorBoundary.tsx          # Error handling
│   │   ├── MaintenanceBanner.tsx      # System maintenance UI
│   │   ├── MenuButton.tsx             # Hamburger menu
│   │   ├── ProdDiagnostics.tsx        # Production diagnostics
│   │   ├── Profile.tsx                # Driver profile screen
│   │   ├── ProfilePhotoUpload.tsx     # Photo upload widget
│   │   ├── RideHistory.tsx            # Past rides list
│   │   ├── RouteLine.tsx              # Single route polyline
│   │   ├── SideSheet.tsx              # Navigation drawer
│   │   ├── StripeConnect.tsx          # Stripe onboarding
│   │   ├── Toast.tsx                  # Notification system
│   │   └── Wallet.tsx                 # Earnings dashboard
│   ├── config/
│   │   └── featureFlags.ts        # Feature toggles
│   ├── hooks/
│   │   ├── useDriverEarnings.ts   # Ledger aggregation
│   │   ├── useDriverRoutes.ts     # Route fetching/caching
│   │   ├── useEtaToPickup.ts      # ETA calculation
│   │   ├── useHeartbeat.ts        # GPS tracking & heartbeats
│   │   ├── useOfferRoute.ts       # Offer route preview
│   │   ├── useReverseGeocode.ts   # Lat/lng → address
│   │   ├── useRoutePolyline.ts    # Route decoding
│   │   └── useSmoothLocation.ts   # GPS noise filtering
│   ├── layout/
│   │   └── MapShell.tsx           # Full-screen map layout
│   ├── native/
│   │   ├── ShiftXNavigation.ts    # Capacitor navigation plugin
│   │   └── ShiftXNavigationWeb.ts # Web fallback
│   ├── routing/
│   │   └── route.ts               # Route utilities
│   ├── styles/
│   │   ├── bottomSheet.css        # Sheet animations
│   │   ├── driverSheetContent.css # Sheet content styles
│   │   └── mapShell.css           # Layout styles
│   ├── utils/
│   │   ├── earnings.ts            # Earnings calculations
│   │   ├── environmentGuard.ts    # Emulator safety checks
│   │   ├── eventLog.ts            # Telemetry logging
│   │   ├── haversine.ts           # Distance calculations
│   │   ├── mapDriverUiState.ts    # UI state machine
│   │   ├── mapIcons.ts            # Leaflet icon configs
│   │   ├── money.ts               # Currency formatting
│   │   └── runtimeFlags.ts        # Dynamic feature flags
│   ├── App.tsx                    # Root component
│   ├── firebase.ts                # Firebase initialization
│   ├── main.tsx                   # Entry point
│   └── styles.css                 # Global styles
├── ios/                           # Capacitor iOS project
│   └── App/
│       └── App/
│           └── Info.plist         # iOS configuration
├── capacitor.config.ts            # Capacitor configuration
├── index.html                     # HTML template
├── package.json                   # Dependencies & scripts
├── seedDriver.ts                  # Test data seeding
├── tsconfig.json                  # TypeScript config
└── vite.config.ts                 # Vite build config
```

### Key Files
- **App.tsx**: Root state management, auth, offers, navigation routing
- **DriverHome.tsx**: Main map interface, online/offline control, GPS heartbeat
- **MapShell.tsx**: Layout container with floating UI overlays
- **BottomSheet.tsx**: Draggable bottom sheet (collapsed ↔ expanded)
- **ActiveRideSheet.tsx**: Trip progression UI (accepted → started → in_progress → completed)
- **useHeartbeat.ts**: GPS tracking with 5s interval, 20m movement threshold

---

## Phase 2 Features

### Phase 2A: MapShell Layout
- **Full-screen map with floating UI**: Map fills viewport, UI elements positioned absolutely
- **Safe area handling**: Respects iOS notches/home indicators
- **Pointer events isolation**: Map interactable, UI elements have selective `pointer-events: auto`

### Phase 2B: Leaflet Map Integration
- **Unified SharedMap component**: Replaces multiple map implementations
- **Mapbox dark tiles**: Uses `VITE_MAPBOX_TOKEN` for custom tile layer
- **Route visualization**: Single-leg (`RouteLine`) and dual-leg (`DualRouteLine`) support
- **Driver marker**: Rotatable icon showing heading direction
- **Auto-fit bounds**: `FitBoundsOnce` utility for viewport management

### Phase 2C: GPS Heartbeat System
- **Always-on GPS tracking**: Tracks location even when offline (for UI display)
- **Conditional heartbeats**: Only sends location updates when `isOnline=true`
- **Smart throttling**: Sends on 20m movement OR 5s elapsed
- **High-accuracy GPS**: Uses `enableHighAccuracy: true` with fallback retry logic
- **Session management**: Race-condition protection with session IDs

### Phase 2D: BottomSheet Component
- **Drag gesture support**: Touch and mouse drag from handle
- **Snap points**: `collapsed` (160px) and `expanded` (62% viewport)
- **Smooth animations**: 300ms cubic-bezier transitions
- **Visual feedback**: Pill-shaped drag handle
- **Content switching**: Conditionally renders `collapsedContent` vs `expandedContent`

### Phase 2E: iOS Capacitor Build
- **Bundle ID**: `com.shiftx.driver`
- **App Name**: "ShiftX Driver"
- **Platform**: iOS 13+ (via Capacitor 8)
- **Plugins**: Core, Browser (for external links)

---

## Key Components

### Layout Components

#### MapShell
**Location**: `src/layout/MapShell.tsx`

Full-screen map container with positioned UI overlays.

**Structure**:
```tsx
<div className="map-shell">
  <div className="map-layer">{map}</div>
  <div className="ui-layer">
    <div className="ui-top-left">{topLeft}</div>      // Menu button
    <div className="ui-top-center">{topCenter}</div>  // Env badge
    <div className="ui-top-right">{topRight}</div>    // Diagnostics
    <div className="ui-right-stack">{rightStack}</div> // Controls
    <div className="ui-bottom-panel">{bottomPanel}</div> // BottomSheet
    <div className="ui-bottom-nav">{bottomNav}</div>  // Tab bar
  </div>
</div>
```

**Z-Index Layers**:
- Map: `z-index: 0` (background, always interactable)
- UI: `z-index: 10+` (overlays, `pointer-events: none` by default)
- Interactive elements: `pointer-events: auto`

---

### Map Components

#### SharedMap
**Location**: `src/components/map/SharedMap.tsx`

Unified Leaflet map with markers, routes, and camera control.

**Props**:
- `pickup`, `dropoff`: Marker positions
- `driver`/`driverLocation`: Driver marker position
- `routeCoords`: Single-leg route (legacy)
- `legA`, `legB`: Dual-leg routing (Phase 4G)
- `activeLeg`: Highlight which leg is active
- `cameraMode`: `'follow'` (track driver) or `'overview'` (fit bounds)
- `shouldFit`: Auto-fit bounds on mount
- `fitKey`: Re-fit when key changes

**Features**:
- Smooth driver movement via `useSmoothLocation` (5m noise filter, 800ms transition)
- Rotatable driver icon (heading-aware)
- Mapbox dark tiles (`streets-v11`)
- Auto-fit bounds with padding

**Example**:
```tsx
<SharedMap
  driver={currentLocation}
  pickup={rideData?.pickup}
  dropoff={rideData?.dropoff}
  legA={driverToPickupRoute}
  legB={pickupToDropoffRoute}
  activeLeg="A"
  cameraMode="follow"
/>
```

---

#### BottomSheet
**Location**: `src/components/BottomSheet.tsx`

Draggable bottom sheet with snap points.

**Props**:
- `defaultSnap`: Initial snap point (`'collapsed'` | `'expanded'`)
- `onSnapChange`: Callback on snap state change
- `collapsedContent`: JSX for collapsed view
- `expandedContent`: JSX for expanded view
- `children`: Fallback if no specific content

**Behavior**:
- **Collapsed**: 160px height, shows quick status
- **Expanded**: 62% viewport height, shows full details
- **Drag from handle**: Only the pill handle initiates drag
- **Content scrolling**: Touch events on content scroll normally
- **Hard reset**: Multiple listeners prevent stuck drag state

**CSS Classes**:
- `.driver-bottom-sheet`: Main container
- `.sheet-drag-handle`: Touchable drag area
- `.sheet-pill`: Visual indicator
- `.sheet-content`: Scrollable content area

**Example**:
```tsx
<BottomSheet
  defaultSnap="collapsed"
  onSnapChange={(snap) => console.log('Snapped to:', snap)}
  collapsedContent={<DriverSheetCollapsed {...props} />}
  expandedContent={<DriverSheetExpanded {...props} />}
/>
```

---

### Sheet Content Components

#### DriverSheetCollapsed
**Location**: `src/components/DriverSheetCollapsed.tsx`

Minimal view showing driver status and primary action.

**Shows**:
- Online/offline badge
- GPS status (fix/no fix)
- Primary action button (e.g., "Go Online", "Accept Ride")

---

#### DriverSheetExpanded
**Location**: `src/components/DriverSheetExpanded.tsx`

Full details and actions for current driver state.

**Cards**:
1. **DriverStatusCard**: Online toggle, GPS status, retry button
2. **Current Work**: Mapped UI state (idle/offer/assigned/active)
3. **Quick Actions**: Ride history, profile shortcuts (when idle)
4. **Dev Tools**: Test ride creator, runtime flags (dev only)

**UI State Mapping**: Uses `mapDriverUiState()` to convert driver state → UI content.

---

#### ActiveRideSheet
**Location**: `src/components/ActiveRideSheet.tsx`

Trip progression interface for active rides.

**States**: `accepted` → `started` → `in_progress` → `completed`

**Shows**:
- Customer info (name, photo, rating)
- Destination address (reverse geocoded)
- Payment authorization status
- Navigation button (launches native nav - Phase 4)
- Status-specific action button:
  - `accepted`: "Start Ride" (en route to pickup)
  - `started`: "Begin Trip" (customer onboard)
  - `in_progress`: "Complete Ride" (arrived at dropoff)

**Auto-dismissal**: Closes sheet when ride is `cancelled` or `completed` from backend.

---

#### DriverOfferSheet
**Location**: `src/components/DriverOfferSheet.tsx`

Modal for accepting/declining ride offers.

**Shows**:
- Pickup/dropoff addresses
- Estimated earnings
- ETA to pickup
- Route preview on map
- Accept/Decline buttons
- Auto-dismiss countdown (30s)

**Behavior**:
- Polls ride status to detect if taken by another driver
- Clears when offer expires or ride status changes
- Updates parent via `onAccepted`/`onExpired` callbacks

---

### Navigation & Controls

#### DriverStatusCard
**Location**: `src/components/DriverStatusCard.tsx`

Online/offline toggle with GPS diagnostics.

**Shows**:
- Online status badge
- GPS fix indicator (🟢 active, 🔴 no fix)
- Current location coordinates
- "Go Online"/"Go Offline" button
- "Retry GPS" button (when error)

**Validations**:
- Blocks going online if no profile photo
- Blocks going online if not admin-approved
- Checks `runtimeFlags.disableDriverOnline` (maintenance mode)
- Requires GPS fix before allowing online

---

#### CameraToggle
**Location**: `src/components/CameraToggle.tsx`

Switches map camera between follow and overview modes.

**Modes**:
- **Follow**: Tracks driver location, auto-centers
- **Overview**: Fits all markers (driver, pickup, dropoff) in view

---

### Profile & Settings

#### Profile
**Location**: `src/components/Profile.tsx`

Driver profile management screen.

**Shows**:
- Profile photo upload
- Name, email, phone
- Stripe Connect onboarding status
- Approval status
- Sign out button

---

#### Wallet
**Location**: `src/components/Wallet.tsx`

Earnings dashboard with ledger entries.

**Shows**:
- Total pending balance
- Total paid out
- Ride ledger (date, ride ID, amount, status)
- Stripe Connect onboarding flow

Uses `useDriverEarnings` hook to aggregate ledger entries.

---

### Utilities & Hooks

#### useHeartbeat
**Location**: `src/hooks/useHeartbeat.ts`

GPS tracking with Firestore heartbeat sync.

**Parameters**:
- `sendHeartbeats`: Boolean, enables/disables location updates
- `interval`: Heartbeat interval (default 5000ms)

**Returns**:
- `currentLocation`: Current GPS position
- `gpsError`: Error message if GPS failed
- `lastFixAtMs`: Timestamp of last GPS fix
- `hasGpsFix`: Boolean GPS status
- `retryGps`: Manual retry function

**Behavior**:
- Always tracks GPS (even offline) for UI display
- Only sends heartbeats when `sendHeartbeats=true`
- Smart throttling: 20m movement OR 5s elapsed
- Retries with low-accuracy then high-accuracy on timeout
- Session ID prevents race conditions

**Example**:
```tsx
const { currentLocation, gpsError, retryGps } = useHeartbeat(isOnline);
```

---

#### useDriverRoutes
**Location**: `src/hooks/useDriverRoutes.ts`

Fetches and caches driver→pickup + pickup→dropoff routes.

**Returns**:
- `legA`: Driver to pickup route coordinates
- `legB`: Pickup to dropoff route coordinates
- `isLoading`: Loading state
- `error`: Error message

**Caching**: Uses `localStorage` with 5-minute TTL to reduce API calls.

---

#### useSmoothLocation
**Location**: `src/hooks/useSmoothLocation.ts`

Filters GPS noise and animates location changes.

**Parameters**:
- `location`: Raw GPS position
- `minDistanceMeters`: Minimum movement to accept (default 5m)
- `transitionDuration`: Animation duration (default 800ms)

**Returns**: Smoothed location object

**Behavior**:
- Ignores updates < 5m (GPS jitter)
- Smoothly animates marker movement
- Uses RAF for 60fps animations

---

#### mapDriverUiState
**Location**: `src/utils/mapDriverUiState.ts`

State machine that maps driver state → UI content.

**States**:
- `offline`: "You're Offline" + "Go Online" button
- `going_online`: "Starting GPS..."
- `online_idle`: "Ready for Rides" + test ride button (dev)
- `online_pending_offer`: Shows offer count, "View Offers" button
- `online_active_ride`: "Active Ride" + "View Ride" button

**Returns**: `{ title, subtitle, primaryActions, secondaryInfo, mode }`

---

## Capacitor Plugins

### Core Plugins
- **@capacitor/core**: Base platform APIs
- **@capacitor/browser**: Opens external URLs in system browser (e.g., Stripe)

### GPS & Geolocation
Driver app uses native browser Geolocation API (no Capacitor plugin needed).

**Configuration**:
```ts
navigator.geolocation.watchPosition(
  successCallback,
  errorCallback,
  {
    enableHighAccuracy: true,  // Use GPS, not cell tower
    timeout: 20000,            // 20s max wait
    maximumAge: 5000,          // Cache position 5s max
  }
);
```

**Error Handling**:
- `PERMISSION_DENIED`: User blocked location access
- `POSITION_UNAVAILABLE`: GPS hardware unavailable
- `TIMEOUT`: Fix took too long

### Native Navigation Plugin (Phase 4 - Planned)
**Plugin**: `ShiftXNavigation` (custom Capacitor plugin)

**Purpose**: Launch native Mapbox Navigation SDK for turn-by-turn directions.

**API**:
```ts
// Start navigation
await ShiftXNavigation.start({
  lat: 37.7749,
  lng: -122.4194,
  label: "Customer Pickup",
  mode: "driving",
});

// Stop navigation
await ShiftXNavigation.stop();

// Check availability
const { available } = await ShiftXNavigation.isAvailable();
```

**Events**:
- `navStarted`: Navigation UI opened
- `navEnded`: User cancelled or arrived
- `navError`: Navigation failed

**Implementation Status**: Web fallback implemented, native iOS/Android SDK integration pending.

---

## Native iOS Integration

### Info.plist Configuration
**Location**: `packages/driver-app/ios/App/App/Info.plist`

**Required Keys**:
```xml
<key>CFBundleDisplayName</key>
<string>ShiftX Driver</string>

<key>CFBundleIdentifier</key>
<string>com.shiftx.driver</string>

<key>UILaunchStoryboardName</key>
<string>LaunchScreen</string>

<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationPortrait</string>
  <string>UIInterfaceOrientationLandscapeLeft</string>
  <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```

### Location Permissions
**Required in Info.plist** (add these manually):
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>ShiftX needs your location to show your position and send it to riders.</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>ShiftX tracks your location in the background to update riders during trips.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Location is required to accept rides and navigate to customers.</string>

<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
```

**Permission Flow**:
1. App requests `WhenInUse` permission on first location access
2. User grants/denies in iOS prompt
3. App checks permission state via `navigator.permissions.query()`
4. Blocks going online if permission denied

### Capabilities
**Required** (set in Xcode):
- Location Services
- Background Modes (location updates)

### Build Configuration
**Debug**: `packages/driver-app/ios/App/debug.xcconfig`
**Release**: Set signing team, bundle ID in Xcode

---

## State Management

### Top-Level State (App.tsx)
- **Auth**: `onAuthStateChanged` listener, auto-create driver doc
- **Driver Profile**: `watchDriverProfile()` with stale `currentRideId` cleanup
- **Offers**: `watchDriverOffers()` with expiration checks and ride validation
- **Navigation**: State machine routing between auth, home, and ride screens

**Key Listeners**:
```tsx
// Auth
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, (driver) => {
    setUser(driver);
    // Create user/driver docs if first login
  });
  return unsubscribe;
}, []);

// Profile
useEffect(() => {
  if (!user) return;
  const unsubscribe = watchDriverProfile(
    user.uid,
    (profile) => setDriverProfile(profile),
    (err) => console.error(err)
  );
  return unsubscribe;
}, [user]);

// Offers
useEffect(() => {
  if (!user || !isOnline) return;
  const unsubscribe = watchDriverOffers(
    user.uid,
    (offers) => {
      // Filter expired, validate rides, show modal for new offers
      setPendingOffers(filteredOffers);
    },
    (err) => console.error(err)
  );
  return unsubscribe;
}, [user, isOnline]);
```

### Local State (DriverHome.tsx)
- **Online State Machine**: `'offline'` | `'going_online'` | `'online'` | `'going_offline'`
- **GPS State**: `currentLocation`, `gpsError`, `lastFixAtMs` (from `useHeartbeat`)
- **Camera Mode**: `'follow'` | `'overview'` (map behavior)

### Sheet State (BottomSheet.tsx)
- **Snap Point**: `'collapsed'` | `'expanded'`
- **Drag State**: `isDragging`, `dragStartY`, `dragStartHeight`

### Ride State (ActiveRideSheet.tsx)
- **Status**: `'accepted'` | `'started'` | `'in_progress'` | `'completed'`
- **Ride Data**: Firestore snapshot listener on `/rides/{rideId}`
- **Customer Profile**: Firestore snapshot on `/users/{riderId}`

---

## Real-time Updates

### Firestore Listeners

#### Driver Profile
**Collection**: `drivers/{driverId}`

**Watched Fields**:
- `isOnline`: Online status
- `isBusy`: Currently on ride
- `currentRideId`: Active ride reference
- `currentRideStatus`: Ride status cache
- `location`: Last known position
- `updatedAtMs`: Last update timestamp

**Stale Data Cleanup**: On profile update, checks if `currentRideId` points to a completed/cancelled ride and clears it.

---

#### Ride Offers
**Collection**: `driverOffers/{driverId}/offers/{rideId}`

**Watched Fields**:
- `status`: `'pending'` | `'accepted'` | `'declined'` | `'expired'` | `'cancelled'`
- `expiresAtMs`: Offer expiration timestamp
- `fareEstimateCents`: Estimated earnings
- `etaMinutes`: ETA to pickup

**Validation**:
- Client-side expiration check (`expiresAtMs <= now`)
- Ride existence check (skip if ride doc deleted)
- Ride status check (skip if already `accepted`, `started`, etc.)

---

#### Active Ride
**Collection**: `rides/{rideId}`

**Watched Fields**:
- `status`: Ride lifecycle state
- `pickup`, `dropoff`: Location objects
- `payment.authorized`: Payment ready state
- `riderId`: Customer reference

**Auto-dismissal**: Sheet closes when status becomes `'cancelled'` or `'completed'`.

---

### GPS Heartbeat
**Function**: `driverHeartbeat()` (Cloud Function call)

**Triggered**:
- On GPS location update (if moved > 20m OR 5s elapsed)
- Every 5s interval (fallback)
- Only when `isOnline=true`

**Payload**:
```ts
{
  lat: number;
  lng: number;
  heading?: number;  // Compass direction (0-360)
}
```

**Backend Updates**:
- `drivers/{driverId}.location`: GeoPoint
- `drivers/{driverId}.heading`: Number
- `drivers/{driverId}.updatedAtMs`: Timestamp

---

### Route Fetching
**Hook**: `useDriverRoutes()`

**Triggers**:
- When driver accepts offer (fetch routes to preview)
- When active ride starts (fetch routes for navigation)

**API**: Mapbox Directions API (via driver-client wrapper)

**Caching**: 5-minute localStorage cache to reduce API calls.

---

## Environment Variables

### Required Variables
**File**: `.env` (copy from `.env.example`)

```bash
# Mapbox (Required for map tiles)
VITE_MAPBOX_TOKEN=pk.eyJ1...your-token

# Firebase (Required for production, optional for dev)
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

# Feature Flags (Optional)
VITE_ENABLE_DEV_TOOLS=false        # Show dev tools in prod
VITE_ENABLE_DEBUG_PANEL=false      # Show GPS debug panel
VITE_VERBOSE_LOGGING=false         # Extra console logs
VITE_ENABLE_DRIVER_WALLET=true     # Earnings/ledger
VITE_SINGLE_DRIVER_MODE=false      # Testing mode
```

### Development Defaults
When running `npm run dev` on localhost:
- Connects to Firebase emulators (Auth: 9099, Firestore: 8081, Functions: 5002)
- Uses emulator data (isolated from production)
- Enables dev tools automatically

### Production Build
When running `npm run build`:
- Requires all Firebase env vars (no defaults)
- Disables dev tools
- Connects to live Firebase project

---

## Build & Run

### Prerequisites
```bash
# Node.js 20+
node --version

# Install dependencies
cd packages/driver-app
npm install
```

### Get Mapbox Token
1. Go to https://account.mapbox.com/access-tokens/
2. Create a token with `styles:read` scope
3. Add to `.env`: `VITE_MAPBOX_TOKEN=pk.eyJ...`

### Development Mode
```bash
# Start dev server (connects to emulators if on localhost)
npm run dev

# Access at http://localhost:5174
# GPU acceleration requires HTTPS or localhost
```

**Emulator Setup** (in repo root):
```bash
# Start Firebase emulators
npm run emulator

# Import seed data
firebase emulators:export ./emulator-export
firebase emulators:start --import=./emulator-export
```

**Test User**:
- Email: `driver@test.com`
- Password: `test123`
- Or use "Sign in with Google" (emulator auto-creates accounts)

---

### Production Build
```bash
# Set production env vars in .env.production
cp .env.example .env.production
# Edit .env.production with live Firebase config

# Build optimized bundle
npm run build

# Preview production build
npm run preview
```

**Deploy to Firebase Hosting**:
```bash
# From repo root
firebase deploy --only hosting:driver-app
```

**Deploy URL**: `https://your-project.web.app` (or custom domain)

---

### iOS Build
```bash
# 1. Build web assets
npm run build

# 2. Sync with iOS project
npx cap sync ios

# 3. Open in Xcode
npx cap open ios

# 4. Set signing team, bundle ID, capabilities
# 5. Build & run on simulator/device
```

**iOS Requirements**:
- Xcode 14+
- iOS 13+ deployment target
- Apple Developer account (for device testing)

**Add Location Permissions**: Manually add `NSLocation...` keys to Info.plist (see Native iOS Integration section).

---

### Scripts Reference
| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (port 5174) |
| `npm run build` | Build production bundle |
| `npm run preview` | Preview production build |
| `npm run seed-driver` | Create test driver in emulator |
| `npm run format` | Format code with Prettier |
| `npx cap sync` | Sync web assets to native projects |
| `npx cap open ios` | Open Xcode project |

---

## Testing

### Manual Testing Procedures

#### 1. Authentication Flow
- [ ] Sign in with test driver account
- [ ] Verify user/driver docs created in Firestore
- [ ] Check `onboardingStatus` (should be `'active'`)
- [ ] Sign out and verify redirect to auth screen

#### 2. Going Online
- [ ] Upload profile photo if missing
- [ ] Click "Go Online" button
- [ ] Grant location permission when prompted
- [ ] Verify GPS fix acquired (green indicator)
- [ ] Check Firestore: `drivers/{id}.isOnline=true`
- [ ] Verify location updates every 5s

#### 3. Receiving Offers
- [ ] Go online as driver
- [ ] Create test ride from customer app (or use "Create Test Ride" in dev tools)
- [ ] Verify offer modal appears with ride details
- [ ] Check route preview on map
- [ ] Verify 30s countdown timer
- [ ] Test decline (offer should disappear)
- [ ] Test accept (should transition to active ride)

#### 4. Active Ride Flow
- [ ] Accept offer → status should be `'accepted'`
- [ ] Bottom sheet shows "Start Ride" button
- [ ] Click "Start Ride" → status becomes `'started'`
- [ ] Sheet shows "Begin Trip" button (customer onboard)
- [ ] Click "Begin Trip" → status becomes `'in_progress'`
- [ ] Sheet shows "Complete Ride" button
- [ ] Click "Complete Ride" → status becomes `'completed'`
- [ ] Sheet auto-dismisses, driver goes back to idle

#### 5. Map & Navigation
- [ ] Verify driver marker shows current location
- [ ] Test camera toggle (follow ↔ overview)
- [ ] Verify route line appears for active ride
- [ ] Test dual-leg rendering (driver→pickup + pickup→dropoff)
- [ ] Verify map rotates when dragging

#### 6. BottomSheet Behavior
- [ ] Test drag from pill handle
- [ ] Verify snap points (collapsed at 160px, expanded at 62%)
- [ ] Test content scrolling (should not trigger drag)
- [ ] Verify smooth animations

#### 7. Wallet & Earnings
- [ ] Go to Wallet tab
- [ ] Verify ledger entries for completed rides
- [ ] Check total pending balance
- [ ] Test Stripe Connect onboarding flow

#### 8. Profile Management
- [ ] Go to Profile tab
- [ ] Upload profile photo
- [ ] Verify photo appears in Firestore Storage
- [ ] Check approval status

#### 9. Error Handling
- [ ] Test GPS permission denied → verify error message
- [ ] Test going offline while in active ride → should block
- [ ] Test network disconnect → verify reconnection
- [ ] Test offer expiration → verify auto-dismiss

#### 10. iOS-Specific
- [ ] Build and run on iOS simulator
- [ ] Test safe area insets (notch/home indicator)
- [ ] Verify location permission prompt
- [ ] Test background location (start ride, minimize app, verify updates)

---

### Test Accounts
**Emulator** (localhost only):
- Driver: `driver@test.com` / `test123`
- Rider: `rider@test.com` / `test123`
- Admin: `admin@test.com` / `test123`

**Production** (requires Firebase Console setup):
- Create via "Sign in with Google" on first use
- Admin must approve driver via Admin Dashboard

---

### Dev Tools
**Enable in Dev Mode**: Set `VITE_ENABLE_DEV_TOOLS=true`

**Features**:
- **Create Test Ride**: Spawns ride 100m away with 30s offer
- **Spawn Test Drivers**: Creates N ghost drivers for load testing
- **Cleanup Test Data**: Removes test rides and drivers
- **Runtime Flags Display**: Shows server-controlled feature flags

**Access**: Expand bottom sheet when online and idle.

---

## Known Issues

### Phase 3 Roadmap Items
- [ ] **Native Mapbox Navigation**: Web fallback only, native SDK integration pending
- [ ] **Push Notifications**: No offer notifications yet (must be in app)
- [ ] **Offline Mode**: Requires network connection for all operations
- [ ] **Background GPS**: iOS kills GPS when app minimized (need background mode config)
- [ ] **Route Optimization**: Uses Mapbox default routes, no traffic awareness
- [ ] **Multi-stop Rides**: Only supports single pickup → single dropoff

### Known Bugs
- **iOS Keyboard Overlap**: BottomSheet content may hide behind keyboard (Phase 3E workaround: use `visualViewport` API)
- **GPS Drift**: Indoor/urban canyon drift not fully mitigated (5m filter helps)
- **Route Cache Staleness**: 5-minute cache may show outdated routes in heavy traffic
- **Offer Race Condition**: Rare case where two drivers accept same ride (backend handles, but UI may briefly show as accepted)

### TODOs
```tsx
// TODO: Phase 4B - Launch native Mapbox Navigation SDK
await ShiftXNavigation.start({ lat, lng, label });

// TODO: Phase 4C - Add FCM push notifications for offers
// TODO: Phase 4D - Implement driver ratings
// TODO: Phase 4E - Add trip notes/customer instructions
// TODO: Phase 4F - Support multi-stop rides
// TODO: Phase 4G - Add traffic-aware routing
// TODO: Phase 4H - Implement driver zones/geo-fencing
// TODO: Phase 4I - Add earnings analytics dashboard
```

### Performance Considerations
- **Firestore Listeners**: 3-4 active listeners per session (profile, offers, active ride, runtime flags)
- **GPS Polling**: ~1 update/sec from browser API (only 1 heartbeat every 5s/20m to backend)
- **Route API Calls**: 1 call per offer accepted + 1 per active ride (cached 5 min)
- **Map Rendering**: Leaflet handles 1000+ markers efficiently, but driver app typically renders 2-5

### Security Notes
- **Auth**: Firebase Auth with email/password or Google Sign-In
- **Authorization**: Cloud Functions validate driver ID from auth context
- **Location Privacy**: Heartbeat only sent when online, not stored permanently
- **Payment Security**: Stripe Connect handles all payment processing (PCI compliant)

---

## Additional Resources

### Documentation
- [Capacitor Docs](https://capacitorjs.com/docs)
- [Leaflet Docs](https://leafletjs.com/reference.html)
- [React-Leaflet Docs](https://react-leaflet.js.org/)
- [Mapbox API Docs](https://docs.mapbox.com/api/navigation/)
- [Firebase Docs](https://firebase.google.com/docs)

### Internal Docs
- [Customer App Docs](./CUSTOMER_APP.md) - Rider interface documentation
- [Admin Dashboard Docs](./ADMIN_DASHBOARD.md) - Fleet management
- [Driver Client Package](../packages/driver-client/README.md) - Shared driver SDK
- [Deployment Guide](../DEPLOYMENT_STATUS.md) - Production deployment

### Troubleshooting
**GPS Not Working**:
1. Check browser console for permission errors
2. Verify HTTPS or localhost (required for geolocation API)
3. Check iOS Info.plist has location permission keys
4. Try "Retry GPS" button in DriverStatusCard

**Offers Not Appearing**:
1. Verify driver is `isOnline=true` in Firestore
2. Check `driverOffers/{driverId}/offers` collection
3. Verify ride status is `'offered'` not `'accepted'`
4. Check browser console for offer validation errors

**Map Not Loading**:
1. Verify `VITE_MAPBOX_TOKEN` is set
2. Check network tab for tile load errors (403 = bad token)
3. Ensure Mapbox token has `styles:read` scope

**Build Errors**:
1. Clear `node_modules`: `rm -rf node_modules package-lock.json && npm install`
2. Clear Vite cache: `rm -rf dist .vite`
3. Check TypeScript errors: `npx tsc --noEmit`

---

**Version**: Phase 3 (December 2024)  
**Maintainers**: ShiftX Engineering Team  
**Last Updated**: 2025-01-19
