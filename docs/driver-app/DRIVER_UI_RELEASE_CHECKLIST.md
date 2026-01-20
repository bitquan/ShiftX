# Driver App - Release Verification Checklist

**Version**: Phases 3C-3G (MapShell + Safety Rails + Final Hardening)  
**Date**: January 2025  
**Reviewer**: _________________  
**Build Hash**: _________________

---

## 🔒 Safety Rails Verification (Phase 3F/3G)

### Test 1: Production + Emulator (HARD BLOCK)

**Setup**:
```bash
cd packages/driver-app

# In .env - ADD these lines temporarily:
VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
VITE_FIREBASE_FIRESTORE_EMULATOR_HOST=127.0.0.1:8081

npm run build
npm run preview
# Open http://localhost:4173
```

**Expected**:
- [ ] 🚨 Full-screen error appears immediately
- [ ] Red gradient background with error icon
- [ ] Error text: "Emulators detected in production build!"
- [ ] Page is completely blocked (no dismiss button)
- [ ] App does NOT start
- [ ] Console shows: "BLOCKED: 🚨 CRITICAL..."

**Result**: ❌ FAIL if app loads | ✅ PASS if blocked

---

### Test 2: Dev + No Emulator (WARNING)

**Setup**:
```bash
cd packages/driver-app

# In .env - COMMENT OUT emulator lines:
# VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
# VITE_FIREBASE_FIRESTORE_EMULATOR_HOST=127.0.0.1:8081

# Make sure Firebase emulators are NOT running:
# (if running, stop them)

npm run dev
# Open http://localhost:5173
```

**Expected**:
- [ ] ⚠️ Orange warning banner at top of screen
- [ ] Warning text: "Development mode but NOT using emulators"
- [ ] Warning text: "You may be connected to PRODUCTION Firebase!"
- [ ] App still works (warning is dismissible)
- [ ] Console shows: "⚠️ WARNINGS:" in yellow
- [ ] "Dismiss" button hides banner (returns on refresh)

**Result**: ❌ FAIL if no warning | ✅ PASS if warning shown

---

### Test 3: Dev + Emulator (NORMAL)

**Setup**:
```bash
cd packages/driver-app

# In .env - UNCOMMENT emulator lines:
VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
VITE_FIREBASE_FIRESTORE_EMULATOR_HOST=127.0.0.1:8081

# Start emulators in another terminal:
cd /Users/papadev/dev/apps/shiftx
firebase emulators:start --only auth,firestore,functions,storage

# Run driver app:
cd packages/driver-app
npm run dev
# Open http://localhost:5173
```

**Expected**:
- [ ] ✅ No warning banner
- [ ] ✅ No error screen
- [ ] Console shows: "🔍 [Firebase] EMULATOR MODE ACTIVE"
- [ ] Console shows: "Production: false, Emulators: true, Valid: ✅"
- [ ] App loads normally

**Result**: ❌ FAIL if any warnings | ✅ PASS if clean

---

### Test 4: Production + No Emulator (NORMAL)

**Setup**:
```bash
cd packages/driver-app

# In .env - COMMENT OUT emulator lines:
# VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
# VITE_FIREBASE_FIRESTORE_EMULATOR_HOST=127.0.0.1:8081

npm run build
npm run preview
# Open http://localhost:4173
```

**Expected**:
- [ ] ✅ No warning banner
- [ ] ✅ No error screen
- [ ] Console shows: "🚀 [Firebase] PRODUCTION MODE"
- [ ] Console shows: "Production: true, Emulators: false, Valid: ✅"
- [ ] DiagnosticsPanel NOT visible (production)
- [ ] App loads normally

**Result**: ❌ FAIL if any errors | ✅ PASS if clean

---

## 📝 Event Log Verification (Phase 3F/3G)

### Test 5: Event Logging

**Setup**: Use **Test 3** setup (dev + emulator)

**Steps**:
1. Sign in to driver app
2. Click "🔧 Diagnostics" button (bottom right)
3. Scroll to "📝 Event Log (Phase 3F)" section

**Expected Events** (in order):
- [ ] ⚙️ SYSTEM: "Firebase initialized"
- [ ] 🔐 AUTH: "User signed in" (with uid/email)
- [ ] 📋 OFFER: Events when offers received
- [ ] ⚙️ SYSTEM: "Driver going online" (when toggling online)
- [ ] 📍 LOCATION: GPS events
- [ ] 📋 OFFER: "Offer shown to driver" (when offer appears)
- [ ] 📋 OFFER: "Offer accepted" or "Offer declined"
- [ ] 🚗 RIDE: "Ride started/completed/cancelled"
- [ ] 🧭 NAVIGATION: "Opened navigation to Pickup/Dropoff"
- [ ] ❌ ERROR: Any errors that occur

