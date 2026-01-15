# ShiftX File Structure

## Active Codebase (Production)

### 📱 Frontend Applications

#### `/packages/customer-app/` - Customer Web App
```
customer-app/
├── src/
│   ├── components/          # React components
│   │   ├── RideStatus.tsx   # Main ride status view with timeline
│   │   ├── RideTimeline.tsx # Event-based ride timeline
│   │   ├── RequestRide.tsx  # Ride request form with map
│   │   ├── RideHistory.tsx  # Past rides with receipts
│   │   ├── Receipt.tsx      # Trip receipt display
│   │   ├── AuthGate.tsx     # Authentication wrapper
│   │   ├── Toast.tsx        # Toast notification system
│   │   ├── map/
│   │   │   ├── SharedMap.tsx        # Unified map component
│   │   │   └── RouteLine.tsx        # Route polyline renderer
│   │   └── ui/
│   │       └── TripCard.tsx         # Trip details card
│   ├── hooks/
│   │   ├── useRoutePolyline.ts      # OSRM route fetching
│   │   ├── useDriverEta.ts          # Driver ETA calculation
│   │   ├── useNearbyDrivers.ts      # Nearby driver locations
│   │   └── useReverseGeocode.ts     # Address lookup
│   ├── firebase.ts          # Firebase initialization
│   ├── App.tsx              # Main app component
│   └── styles.css           # Global styles
├── public/                  # Static assets
├── dist/                    # Build output (deployed)
├── package.json
├── vite.config.ts
└── tsconfig.json
```

#### `/packages/driver-app/` - Driver Web App
```
driver-app/
├── src/
│   ├── components/
│   │   ├── ActiveRide.tsx          # Active ride management
│   │   ├── DriverHome.tsx          # Home dashboard with earnings
│   │   ├── AvailableRides.tsx      # Ride offer list
│   │   ├── RideOfferModal.tsx      # New ride offer popup
│   │   ├── BottomNav.tsx           # Bottom navigation bar
│   │   ├── Toast.tsx               # Toast notifications
│   │   └── map/
│   │       └── SharedMap.tsx       # Unified map component (shared)
│   ├── hooks/
│   │   ├── useRoutePolyline.ts     # Route fetching
│   │   └── useHeartbeat.ts         # GPS heartbeat system
│   ├── config/
│   │   └── featureFlags.ts         # Feature toggles
│   ├── firebase.ts          # Firebase initialization
│   ├── App.tsx              # Main app component
│   └── styles.css           # Global styles
├── dist/                    # Build output (deployed)
├── package.json
└── vite.config.ts
```

#### `/packages/driver-client/` - Shared Client SDK
```
driver-client/
├── src/
│   ├── index.ts             # Main exports
│   ├── types.ts             # TypeScript types
│   └── demoDriverFlow.ts    # Demo/test utilities
├── package.json
└── tsconfig.json
```

### ⚙️ Backend (Cloud Functions)

#### `/functions/` - Firebase Cloud Functions
```
functions/
├── src/
│   ├── index.ts             # Function exports
│   ├── rides.ts             # Ride lifecycle functions
│   │   ├── tripRequest      # Create ride
│   │   ├── acceptRide       # Driver accepts ride
│   │   ├── startRide        # Start ride
│   │   ├── progressRide     # Mark in progress
│   │   ├── completeRide     # Complete ride + ledger
│   │   ├── cancelRide       # Cancel ride
│   │   ├── getRideEvents    # Fetch timeline events
│   │   └── getRideHistory   # Customer ride history
│   ├── driver.ts            # Driver functions
│   │   ├── driverSetOnline  # Set online/offline
│   │   ├── driverHeartbeat  # GPS location update
│   │   ├── setDriverAvailability
│   │   └── getDriverLedgerSummary
│   ├── payment.ts           # Payment functions
│   │   ├── customerConfirmPayment
│   │   ├── setPaymentAuthorized
│   │   └── addPaymentMethod
│   ├── eventLog.ts          # Event logging system
│   │   ├── logRideEvent     # Log event to timeline
│   │   └── getRideEvents    # Fetch events
│   └── cleanup.ts           # Maintenance functions
├── lib/                     # Compiled JavaScript
├── package.json
├── tsconfig.json
└── .env                     # Environment variables (Stripe keys)
```

### 🔒 Security & Configuration

```
/
├── firestore.rules          # Firestore security rules
├── firestore.indexes.json   # Composite indexes
├── firebase.json            # Firebase config (hosting, functions)
├── .firebaserc              # Firebase project config
└── service-account-key.json # Admin SDK credentials (gitignored)
```

### 🧪 Testing & Scripts

