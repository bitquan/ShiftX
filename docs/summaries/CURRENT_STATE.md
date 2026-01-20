# ShiftX Current State - UI Architecture Summary

**Date:** January 20, 2026  
**Status:** Both apps production-ready with synchronized UI quality

---

## Executive Summary

ShiftX consists of two primary TypeScript/React applications serving different user roles:

1. **Customer App** — For ride-hailing customers (riders)
2. **Driver App** — For drivers to accept and complete rides

Both apps share:
- Modern React 18 + TypeScript + Vite architecture
- Firebase integration (Auth, Firestore, Functions)
- Leaflet map visualization
- Real-time ride tracking
- Consistent design system (as of Jan 2026)

---

## Recent Sync (January 2026)

The customer app UI has been enhanced to match the driver app's quality standards:

### UI Quality Improvements

✅ **Consistent Design System**
- CSS variables for spacing, colors, typography
- Semantic color coding (blue=customer, yellow=payment, green=success)
- Standardized card/sheet padding (24px)
- Typography scale (0.75rem - 1.5rem)

✅ **Enhanced Components**
- Visible scrollbars in bottom sheets (UX improvement)
- Info card variants with semantic colors
- Status badges with consistent styling
- Avatar styles with standardized sizing
- Spacing helper classes (stack-sm/md/lg, row-sm/md)

✅ **Button System**
- Primary (gradient), Secondary (outline), Danger (red)
- Outline variants for specific actions
- Consistent hover/disabled states

---

## Architecture Comparison

### Common Patterns

Both apps share:
- MapShell layout component (full-screen map + overlays)
- BottomSheet with drag-to-snap behavior
- Toast notification system
- Error boundaries
- Diagnostics panels
- Real-time Firestore listeners

### Key Differences

| Feature | Customer App | Driver App |
|---------|-------------|-----------|
| **Primary Use Case** | Request & track rides | Accept & complete rides |
| **Map Interaction** | Select pickup/dropoff | View routes, track position |
| **Navigation** | Address search & selection | Turn-by-turn (iOS native) |
| **Core Workflow** | Book → Wait → Track → Complete | Online → Accept → Navigate → Complete |
| **Payment** | Add payment methods, view charges | View earnings, setup payouts |
| **Native Features** | Web-only (future iOS wrapper) | iOS app via Capacitor |

---

## Customer App Details

### Tech Stack
- React 18 + TypeScript + Vite
- Firebase (Auth, Firestore, Functions)
- Leaflet maps
- Stripe payments
- No native app yet (web-only)

### Key Features
- Real-time ride booking with map selection
- Address autocomplete (Mapbox/Google Places)
- Multiple service tiers (ShiftX, LX, Black)
- Live driver tracking and ETA
- Payment method management
- Ride history with receipts
- Saved places (home, work, favorites)
- Preferred driver selection

### Component Architecture
```
App.tsx (main coordinator)
├── MapShell layout
│   ├── Map layer (Leaflet)
│   └── BottomSheet panel
│       ├── RequestRide
│       ├── RideStatus
│       ├── RideHistory
│       ├── CustomerWallet
│       └── Profile
└── FloatingTopBar
    ├── Back button
    └── Menu button
```

### State Management
- Local state (React hooks)
- Firebase real-time listeners for rides
- Component-based navigation

---

## Driver App Details

### Tech Stack
- React 18 + TypeScript + Vite
- Firebase (Auth, Firestore, Functions)
- Leaflet maps (web) + Mapbox GL (iOS native)
- Stripe Connect
- Capacitor for iOS native features

### Key Features
- Real-time ride offer notifications
- Turn-by-turn navigation (iOS: Mapbox, Web: Google Maps)
- Dual-leg route visualization (pickup → dropoff)
- Camera modes (Follow driver / Overview route)
- Online/offline status control
- Earnings dashboard
- Stripe Connect onboarding
- GPS health monitoring

