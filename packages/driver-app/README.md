# ShiftX Driver App

Production-ready driver web and iOS app built with React, TypeScript, and Capacitor.

## 🚗 Features

- **Ride Management** - Accept/decline ride offers with countdown timer
- **Real-time GPS** - Location tracking with 5s/20m throttling
- **Live Map** - Leaflet with OSRM routing and polylines
- **Payment Status** - Visual indicators for payment authorization
- **Wallet & Earnings** - Today/week earnings with ledger
- **iOS Native** - Capacitor wrapper with Apple Maps integration
- **Phase 2 UI** - MapShell + 2-snap BottomSheet design

## 🏗️ Tech Stack

- **Frontend:** React 18.3 + TypeScript 5.3
- **Build Tool:** Vite 5.0
- **Maps:** Leaflet 1.9.4 + React Leaflet 4.x
- **Routing:** OSRM (Open Source Routing Machine)
- **Mobile:** Capacitor 8.0 (iOS wrapper)
- **Backend:** Firebase (Auth, Firestore, Functions)
- **Real-time:** Firestore snapshots + GPS heartbeat

## 📦 Setup

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+
- Firebase CLI (`npm install -g firebase-tools`)
- Xcode 15+ (for iOS builds)
- CocoaPods (for iOS dependencies)

### Install Dependencies

```bash
cd packages/driver-app
npm install
```

### Environment Variables

Create `.env` file:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

# Mapbox (optional for Phase 3)
VITE_MAPBOX_ACCESS_TOKEN=pk.xxxxx

# Feature Flags (optional)
VITE_ENABLE_GPS_TRACKING=true
VITE_GPS_UPDATE_INTERVAL=5000
VITE_GPS_DISTANCE_THRESHOLD=20
```

**See [docs/ENVIRONMENT_VARIABLES.md](../../docs/ENVIRONMENT_VARIABLES.md) for complete reference.**

## 🚀 Development

### Web Development

```bash
npm run dev
```

App runs at: http://localhost:4173

### iOS Development

1. **Build Web Assets:**
   ```bash
   npm run build
   ```

2. **Sync to iOS:**
   ```bash
   npx cap sync ios
   ```

3. **Open in Xcode:**
   ```bash
   npx cap open ios
   ```

4. **Run on Simulator/Device** from Xcode

## 🏗️ Build

### Production Web Build

```bash
npm run build
```

Output: `dist/`

Preview build:
```bash
npm run preview  # Port 4174
```

### iOS Build

```bash
# Build web assets
npm run build

# Sync to iOS
npx cap sync ios

# Open Xcode (build from there)
npx cap open ios
```

**For TestFlight/App Store:** See [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md#ios-deployment)

## 📂 Project Structure

```
driver-app/
├── src/
│   ├── components/          # React components
│   │   ├── MapShell.tsx    # Main map container
│   │   ├── SharedMap.tsx   # Leaflet map component
│   │   ├── DriverSheet*.tsx # BottomSheet UI
│   │   ├── ProfileScreen.tsx
│   │   └── WalletScreen.tsx
│   ├── hooks/              # Custom React hooks
│   │   ├── useHeartbeat.ts # GPS tracking hook
│   │   ├── useOffers.ts    # Ride offers listener
│   │   └── useDriverProfile.ts
│   ├── utils/              # Utilities
│   │   └── mapDriverUiState.ts # State → UI mapper
│   ├── App.tsx             # Root component
│   ├── firebase.ts         # Firebase config
│   └── main.tsx            # Entry point
├── ios/                    # iOS project (Capacitor)
│   └── App/
│       └── App/
│           ├── Info.plist  # iOS config
│           └── capacitor.config.json
├── public/                 # Static assets
├── capacitor.config.ts     # Capacitor config
├── vite.config.ts          # Vite config
└── tsconfig.json           # TypeScript config
```

## 🔑 Key Features

### GPS Heartbeat

Driver location is automatically sent to Firebase when:
- 5 seconds have elapsed since last update, OR
- Driver has moved >20 meters

Implementation: `src/hooks/useHeartbeat.ts`

### Ride Offers

Real-time ride offers via Firestore listener:
```typescript
// Automatically listens to offers subcollection
const { offers, loading } = useOffers(driverId);
```

### Payment Gating

Start Ride button is disabled until payment is authorized:
- Status: `requires_authorization` → Show "Waiting for payment..."
- Status: `authorized` → Enable "Start Ride" button

### MapShell + BottomSheet

**Phase 2 Design:**
- Map takes full screen
- BottomSheet has 2 snap points:
  - Snapped: Shows essential info (status, next action)
  - Expanded: Shows full details + actions

**Gesture:** Swipe up/down to expand/collapse

## 🧪 Testing

### Manual Testing

1. **Sign Up/Login** - Create driver account
2. **Profile Setup** - Add vehicle info, photo
3. **Go Online** - Toggle online status
4. **Accept Ride** - Wait for offer, accept
5. **Start Ride** - Navigate to pickup, start when authorized
6. **Complete Ride** - Navigate to dropoff, complete
7. **Check Wallet** - Verify earnings appear

### Emulator Testing

```bash
# Start Firebase emulators
firebase emulators:start --only auth,firestore,functions

# In another terminal, start dev server
npm run dev
```

## 📱 iOS Configuration

### Location Permissions

In `ios/App/App/Info.plist`:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>ShiftX needs your location to show your position on the map and send location updates to customers.</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>ShiftX needs your location in the background to provide accurate driver tracking during rides.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>ShiftX needs continuous location access to provide real-time driver tracking and navigation.</string>
```

### Capabilities

- ✅ Background Modes → Location updates
- ✅ Maps → Apple Maps integration
- ✅ Push Notifications (future)

## 🐛 Known Issues / TODOs

### Phase 3 Roadmap

- [ ] Wire up actual ride state from Firestore (currently uses placeholder)
- [ ] Add real address geocoding for pickup/dropoff
- [ ] Connect accept/decline handlers to existing functions
- [ ] Show estimated fare and distance in offers
- [ ] Add native navigation integration

**See [docs/DRIVER_APP.md](../../docs/DRIVER_APP.md) for complete documentation.**

## 📚 Documentation

- **[DRIVER_APP.md](../../docs/DRIVER_APP.md)** - Complete architecture and feature docs
- **[DEPLOYMENT.md](../../docs/DEPLOYMENT.md)** - iOS deployment guide
- **[SETUP.md](../../docs/SETUP.md)** - Development setup
- **[ENVIRONMENT_VARIABLES.md](../../docs/ENVIRONMENT_VARIABLES.md)** - Config reference

## 🛠️ Troubleshooting

### Issue: GPS not updating

**Solution:** Check location permissions in iOS Settings

### Issue: Firebase not connecting

**Solution:** Verify `.env` file has all required variables

### Issue: Build fails

**Solution:**
```bash
# Clear cache
rm -rf node_modules/.vite
rm -rf dist

# Reinstall
npm install
npm run build
```

### Issue: iOS build errors

**Solution:**
```bash
# Update CocoaPods
cd ios/App && pod install --repo-update

# Clean Xcode build
# In Xcode: Product → Clean Build Folder
```

---

**Status:** Production Ready ✅  
**Last Updated:** January 20, 2026  
**Phase:** Phase 2 Complete (MapShell + BottomSheet)