**Test Actions**:
- [ ] Filter by category (select "📋 Offers") - only offer events show
- [ ] Filter by category (select "🚗 Rides") - only ride events show
- [ ] Click "Export" button - toast shows "Copied Event Log JSON"
- [ ] Paste clipboard - valid JSON array with all events
- [ ] Click "Clear" button - toast shows "Event log cleared"
- [ ] Event list shows "No events logged yet"

**Result**: ❌ FAIL if events missing | ✅ PASS if all present

---

## 🚗 MapShell Ride Flow (Phase 3C/3D/3E)

### Test 6: Ride Cancellation Sync

**Setup**: Use **Test 3** setup (dev + emulator)

**Steps**:
1. Sign in as driver
2. Go online
3. Create test ride (use admin or customer app)
4. Accept ride offer
5. **Cancel ride from customer app** (not driver app)

**Expected**:
- [ ] DriverOfferSheet auto-dismisses immediately
- [ ] ActiveRideSheet auto-dismisses immediately
- [ ] Driver returns to idle/online state
- [ ] No stale offer sheet visible
- [ ] No stale active ride sheet visible
- [ ] Event log shows: "Ride cancelled"

**Result**: ❌ FAIL if sheet persists | ✅ PASS if auto-dismisses

---

### Test 7: Offer Modal Removal After Accept

**Setup**: Use **Test 3** setup (dev + emulator)

**Steps**:
1. Sign in as driver
2. Go online
3. Create test ride
4. See offer appear (DriverOfferSheet)
5. Click "Accept" button

**Expected**:
- [ ] DriverOfferSheet disappears immediately
- [ ] ActiveRideSheet appears in bottom sheet
- [ ] No double sheets visible
- [ ] No stale offer after acceptance
- [ ] Transition is smooth

**Result**: ❌ FAIL if offer persists | ✅ PASS if clean transition

---

### Test 8: Navigation Deep Links (Phase 3D)

**Setup**: Use **Test 3** setup, test on actual mobile device if possible

**Steps**:
1. Accept a ride
2. Click "Navigate" button
3. Verify destination:
   - Pre-trip (accepted/started): Should route to **pickup**
   - On-trip (in_progress): Should route to **dropoff**

**Expected**:
- [ ] **iOS**: Opens Apple Maps with driving directions
- [ ] **Android**: Opens Google Maps with navigation
- [ ] **Desktop/Web**: Opens Google Maps web with directions
- [ ] Correct destination used (pickup vs dropoff based on state)
- [ ] Event log shows: "🧭 NAVIGATION: Opened navigation to Pickup/Dropoff"

**Result**: ❌ FAIL if wrong app/destination | ✅ PASS if correct

---

### Test 9: Smooth Location + Heading (Phase 3E)

**Setup**: Use **Test 3** setup (dev + emulator with simulated location)

**OR**: Test on actual mobile device driving around

**Steps**:
1. Sign in as driver
2. Go online
3. Watch map for 30 seconds while moving

**Expected**:
- [ ] Car marker moves smoothly (not jumpy)
- [ ] Car marker rotates to match heading/direction
- [ ] No jitter on small movements (< 5m ignored)
- [ ] Transitions are 800ms smooth interpolation
- [ ] Marker rotation is smooth (300ms CSS transition)

**Result**: ❌ FAIL if jumpy | ✅ PASS if smooth

---

## 🏗️ Build + Deployment Verification

### Test 10: Clean Build

**Setup**:
```bash
cd packages/driver-app
npm run build
```

**Expected**:
- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Build output in `dist/` folder
- [ ] Console shows: "✓ built in XXXXms"

**Result**: ❌ FAIL if errors | ✅ PASS if clean

---

### Test 11: Build Size Check

**Setup**: After running `npm run build`

**Command**:
```bash
cd packages/driver-app
ls -lh dist/assets/*.js | awk '{print $5, $9}'
```

**Expected**:
- [ ] Main JS bundle < 1MB (preferably < 500KB gzipped)
- [ ] No massive vendor chunks (check for duplicate libs)
- [ ] Reasonable chunk splitting

**Result**: ✅ PASS | ⚠️ WARN if > 1MB | ❌ FAIL if > 2MB