### Component Architecture
```
App.tsx (main coordinator)
├── MapShell layout
│   ├── Map layer (Leaflet + routes)
│   ├── MenuButton (top-left)
│   ├── EnvironmentBadge (top-center)
│   ├── DiagnosticsPanel (top-right)
│   ├── CameraToggle (map mode)
│   └── BottomSheet panel
│       ├── DriverStatusCard (online/offline)
│       ├── ActiveRideSheet (during ride)
│       └── DriverOfferSheet (incoming offers)
└── SideSheet navigation
    ├── Home
    ├── Available Rides
    ├── Ride History
    ├── Profile
    └── Wallet
```

### State Management
- Local state (React hooks)
- Firebase real-time listeners for offers and rides
- URL-based navigation history

### Native Integration (iOS)
- Capacitor wrapper in `packages/ios-driver/`
- Native Mapbox SDK for turn-by-turn
- Location services
- Push notifications
- Background location tracking

---

## Design System

### Color Palette

Both apps now use a consistent semantic color system:

```css
/* Semantic Colors */
--color-customer-primary: #60a5fa;      /* Blue - customer info */
--color-driver-primary: #10b981;        /* Green - driver/ready states */
--color-payment-warning: #ffb703;       /* Yellow - payment alerts */
--color-action-primary: #fb8b24;        /* Orange - primary actions */
--color-error: #ef4444;                 /* Red - errors/danger */
--color-success: #10b981;               /* Green - success states */
```

### Spacing Scale

```css
--spacing-xs: 0.5rem;    /* 8px */
--spacing-sm: 0.75rem;   /* 12px */
--spacing-md: 1rem;      /* 16px */
--spacing-lg: 1.25rem;   /* 20px */
--spacing-xl: 1.5rem;    /* 24px */
--spacing-2xl: 2rem;     /* 32px */
```

### Typography Scale

```css
--text-xs: 0.75rem;      /* 12px - labels, captions */
--text-sm: 0.875rem;     /* 14px - body, descriptions */
--text-base: 1rem;       /* 16px - body, buttons */
--text-lg: 1.125rem;     /* 18px - subheadings */
--text-xl: 1.25rem;      /* 20px - headings */
--text-2xl: 1.5rem;      /* 24px - page titles */
```

### Card Patterns

Both apps use consistent card styling:

```tsx
// Info card with semantic tint
<div className="info-card info-card-customer">
  {/* Blue tinted background for customer info */}
</div>

<div className="info-card info-card-payment">
  {/* Yellow tinted background for payment warnings */}
</div>

<div className="info-card info-card-success">
  {/* Green tinted background for success states */}
</div>
```

---

## Shared Infrastructure

### Backend (Cloud Functions)

Located in `functions/` directory:

**Key Functions:**
- `tripRequest` — Create new ride request
- `tripCancel` — Cancel ride
- `tripAccept` — Driver accepts ride
- `tripStart` — Driver starts ride
- `tripComplete` — Complete ride
- Payment processing (Stripe integration)
- Push notifications
- Driver matching/dispatching

### Firebase Collections

**Users & Roles:**
- `users/{uid}` — User profile (email, role, photoURL)
- `customers/{uid}` — Customer-specific data
- `drivers/{uid}` — Driver-specific data (status, location, earnings)

**Rides:**
- `rides/{rideId}` — Ride documents with full lifecycle
  - Status: requested → dispatching → offered → accepted → started → in_progress → completed
  - Customer/driver info
  - Pickup/dropoff locations
  - Fare, payment status
  - Timestamps for each state

**Other:**
- `savedPlaces/{customerId}/places/{placeId}` — Saved locations
- `paymentMethods/{customerId}/methods/{methodId}` — Stripe payment methods
- `earnings/{driverId}/trips/{tripId}` — Driver earnings records

### Shared Client Library

`packages/driver-client/` provides typed wrappers for Cloud Functions:

```typescript
import { tripRequest, tripCancel, tripAccept } from '@shiftx/driver-client';

// Customer requests ride
const { rideId } = await tripRequest({
  pickup: { lat, lng },
  dropoff: { lat, lng },
  serviceTier: 'shiftx'
});

// Driver accepts ride
await tripAccept({ rideId });
```

