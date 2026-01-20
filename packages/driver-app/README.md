# ShiftX Driver App

**Status:** Production Ready  
**Version:** Phase 4G (Native Navigation + Dual-Leg Routes)  
**Tech Stack:** React 18 + TypeScript + Vite + Capacitor + Leaflet + Mapbox (iOS)

---

## Overview

The ShiftX Driver App is a modern, map-based ride-hailing driver application with real-time ride offers, turn-by-turn navigation, and earnings tracking. Built with React and TypeScript, it runs on web and iOS (via Capacitor).

### Key Features

✅ **Real-time Ride Offers** — Instant notifications for nearby ride requests  
✅ **Native Navigation** — Mapbox turn-by-turn on iOS, web fallback for desktop  
✅ **Dual-Leg Routes** — Visual pickup → dropoff route display  
✅ **Camera Modes** — Follow driver position or overview entire route  
✅ **Online/Offline Control** — Instant availability toggling  
✅ **Earnings Dashboard** — Track daily/weekly earnings and payouts  
✅ **Stripe Connect** — Integrated payout setup  
✅ **Ride History** — Complete trip history with details  
✅ **GPS Monitoring** — Real-time GPS health diagnostics  

---

## Architecture

### Component Structure

```
MapShell (Full-screen layout)
├── Map Layer (Leaflet + route visualization)
├── UI Overlays
│   ├── MenuButton (top-left)
│   ├── EnvironmentBadge (top-center)
│   ├── DiagnosticsPanel (top-right)
│   └── BottomSheet (draggable panel)
│       ├── DriverStatusCard (online/offline)
│       ├── ActiveRideSheet (during ride)
│       └── DriverOfferSheet (incoming offers)
└── SideSheet (navigation drawer)
    ├── Home
    ├── Available Rides
    ├── Ride History
    ├── Profile
    └── Wallet
```

### State Management

- **Local State** — React hooks (useState, useEffect)
- **Firebase Real-time** — Firestore listeners for offers and rides
- **URL-based Navigation** — SideSheet menu with history stack

### Map Integration

- **Web:** Leaflet with OpenStreetMap tiles
- **iOS Native:** Mapbox GL for turn-by-turn navigation
- **Route Display:** Dual-leg polylines (pickup leg + ride leg)
- **Camera Control:** Follow driver or overview route

---

## Development Setup

### Prerequisites

- Node.js 20+
- npm 10+
- Firebase project with Firestore and Functions
- (iOS only) Xcode 15+, CocoaPods

### Installation

```bash
# From repository root
npm install

# Install driver-app dependencies
cd packages/driver-app
npm install
```

### Environment Configuration

Create a `.env` file in `packages/driver-app/`:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

# Emulator Mode (optional for local dev)
VITE_USE_EMULATOR=true
VITE_FIRESTORE_EMULATOR_HOST=localhost
VITE_FIRESTORE_EMULATOR_PORT=8081
VITE_FUNCTIONS_EMULATOR_HOST=localhost
VITE_FUNCTIONS_EMULATOR_PORT=5002
VITE_AUTH_EMULATOR_URL=http://localhost:9099

# Mapbox (for iOS navigation)
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

## iOS Setup (Capacitor)

### Sync Web Assets to iOS

```bash
cd packages/ios-driver
npx cap sync ios
```

### Open in Xcode

```bash
npx cap open ios
```

### iOS Configuration

1. **Info.plist** — Add location permissions:
   ```xml
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>We need your location to show your position on the map</string>
   ```

2. **Mapbox Token** — Add to `Info.plist`:
   ```xml
   <key>MBXAccessToken</key>
   <string>your_mapbox_token_here</string>
   ```

3. **Build Settings** — Minimum iOS version: 15.0

---

## Key Components

### DriverHome.tsx

Main screen with map, status card, and ride management.

**Features:**
- Online/offline toggle
- Real-time ride offer display
- Active ride tracking
- GPS diagnostics

### ActiveRideSheet.tsx

Displayed during active rides.

**Features:**
- Customer info (name, photo, rating)
- Pickup/dropoff addresses with emoji dots
- Payment warning badges
- Multi-action buttons (Navigate, Call, Complete, Cancel)
- Camera toggle (Follow/Overview)

### DriverOfferSheet.tsx

Shown when a new ride offer arrives.

**Features:**
- Customer location preview
- Fare display
- Distance to pickup
- Accept/Decline buttons
- Auto-decline countdown

### MapShell Layout

Full-screen map with floating UI overlays.

