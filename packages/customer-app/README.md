# ShiftX Customer App

**Status:** Production Ready (UI Enhanced - Jan 2026)  
**Version:** Phase 2 (Sync with Driver UI Quality)  
**Tech Stack:** React 18 + TypeScript + Vite + Firebase + Leaflet + Stripe

---

## Overview

The ShiftX Customer App is a modern, map-based ride-hailing application for requesting and tracking rides in real-time. Built with React and TypeScript, it provides a seamless booking experience with live driver tracking, payment integration, and ride history.

### Key Features

✅ **Real-time Ride Booking** — Map-based pickup/dropoff selection with address search  
✅ **Live Driver Tracking** — Real-time driver location and ETA updates  
✅ **Payment Integration** — Stripe payment methods and receipt generation  
✅ **Ride History** — Complete trip history with details and receipts  
✅ **Saved Places** — Quick access to home, work, and favorite locations  
✅ **Preferred Drivers** — Request rides from specific drivers  
✅ **Multiple Service Classes** — ShiftX, Shift LX, Shift Black  
✅ **Fare Estimates** — Real-time pricing before booking  
✅ **Push Notifications** — Ride status updates and driver messages  

### Recent Improvements (Jan 2026)

- ✨ Enhanced CSS design system with semantic colors
- ✨ Improved scrollbar visibility in bottom sheet
- ✨ Added card variants for customer info, payment warnings
- ✨ Consistent spacing and typography using CSS variables
- ✨ Status badges and avatar styles
- ✨ Secondary and outline button variants

---

## Architecture

### Component Structure

```
MapShell (Full-screen layout)
├── Map Layer (Leaflet + route visualization)
├── UI Overlays
│   ├── FloatingTopBar (back button, menu)
│   ├── EnvironmentBadge (top-right)
│   └── DiagnosticsPanel (bottom-right)
└── BottomSheet (draggable panel)
    ├── RequestRide (booking form)
    ├── RideStatus (active ride tracking)
    ├── RideHistory (past trips)
    ├── CustomerWallet (payment methods)
    └── Profile (user settings)
```

### State Management

- **Local State** — React hooks (useState, useEffect)
- **Firebase Real-time** — Firestore listeners for ride updates
- **Navigation State** — Component-based navigation (request-ride, ride-status, etc.)

### Data Flow

```
User Action → Request Ride Form → Cloud Function (tripRequest)
                                         ↓
                                   Firestore writes
                                         ↓
                              Real-time listener updates
                                         ↓
                              RideStatus UI updates
```

---

## Development Setup

### Prerequisites

- Node.js 20+
- npm 10+
- Firebase project with Firestore and Functions
- Stripe account (for payment testing)

### Installation

```bash
# From repository root
npm install

# Install customer-app dependencies
cd packages/customer-app
npm install
```

### Environment Configuration

Create a `.env` file in `packages/customer-app/`:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key

# Emulator Mode (optional for local dev)
VITE_USE_EMULATOR=true
VITE_FIRESTORE_EMULATOR_HOST=localhost
VITE_FIRESTORE_EMULATOR_PORT=8081
VITE_FUNCTIONS_EMULATOR_HOST=localhost
VITE_FUNCTIONS_EMULATOR_PORT=5002
VITE_AUTH_EMULATOR_URL=http://localhost:9099

# Optional: Mapbox for geocoding
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token
```

### Development Server

```bash
npm run dev
```

Opens at `http://localhost:5173`

### Build

```bash
npm run build
```

Output: `dist/` directory

---

## Key Components

### RequestRide.tsx

Main booking interface with map selection and service options.

**Features:**
- Address autocomplete with geocoding
- Map-based pickup/dropoff selection
- Service class selector (ShiftX, LX, Black)
- Preferred driver selection
- Fare estimate display
- Payment method selector
- Booking confirmation

**Enhanced Styling:**
- Info cards with semantic colors
- Section headers with consistent typography
- Card-based layout with proper spacing
- Responsive button styles

### RideStatus.tsx

Real-time ride tracking and status display.

**Features:**
- Visual timeline of ride states
- Driver info (name, photo, rating, vehicle)
- Real-time driver location on map
- ETA countdown
- Cancel ride (in early states)
- Trip route visualization
- Customer support access

