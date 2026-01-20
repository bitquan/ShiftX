# ShiftX Architecture - Files and Structure

**Last Updated:** January 20, 2026  
**Status:** Current TypeScript/React Architecture

This document describes the current monorepo structure and key files in the ShiftX project.

---

## Project Structure Overview

ShiftX is a TypeScript/React monorepo with multiple packages for customer and driver applications, plus cloud functions for backend logic.

```
ShiftX/
├── packages/
│   ├── customer-app/        — Customer/Rider web app (React + Vite + TypeScript)
│   ├── driver-app/          — Driver web app (React + Vite + TypeScript + Capacitor)
│   ├── admin-dashboard/     — Admin dashboard (React + Vite)
│   ├── ios-customer/        — iOS wrapper for customer app (Capacitor)
│   ├── ios-driver/          — iOS wrapper for driver app (Capacitor)
│   ├── driver-client/       — Shared client library for Firebase callables
│   ├── shared/              — Shared utilities and types
│   └── landing/             — Marketing landing page
├── functions/               — Firebase Cloud Functions (Node.js + TypeScript)
├── docs/                    — Documentation
├── lib/                     — Legacy Flutter code (not actively used)
└── firebase configuration files
```

---

## Package Details

### packages/customer-app/ — Customer Application

**Tech Stack:** React 18 + TypeScript + Vite + Firebase + Leaflet Maps

**Key Files:**
```
src/
  App.tsx                    — Main app component, auth state, navigation
  main.tsx                   — App entry point
  firebase.ts                — Firebase initialization and config
  
  components/
    AuthGate.tsx             — Email/password authentication
    RequestRide.tsx          — Ride request form with map integration
    RideStatus.tsx           — Real-time ride status display
    RideHistory.tsx          — Past rides list
    CustomerWallet.tsx       — Wallet and payment methods
    Profile.tsx              — User profile and settings
    BottomSheet.tsx          — Draggable bottom sheet component
    AddressAutocomplete.tsx  — Location search with geocoding
    Toast.tsx                — Toast notification system
    ErrorBoundary.tsx        — Error boundary wrapper
    DiagnosticsPanel.tsx     — Debug/diagnostics overlay
    map/                     — Map-related components
      
  layout/
    MapShell.tsx             — Full-screen map layout with UI overlays
    
  styles/
    styles.css               — Global styles with CSS variables
    bottomSheet.css          — Bottom sheet styles
    mapShell.css             — Map shell layout styles
    
  hooks/
    useDriverEta.ts          — Real-time driver ETA calculation
    useFareEstimate.ts       — Fare estimation logic
    useNearbyDrivers.ts      — Query nearby available drivers
    useForwardGeocode.ts     — Address to coordinates
    useReverseGeocode.ts     — Coordinates to address
    useRoutePolyline.ts      — Route visualization
    
  lib/
    distance.ts              — Haversine distance calculation
    routing.ts               — Routing and navigation helpers
    
  utils/
    configValidation.ts      — Production config validation
    stripeMode.ts            — Stripe mode detection and logging
    runtimeFlags.ts          — Feature flags from Firestore
```

**Features:**
- Real-time ride booking and tracking
- Map-based pickup/dropoff selection
- Live driver location and ETA
- Payment integration (Stripe)
- Ride history and receipts
- Saved places
- Preferred drivers

---

### packages/driver-app/ — Driver Application

**Tech Stack:** React 18 + TypeScript + Vite + Firebase + Leaflet Maps + Capacitor

**Key Files:**
```
src/
  App.tsx                    — Main app component with offer management
  main.tsx                   — App entry point
  firebase.ts                — Firebase initialization and config
  
  components/
    AuthGate.tsx             — Driver authentication
    DriverHome.tsx           — Main driver screen with map
    DriverStatusCard.tsx     — Online/offline status control
    ActiveRideSheet.tsx      — Active ride details and actions
    DriverOfferSheet.tsx     — Incoming ride offers
    AvailableRides.tsx       — Browse available rides
    Availability.tsx         — Set driver availability zones
    BottomSheet.tsx          — Draggable bottom sheet
    CameraToggle.tsx         — Map camera mode toggle (Follow/Overview)
    DualRouteLine.tsx        — Dual-leg route visualization
    RouteLine.tsx            — Single route polyline
    MenuButton.tsx           — Navigation menu button
    SideSheet.tsx            — Slide-out navigation
    Profile.tsx              — Driver profile and verification
    Wallet.tsx               — Earnings and payouts
    StripeConnect.tsx        — Stripe Connect onboarding
    RideHistory.tsx          — Completed rides
    DebugPanel.tsx           — Debug overlay
    ErrorBoundary.tsx        — Error boundary
    map/                     — Map components
      MapView.tsx            — Core Leaflet map
      
  layout/
    MapShell.tsx             — Full-screen map with floating UI
    mapShell.css             — Map layout styles
    
  native/
    ShiftXNavigation.ts      — Native navigation interface
    ShiftXNavigationIOS.ts   — iOS Mapbox navigation
    ShiftXNavigationWeb.ts   — Web fallback
    
  routing/
    routeMatching.ts         — Route matching algorithms
    gpsFixes.ts              — GPS data processing
    
  utils/
    eventLog.ts              — Event logging system
    runtimeFlags.ts          — Feature flags
    gpsMonitor.ts            — GPS status monitoring
```

**Features:**
- Real-time ride offer notifications
- Turn-by-turn navigation (iOS native, web fallback)
- Dual-leg route visualization (pickup → dropoff)
- Camera modes (Follow driver, Overview route)
- Online/offline status management
- Earnings tracking and analytics
- Stripe Connect integration
- Ride acceptance/rejection workflow
- GPS monitoring and diagnostics