```
/
├── scripts/
│   └── test-ride-e2e.ts     # End-to-end ride flow test
├── packages/rules-tests/    # Firestore rules tests
└── test/                    # Legacy Dart tests (not used)
```

### 📚 Documentation

```
/docs/
├── INDEX.md                 # Documentation index
├── ARCHITECTURE.md          # System architecture
├── backend-contract.md      # API contracts
├── FUNCTIONS.md             # Cloud Functions details
├── SETUP.md                 # Development setup
├── DEVELOPMENT.md           # Development workflow
├── DEPLOYMENT.md            # Deployment guide
├── PRODUCTION_READINESS.md  # Production checklist
├── QA_CHECKLIST.md          # Testing procedures
├── STRIPE_SETUP.md          # Payment setup
├── customer-app/            # Customer app docs
│   ├── BUILD_COMPLETE.md
│   ├── IMPLEMENTATION_GUIDE.md
│   ├── INTEGRATION_TESTS.md
│   ├── MANUAL_TEST_CHECKLIST.md
│   └── QUICKSTART.md
└── driver-app/              # Driver app docs
    └── ROUTING.md
```

---

## Legacy/Unused Files (Not in Production)

### Flutter/Dart Codebase
```
/lib/                        # Legacy Flutter app (not deployed)
/test/                       # Dart tests (superseded by web apps)
/android/                    # Android build (not used)
/ios/                        # iOS build (not used)
/linux/                      # Linux build (not used)
/macos/                      # macOS build (not used)
/windows/                    # Windows build (not used)
/web/                        # Flutter web (superseded by React apps)
pubspec.yaml                 # Dart dependencies (not used)
analysis_options.yaml        # Dart linter (not used)
```

**Status:** The original Flutter monorepo is preserved for reference but not actively maintained. All production code is in `/packages/` (React apps) and `/functions/` (Cloud Functions).

---

## Build Outputs & Dependencies

### Build Artifacts (Gitignored)
```
/packages/*/dist/            # Vite build output
/packages/*/node_modules/    # NPM dependencies
/functions/lib/              # Compiled Cloud Functions
/build/                      # Flutter build (legacy)
/coverage/                   # Test coverage
/.firebase/                  # Firebase cache
```

### Configuration
```
/packages/*/package.json     # NPM dependencies and scripts
/packages/*/tsconfig.json    # TypeScript config
/packages/*/vite.config.ts   # Vite bundler config
/packages/*/.env             # Environment variables (gitignored)
/packages/*/.env.example     # Environment template
```

---

## Key Directories Explained

### `/packages/` - Production Frontend
- **customer-app**: Customer-facing ride request and tracking
- **driver-app**: Driver dashboard, ride management, earnings
- **driver-client**: Shared Firebase utilities for both apps
- **rules-tests**: Firestore security rules unit tests

### `/functions/` - Production Backend
- **src/rides.ts**: All ride lifecycle management
- **src/driver.ts**: Driver profile, GPS, earnings
- **src/payment.ts**: Stripe payment integration
- **src/eventLog.ts**: Ride event timeline system

### `/docs/` - Documentation
- Comprehensive guides for setup, development, deployment
- Architecture and design documentation
- Testing and QA procedures
- Production readiness checklists

### `/scripts/` - Automation
- **test-ride-e2e.ts**: Automated end-to-end testing
- Uses Firebase Admin SDK to simulate full ride flow

---

## File Naming Conventions

### React Components
- **PascalCase.tsx**: Components (RideStatus.tsx)
- **camelCase.ts**: Hooks, utilities (useRoutePolyline.ts)
- **camelCase.css**: Styles (RideTimeline.css)

### Cloud Functions
- **camelCase.ts**: Source files (rides.ts, driver.ts)
- **camelCase**: Exported functions (tripRequest, acceptRide)

### Documentation
- **UPPERCASE.md**: Project-wide docs (README.md, SETUP.md)
- **lowercase.md**: Technical references (backend-contract.md)

---

## Deployment Targets

### Firebase Hosting
- **customer**: https://shiftx-95c4b-customer.web.app
- **driver**: https://shiftx-95c4b-driver.web.app

### Firebase Cloud Functions
- **Region**: us-central1
- **Runtime**: Node.js 20
- **Gen**: 2nd generation

### Firebase Services
- **Firestore**: NoSQL database
- **Auth**: Anonymous authentication
- **Storage**: (not currently used)

---

## Environment Variables

### Customer App (`.env`)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_ROUTING_PROVIDER=osrm|mapbox|google|none
VITE_ROUTING_API_KEY=
VITE_OSRM_BASE_URL=http://localhost:5005
```

### Driver App (`.env`)
```
(Same as customer app)
```

### Cloud Functions (`.env`)
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

**Last Updated:** January 13, 2026