**Status States:**
- `requested` — Searching for driver
- `dispatching` — Driver being notified
- `offered` — Waiting for driver acceptance
- `accepted` — Driver on the way to pickup
- `started` — Driver at pickup location
- `in_progress` — Ride in progress
- `completed` — Trip finished

### AddressAutocomplete.tsx

Smart address search with geocoding.

**Features:**
- Mapbox/Google Places integration
- Recent searches
- Saved places (home, work)
- Coordinates fallback for manual entry
- Debounced search queries

### CustomerWallet.tsx

Payment method management.

**Features:**
- Add/remove payment methods
- Set default payment method
- View payment history
- Stripe integration

### RideHistory.tsx

Past trips list with details.

**Features:**
- Chronological trip list
- Trip details (date, route, fare)
- Receipt download
- Rebook previous trips
- Driver rating

---

## Styling System

The customer app now uses a comprehensive CSS design system matching the driver app quality.

### CSS Variables

```css
/* Spacing Scale */
--spacing-xs: 0.5rem;    /* 8px */
--spacing-sm: 0.75rem;   /* 12px */
--spacing-md: 1rem;      /* 16px */
--spacing-lg: 1.25rem;   /* 20px */
--spacing-xl: 1.5rem;    /* 24px */
--spacing-2xl: 2rem;     /* 32px */

/* Typography */
--text-xs: 0.75rem;      /* 12px */
--text-sm: 0.875rem;     /* 14px */
--text-base: 1rem;       /* 16px */
--text-lg: 1.125rem;     /* 18px */
--text-xl: 1.25rem;      /* 20px */

/* Semantic Colors */
--color-customer-primary: #60a5fa;      /* Blue for customer info */
--color-driver-primary: #10b981;        /* Green for driver/ready */
--color-payment-warning: #ffb703;       /* Yellow/orange for payment */
--color-action-primary: #fb8b24;        /* Primary actions */
--color-error: #ef4444;                 /* Errors */

/* Card Backgrounds */
--card-bg: rgba(26, 26, 26, 0.98);
--card-bg-subtle: rgba(255, 255, 255, 0.05);
--card-border: rgba(255, 255, 255, 0.1);
--card-padding: 1.5rem;  /* 24px */
```

### Card Components

```tsx
// Customer info card (blue tint)
<div className="info-card info-card-customer">
  <div className="section-header">Customer Details</div>
  <div className="row-md">
    <img src={photo} className="avatar" alt="Customer" />
    <div>Name: John Doe</div>
  </div>
</div>

// Payment warning (yellow tint)
<div className="info-card info-card-payment">
  <div className="section-header">Payment Notice</div>
  <p>Please update your payment method</p>
</div>

// Success state (green tint)
<div className="info-card info-card-success">
  <div className="section-header">Ride Complete</div>
  <p>Thank you for riding with ShiftX!</p>
</div>
```

### Button Styles

```tsx
// Primary action (gradient)
<button className="button-primary">Request Ride</button>

// Secondary action
<button className="button-secondary">View History</button>

// Outline style (blue)
<button className="button-outline-blue">Add Payment Method</button>

// Danger action (red)
<button className="button-danger">Cancel Ride</button>
```

### Spacing Helpers

```tsx
// Vertical stack with small gaps
<div className="stack-sm">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

// Horizontal row with medium gaps
<div className="row-md">
  <span>Label:</span>
  <span>Value</span>
</div>
```

---

## Testing

### Manual Testing Checklist

**Authentication:**
- [ ] Sign up with new email
- [ ] Sign in with existing account
- [ ] Sign out

**Ride Booking:**
- [ ] Search for pickup location
- [ ] Search for dropoff location
- [ ] Select service class
- [ ] View fare estimate
- [ ] Add preferred driver (optional)
- [ ] Confirm booking
- [ ] Verify ride appears in Firestore

**Ride Tracking:**
- [ ] View real-time ride status
- [ ] See driver info when assigned
- [ ] Track driver location on map
- [ ] View ETA updates
- [ ] Cancel ride (early states only)
- [ ] View completed ride details

**Wallet & Payments:**
- [ ] Add payment method
- [ ] Set default payment method
- [ ] Remove payment method
- [ ] View payment history

