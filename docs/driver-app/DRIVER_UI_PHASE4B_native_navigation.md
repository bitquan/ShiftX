# Phase 4B: Native Mapbox Navigation Setup Guide

**Version**: Phase 4B  
**Date**: January 2026  
**Status**: Implementation Complete

---

## Overview

Phase 4B integrates **Mapbox Navigation SDK** into the driver app via a custom Capacitor plugin. When the driver taps "Navigate", the app launches **native turn-by-turn navigation** (like Uber/Lyft) instead of opening an external maps app. This provides a professional, in-app navigation experience.

### Key Features

✅ **Native Turn-by-Turn**: Full navigation UI on iOS (NavigationViewController) and Android (Navigation Activity)  
✅ **Automatic Fallback**: Falls back to Apple Maps / Google Maps if native nav unavailable  
✅ **Event Logging**: navStarted, navEnded, navError events tracked  
✅ **Pickup → Dropoff**: Navigates to pickup before trip, dropoff during trip  
✅ **Token Hygiene**: Dev/prod tokens separated via build configs  

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│            Driver App (React/TypeScript)            │
│                                                     │
│  ActiveRideSheet.tsx                               │
│    ↓ taps "Navigate"                               │
│  ShiftXNavigation.start({ lat, lng, label })      │
└──────────────────┬──────────────────────────────────┘
                   │ Capacitor Bridge
         ┌─────────┴─────────┐
         ↓                   ↓
┌─────────────────┐   ┌──────────────────┐
│  iOS Plugin     │   │  Android Plugin  │
│  (Swift)        │   │  (Kotlin)        │
│                 │   │                  │
│  Mapbox Nav SDK │   │  Mapbox Nav SDK  │
│  v3.x           │   │  v3.x            │
│                 │   │                  │
│  Presents       │   │  Launches        │
│  Navigation     │   │  Navigation      │
│  ViewController │   │  Activity        │
└─────────────────┘   └──────────────────┘
```

### Files Created

**TypeScript Interface**:
- `packages/driver-app/src/native/ShiftXNavigation.ts` - Plugin interface
- `packages/driver-app/src/native/ShiftXNavigationWeb.ts` - Web fallback stub

**iOS Implementation**:
- `ios/App/App/Plugins/ShiftXNavigationPlugin.swift` - iOS plugin code

**Android Implementation**:
- `android/app/src/main/java/com/shiftx/driver/ShiftXNavigationPlugin.kt` - Android plugin
- `android/app/src/main/java/com/shiftx/driver/ShiftXNavigationActivity.kt` - Navigation UI activity

**Integration**:
- `packages/driver-app/src/components/ActiveRideSheet.tsx` - Updated to use native nav with fallback

---

## Setup Instructions

### Part 1: iOS Setup

#### 1.1 Add Mapbox Navigation SDK via Swift Package Manager

```bash
# Open Xcode
cd /Users/papadev/dev/apps/shiftx
open ios/App/App.xcworkspace
```

In Xcode:
1. **File** → **Add Package Dependencies**
2. Enter URL: `https://github.com/mapbox/mapbox-navigation-ios`
3. Select version: **3.x** (latest stable, e.g., 3.0.0)
4. Click **Add Package**
5. Select **MapboxNavigationCore** and **MapboxNavigationUIKit**
6. Click **Add Package**

#### 1.2 Configure Info.plist

Add to `ios/App/App/Info.plist`:

```xml
<!-- Mapbox Access Token (uses build config variable) -->
<key>MBXAccessToken</key>
<string>$(MAPBOX_ACCESS_TOKEN)</string>

<!-- Location permissions (required for navigation) -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>ShiftX needs your location to navigate to rides</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>ShiftX needs your location to provide navigation during rides</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>ShiftX needs your location to track rides and provide navigation</string>
```

#### 1.3 Configure Build Settings (Separate Dev/Prod Tokens)

In Xcode:
1. Select **App** target → **Build Settings**
2. Filter: "User-Defined"
3. Click **+** → **Add User-Defined Setting**
4. Name: `MAPBOX_ACCESS_TOKEN`
5. Expand the row, add values:
   - **Debug**: `pk.eyJ1...your_dev_token_here`
   - **Release**: `pk.eyJ1...your_prod_token_here`

