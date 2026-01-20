# Phase 4B: Quick Setup Checklist

**Goal**: Get native Mapbox navigation working on iOS + Android devices

---

## iOS Setup (5 minutes)

### 1. Add Mapbox SDK
```bash
cd /Users/papadev/dev/apps/shiftx
open ios/App/App.xcworkspace
```

In Xcode:
- File → Add Package Dependencies
- URL: `https://github.com/mapbox/mapbox-navigation-ios`
- Version: 3.x
- Add MapboxNavigationCore + MapboxNavigationUIKit

### 2. Configure Info.plist

Add to `ios/App/App/Info.plist`:
```xml
<key>MBXAccessToken</key>
<string>$(MAPBOX_ACCESS_TOKEN)</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>ShiftX needs your location to navigate to rides</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>ShiftX needs your location to provide navigation during rides</string>
```

### 3. Add Build Settings

Xcode → App target → Build Settings → + (Add User-Defined Setting):
- Name: `MAPBOX_ACCESS_TOKEN`
- Debug: `pk.eyJ1...YOUR_DEV_TOKEN`
- Release: `pk.eyJ1...YOUR_PROD_TOKEN`

Get tokens: https://account.mapbox.com/access-tokens/

### 4. Build

```bash
npx cap sync ios
npx cap open ios
```

Build on real iOS device (simulator won't show nav properly)

---

## Android Setup (5 minutes)

### 1. Add Dependencies

Edit `android/app/build.gradle`:
```gradle
dependencies {
    implementation 'com.mapbox.navigation:android:3.0.0'
    implementation 'com.mapbox.navigation:ui-dropin:3.0.0'
}
```

### 2. Configure Manifest

Edit `android/app/src/main/AndroidManifest.xml`:
```xml
<manifest>
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    
    <application>
        <meta-data
            android:name="MAPBOX_ACCESS_TOKEN"
            android:value="${MAPBOX_ACCESS_TOKEN}" />
        
        <activity
            android:name=".ShiftXNavigationActivity"
            android:theme="@style/Theme.AppCompat.NoActionBar" />
    </application>
</manifest>
```

### 3. Add Tokens

Edit `android/gradle.properties`:
```properties
MAPBOX_ACCESS_TOKEN_DEV=pk.eyJ1...YOUR_DEV_TOKEN
MAPBOX_ACCESS_TOKEN_PROD=pk.eyJ1...YOUR_PROD_TOKEN
```

Edit `android/app/build.gradle`:
```gradle
android {
    buildTypes {
        debug {
            manifestPlaceholders = [MAPBOX_ACCESS_TOKEN: project.properties['MAPBOX_ACCESS_TOKEN_DEV']]
        }
        release {
            manifestPlaceholders = [MAPBOX_ACCESS_TOKEN: project.properties['MAPBOX_ACCESS_TOKEN_PROD']]
        }
    }
}
```

### 4. Register Plugin

Edit `android/app/src/main/java/com/shiftx/driver/MainActivity.kt`:
```kotlin
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        registerPlugin(ShiftXNavigationPlugin::class.java)
    }
}
```

### 5. Build

```bash
npx cap sync android
npx cap open android
```

Sync Gradle, build on real Android device

---

## Quick Test

1. Sign in to driver app on real device
2. Go online
3. Create test ride (admin app)
4. Accept ride
5. Tap **"Navigate"** button

**Expected**: Native full-screen navigation opens with turn-by-turn directions

**If it doesn't work**:
- Check tokens are valid: https://account.mapbox.com/
- Check location permissions granted
- Check console for errors
- Try fallback: should open Apple/Google Maps externally

---

## Token Hygiene

**DO NOT**:
- ❌ Commit tokens to git
- ❌ Use same token for dev and prod
- ❌ Share tokens in Slack/Discord

**DO**:
- ✅ Add tokens to `.gitignore` (gradle.properties, xcconfig files)
- ✅ Create separate dev/prod tokens with URL restrictions
- ✅ Rotate tokens every 6 months

---

## Files Changed

**Created**:
- `packages/driver-app/src/native/ShiftXNavigation.ts` (plugin interface)
- `packages/driver-app/src/native/ShiftXNavigationWeb.ts` (web fallback)
- `ios/App/App/Plugins/ShiftXNavigationPlugin.swift` (iOS implementation)
- `android/app/src/main/java/com/shiftx/driver/ShiftXNavigationPlugin.kt` (Android plugin)
- `android/app/src/main/java/com/shiftx/driver/ShiftXNavigationActivity.kt` (Android UI)

**Modified**:
- `packages/driver-app/src/components/ActiveRideSheet.tsx` (uses native nav with fallback)

**Documentation**:
- `docs/driver-app/DRIVER_UI_PHASE4B_native_navigation.md` (full guide)
- `docs/driver-app/PHASE4B_QUICK_SETUP.md` (this checklist)

---

## Troubleshooting

**"Mapbox token not configured"**:
- iOS: Check Xcode Build Settings → MAPBOX_ACCESS_TOKEN
- Android: Check gradle.properties and build.gradle

**Navigation doesn't open**:
- Use real device (not emulator/simulator)
- Grant location permissions in device settings
- Check token is valid in Mapbox Dashboard

**Always falls back to external maps**:
- Plugin not registered in MainActivity.kt
- SDK not installed via SPM/Gradle
- Token missing/invalid

---

## Next Steps

1. **Test on devices**: iOS + Android real devices with GPS
2. **Test pickup → dropoff**: Verify destination switches correctly
3. **Test fallback**: Try on web browser (should open Google/Apple Maps)
4. **Check event logs**: DiagnosticsPanel → Navigation events

---

**Full docs**: `docs/driver-app/DRIVER_UI_PHASE4B_native_navigation.md`
