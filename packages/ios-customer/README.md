# ShiftX Customer - iOS Wrapper

Capacitor iOS wrapper for the ShiftX Customer web application.

## Overview

This package wraps the customer web app (from `packages/customer-app`) into a native iOS application using [Capacitor](https://capacitorjs.com/).

**App Identity:**
- **App ID:** `com.shiftx.customer`
- **App Name:** ShiftX Customer
- **Platform:** iOS 13.0+

## Prerequisites

- macOS with Xcode 14+ installed
- Node.js 18+ and npm
- CocoaPods (installed via `sudo gem install cocoapods`)
- iOS Simulator or physical iOS device for testing

## Project Structure

```
packages/ios-customer/
├── capacitor.config.ts    # Capacitor configuration
├── package.json           # Build scripts and dependencies
├── ios/                   # Generated iOS project (Xcode)
│   └── App/
│       ├── App.xcworkspace  # Open this in Xcode
│       ├── App/
│       │   └── public/      # Synced web assets
│       └── Podfile
└── README.md             # This file
```

## Quick Start

### Strategy: Debug vs Release

**Debug Mode (Development):**
- Loads from: **Local dev server** (http://127.0.0.1:5173)
- Stripe keys: **TEST** (pk_test_...)
- Firebase: **Emulator Suite** (optional)
- Use for: Local testing, rapid iteration

**Release Mode (Production):**
- Loads from: **Hosted web app** (https://shiftx-95c4b-customer.web.app)
- Stripe keys: **LIVE** (pk_live_...)
- Firebase: **Production backend**
- Use for: App Store builds, real users

### Debug Mode Setup (Recommended for Dev)

### 1. Start Customer Dev Server

```bash
cd ../customer-app
npm run dev
```

This starts Vite dev server on http://127.0.0.1:5173 with:
- TEST Stripe keys
- Hot module reload
- Firebase Emulator connection (if running)

### 2. Sync for Debug Mode

```bash
npm run cap:sync:debug
```

This:
- Copies `capacitor.config.debug.ts` → `capacitor.config.ts`
- Points iOS app to local dev server
- Syncs iOS project

### 3. Open and Run in Xcode

```bash
npm run ios:open
```

Or use the shortcut:
```bash
npm run ios:debug  # Sync + open in one command
```

Then in Xcode:
1. Select iPhone simulator
2. Press `Cmd + R` to build and run
3. App loads from local dev server with TEST keys ✅

### Release Mode Setup (For Production)

### 1. Deploy Customer Web App

```bash
cd ../customer-app
npm run build
firebase deploy --only hosting:customer
```

This deploys to https://shiftx-95c4b-customer.web.app with LIVE keys.

### 2. Sync for Release Mode

```bash
npm run cap:sync:release
```

This:
- Copies `capacitor.config.release.ts` → `capacitor.config.ts`
- Points iOS app to hosted HTTPS web app
- Syncs iOS project

### 3. Build for App Store

```bash
npm run ios:open
```

Then in Xcode:
1. Select "Generic iOS Device" or your device
2. Product → Archive
3. Submit to App Store

### Legacy: Static Build (Not Recommended)

If you need to bundle the web app statically (no live server):

```bash
npm run build:web
npm run cap:sync
```

This copies the built `dist/` folder into the iOS app, but you lose:
- Instant updates without App Store review
- Proper HTTPS origin for Stripe
- Server-side environment switching

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build:web` | Build customer web app (production) |
| `npm run build:web:dev` | Start customer dev server |
| `npm run cap:sync:debug` | Switch to Debug mode (local dev server) |
| `npm run cap:sync:release` | Switch to Release mode (hosted HTTPS) |
| `npm run cap:sync` | Generic sync (uses current config) |
| `npm run ios:debug` | Full debug setup: sync + open Xcode |
| `npm run ios:release` | Full release setup: sync + open Xcode |
| `npm run ios:open` | Open Xcode workspace |
| `npm run ios:run` | Build and run in simulator (CLI) |

## Configuration Files

- **capacitor.config.ts** - Active config (gets overwritten by sync commands)
- **capacitor.config.debug.ts** - Debug template (local dev server + test keys)
- **capacitor.config.release.ts** - Release template (hosted HTTPS + live keys)

## Development Workflow

### Recommended: Debug Mode (Local Dev Server)

**Why this is better:**
- ✅ Instant hot reload (no rebuild needed)
- ✅ TEST Stripe keys automatically
- ✅ Firebase Emulator integration
- ✅ Web Inspector for debugging
- ✅ Faster iteration cycle

**Setup once:**
```bash
# Terminal 1: Start Firebase Emulators (optional)
npm run emulators  # From project root

# Terminal 2: Start customer dev server
cd packages/customer-app
npm run dev

# Terminal 3: Sync iOS app to use dev server
cd packages/ios-customer
npm run cap:sync:debug
npm run ios:open
```

**Then in Xcode:**
- Select simulator → Run (Cmd+R)
- App loads from http://127.0.0.1:5173
- Make changes to React code → See updates instantly in simulator

### Alternative: Release Mode (Hosted Web App)

**When to use:**
- Testing App Store builds
- Verifying LIVE Stripe keys work
- Final QA before release

**Setup:**
```bash
# 1. Deploy web app to Firebase Hosting
cd packages/customer-app
npm run build
firebase deploy --only hosting:customer

# 2. Sync iOS to use hosted URL
cd packages/ios-customer
npm run cap:sync:release
npm run ios:open
```

**Then in Xcode:**
- Archive for App Store

### Switching Between Modes

```bash
# Switch to Debug (local)
npm run cap:sync:debug

# Switch to Release (hosted)
npm run cap:sync:release

# Or use shortcuts
npm run ios:debug    # sync:debug + open
npm run ios:release  # sync:release + open
```

### Debugging with Safari Web Inspector

**Essential for troubleshooting JS errors, Stripe issues, Firebase problems:**

1. **Enable in Simulator:**
   - Run app in iOS Simulator
   - App must be running (not at splash screen)

2. **Open Web Inspector:**
   - Mac Safari → Develop → Simulator → [iPhone Name] → [ShiftX Customer]
   - If "Develop" menu missing: Safari → Settings → Advanced → Show Develop menu

3. **What to Check:**
   - **Console:** JS errors, Stripe logs, Firebase warnings
   - **Network:** API calls, 404s, CORS errors
   - **Elements:** Inspect React components
   - **Storage:** localStorage, sessionStorage (auth tokens)

4. **Common Logs to Look For:**
   ```
   [Stripe] mode=test, key=TEST         ← Should match your mode
   Firebase: Emulator detected           ← Debug mode only
   PaymentIntent created: pi_...         ← Stripe working
   Auth state changed: {...}             ← Firebase auth working
   ```

5. **Debugging Stripe Issues:**
   ```javascript
   // In Console, check Stripe mode:
   window.Stripe  // Should exist
   
   // Check environment:
   import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
   ```

## Configuration

### Capacitor Config ([capacitor.config.ts](capacitor.config.ts))

**Active Config (auto-managed):**
```typescript
{
  appId: 'com.shiftx.customer',
  appName: 'ShiftX Customer (Dev)',  // or 'ShiftX Customer' for release
  webDir: '../customer-app/dist',
  server: {
    url: 'http://127.0.0.1:5173',  // Debug
    // url: 'https://shiftx-95c4b-customer.web.app',  // Release
    cleartext: true  // Debug only
  }
}
```

**Don't edit this file directly!** Use the sync commands:
- `npm run cap:sync:debug` - Copies from `capacitor.config.debug.ts`
- `npm run cap:sync:release` - Copies from `capacitor.config.release.ts`

### Firebase Auth in iOS

Firebase Authentication works in WKWebView with mode-specific behavior:

**Debug Mode (Local Dev Server):**
- Uses: `VITE_STRIPE_PUBLISHABLE_KEY` from `.env.development`
- Stripe Mode: **TEST** (pk_test_...)
- Firebase: Connects to **Emulator Suite** (if running)
- Auth Domain: `localhost` or emulator auth domain
- Sign-In: All methods work (email/password, Google)

**Release Mode (Hosted HTTPS):**
- Uses: `VITE_STRIPE_PUBLISHABLE_KEY` from `.env.production`
- Stripe Mode: **LIVE** (pk_live_...)
- Firebase: Connects to **production backend**
- Auth Domain: `shiftx-95c4b.firebaseapp.com`
- Sign-In: Full production auth flow

**Environment Files in customer-app:**
```
packages/customer-app/
├── .env.development    # TEST keys (npm run dev)
├── .env.production     # LIVE keys (npm run build)
└── .env.local          # Legacy, not used with new setup
```

**Stripe Origin Requirements:**
- Debug: `http://127.0.0.1:5173` - Works for test keys ✅
- Release: `https://shiftx-95c4b-customer.web.app` - Works for live keys ✅
- ❌ `capacitor://localhost` - Breaks Stripe (invalid origin)

**Testing Auth:**
1. **Debug Mode:**
   ```bash
   # Start emulators
   npm run emulators
   
   # Start dev server
   cd packages/customer-app && npm run dev
   
   # Sync and run
   cd packages/ios-customer
   npm run ios:debug
   ```
   - Test with Firebase Emulator users
   - Stripe test cards work

2. **Release Mode:**
   ```bash
   # Deploy to hosting
   cd packages/customer-app
   npm run build && firebase deploy --only hosting:customer
   
   # Sync and run
   cd packages/ios-customer
   npm run ios:release
   ```
   - Test with real Firebase users
   - Stripe live mode (use test cards initially!)

## Troubleshooting

### White Screen / Blank App

**Symptom:** App opens but shows a white screen

**Debug Mode Solutions:**

1. **Dev server not running**
   ```bash
   # Terminal 1: Start dev server FIRST
   cd ../customer-app && npm run dev
   
   # Terminal 2: Then sync and run
   cd ../ios-customer
   npm run cap:sync:debug
   npm run ios:open
   ```

2. **Wrong URL in config**
   ```bash
   # Check active config
   cat capacitor.config.ts | grep url
   # Should show: url: 'http://127.0.0.1:5173'
   
   # If wrong, re-sync
   npm run cap:sync:debug
   ```

3. **Check Safari Web Inspector**
   - In Simulator: Safari → Develop → Simulator → [Your App]
   - Look for JS errors, 404s, or Stripe errors

**Release Mode Solutions:**

1. **Web app not deployed**
   ```bash
   cd ../customer-app
   npm run build
   firebase deploy --only hosting:customer
   ```

2. **Check hosted URL loads**
   - Open https://shiftx-95c4b-customer.web.app in Safari
   - Should load the customer app
   - Check for 404 or deployment issues

### Build Errors in Xcode

**CocoaPods Issues:**
```bash
cd ios/App
pod deintegrate
pod install
```

**Clean Build:**
- In Xcode: Product → Clean Build Folder (Cmd + Shift + K)
- Delete derived data: Xcode → Preferences → Locations → Derived Data → Delete

### File Not Found Errors

**Error:** `[error] - Error: ENOENT: no such file or directory`

**Solution:**
```bash
# Ensure customer-app is built first
cd ../customer-app
npm install
npm run build

# Then sync
cd ../ios-customer
npm run cap:sync
```

### Stripe Errors ("No such payment_intent", "Invalid key")

**Symptom:** Stripe API errors in app logs

**Debug Mode (Expected: TEST keys):**
```bash
# 1. Verify dev server is using test key
cd ../customer-app
cat .env.development | grep VITE_STRIPE
# Should show: pk_test_...

# 2. Check backend functions use test key
# Functions should detect emulator and use STRIPE_SECRET_KEY_TEST

# 3. Restart dev server
npm run dev

# 4. Re-sync iOS
cd ../ios-customer
npm run cap:sync:debug
```

**Release Mode (Expected: LIVE keys):**
```bash
# 1. Verify production env has live key
cd ../customer-app
cat .env.production | grep VITE_STRIPE
# Should show: pk_live_...

# 2. Rebuild and deploy
npm run build
firebase deploy --only hosting:customer

# 3. Re-sync iOS
cd ../ios-customer
npm run cap:sync:release
```

**Check Stripe Mode in Safari Inspector:**
- Debug → Safari → Develop → Simulator → Console
- Look for: `[Stripe] mode=test` or `mode=live`
- Should match your current mode (debug=test, release=live)

### Permission Errors

If you need permissions (location, camera, etc.) in the future:

1. Add to `ios/App/App/Info.plist`:
   ```xml
   <key>NSLocationWhenInUseUsageDescription</key>
   <string>We need your location to show nearby drivers</string>
   ```

2. Request permission in web code using Capacitor plugins

## App Icons & Splash Screen

### Current State
- Using default Capacitor icon (blue square)
- No custom splash screen

### To Customize

**1. Generate Assets**

Use [Capacitor Asset Generator](https://github.com/ionic-team/capacitor-assets):

```bash
npm install -g @capacitor/assets
# Place your icon at: assets/icon.png (1024x1024)
# Place your splash at: assets/splash.png (2732x2732)
npx capacitor-assets generate
```

**2. Manual Setup**

Place icons in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

## Production Checklist

Before submitting to App Store:

### Release Configuration
- [ ] Switch to release mode: `npm run cap:sync:release`
- [ ] Verify config loads from HTTPS: `cat capacitor.config.ts | grep url`
- [ ] Should show: `https://shiftx-95c4b-customer.web.app`

### Web App Deployment
- [ ] Customer app built with production env: `npm run build`
- [ ] Deployed to Firebase Hosting: `firebase deploy --only hosting:customer`
- [ ] Test hosted URL in Safari: https://shiftx-95c4b-customer.web.app
- [ ] Verify LIVE Stripe key active in web app console

### Firebase Backend
- [ ] Production Firebase backend running (not emulator)
- [ ] Cloud Functions using LIVE Stripe secret key
- [ ] Firestore rules deployed and tested
- [ ] Authentication providers enabled in console

### iOS App
- [ ] Update bundle ID and signing in Xcode
- [ ] App icons and splash screen customized
- [ ] Test on physical device (not just simulator)
- [ ] Verify Stripe payments work (test mode first!)
- [ ] Test sign-in/sign-out flow
- [ ] Test ride booking end-to-end
- [ ] Archive and validate with App Store Connect

### Critical: Stripe Safety
- [ ] Test Release build with Stripe TEST mode first
  - Temporarily change .env.production to pk_test_...
  - Deploy and test full payment flow
  - Verify no "invalid key" or "CORS" errors
- [ ] Only switch to LIVE keys after full testing
- [ ] Monitor Stripe Dashboard for real transactions

### App Store Guidelines
- [ ] Privacy policy URL in Info.plist
- [ ] App Store description and screenshots
- [ ] Review App Store Connect compliance
- [ ] Test In-App Purchase (if applicable)

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [Firebase iOS Setup](https://firebase.google.com/docs/ios/setup)
- [Xcode Release Guide](https://capacitorjs.com/docs/ios/deploying-to-app-store)

## Support

For issues specific to:
- **Web app functionality:** See `packages/customer-app/`
- **Capacitor/iOS wrapper:** This package
- **Firebase backend:** See `functions/`
- **ShiftX project:** Root README.md

---

**Note:** This is the iOS wrapper only. The web app (`packages/customer-app`) remains deployable independently on `web/main` branch.