**IMPORTANT**: 
- Get tokens from https://account.mapbox.com/access-tokens/
- Create **2 tokens**: one for dev, one for prod
- Do NOT commit tokens to git
- Add `*.xcconfig` with tokens to `.gitignore` if using config files

#### 1.4 Register Plugin

The plugin file `ShiftXNavigationPlugin.swift` is already created. Capacitor will auto-discover it if placed in `ios/App/App/Plugins/`.

**Verify**:
```bash
cd ios/App
pod install  # If using CocoaPods for other dependencies
```

---

### Part 2: Android Setup

#### 2.1 Add Mapbox Navigation SDK Dependencies

Edit `android/app/build.gradle`:

```gradle
dependencies {
    // Existing dependencies...
    
    // Phase 4B: Mapbox Navigation SDK
    implementation 'com.mapbox.navigation:android:3.0.0'  // Use latest 3.x
    implementation 'com.mapbox.navigation:ui-dropin:3.0.0'
}
```

#### 2.2 Configure AndroidManifest.xml

Edit `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest>
    <!-- Permissions for GPS navigation -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    
    <application>
        <!-- Mapbox Access Token (uses build config) -->
        <meta-data
            android:name="MAPBOX_ACCESS_TOKEN"
            android:value="${MAPBOX_ACCESS_TOKEN}" />
        
        <!-- Navigation Activity -->
        <activity
            android:name=".ShiftXNavigationActivity"
            android:theme="@style/Theme.AppCompat.NoActionBar"
            android:screenOrientation="portrait" />
    </application>
</manifest>
```

#### 2.3 Configure Gradle Properties (Separate Dev/Prod Tokens)

Edit `android/gradle.properties`:

```properties
# Phase 4B: Mapbox tokens (DO NOT COMMIT THESE)
MAPBOX_ACCESS_TOKEN_DEV=pk.eyJ1...your_dev_token_here
MAPBOX_ACCESS_TOKEN_PROD=pk.eyJ1...your_prod_token_here
```

Edit `android/app/build.gradle`:

```gradle
android {
    // ...existing config
    
    buildTypes {
        debug {
            manifestPlaceholders = [
                MAPBOX_ACCESS_TOKEN: project.properties['MAPBOX_ACCESS_TOKEN_DEV']
            ]
        }
        release {
            manifestPlaceholders = [
                MAPBOX_ACCESS_TOKEN: project.properties['MAPBOX_ACCESS_TOKEN_PROD']
            ]
        }
    }
}
```

**IMPORTANT**:
- Add `gradle.properties` to `.gitignore` (it should already be ignored)
- Keep dev and prod tokens separate
- Get tokens from https://account.mapbox.com/access-tokens/

#### 2.4 Register Plugin

Edit `android/app/src/main/java/com/shiftx/driver/MainActivity.kt`:

```kotlin
import com.getcapacitor.BridgeActivity
import android.os.Bundle

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Register ShiftXNavigation plugin
        registerPlugin(ShiftXNavigationPlugin::class.java)
    }
}
```

---

### Part 3: Build & Sync

#### iOS

```bash
cd /Users/papadev/dev/apps/shiftx
npx cap sync ios
npx cap open ios
```