---

## Development Workflow

### Setup

```bash
# Clone repository
git clone https://github.com/your-org/ShiftX.git
cd ShiftX

# Install dependencies
npm install

# Start Firebase emulators
firebase emulators:start
```

### Running Apps Locally

**Customer App:**
```bash
cd packages/customer-app
npm run dev
# Opens at http://localhost:5173
```

**Driver App:**
```bash
cd packages/driver-app
npm run dev
# Opens at http://localhost:5173
```

### Building for Production

```bash
# Customer app
cd packages/customer-app
npm run build
firebase deploy --only hosting:customer-app

# Driver app
cd packages/driver-app
npm run build
firebase deploy --only hosting:driver-app
```

---

## Testing Strategy

### Manual Testing

Both apps have comprehensive manual test checklists:
- Authentication flows
- Ride lifecycle (request → complete)
- Payment integration
- Real-time updates
- Error handling
- UI responsiveness

### Emulator Testing

All features can be tested locally:
- Firebase Auth Emulator (port 9099)
- Firestore Emulator (port 8081)
- Cloud Functions Emulator (port 5002)

### End-to-End Testing

Test complete ride flow:
1. Customer requests ride
2. Driver receives offer
3. Driver accepts
4. Driver navigates to pickup
5. Driver starts ride
6. Driver completes ride
7. Customer sees completion and charges

---

## Performance Metrics

### Bundle Sizes

**Customer App:**
- Development: ~2MB (with HMR)
- Production: ~250KB gzipped

**Driver App:**
- Development: ~2MB (with HMR)
- Production: ~258KB gzipped

### Load Times

- Initial page load: <2s (on 4G)
- Time to interactive: <3s
- Map render: <1s
- Real-time updates: <500ms latency

---

## Future Roadmap

### Customer App
- [ ] iOS native wrapper (Capacitor)
- [ ] Push notifications
- [ ] In-app chat with driver
- [ ] Split payment support
- [ ] Scheduled rides
- [ ] Accessibility improvements (WCAG 2.1)

### Driver App
- [ ] Android support
- [ ] Multi-stop rides
- [ ] Driver-to-driver chat
- [ ] Advanced analytics dashboard
- [ ] Offline mode with sync

### Platform
- [ ] Admin dashboard enhancements
- [ ] Automated testing (Jest + Playwright)
- [ ] CI/CD pipeline
- [ ] Performance monitoring (Sentry)
- [ ] A/B testing framework

---

## Documentation Links

### Architecture
- [FILES.md](../architecture/FILES.md) — Complete file structure
- [SETUP.md](../SETUP.md) — Initial setup guide
- [DEV_ONBOARDING.md](../DEV_ONBOARDING.md) — Developer onboarding

### Customer App
- [README.md](../../packages/customer-app/README.md)
- [QUICKSTART.md](../customer-app/QUICKSTART.md)
- [IMPLEMENTATION_GUIDE.md](../customer-app/IMPLEMENTATION_GUIDE.md)

### Driver App
- [README.md](../../packages/driver-app/README.md)
- [Phase 2 UI](../driver-app/DRIVER_UI_PHASE2.md)
- [Phase 4B Native Navigation](../driver-app/DRIVER_UI_PHASE4B_native_navigation.md)
- [Phase 4G Route Polylines](../driver-app/DRIVER_UI_PHASE4G_route_polylines.md)

### Backend
- [Cloud Functions Guide](../backend/CLOUD_FUNCTIONS.md)
- [Stripe Connect Setup](../features/STRIPE_CONNECT_SETUP.md)

---

## Team & Maintenance

**Maintained by:** ShiftX Engineering Team  
**Last Updated:** January 20, 2026  
**Next Review:** Q2 2026

**Contact:**
- Technical questions: Dev Slack channel
- Bug reports: GitHub Issues
- Feature requests: Product roadmap board

---

**Status:** ✅ Both apps production-ready and feature-complete
