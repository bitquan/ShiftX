# Customer App Documentation

**Version:** 0.1.0  
**Last Updated:** January 19, 2026  
**Status:** ✅ Production-Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Package Structure](#package-structure)
3. [Key Features](#key-features)
4. [Key Components](#key-components)
5. [State Management](#state-management)
6. [API Integration](#api-integration)
7. [Real-time Updates](#real-time-updates)
8. [Payment Flow](#payment-flow)
9. [Environment Variables](#environment-variables)
10. [Build & Run](#build--run)
11. [Testing](#testing)

---

## Overview

The ShiftX Customer App is a modern, production-ready web application that enables customers to request rides, track drivers in real-time, make payments, and manage their ride history. Built with performance and user experience as top priorities.

### Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3.0 | UI framework with hooks and functional components |
| **TypeScript** | 5.3.3 | Type-safe development with strict mode |
| **Vite** | 5.0.0 | Fast build tool with HMR (Hot Module Replacement) |
| **Leaflet** | 1.9.4 | Interactive maps with tile layers |
| **React Leaflet** | 4.2.1 | React bindings for Leaflet maps |
| **Firebase** | 11.10.0 | Authentication, Firestore, Cloud Functions, Storage |
| **Stripe** | 8.6.1 / 5.4.1 | Payment processing (js + react-stripe-js) |

### Architecture Principles

- **Single Firebase Instance**: Peer dependencies prevent duplication
- **Type Safety**: 100% TypeScript with strict mode enabled
- **Real-time First**: Firestore snapshots for instant updates (<500ms)
- **Component Composition**: Small, reusable components with clear responsibilities
- **Error Resilience**: Comprehensive error handling with user-friendly messages
- **Performance**: Bundle size optimized (202KB gzipped)

### Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 90+)

---

## Package Structure

```
packages/customer-app/
├── src/
│   ├── components/           # React components
│   │   ├── AuthGate.tsx     # Authentication UI
│   │   ├── RequestRide.tsx  # Ride booking form with map
│   │   ├── RideStatus.tsx   # Real-time ride tracking
│   │   ├── RideHistory.tsx  # Past rides list
│   │   ├── PaymentAuthorize.tsx  # Stripe payment UI
│   │   ├── Receipt.tsx      # Post-ride receipt
│   │   ├── CustomerWallet.tsx    # Payment methods
│   │   ├── Profile.tsx      # User profile & settings
│   │   ├── Toast.tsx        # Notification system
│   │   ├── ErrorBoundary.tsx     # Error fallback UI
│   │   ├── AddressAutocomplete.tsx   # Location search
│   │   ├── RideTimeline.tsx # Visual status timeline
│   │   ├── SavedPlaces.tsx  # Home/work shortcuts
│   │   ├── Invite.tsx       # Driver invite flow
│   │   ├── map/             # Map components
│   │   │   ├── SharedMap.tsx     # Leaflet map wrapper
│   │   │   ├── RouteLine.tsx     # Polyline renderer
│   │   │   ├── FitBoundsOnce.tsx # Auto-zoom utility
│   │   │   └── MapCenterOnce.tsx # Center utility
│   │   └── ui/              # UI primitives
│   │       └── TripCard.tsx # Ride info card
│   ├── hooks/               # Custom React hooks
│   │   ├── useDriverEta.ts  # ETA calculation
│   │   ├── useFareEstimate.ts    # Price estimation
│   │   ├── useForwardGeocode.ts  # Address → coordinates
│   │   ├── useReverseGeocode.ts  # Coordinates → address
│   │   ├── useNearbyDrivers.ts   # Driver availability
│   │   └── useRoutePolyline.ts   # Route rendering
│   ├── utils/               # Utility functions
│   │   ├── configValidation.ts   # Config checker
│   │   ├── geolocation.ts   # GPS utilities
│   │   ├── stripeMode.ts    # Stripe mode logger
│   │   └── runtimeFlags.ts  # Dynamic feature flags
│   ├── types/               # TypeScript definitions
│   │   └── rebook.ts        # Rebook payload type
│   ├── config/              # Configuration
│   │   └── featureFlags.ts  # Feature toggles
│   ├── layout/              # Layout components
│   │   └── MapShell.tsx     # Map container
│   ├── styles/              # CSS modules
│   │   └── RideTimeline.css # Timeline styles
│   ├── App.tsx              # Root component
│   ├── main.tsx             # Entry point
│   ├── firebase.ts          # Firebase initialization
│   └── styles.css           # Global styles
├── public/                  # Static assets
├── dist/                    # Build output
├── .env.example             # Environment template
├── .env.development         # Dev environment
├── .env.production          # Prod environment
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── vite.config.ts           # Vite config
├── index.html               # HTML entry
└── README.md                # Implementation summary
```

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `App.tsx` | Root component with auth and routing | ~350 |
| `RequestRide.tsx` | Ride booking UI with map interaction | ~800 |
| `RideStatus.tsx` | Real-time ride tracking display | ~600 |
| `PaymentAuthorize.tsx` | Stripe payment authorization | ~400 |
| `firebase.ts` | Firebase SDK initialization | ~40 |
| `featureFlags.ts` | Production feature toggles | ~70 |

---

## Key Features

### 1. **Ride Requests**

Submit ride requests with pickup/dropoff coordinates, service class selection, and optional scheduling.

**Capabilities:**
- Interactive map for location selection
- Address autocomplete with forward geocoding
- Multiple service classes (ShiftX, ShiftX Premium, ShiftX XL)
- Real-time fare estimation
- Saved places (Home, Work, custom)
- Preferred driver selection
- Scheduled rides (future pickup time)
- Metadata support (special instructions)

**User Flow:**
1. Customer opens app → sees RequestRide screen
2. Taps map or uses autocomplete for pickup
3. Taps map or uses autocomplete for dropoff
4. Selects service class (default: ShiftX)
5. Reviews fare estimate
6. Optionally schedules for later
7. Taps "Request Ride" → `tripRequest` callable invoked
8. Redirects to RideStatus screen

### 2. **Real-time Tracking**

Live updates on ride status, driver location, and ETA.

**Capabilities:**
- Visual timeline with 7 states (requested → completed)
- Driver location on map (updates every 5-30s)
- Route polyline (pickup → dropoff)
- Driver ETA to pickup (when accepted/started)
- Driver profile (name, photo, rating, vehicle)
- Trip details (distance, duration, fare)
- Automatic status transitions
- Search timeout countdown (60-90s)

**Status States:**
1. `requested` - Ride created, searching for driver
2. `dispatching` - Searching active drivers
3. `offered` - Offered to specific driver(s)
4. `accepted` - Driver accepted, en route to pickup
5. `started` - Driver arrived at pickup
6. `in_progress` - Customer on board, heading to dropoff
7. `completed` - Trip finished, payment captured

### 3. **Payment Flow**

Secure Stripe integration with payment authorization and capture.

**Capabilities:**
- Saved payment methods (cards on file)
- New card entry with validation
- Payment Intent authorization (pre-auth)
- Automatic capture after ride completion
- Receipt generation with breakdown
- Refund support (via admin dashboard)
- Test mode / Live mode indicators

**Payment States:**
- `pending` - No payment method selected
- `requires_payment_method` - Needs card info
- `requires_confirmation` - Card entered, ready to authorize
- `processing` - Stripe processing authorization
- `authorized` - Pre-authorized, funds held
- `captured` - Payment completed, funds transferred
- `cancelled` - Ride cancelled, auth released

### 4. **Ride History**

View past rides with receipts and rebook options.

**Capabilities:**
- Chronological list of completed rides
- Ride details (date, route, fare, driver)
- Receipt download/view
- Rebook with same route
- Filter by date range
- Search by location
- Export to CSV (future)

### 5. **Address Autocomplete**

Fast location search with Mapbox Geocoding API.

**Capabilities:**
- Forward geocoding (address → coordinates)
- Reverse geocoding (coordinates → address)
- Autocomplete suggestions
- Recent searches
- Saved places prioritization
- Bias to user's current location
- Debounced API calls (300ms)

### 6. **Profile Management**

User settings and preferences.

**Capabilities:**
- Profile photo upload (Firebase Storage)
- Display name
- Email (read-only, from auth)
- Phone number
- Saved places management
- Preferred drivers list
- Payment methods
- Notification preferences
- Sign out

---

## Key Components

### `App.tsx`

**Purpose:** Root component managing auth state, routing, and global state.

**Responsibilities:**
- Firebase initialization
- Auth state listener
- User/customer document creation
- App-level state (current screen, ride ID)
- Toast notification provider
- Error boundary wrapper
- Config validation
- Runtime flags watcher

**State:**
```typescript
const [user, setUser] = useState<User | null>(null);
const [appState, setAppState] = useState<'request-ride' | 'ride-status' | 'ride-history' | 'wallet' | 'invite'>();
const [rideId, setRideId] = useState<string | null>(null);
const [onboardingStatus, setOnboardingStatus] = useState<'pending' | 'active' | 'suspended'>();
const [showProfile, setShowProfile] = useState(false);
```

**Key Methods:**
- `handleRideRequested(rideId)` - Navigate to RideStatus
- `handleRideCompleted()` - Navigate back to RequestRide
- `handleViewHistory()` - Navigate to RideHistory
- `handleSignOut()` - Sign out and reset state

---

### `AuthGate.tsx`

**Purpose:** Authentication UI with sign-in/sign-up forms.

**Features:**
- Email/password authentication
- Form validation
- Error handling (user-not-found, wrong-password, email-in-use)
- Toggle between sign-in/sign-up modes
- Sign-out button in header

**Firebase Methods:**
- `signInWithEmailAndPassword(auth, email, password)`
- `createUserWithEmailAndPassword(auth, email, password)`
- `signOut(auth)`

---

### `RequestRide.tsx`

**Purpose:** Ride booking form with interactive map.

**Features:**
- Leaflet map with dark tiles (Mapbox)
- Click-to-select pickup/dropoff
- Address autocomplete
- Service class selection (ShiftX, Premium, XL)
- Fare estimation
- Saved places shortcuts
- Preferred driver selection
- Schedule ride option
- Nearby drivers indicator

**Form State:**
```typescript
const [pickup, setPickup] = useState<LatLng | null>(null);
const [dropoff, setDropoff] = useState<LatLng | null>(null);
const [selectedService, setSelectedService] = useState<VehicleClass>('shiftx');
const [isScheduled, setIsScheduled] = useState(false);
const [scheduledTime, setScheduledTime] = useState('');
```

**Key Methods:**
- `handleRequestRide()` - Submit ride request
- `handleMapClick(e)` - Set pickup/dropoff from map
- `handleAutocompleteSelect(place)` - Set from autocomplete
- `handleGetCurrentLocation()` - Use GPS for pickup
- `handleUseSavedPlace(place)` - Use home/work

**API Calls:**
```typescript
const tripRequestFn = httpsCallable(functions, 'tripRequest');
const result = await tripRequestFn({
  pickup: { lat: 40.7128, lng: -74.0060 },
  dropoff: { lat: 40.7580, lng: -73.9855 },
  vehicleClass: 'shiftx',
  scheduledPickupTimeMs: 1234567890,
  metadata: { notes: 'Handle with care' }
});
```

---

### `RideStatus.tsx`

**Purpose:** Real-time ride tracking with visual timeline.

**Features:**
- Firestore listener on `rides/{rideId}`
- Visual timeline (7 states)
- Driver location marker
- Route polyline
- Driver ETA countdown
- Cancel ride button (conditionally shown)
- Payment authorization trigger
- Receipt display after completion

**Real-time Listener:**
```typescript
useEffect(() => {
  const rideRef = doc(db, 'rides', rideId);
  const unsubscribe = onSnapshot(rideRef, (snap) => {
    if (snap.exists()) {
      setRide({ id: snap.id, ...snap.data() } as Ride);
    }
  }, (error) => {
    console.error('Firestore listener error:', error);
  });
  return () => unsubscribe();
}, [rideId]);
```

**Cancel Logic:**
```typescript
const handleCancel = async () => {
  try {
    const cancelFn = httpsCallable(functions, 'tripCancel');
    await cancelFn({ rideId, reason: 'Customer cancelled' });
    show('Ride cancellation requested', 'success');
  } catch (error) {
    setCancelError(convertErrorMessage(error));
  }
};
```

---

### `PaymentAuthorize.tsx`

**Purpose:** Stripe payment authorization UI.

**Features:**
- Stripe Elements integration
- CardElement for new card entry
- Saved payment method display
- Payment Intent confirmation
- Error handling (card_declined, insufficient_funds)
- Loading states
- Success callback

**Payment Flow:**
```typescript
// 1. Get client secret from backend
const getPaymentStateFn = httpsCallable(functions, 'getPaymentState');
const { clientSecret } = await getPaymentStateFn({ rideId });

// 2. Confirm Payment Intent with Stripe
const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: savedPaymentMethod?.id || {
    card: elements.getElement(CardElement),
  }
});

// 3. Notify backend of confirmation
const confirmFn = httpsCallable(functions, 'customerConfirmPayment');
await confirmFn({ rideId });
```

---

### `RideTimeline.tsx`

**Purpose:** Visual representation of ride status progression.

**Rendering:**
```tsx
<div className="ride-timeline">
  {RIDE_TIMELINE.map((state, idx) => (
    <div key={state} className={`timeline-item ${
      currentState === state ? 'current' : 
      idx < currentIndex ? 'completed' : 'future'
    }`}>
      <div className="timeline-dot" />
      <div className="timeline-label">{state}</div>
    </div>
  ))}
</div>
```

**Styles:**
- Current state: Glowing effect, full opacity
- Completed states: Full opacity, green checkmark
- Future states: 30% opacity, gray

---

### Map Components

#### `SharedMap.tsx`
Leaflet MapContainer wrapper with default configuration.

**Props:**
```typescript
{
  center: LatLng;
  zoom: number;
  children: ReactNode;
  className?: string;
}
```

#### `RouteLine.tsx`
Polyline renderer for pickup → dropoff route.

**Props:**
```typescript
{
  positions: LatLng[];
  color?: string;
  weight?: number;
}
```

#### `FitBoundsOnce.tsx`
Auto-zoom map to show all markers (pickup, dropoff, driver).

**Props:**
```typescript
{
  bounds: LatLngBounds;
  key: string; // Change to re-fit
}
```

---

### `Toast.tsx`

**Purpose:** Global notification system.

**API:**
```typescript
const { show } = useToast();

show('Ride requested successfully', 'success');
show('Failed to cancel ride', 'error');
show('Driver is 2 minutes away', 'info');
```

**Types:** `success`, `error`, `info`, `warning`

**Auto-dismiss:** 5 seconds (configurable)

---

## State Management

### App-Level State

Managed in `App.tsx` with React hooks:

```typescript
// Auth state
const [user, setUser] = useState<User | null>(null);
const [isLoadingAuth, setIsLoadingAuth] = useState(true);

// Navigation state
const [appState, setAppState] = useState<AppState>('request-ride');

// Ride state
const [rideId, setRideId] = useState<string | null>(null);

// Customer state
const [onboardingStatus, setOnboardingStatus] = useState<'active' | 'pending' | 'suspended'>();
```

### Component-Level State

Each component manages its own local state:

**RequestRide:**
- Form inputs (pickup, dropoff, metadata)
- Loading states
- Validation errors
- Nearby drivers

**RideStatus:**
- Ride document (from Firestore listener)
- Cancel loading state
- Payment UI visibility
- Driver profile

**PaymentAuthorize:**
- Stripe Elements state
- Payment processing loading
- Error messages
- Client secret

### Persistent State

**localStorage:**
- Last ride ID (for recovery after refresh)
- Saved places (home, work)
- Recent searches

**Firestore:**
- User document (`users/{uid}`)
- Customer document (`customers/{uid}`)
- Ride document (`rides/{rideId}`)
- Payment methods (`customers/{uid}/paymentMethods/{id}`)

---

## API Integration

### Cloud Functions

All backend interactions use Firebase Callable Functions:

#### `tripRequest`

**Purpose:** Create a new ride request.

**Payload:**
```typescript
{
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  vehicleClass: 'shiftx' | 'shiftx_premium' | 'shiftx_xl';
  scheduledPickupTimeMs?: number;
  metadata?: { [key: string]: any };
  preferredDriverId?: string;
}
```

**Response:**
```typescript
{
  rideId: string;
  status: 'requested';
  estimatedFareCents: number;
}
```

**Usage:**
```typescript
const tripRequestFn = httpsCallable(functions, 'tripRequest');
const result = await tripRequestFn(payload);
const { rideId } = result.data;
```

---

#### `tripCancel`

**Purpose:** Cancel a ride request.

**Payload:**
```typescript
{
  rideId: string;
  reason: string;
}
```

**Response:**
```typescript
{
  success: true;
  cancelledAtMs: number;
}
```

**Error Codes:**
- `PERMISSION_DENIED` - Not your ride
- `FAILED_PRECONDITION` - Cannot cancel in current state
- `NOT_FOUND` - Ride doesn't exist

---

#### `customerConfirmPayment`

**Purpose:** Confirm payment authorization (after Stripe confirms).

**Payload:**
```typescript
{
  rideId: string;
}
```

**Response:**
```typescript
{
  success: true;
  paymentStatus: 'authorized';
}
```

---

#### `getPaymentState`

**Purpose:** Get current payment state for a ride.

**Payload:**
```typescript
{
  rideId: string;
}
```

**Response:**
```typescript
{
  paymentStatus: 'pending' | 'authorized' | 'captured';
  paymentIntentStatus: string | null;
  clientSecret: string | null;
  needsConfirm: boolean;
}
```

---

### Firestore Queries

#### Read Ride History

```typescript
const ridesRef = collection(db, 'rides');
const q = query(
  ridesRef, 
  where('riderId', '==', user.uid),
  where('status', '==', 'completed'),
  orderBy('completedAtMs', 'desc'),
  limit(20)
);
const snapshot = await getDocs(q);
```

#### Listen to Ride Updates

```typescript
const rideRef = doc(db, 'rides', rideId);
const unsubscribe = onSnapshot(rideRef, (snap) => {
  const ride = { id: snap.id, ...snap.data() };
  setRide(ride);
});
```

#### Get Customer Profile

```typescript
const customerRef = doc(db, 'customers', user.uid);
const snap = await getDoc(customerRef);
const customer = snap.data();
```

---

## Real-time Updates

### Firestore Listeners

The app uses `onSnapshot` for real-time updates:

**Ride Status:**
```typescript
useEffect(() => {
  const rideRef = doc(db, 'rides', rideId);
  
  const unsubscribe = onSnapshot(
    rideRef,
    (snapshot) => {
      if (snapshot.exists()) {
        setRide({ id: snapshot.id, ...snapshot.data() });
      }
    },
    (error) => {
      console.error('Listener error:', error);
      show('Failed to get ride updates', 'error');
    }
  );
  
  return () => unsubscribe(); // Cleanup on unmount
}, [rideId]);
```

**Update Frequency:**
- Status changes: Instant (<500ms)
- Driver location: Every 5-30 seconds (from driver app)
- Payment status: Instant after Stripe webhook

### Optimistic UI Updates

Some actions update UI optimistically before server confirmation:

**Cancel Ride:**
```typescript
const handleCancel = async () => {
  setLoading(true);
  // Optimistically disable button
  try {
    await cancelFn({ rideId });
    // Success - Firestore listener will update status
  } catch (error) {
    // Revert optimistic update
    setLoading(false);
  }
};
```

---

## Payment Flow

### Overview

```
1. Ride Completed (status: completed)
   ↓
2. RideStatus shows PaymentAuthorize component
   ↓
3. Customer enters card or selects saved method
   ↓
4. PaymentAuthorize calls getPaymentState → gets clientSecret
   ↓
5. Stripe.confirmCardPayment(clientSecret, paymentMethod)
   ↓
6. PaymentAuthorize calls customerConfirmPayment(rideId)
   ↓
7. Backend updates ride.paymentStatus = 'authorized'
   ↓
8. Backend captures payment (moves funds)
   ↓
9. RideStatus shows Receipt
```

### Stripe Setup

**Environment Variables:**
```bash
# Test mode (default)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51...

# Live mode (production)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_51...
```

**Initialization:**
```typescript
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

<Elements stripe={stripePromise}>
  <PaymentForm />
</Elements>
```

### Payment Intent Flow

**1. Create Payment Intent (Backend):**
```typescript
// Triggered when ride status changes to 'completed'
const paymentIntent = await stripe.paymentIntents.create({
  amount: ride.finalAmountCents || ride.priceCents,
  currency: 'usd',
  customer: stripeCustomerId,
  metadata: { rideId: ride.id },
  capture_method: 'manual', // Authorize only
});

await updateDoc(rideRef, {
  paymentIntentId: paymentIntent.id,
  paymentStatus: 'requires_confirmation',
  clientSecret: paymentIntent.client_secret,
});
```

**2. Confirm Payment Intent (Frontend):**
```typescript
const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: savedPaymentMethodId || {
    card: elements.getElement(CardElement),
    billing_details: {
      email: user.email,
    },
  },
});

if (error) {
  // Handle card_declined, insufficient_funds, etc.
  show(error.message, 'error');
} else if (paymentIntent.status === 'requires_capture') {
  // Notify backend
  await customerConfirmPaymentFn({ rideId });
}
```

**3. Capture Payment (Backend):**
```typescript
// After customer confirms, capture the authorized payment
const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

await updateDoc(rideRef, {
  paymentStatus: 'captured',
  paymentCapturedAtMs: Date.now(),
});
```

### Error Handling

| Error Code | User Message |
|------------|--------------|
| `card_declined` | "Your card was declined. Please try another card." |
| `insufficient_funds` | "Insufficient funds. Please use another card." |
| `expired_card` | "Your card has expired. Please update your payment method." |
| `incorrect_cvc` | "Incorrect CVC. Please check your card details." |
| `processing_error` | "Payment processing error. Please try again." |

---

## Environment Variables

### Required Variables

Create `.env.production` for production deployment:

```bash
# Mapbox (for dark map tiles)
VITE_MAPBOX_TOKEN=pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjaXl6aGVyc2UifQ.example

# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyCi9fz_lpRJh1dEnmRekGVh3Jc9JAyYHnU
VITE_FIREBASE_AUTH_DOMAIN=shiftx-95c4b.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=shiftx-95c4b
VITE_FIREBASE_STORAGE_BUCKET=shiftx-95c4b.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=928827778230
VITE_FIREBASE_APP_ID=1:928827778230:web:ac7b78dcf4d7b93d22f217

# Stripe (use pk_test_ for testing, pk_live_ for production)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51SWRzNBN63mybdvOK838...
```

### Optional Feature Flags

```bash
# Development Tools (default: false in production)
VITE_ENABLE_DEV_TOOLS=false
VITE_ENABLE_DEBUG_PANEL=false
VITE_VERBOSE_LOGGING=false

# Feature Toggles (default: true)
VITE_ENABLE_SCHEDULED_CLEANUP=true
VITE_ENABLE_PAYMENTS=true
VITE_ENABLE_SAVED_PAYMENTS=true

# Operational Flags
VITE_SINGLE_DRIVER_MODE=false
VITE_SKIP_EMULATOR_CHECK=false
```

### Environment Files

| File | Purpose |
|------|---------|
| `.env.example` | Template for all variables |
| `.env.development` | Local development (emulators) |
| `.env.production` | Production deployment |
| `.env.local.example` | Local overrides (gitignored) |

---

## Build & Run

### Prerequisites

```bash
# Node.js 20+ and npm 10+
node --version  # v20.x.x
npm --version   # 10.x.x

# Install dependencies (from monorepo root)
npm install
```

### Development Mode

```bash
# Navigate to customer app
cd packages/customer-app

# Start dev server with HMR
npm run dev

# App available at http://localhost:5173
# HMR enabled for fast iteration
```

**Development Features:**
- Hot Module Replacement (instant updates)
- Firebase Emulators (Auth, Firestore, Functions, Storage)
- Debug panel (enabled by default)
- Dev tools (seed data, test buttons)
- Verbose logging

### Production Build

```bash
# Build for production
npm run build

# Output: dist/ directory
# Bundle size: ~784KB uncompressed, ~202KB gzipped
# Build time: <1 second

# Preview production build locally
npm run preview
# Available at http://localhost:4173
```

### Firebase Deployment

```bash
# Deploy to Firebase Hosting
firebase deploy --only hosting:customer

# Deploy all (hosting + functions + firestore rules)
firebase deploy
```

### Build Configuration

**vite.config.ts:**
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // Allows iOS simulator access
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': '/src',  // Import aliases: @/components/...
    },
  },
  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions'],
  },
});
```

### TypeScript Configuration

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "jsx": "react-jsx",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  }
}
```

### Bundle Analysis

```bash
# Install bundle analyzer
npm install --save-dev rollup-plugin-visualizer

# Add to vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [
  react(),
  visualizer({ filename: 'dist/stats.html' })
]

# Build and open stats.html
npm run build
open dist/stats.html
```

---

## Testing

### Manual Testing Procedures

Comprehensive manual testing checklist available in `/packages/customer-app/MANUAL_TEST_CHECKLIST.md`.

#### Test Groups

**1. Authentication (4 tests)**
- Sign up with new email
- Sign in with existing email
- Sign out
- Auth persistence after reload

**2. User Document Creation (2 tests)**
- User document created on first login
- Customer document created on first login

**3. Request Ride (4 tests)**
- Select pickup on map
- Select dropoff on map
- Use address autocomplete
- Submit ride request

**4. Form Validation (3 tests)**
- Missing pickup coordinates
- Missing dropoff coordinates
- Invalid coordinates

**5. Real-time Updates (5 tests)**
- Ride status changes (requested → dispatching → offered)
- Driver acceptance (offered → accepted)
- Trip start (accepted → started → in_progress)
- Trip completion (in_progress → completed)
- Cancellation updates

**6. Cancel Ride (6 tests)**
- Cancel in 'requested' state
- Cancel in 'offered' state
- Cannot cancel after 'accepted'
- Cancel error handling

**7. Payment Flow (4 tests)**
- Payment UI appears after completion
- Enter new card
- Use saved payment method
- Payment authorization

**8. Ride History (3 tests)**
- View completed rides
- Ride details display
- Rebook previous ride

**9. UI/UX (5 tests)**
- Responsive design (mobile, tablet, desktop)
- Toast notifications
- Loading states
- Error messages
- Dark theme

**10. Performance (3 tests)**
- Real-time update latency (<500ms)
- Bundle size (<250KB gzipped)
- Time to Interactive (<3s)

### End-to-End Testing

**Prerequisites:**
1. Firebase emulators running (`npm run emulators` from repo root)
2. Customer app running (`npm run dev`)
3. Driver app or Firestore UI for driver actions

**Test Scenario: Complete Ride Flow**

```bash
# Terminal 1: Start emulators
cd /path/to/ShiftX
npm run emulators

# Terminal 2: Start customer app
cd packages/customer-app
npm run dev

# Browser: http://localhost:5173
```

**Steps:**
1. Sign up with `test@example.com` / `password123`
2. Verify user and customer documents in Firestore UI
3. Click map to set pickup (40.7128, -74.0060)
4. Click map to set dropoff (40.7580, -73.9855)
5. Click "Request Ride"
6. Verify ride created in Firestore UI
7. In Firestore UI, update ride status to 'accepted', add driverId
8. Verify UI updates to show "Driver Accepted"
9. Update ride status to 'started'
10. Update ride status to 'in_progress'
11. Update ride status to 'completed'
12. Verify payment UI appears
13. Enter test card: 4242 4242 4242 4242, exp 12/34, CVC 123
14. Click "Authorize Payment"
15. Verify payment authorized in Firestore UI
16. Verify receipt displayed

**Expected Results:**
- ✅ All status transitions update UI in <500ms
- ✅ No console errors
- ✅ Payment authorized successfully
- ✅ Receipt shows correct fare breakdown

### Regression Testing

Before each release, run full manual test suite:

```bash
# 1. Run linter
npm run lint

# 2. Build production bundle
npm run build

# 3. Run manual tests (MANUAL_TEST_CHECKLIST.md)
# 4. Test on multiple browsers (Chrome, Firefox, Safari)
# 5. Test on mobile devices (iOS Safari, Chrome Mobile)
```

### Load Testing

**Simulate Multiple Concurrent Users:**

Use Firebase Emulator with multiple browser tabs:

```bash
# Open 5-10 tabs of customer app
# Each tab signs in with different test user
# Each user requests ride simultaneously
# Monitor emulator logs for performance issues
```

**Expected Performance:**
- No errors under 10 concurrent users
- Firestore reads/writes complete in <500ms
- Cloud Functions respond in <2s

---

## Troubleshooting

### Common Issues

**Issue: "Service firestore is not available"**
- **Cause:** Multiple Firebase instances (dependency duplication)
- **Fix:** `npm ls firebase` to verify single instance, `npm install` from root

**Issue: "Failed to create ride"**
- **Cause:** Cloud Function error or emulator not running
- **Fix:** Check emulator logs, verify functions deployed

**Issue: "Payment authorization failed"**
- **Cause:** Invalid Stripe key or card declined
- **Fix:** Check `VITE_STRIPE_PUBLISHABLE_KEY`, use test card 4242...

**Issue: "Real-time updates not working"**
- **Cause:** Firestore listener not attached or auth issue
- **Fix:** Check auth state, verify Firestore rules, check listener cleanup

**Issue: Map not loading**
- **Cause:** Missing Mapbox token
- **Fix:** Set `VITE_MAPBOX_TOKEN` in `.env`

### Debug Mode

Enable verbose logging:

```typescript
// src/config/featureFlags.ts
export const featureFlags = {
  verboseLogging: true,
  enableDebugPanel: true,
};
```

### Browser DevTools

**Console Logs:**
```javascript
// Filter by prefix
[Customer] - Customer app logs
[Firebase] - Firebase SDK logs
[Stripe] - Stripe SDK logs
[PaymentAuthorize] - Payment component logs
```

**Network Tab:**
- Filter by `firestore.googleapis.com` for Firestore requests
- Filter by `cloudfunctions.net` for Cloud Function calls
- Filter by `api.stripe.com` for Stripe API calls

**Firestore Emulator UI:**
- View real-time data changes
- Manually update ride status for testing
- Inspect document structure

---

## Architecture Diagrams

### Component Hierarchy

```
App
├── ErrorBoundary
│   └── ToastProvider
│       ├── AuthGate (if not authenticated)
│       └── (if authenticated)
│           ├── RequestRide
│           │   ├── SharedMap
│           │   │   ├── MapClickHandler
│           │   │   ├── RouteLine
│           │   │   └── FitBoundsOnce
│           │   ├── AddressAutocomplete
│           │   ├── ServiceCard (multiple)
│           │   └── SavedPlaces
│           ├── RideStatus
│           │   ├── SharedMap
│           │   │   ├── RouteLine
│           │   │   └── Driver Marker
│           │   ├── RideTimeline
│           │   ├── PaymentAuthorize
│           │   │   └── Elements (Stripe)
│           │   │       └── CardElement
│           │   └── Receipt
│           ├── RideHistory
│           │   └── TripCard (multiple)
│           ├── CustomerWallet
│           │   └── Payment Method Cards
│           ├── Profile
│           │   └── ProfilePhotoUpload
│           └── Invite
```

### Data Flow

```
User Action → Component → Cloud Function → Firestore
                 ↓                            ↓
              Local State ← Firestore Listener ←
                 ↓
             UI Update
```

---

## Performance Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Bundle Size (gzipped) | <250KB | 202KB ✅ |
| Time to Interactive | <3s | ~2.1s ✅ |
| First Contentful Paint | <1.5s | ~1.2s ✅ |
| Real-time Update Latency | <500ms | ~300ms ✅ |
| Cloud Function Response | <2s | ~1.5s ✅ |
| Build Time | <2s | ~785ms ✅ |

---

## Security Considerations

### Firestore Rules

Customer app reads/writes are protected by Firestore security rules:

```javascript
// Customers can only read their own rides
match /rides/{rideId} {
  allow read: if request.auth != null && 
    resource.data.riderId == request.auth.uid;
}

// Customers can only update their own customer document
match /customers/{customerId} {
  allow read, write: if request.auth != null && 
    request.auth.uid == customerId;
}
```

### Environment Variables

**Never commit secrets:**
- `.env.production` is in `.gitignore`
- Use Firebase Hosting environment variables for production
- Rotate Stripe keys regularly

### XSS Protection

All user input is sanitized:
- React automatically escapes JSX values
- Metadata JSON is validated before storage
- No `dangerouslySetInnerHTML` used

### CORS

Cloud Functions CORS configuration:
```typescript
// Allow customer app origin only
cors({ origin: 'https://customer.shiftx.app' });
```

---

## Contributing

### Code Style

- Use TypeScript strict mode
- Functional components with hooks (no class components)
- Prettier for formatting (2 spaces, single quotes)
- ESLint for linting

### Component Guidelines

1. One component per file
2. Props interface at top of file
3. Group useState hooks together
4. useEffect cleanup functions for listeners
5. Memoize expensive computations with useMemo

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/ride-sharing

# Make changes, commit
git add .
git commit -m "feat: add ride sharing feature"

# Push and create PR
git push origin feature/ride-sharing
```

---

## Future Enhancements

### Short Term
- [ ] Push notifications for ride updates
- [ ] In-app chat with driver
- [ ] Driver rating and reviews
- [ ] Promo codes and discounts
- [ ] Multi-language support (i18n)

### Medium Term
- [ ] Scheduled rides (pick-up in future)
- [ ] Multiple stops (A → B → C)
- [ ] Split fare with friends
- [ ] Accessibility improvements (WCAG 2.1 AA)
- [ ] Progressive Web App (PWA)

### Long Term
- [ ] Ride pooling (carpool)
- [ ] Corporate accounts
- [ ] API for third-party integrations
- [ ] Advanced analytics dashboard
- [ ] Carbon offset program

---

## Resources

### Documentation
- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev)
- [Leaflet Documentation](https://leafletjs.com/reference.html)
- [Stripe Documentation](https://stripe.com/docs)

### Internal Docs
- `/packages/customer-app/README.md` - Implementation summary
- `/packages/customer-app/MANUAL_TEST_CHECKLIST.md` - Test procedures
- `/packages/customer-app/BUILD_COMPLETE.md` - Build details
- `/packages/customer-app/IMPLEMENTATION_GUIDE.md` - Technical guide

### Support
- GitHub Issues: [ShiftX Repository](https://github.com/your-org/ShiftX/issues)
- Slack: #customer-app channel
- Email: support@shiftx.app

---

**Document Version:** 1.0.0  
**Last Reviewed:** January 19, 2026  
**Next Review:** February 19, 2026