In Xcode:
- Build target: **App**
- Run on: **Real iOS device** (simulator won't show navigation properly)

#### Android

```bash
cd /Users/papadev/dev/apps/shiftx
npx cap sync android
npx cap open android
```

In Android Studio:
- Sync Gradle files
- Build → Make Project
- Run on: **Real Android device** (emulator needs Google Play Services)

---

## Testing Guide

### Test 1: Native Navigation (iOS Device)

**Setup**: Real iPhone with GPS, connected to dev build

**Steps**:
1. Sign in to driver app
2. Go online
3. Create test ride (admin or customer app)
4. Accept ride
5. Tap **"Navigate"** button

**Expected**:
- [ ] Native Mapbox navigation UI opens (full screen)
- [ ] Route is calculated to **pickup** location
- [ ] Turn-by-turn instructions appear
- [ ] Voice guidance works
- [ ] Can swipe down to dismiss navigation
- [ ] Returns to MapShell after dismissing
- [ ] Event log shows: "🧭 NAVIGATION: Started native navigation to Pickup"

**Result**: ❌ FAIL | ✅ PASS

---

### Test 2: Native Navigation (Android Device)

**Setup**: Real Android device with GPS, connected to dev build

**Steps**:
1. Sign in to driver app
2. Go online
3. Create test ride
4. Accept ride
5. Tap **"Navigate"** button

**Expected**:
- [ ] Native Mapbox navigation activity launches
- [ ] Route is calculated to **pickup** location
- [ ] Turn-by-turn instructions appear
- [ ] Voice guidance works
- [ ] Can tap back or finish to exit navigation
- [ ] Returns to MapShell after exiting
- [ ] Event log shows: "🧭 NAVIGATION: Started native navigation to Pickup"

**Result**: ❌ FAIL | ✅ PASS

---

### Test 3: Pickup → Dropoff Transition

**Setup**: Active ride, driver at pickup location

**Steps**:
1. Accept ride → Navigate (routes to **pickup**)
2. Dismiss navigation, arrive at pickup
3. Tap **"Start Ride"** button
4. Tap **"Navigate"** button again

**Expected**:
- [ ] First navigation: routes to **pickup**
- [ ] After "Start Ride": routes to **dropoff**
- [ ] Event log shows: "Pickup" then "Dropoff"

**Result**: ❌ FAIL | ✅ PASS

---

### Test 4: Fallback to External Maps (Web/Desktop)

**Setup**: Run driver app in desktop browser (Chrome/Safari)

**Steps**:
1. Sign in, go online, accept ride
2. Tap **"Navigate"** button

**Expected**:
- [ ] Native navigation NOT available (plugin returns `available: false`)
- [ ] Falls back to Apple Maps (macOS) or Google Maps (Windows/Linux)
- [ ] External map opens in new tab with directions
- [ ] Event log shows: "🧭 NAVIGATION: Native navigation failed, using fallback"
- [ ] Then: "🧭 NAVIGATION: Opened external navigation to Pickup"

**Result**: ❌ FAIL | ✅ PASS

---

### Test 5: Error Handling

**Setup**: Real device, but Mapbox token invalid

**Steps**:
1. Temporarily set invalid token in build config
2. Rebuild app
3. Try to navigate

**Expected**:
- [ ] Native navigation fails
- [ ] Falls back to external maps
- [ ] Event log shows: "❌ ERROR: Native navigation error"
- [ ] Toast shows: "Navigation error: ..."
- [ ] App does NOT crash

**Result**: ❌ FAIL | ✅ PASS

---

## Event Logging

Phase 4B adds navigation event tracking:

```typescript
// When native navigation starts
logEvent('navigation', 'Started native navigation to Pickup', { 
  rideId, 
  destination, 
  method: 'native' 
});

// When fallback is used
logEvent('navigation', 'Native navigation failed, using fallback', { 
  rideId, 
  destination, 
  error: 'Plugin not available' 
});

logEvent('navigation', 'Opened external navigation to Pickup', { 
  rideId, 
  destination, 
  method: 'external' 
});

// When navigation ends
logEvent('navigation', 'Native navigation ended', { 
  rideId, 
  timestamp 
});

// On error
logEvent('error', 'Native navigation error', { 
  rideId, 
  error, 
  code 
});
```

**View logs**: DiagnosticsPanel → Event Log → Filter by "🧭 Navigation"

---

## Token Management Best Practices

### Security Rules

1. **Never commit tokens to git**
   - Add to `.gitignore`: `android/gradle.properties`, `ios/Config.xcconfig`
   - Use environment variables in CI/CD

2. **Separate dev and prod tokens**
   - Dev token: URL restrictions for `localhost:5173`, dev domain
   - Prod token: URL restrictions for production domain only

3. **Rotate tokens regularly**
   - Mapbox Dashboard → Access Tokens → Rotate token
   - Update build configs

### Getting Tokens

1. Go to https://account.mapbox.com/
2. Sign up / sign in
3. **Access Tokens** → **Create a token**
4. Token name: `ShiftX Driver Dev` / `ShiftX Driver Prod`
5. Scopes: 
   - ✅ `DOWNLOADS:READ`
   - ✅ `NAVIGATION:READ`
   - ✅ `MAPS:READ`
6. URL restrictions: 
   - Dev: `http://localhost:*`, `https://dev.yourcompany.com/*`
   - Prod: `https://yourcompany.com/*`
7. Copy token (starts with `pk.eyJ1...`)

### Environment Variables (CI/CD)

**GitHub Actions** (example):

```yaml
# .github/workflows/build-ios.yml
env:
  MAPBOX_ACCESS_TOKEN: ${{ secrets.MAPBOX_TOKEN_PROD }}
```

**Xcode Cloud** (example):

1. Xcode Cloud → Environment
2. Add secret: `MAPBOX_ACCESS_TOKEN`
3. Value: `pk.eyJ1...`

**Firebase App Distribution / TestFlight**:
- Use build settings from Xcode project
- Tokens are embedded during build, not runtime

---

## Troubleshooting

### iOS: "Mapbox token not configured"

**Check**:
```bash
# Open Xcode
cd /Users/papadev/dev/apps/shiftx
open ios/App/App.xcworkspace

# Verify in Xcode:
# 1. Build Settings → MAPBOX_ACCESS_TOKEN exists
# 2. Info.plist has MBXAccessToken = $(MAPBOX_ACCESS_TOKEN)
```

**Fix**: Add user-defined build setting (see iOS Setup 1.3)

---

### Android: "Mapbox access token not configured"

**Check**:
```bash
cat android/gradle.properties | grep MAPBOX
cat android/app/build.gradle | grep MAPBOX
```

**Fix**: 
1. Add tokens to `gradle.properties` (see Android Setup 2.3)
2. Add `manifestPlaceholders` to `build.gradle`
3. Sync Gradle in Android Studio

---

### Navigation UI doesn't appear

**Check**:
1. Are you testing on a **real device**? (Emulators have limited GPS)
2. Did you grant location permissions? (Settings → App → Permissions → Location)
3. Is the token valid? (Check Mapbox Dashboard)

**Fix**: 
- Use real device with GPS enabled
- Grant "Always" or "While Using" location permission
- Verify token in Mapbox Dashboard

---

### Fallback always triggers

**Check**:
```typescript
const { available, reason } = await ShiftXNavigation.isAvailable();
console.log('Native nav available:', available, reason);
```

**Possible reasons**:
- Running on web (expected - use external maps)
- Plugin not registered in MainActivity.kt / Capacitor config
- Mapbox SDK not installed / token missing

**Fix**: Follow setup steps for iOS/Android, rebuild app

---

## Performance Notes

### Native Navigation Benefits

- **Lower battery usage**: Mapbox SDK optimized for mobile
- **Better UX**: No app switching, stays in ShiftX context
- **Faster route recalc**: Real-time traffic updates
- **Offline maps**: Can download regions for offline nav

### When to Use Fallback

- **Web/Desktop**: No native SDK available (always fallback)
- **Token issues**: Dev/test environments without valid tokens
- **SDK errors**: Rare cases where route calculation fails

---

## Next Steps

### Phase 4C (Future): Enhanced Navigation

- [ ] **Voice Guidance**: Unmute Mapbox voice instructions
- [ ] **Waypoints**: Multi-stop rides (pickup passenger A, B, then dropoff A, B)
- [ ] **Traffic Avoidance**: Real-time route optimization
- [ ] **Offline Maps**: Pre-download city regions
- [ ] **ETA Updates**: Send live ETA to customer every 30s during nav

### Phase 4D (Future): Navigation Analytics

- [ ] Track navigation accuracy (did driver follow route?)
- [ ] Log off-route events
- [ ] Measure time to arrival vs. estimated time
- [ ] A/B test native vs. external maps adoption

---

## Support

**Issues?** Check:
1. This doc: `docs/driver-app/DRIVER_UI_PHASE4B_native_navigation.md`
2. Event Log: DiagnosticsPanel → Export log → share JSON
3. Console: Look for `[ActiveRideSheet]` or `[ShiftXNavigation]` logs

**Token Problems?** https://docs.mapbox.com/help/troubleshooting/

---

## Summary

Phase 4B provides **professional in-app turn-by-turn navigation** for iOS and Android, with automatic fallback to external maps on web. This matches the UX of Uber/Lyft where navigation happens inside the app, not by switching to Google Maps.

**Status**: ✅ Implementation complete, ready for device testing

---

**End of Phase 4B Documentation**