---

### Test 12: Production Deployment

**Setup**:
```bash
cd /Users/papadev/dev/apps/shiftx
firebase deploy --only hosting:driver
```

**Expected**:
- [ ] Deploy completes successfully
- [ ] Visit production URL: https://shiftx-95c4b.web.app/driver (or your domain)
- [ ] App loads without errors
- [ ] No console errors
- [ ] No emulator connections (verify in console)
- [ ] DiagnosticsPanel NOT visible

**Result**: ❌ FAIL if errors | ✅ PASS if deployed

---

## 🧹 Code Quality Checks

### Test 13: No Tracked Secrets

**Command**:
```bash
cd packages/driver-app
git status
grep -r "AIza" .env* 2>/dev/null || echo "No API keys in .env files (good)"
git ls-files | xargs grep -l "AIza" 2>/dev/null || echo "No API keys tracked in git (good)"
```

**Expected**:
- [ ] `.env` is in `.gitignore`
- [ ] No API keys in tracked files
- [ ] Console shows: "No API keys tracked in git (good)"

**Result**: ❌ FAIL if keys found | ✅ PASS if clean

---

### Test 14: Subscription Cleanup

**Verification**: Manual code review

**Files to Check**:
- [ ] `App.tsx` - watchDriverOffers returns `unsubscribe()`
- [ ] `App.tsx` - watchDriverProfile returns `unsubscribe()`
- [ ] `BottomSheet.tsx` - window listeners cleaned up in useEffect return
- [ ] `useHeartbeat.ts` - GPS watch + interval cleared in cleanup
- [ ] `DriverOfferSheet.tsx` - watchRide cleaned up
- [ ] `ActiveRideSheet.tsx` - onSnapshot cleaned up

**Result**: ❌ FAIL if missing cleanup | ✅ PASS if all clean

---

### Test 15: Dead Code Removal

**Verification**: Check files were deleted

**Command**:
```bash
cd packages/driver-app
ls src/components/ActiveRide.tsx 2>/dev/null && echo "❌ ActiveRide.tsx still exists" || echo "✅ ActiveRide.tsx deleted"
ls src/components/ActiveRideHeader.tsx 2>/dev/null && echo "❌ ActiveRideHeader.tsx still exists" || echo "✅ ActiveRideHeader.tsx deleted"
ls src/components/OfferModal.tsx 2>/dev/null && echo "❌ OfferModal.tsx still exists" || echo "✅ OfferModal.tsx deleted"
```

**Expected**:
- [ ] ✅ ActiveRide.tsx deleted
- [ ] ✅ ActiveRideHeader.tsx deleted
- [ ] ✅ OfferModal.tsx deleted

**Result**: ❌ FAIL if files exist | ✅ PASS if all deleted

---

## 📊 Final Summary

### Checklist Completion

**Safety Rails**: ____ / 4 tests passed  
**Event Logging**: ____ / 1 test passed  
**MapShell Ride Flow**: ____ / 4 tests passed  
**Build + Deployment**: ____ / 3 tests passed  
**Code Quality**: ____ / 3 tests passed  

**TOTAL**: ____ / 15 tests passed

### Critical Failures (Must Fix)

- [ ] None

### Warnings (Should Fix)

- [ ] None

### Sign-Off

**Tested by**: _________________  
**Date**: _________________  
**Approved for release**: ☐ YES | ☐ NO | ☐ WITH FIXES

---

## 🚀 Deployment Commands

### Hosting Only
```bash
cd /Users/papadev/dev/apps/shiftx
firebase deploy --only hosting:driver
```

### Functions + Hosting
```bash
cd /Users/papadev/dev/apps/shiftx
npm run deploy:all  # Or use tasks if configured
```

### Rollback (If Needed)
```bash
firebase hosting:rollback driver
```

---

## 📞 Support

If any test fails, check:
1. **Phase 3F Doc**: `docs/driver-app/DRIVER_UI_PHASE3F_safety_rails.md`
2. **Phase 3C Doc**: `docs/driver-app/DRIVER_UI_PHASE3C_mapshell_state_cleanup.md`
3. **Phase 3D Doc**: `docs/driver-app/DRIVER_UI_PHASE3D_real_navigation.md`
4. **Phase 3E Doc**: `docs/driver-app/DRIVER_UI_PHASE3E_smooth_location.md`
5. **Event Log**: Use DiagnosticsPanel → Export to capture error context

---

**End of Checklist**