**Sections:**
- `topLeft` — Menu button
- `topCenter` — Environment badge
- `topRight` — Diagnostics
- `rightStack` — Map controls
- `bottomPanel` — Status/ride sheets
- `bottomNav` — Bottom navigation (future)

---

## Styling Guidelines

The driver app follows a consistent design system:

### CSS Variables

```css
/* Spacing */
--spacing-xs: 0.5rem;   /* 8px */
--spacing-sm: 0.75rem;  /* 12px */
--spacing-md: 1rem;     /* 16px */
--spacing-lg: 1.25rem;  /* 20px */
--spacing-xl: 1.5rem;   /* 24px */

/* Colors */
--color-customer-primary: #60a5fa;   /* Blue */
--color-driver-primary: #10b981;     /* Green */
--color-payment-warning: #ffb703;    /* Yellow */
--color-action-primary: #fb8b24;     /* Orange */
--color-error: #ef4444;              /* Red */

/* Typography */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */

/* Cards */
--card-padding: 1.5rem;  /* 24px */
--card-bg: rgba(26, 26, 26, 0.98);
--card-border: rgba(255, 255, 255, 0.1);
```

### Card Patterns

```tsx
// Customer info card
<div style={{
  background: 'rgba(96, 165, 250, 0.1)',
  border: '1px solid rgba(96, 165, 250, 0.3)',
  borderRadius: '12px',
  padding: '1rem'
}}>
  {/* Content */}
</div>

// Payment warning card
<div style={{
  background: 'rgba(255, 183, 3, 0.1)',
  border: '1px solid rgba(255, 183, 3, 0.3)',
  borderRadius: '12px',
  padding: '1rem'
}}>
  {/* Content */}
</div>
```

---

## Navigation Integration

### Native (iOS)

Uses Mapbox GL for turn-by-turn navigation:

```typescript
import { ShiftXNavigation } from './native/ShiftXNavigation';

const nav = await ShiftXNavigation.init();
await nav.startNavigation({
  origin: { lat, lng },
  destination: { lat, lng },
  waypoints: []
});
```

### Web Fallback

Opens Google Maps in a new tab:

```typescript
const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
window.open(url, '_blank');
```

---

## Testing

### Manual Testing Checklist

- [ ] Sign in with driver account
- [ ] Toggle online/offline status
- [ ] Accept a ride offer
- [ ] Start navigation to pickup
- [ ] Complete pickup
- [ ] Navigate to dropoff
- [ ] Complete ride
- [ ] View earnings in Wallet
- [ ] Check ride history

### Emulator Testing

```bash
# Start Firebase emulators
cd ../../  # repo root
firebase emulators:start

# In another terminal
cd packages/driver-app
npm run dev
```

---

## Deployment

### Web Deployment

```bash
npm run build
firebase deploy --only hosting:driver-app
```

### iOS Deployment

1. Build in Xcode
2. Archive for distribution
3. Upload to App Store Connect

---

## Common Issues

### Issue: "Service firestore is not available"

**Solution:** Ensure `firebase` is a peer dependency and only one instance is loaded.

### Issue: iOS location not updating

**Solution:** Check Info.plist location permissions and ensure GPS is enabled.

### Issue: Route not displaying

**Solution:** Verify route data format matches `{ lat, lng }[]` array.

### Issue: Navigation button not working

**Solution:** Check Mapbox token and ensure it's set in environment and iOS config.

---

## Performance

### Bundle Size

- **Development:** ~2MB (with HMR)
- **Production:** ~250KB gzipped

### Optimization Tips

1. Use dynamic imports for large components
2. Lazy load map tiles
3. Debounce GPS updates (1-2 second intervals)
4. Minimize Firestore listener count

---

## Documentation

- [Phase 2 UI Implementation](../../docs/driver-app/DRIVER_UI_PHASE2.md)
- [Phase 4B Native Navigation](../../docs/driver-app/DRIVER_UI_PHASE4B_native_navigation.md)
- [Phase 4G Route Polylines](../../docs/driver-app/DRIVER_UI_PHASE4G_route_polylines.md)
- [Architecture Overview](../../docs/architecture/FILES.md)

---

## Contributing

1. Follow existing code style (ESLint + Prettier)
2. Use TypeScript strict mode
3. Add inline comments for complex logic
4. Test on both web and iOS
5. Update documentation for new features

---

## License

Proprietary — ShiftX Platform

---

**Questions?** See [DEV_ONBOARDING.md](../../docs/DEV_ONBOARDING.md) or ask in Slack.
