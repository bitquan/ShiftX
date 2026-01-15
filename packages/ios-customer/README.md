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

### 1. Build the Web App

First, build the customer web application:

```bash
npm run build:web
```

This runs `cd ../customer-app && npm run build` and creates the production bundle in `../customer-app/dist/`.

### 2. Sync to iOS

Copy the web build to the iOS project and update native dependencies:

```bash
npm run cap:sync
```

This command:
- Copies web assets from `../customer-app/dist` to `ios/App/App/public`
- Updates the Capacitor configuration
- Runs `pod install` to update iOS dependencies

### 3. Open in Xcode

```bash
npm run ios:open
```

This opens `ios/App/App.xcworkspace` in Xcode.

### 4. Run in Simulator

**Option A: From Xcode**
1. Select a simulator (e.g., iPhone 15 Pro)
2. Press `Cmd + R` to build and run

**Option B: From Command Line**
```bash
npm run ios:run
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build:web` | Build the customer web app |
| `npm run cap:sync` | Sync web assets and update iOS project |
| `npm run cap:copy` | Copy web assets only (no dependency update) |
| `npm run ios:open` | Open Xcode workspace |
| `npm run ios:run` | Build and run in iOS simulator (CLI) |
| `npm run build` | Full build: web + sync |

## Development Workflow

### Standard Flow

1. Make changes to the customer web app in `packages/customer-app/src`
2. Build the web app: `npm run build:web`
3. Sync to iOS: `npm run cap:sync`
4. Run in Xcode or simulator

### Live Reload (Development Mode)

For faster development, you can use live reload:

1. Start the customer web dev server:
   ```bash
   cd ../customer-app && npm run dev
   ```

2. Update `capacitor.config.ts` to use the dev server:
   ```typescript
   server: {
     url: 'http://localhost:5173',
     cleartext: true
   }
   ```

3. Sync and run:
   ```bash
   npm run cap:sync
   npm run ios:run
   ```

4. **Important:** Remove the `server` config before production builds!

## Configuration

### Capacitor Config ([capacitor.config.ts](capacitor.config.ts))

```typescript
{
  appId: 'com.shiftx.customer',
  appName: 'ShiftX Customer',
  webDir: '../customer-app/dist',  // Points to web build output
  ios: {
    contentInset: 'automatic'
  }
}
```

### Firebase Auth in iOS

Firebase Authentication works in WKWebView with the following considerations:

**Auth Domain:**
- Uses `authDomain` from Firebase config in `packages/customer-app/src/firebase.ts`
- Defaults to `shiftx-95c4b.firebaseapp.com`
- Can be overridden with `VITE_FIREBASE_AUTH_DOMAIN` environment variable

**Sign-In Flow:**
- Email/password: Works natively ✅
- Google Sign-In (popup): May not work in WKWebView ⚠️
  - **Solution:** Use redirect flow instead of popup
  - Consider adding `@capacitor/google-auth` plugin for native Google Sign-In

**Testing Auth:**
1. Build and run the app
2. Navigate to sign-in screen
3. Test email/password authentication
4. Verify user session persists across app restarts

## Troubleshooting

### White Screen / Blank App

**Symptom:** App opens but shows a white screen

**Causes & Solutions:**

1. **Web assets not built**
   ```bash
   cd ../customer-app && npm run build
   npm run cap:sync
   ```

2. **Wrong webDir path**
   - Verify `capacitor.config.ts` has `webDir: '../customer-app/dist'`
   - Check that `dist/index.html` exists

3. **Missing index.html**
   ```bash
   ls -la ../customer-app/dist/
   # Should show index.html and assets/
   ```

4. **Capacitor not synced**
   ```bash
   npm run cap:sync
   # Rebuild in Xcode (Cmd + B)
   ```

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

### Firebase Connection Issues

**Symptom:** "Firebase not initialized" or auth errors

**Solution:**
1. Verify `firebase.ts` configuration in customer-app
2. Check `VITE_FIREBASE_*` environment variables in `customer-app/.env.local`
3. Ensure emulator settings (if using local Firebase Emulator Suite)
4. Test web app first: `cd ../customer-app && npm run dev`

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

- [ ] Remove `server` config from `capacitor.config.ts` (no live reload URL)
- [ ] Update Firebase config to use production API keys
- [ ] Test with production Firebase backend
- [ ] Verify app icons and splash screen
- [ ] Update bundle ID and signing in Xcode
- [ ] Test on physical device (not just simulator)
- [ ] Verify Stripe payments work (test mode first, then live mode)
- [ ] Test push notifications (if implemented)
- [ ] Review App Store guidelines compliance

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
