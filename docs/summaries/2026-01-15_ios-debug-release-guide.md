# iOS Wrapper: Debug/Release Mode Implementation ✅

## What Was Implemented

Clean environment separation for iOS wrapper development and production:

### Debug Mode (Development)
- **Web Source:** Local dev server (`http://127.0.0.1:5173`)
- **Stripe Keys:** TEST mode (`pk_test_...`)
- **Firebase:** Emulator Suite (optional)
- **Benefits:** Hot reload, instant updates, safe testing

### Release Mode (Production)
- **Web Source:** Hosted HTTPS (`https://shiftx-95c4b-customer.web.app`)
- **Stripe Keys:** LIVE mode (`pk_live_...`)
- **Firebase:** Production backend
- **Benefits:** Proper Stripe origin, App Store ready, instant web updates

## Files Created/Updated

### New Files
```
packages/customer-app/
└── .env.development              # TEST Stripe key + emulator config

packages/ios-customer/
├── capacitor.config.debug.ts     # Local dev server template
└── capacitor.config.release.ts   # Hosted HTTPS template
```

### Updated Files
```
packages/ios-customer/
├── capacitor.config.ts           # Active config (auto-switched)
├── package.json                  # New scripts for mode switching
└── README.md                     # Complete guide with both modes
```

## Quick Start

### Option 1: Debug Mode (Recommended for Development)

```bash
# Terminal 1: Start customer dev server
cd packages/customer-app
npm run dev

# Terminal 2: Sync and open iOS
cd packages/ios-customer
npm run ios:debug
```

**In Xcode:**
- Select iPhone simulator
- Press `Cmd + R` to run
- App loads from local server with TEST keys ✅

**Debug in Safari:**
- Safari → Develop → Simulator → ShiftX Customer
- View console logs, network requests, Stripe calls

### Option 2: Release Mode (For Production Testing)

```bash
# 1. Deploy web app to hosting
cd packages/customer-app
npm run build
firebase deploy --only hosting:customer

# 2. Sync and open iOS
cd packages/ios-customer
npm run ios:release
```

**In Xcode:**
- Archive for App Store or test with production config

## How Mode Switching Works

### Behind the Scenes

1. **Two template configs:**
   - `capacitor.config.debug.ts` → local dev server
   - `capacitor.config.release.ts` → hosted HTTPS

2. **Scripts copy the right template:**
   ```bash
   npm run cap:sync:debug
   # → cp capacitor.config.debug.ts capacitor.config.ts
   # → npx cap sync ios
   ```

3. **Active config is auto-managed:**
   - Don't edit `capacitor.config.ts` directly
   - Always use the sync scripts to switch

### Command Reference

| Command | What It Does |
|---------|-------------|
| `npm run cap:sync:debug` | Switch to debug (local) |
| `npm run cap:sync:release` | Switch to release (hosted) |
| `npm run ios:debug` | Sync debug + open Xcode |
| `npm run ios:release` | Sync release + open Xcode |

## Environment Variables

### Customer App Environments

**Development (npm run dev):**
```env
# packages/customer-app/.env.development
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_USE_FIREBASE_EMULATOR=true
```

**Production (npm run build):**
```env
# packages/customer-app/.env.production
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
# Production Firebase config
```

### How It Flows

```
Debug Mode Flow:
┌─────────────────┐
│ iOS Simulator   │
│ (Capacitor)     │
└────────┬────────┘
         │ Loads URL
         ▼
┌─────────────────┐
│ http://127.0    │
│ .0.1:5173       │  ← Dev server
│ (Vite)          │    .env.development
└────────┬────────┘    TEST keys ✓
         │
         ▼
┌─────────────────┐
│ Emulator Suite  │
│ localhost:9099  │
└─────────────────┘

Release Mode Flow:
┌─────────────────┐
│ iOS Device      │
│ (App Store)     │
└────────┬────────┘
         │ Loads URL
         ▼
┌─────────────────┐
│ https://shiftx  │
│ -95c4b-customer │  ← Firebase Hosting
│ .web.app        │    .env.production
└────────┬────────┘    LIVE keys ✓
         │
         ▼
┌─────────────────┐
│ Firebase Prod   │
│ Stripe Live API │
└─────────────────┘
```

## Troubleshooting

### "Loading..." Forever in Simulator

**Check 1: Is dev server running?**
```bash
curl http://127.0.0.1:5173
# Should return HTML, not "Connection refused"
```

**Check 2: Is correct config active?**
```bash
cat packages/ios-customer/capacitor.config.ts | grep url
# Debug: http://127.0.0.1:5173
# Release: https://shiftx-95c4b-customer.web.app
```

**Check 3: Safari Web Inspector**
- Safari → Develop → Simulator
- Look for JS errors or 404s

### Stripe Errors in Logs

**Mode Mismatch:**
```bash
# Check what mode is active
cd packages/ios-customer
cat capacitor.config.ts | grep url

# Should match your intent:
# Debug = http://127.0.0.1:5173 → TEST keys
# Release = https://... → LIVE keys
```

**Fix:**
```bash
# Switch to correct mode
npm run cap:sync:debug    # For testing
npm run cap:sync:release  # For production
```

### White Screen After Load

**Web app error (check Safari Inspector):**
- Network tab: Any 404s?
- Console: JS errors?
- Elements: Is React mounting?

**Common causes:**
- Firebase config missing
- Stripe key invalid
- API endpoint unreachable

## Testing Checklist

### Debug Mode Verification

- [ ] Dev server running on http://127.0.0.1:5173
- [ ] `npm run ios:debug` syncs and opens Xcode
- [ ] App loads in simulator (not white screen)
- [ ] Safari Inspector shows console logs
- [ ] Stripe mode = TEST (check console)
- [ ] Can sign in with Firebase Emulator user
- [ ] Can create ride with test card (4242 4242 4242 4242)

### Release Mode Verification

- [ ] Web app deployed to https://shiftx-95c4b-customer.web.app
- [ ] URL loads in Safari browser (test first!)
- [ ] `npm run ios:release` syncs correctly
- [ ] App loads hosted web app in simulator
- [ ] Stripe mode = LIVE (check console)
- [ ] Can sign in with production Firebase user
- [ ] **Test with Stripe test card first!** (don't use real card yet)

## Next Steps

1. **Test Debug Mode Now:**
   ```bash
   # Terminal 1
   cd packages/customer-app && npm run dev
   
   # Terminal 2
   cd packages/ios-customer && npm run ios:debug
   ```

2. **Verify Stripe Works:**
   - Open Safari Web Inspector
   - Test ride booking with test card
   - Check logs for `[Stripe] mode=test`

3. **Ready for Production:**
   - Deploy web app to hosting
   - Switch to release mode
   - Test on physical device
   - Archive for App Store

## Benefits of This Approach

✅ **No more CORS issues** - Proper origin for both modes
✅ **No more key mismatches** - Environment auto-selects keys
✅ **Faster development** - Hot reload in debug mode
✅ **Safer testing** - Test keys in debug, live keys in release
✅ **Instant updates** - Web changes deploy without App Store review
✅ **Clean separation** - One command to switch modes

---

**Status:** ✅ Implementation complete and committed to `ios/main`

**Commit:** `846dd81` - Debug/Release mode switching