**Ride History:**
- [ ] View past rides
- [ ] View ride details
- [ ] Rebook previous ride
- [ ] Rate driver

### Emulator Testing

```bash
# Terminal 1: Start Firebase emulators
cd ../../  # repo root
firebase emulators:start

# Terminal 2: Start customer app
cd packages/customer-app
npm run dev
```

Visit `http://localhost:5173`

---

## Firebase Integration

### Collections Used

```typescript
// User document
users/{uid}
  - email: string
  - role: 'customer'
  - photoURL: string (optional)
  - createdAtMs: number

// Customer document
customers/{uid}
  - onboardingStatus: 'pending' | 'active' | 'suspended'
  - createdAtMs: number
  - updatedAtMs: number
  - savedPlaces: { home, work, favorites }
  - paymentMethods: array

// Ride document
rides/{rideId}
  - status: 'requested' | 'dispatching' | 'offered' | 'accepted' | 'started' | 'in_progress' | 'completed' | 'cancelled'
  - customerId: string
  - driverId: string (when assigned)
  - pickup: { lat, lng, address }
  - dropoff: { lat, lng, address }
  - fareCents: number
  - serviceTier: 'shiftx' | 'shift_lx' | 'shift_black'
  - createdAtMs: number
  - acceptedAtMs: number (when accepted)
  - startedAtMs: number (when started)
  - completedAtMs: number (when completed)
```

### Cloud Functions Called

```typescript
// Request a ride
const result = await tripRequest({
  pickup: { lat: 40.7128, lng: -74.0060 },
  dropoff: { lat: 40.7580, lng: -73.9855 },
  serviceTier: 'shiftx',
  fareCents: 2500
});

// Cancel a ride
await tripCancel({
  rideId: 'ride_abc123',
  reason: 'Customer cancelled'
});

// Create payment intent
const { clientSecret } = await createPaymentIntent({
  amountCents: 2500
});
```

---

## Deployment

### Web Deployment

```bash
# Build for production
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting:customer-app
```

### Environment-Specific Deploys

```bash
# Staging
firebase use staging
firebase deploy --only hosting:customer-app

# Production
firebase use production
firebase deploy --only hosting:customer-app
```

---

## Performance

### Bundle Size

- **Development:** ~2MB (with HMR)
- **Production:** ~250KB gzipped

### Optimization Tips

1. **Lazy Load Routes:** Use dynamic imports for large pages
2. **Optimize Images:** Compress avatars and profile photos
3. **Debounce Search:** Limit geocoding API calls
4. **Minimize Listeners:** Close Firestore listeners when not needed
5. **Cache Static Data:** Store saved places locally

---

## Common Issues

### Issue: "Service firestore is not available"

**Solution:** Ensure `firebase` package version matches across all packages (11.10.0+).

### Issue: Map not displaying

**Solution:** Check that Leaflet CSS is imported in `main.tsx` or `styles.css`.

### Issue: Geocoding not working

**Solution:** Verify Mapbox token is set in `.env` as `VITE_MAPBOX_ACCESS_TOKEN`.

### Issue: Payment method won't add

**Solution:** 
1. Check Stripe publishable key is correct
2. Ensure Cloud Functions are deployed
3. Verify Stripe webhook is configured

---

## Documentation

- [Quick Start Guide](../../docs/customer-app/QUICKSTART.md)
- [Implementation Guide](../../docs/customer-app/IMPLEMENTATION_GUIDE.md)
- [Manual Test Checklist](../../docs/customer-app/MANUAL_TEST_CHECKLIST.md)
- [Architecture Overview](../../docs/architecture/FILES.md)

---

## Contributing

1. Follow existing code style (ESLint + Prettier)
2. Use TypeScript strict mode
3. Test on both desktop and mobile browsers
4. Update documentation for new features
5. Write meaningful commit messages

### Code Style

- Use functional components with hooks
- Prefer `const` over `let`
- Use descriptive variable names
- Add comments for complex logic
- Extract reusable logic to custom hooks

---

## License

Proprietary — ShiftX Platform

---

**Questions?** See [DEV_ONBOARDING.md](../../docs/DEV_ONBOARDING.md) or ask in Slack.