---

### packages/driver-client/ — Shared Client Library

**Purpose:** Provides typed wrappers for Firebase Cloud Functions callables

**Key Files:**
```
src/
  index.ts                   — Main exports
  types.ts                   — Shared TypeScript types
  callables/
    rides.ts                 — Ride-related callables
    drivers.ts               — Driver-specific callables
    payments.ts              — Payment callables
```

**Exported Functions:**
- `tripRequest(payload)` — Request a ride
- `tripCancel(payload)` — Cancel a ride
- `tripAccept(payload)` — Driver accepts ride
- `tripStart(payload)` — Start ride
- `tripComplete(payload)` — Complete ride
- `createStripeSetupIntent()` — Payment setup

---

### packages/admin-dashboard/ — Admin Dashboard

**Tech Stack:** React + TypeScript + Vite + Firebase Admin

**Purpose:** Admin tools for managing drivers, rides, and system configuration

---

### packages/ios-customer/ & packages/ios-driver/

**Tech Stack:** Capacitor iOS

**Purpose:** Native iOS wrappers for web apps with native feature access

**Key Features:**
- Push notifications
- Location services
- Camera access
- Native navigation (driver app)

---

## Backend - Cloud Functions

### functions/ — Firebase Cloud Functions

**Tech Stack:** Node.js + TypeScript + Firebase Admin SDK

**Key Files:**
```
src/
  index.ts                   — Function exports
  
  trips/
    tripRequest.ts           — Handle ride requests
    tripCancel.ts            — Cancel rides
    tripAccept.ts            — Driver accepts ride
    tripStart.ts             — Start ride
    tripComplete.ts          — Complete ride
    
  payments/
    stripe/
      setupIntents.ts        — Payment method setup
      paymentIntents.ts      — Charge processing
      connect.ts             — Stripe Connect management
      
  notifications/
    rideOffers.ts            — Push ride offers to drivers
    statusUpdates.ts         — Notify customers of status changes
    
  triggers/
    onRideCreated.ts         — Firestore trigger on new rides
    onDriverLocationUpdate.ts — Real-time location processing
```

**Key Features:**
- Ride state machine enforcement
- Payment processing with Stripe
- Driver matching and dispatching
- Push notifications
- Analytics and logging
- Security rule enforcement

---

## Shared Resources

### docs/ — Documentation

```
architecture/
  FILES.md                   — This file
  
backend/
  CLOUD_FUNCTIONS.md         — Cloud Functions documentation
  
customer-app/
  QUICKSTART.md              — Quick start guide
  IMPLEMENTATION_GUIDE.md    — Detailed implementation
  BUILD_COMPLETE.md          — Build summary
  
driver-app/
  DRIVER_UI_PHASE2.md        — Phase 2 UI implementation
  DRIVER_UI_PHASE4B_native_navigation.md  — Native nav docs
  DRIVER_UI_PHASE4G_route_polylines.md    — Route visualization
  
deployment/
  DEPLOYMENT_STATUS.md       — Deployment tracking
  
features/
  STRIPE_CONNECT_SETUP.md    — Stripe setup guide
  ACTIVE_RIDE_CANCELLATION.md — Cancellation logic
```

---

## Legacy Code

### lib/ — Flutter/Dart Code (Legacy)

**Status:** Not actively used, kept for reference

The original ShiftX was built with Flutter. This code is preserved for reference but the active codebase is now TypeScript/React.

---

## Configuration Files

### Root Level

- `firebase.json` — Firebase project configuration
- `firestore.rules` — Firestore security rules
- `firestore.indexes.json` — Firestore indexes
- `storage.rules` — Cloud Storage security rules
- `package.json` — Workspace configuration
- `.firebaserc` — Firebase project aliases

---

## Build & Development

### Build Commands

```bash
# Customer app
cd packages/customer-app
npm run dev          # Development server
npm run build        # Production build

# Driver app
cd packages/driver-app
npm run dev          # Development server
npm run build        # Production build

# Cloud Functions
cd functions
npm run build        # Build functions
npm run deploy       # Deploy to Firebase
```

### Environment Configuration

Both apps support multiple environments:
- Development (local emulators)
- Staging (Firebase staging project)
- Production (Firebase production project)

Configuration is via environment variables in `.env` files.

---

## Key Technologies

### Frontend Stack
- **React 18** — UI framework
- **TypeScript** — Type safety
- **Vite** — Build tool and dev server
- **Leaflet** — Map visualization
- **Firebase SDK** — Auth, Firestore, Functions
- **Capacitor** — Native iOS capabilities

### Backend Stack
- **Firebase Cloud Functions** — Serverless backend
- **Firestore** — NoSQL database
- **Firebase Auth** — User authentication
- **Cloud Storage** — File storage
- **Stripe** — Payment processing

### Development Tools
- **ESLint** — Code linting
- **Prettier** — Code formatting
- **TypeScript** — Type checking
- **Vite** — Fast HMR and builds

---

## Next Steps

### For New Developers

1. Read [SETUP.md](../SETUP.md) for initial setup
2. Review [DEV_ONBOARDING.md](../DEV_ONBOARDING.md) for development workflow
3. Check package-specific README files:
   - [packages/customer-app/README.md](../../packages/customer-app/README.md)
   - [packages/driver-app/README.md](../../packages/driver-app/README.md)

### For Documentation Updates

When adding new files or making architectural changes:
1. Update this file (FILES.md)
2. Update package-specific README files
3. Add detailed docs to appropriate subdirectories
4. Update CURRENT_STATE.md with high-level changes

---

**Maintained by:** ShiftX Engineering Team  
**Questions?** See [DEV_ONBOARDING.md](../DEV_ONBOARDING.md) or ask in Slack
