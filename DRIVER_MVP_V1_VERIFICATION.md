# Driver MVP v1 - Definition of Done Verification

## ✅ Implementation Complete

### Backend Hardening Added
- ✅ **Role Enforcement**: All driver endpoints check `users/{uid}.role === 'driver'`
  - `acceptRide`, `startRide`, `progressRide`, `completeRide`
  - `driverSetOnline`, `driverHeartbeat`
- ✅ **Structured Logging**: All callables log `{function, uid, rideId, timestamp}`
- ✅ **Idempotency**: Duplicate calls return success without corruption
  - Calling `acceptRide` twice returns success
  - Calling `startRide` on already-started ride returns success
  - Calling `progressRide` on in_progress ride returns success
  - Calling `completeRide` on completed ride returns success
- ✅ **Decline Offer Support**: New `declineOffer` callable added

### Frontend Features
- ✅ **Email/Password Auth**: Sign in/up with validation
- ✅ **Auto-create docs**: `users/{uid}` + `drivers/{uid}` on first login
- ✅ **Onboarding Gating**: Shows different screens based on status
  - `pending` → "Onboarding Pending" screen
  - `suspended` → "Account Suspended" screen
  - `active` → Full driver functionality
- ✅ **Online/Offline Toggle**: Calls `driverSetOnline()`
- ✅ **Automatic Heartbeat**: Runs every 30s while online
- ✅ **Offers UI**: Modal with pickup/dropoff/price + Accept action
- ✅ **Active Ride**: State machine Start → In Progress → Complete
- ✅ **Error Handling**: Toast notifications throughout

---

## 🧪 Verification Checklist (10 minutes)

### 1. Sign Up & Document Creation
```
✓ Go to http://localhost:4173
✓ Sign up with: test-driver@example.com / password123
✓ Check Firestore Emulator UI (http://127.0.0.1:4000/firestore):
  - users/{uid} exists with role: "driver"
  - drivers/{uid} exists with onboardingStatus: "pending"
```

### 2. Onboarding Gate
```
✓ App shows "Onboarding Pending" screen
✓ Cannot access DriverHome, offers, or rides
```

### 3. Activate Driver
```
✓ In Firestore Emulator UI, update drivers/{uid}:
  onboardingStatus: "active"
✓ App immediately unlocks to DriverHome
```

### 4. Online Toggle & Heartbeat
```
✓ Click "Go online"
✓ Check drivers/{uid}.isOnline === true
✓ Wait 30 seconds
✓ Check drivers/{uid}.lastSeenAtMs updated
✓ Check Functions logs for heartbeat calls
```

### 5. Offer Flow & Ride Lifecycle
```
✓ Click "Create test ride"
✓ Offer modal appears with pickup/dropoff/price
✓ Click "Accept"
✓ Check:
  - rides/{rideId}.status === "accepted"
  - rides/{rideId}.driverId === {uid}
  - drivers/{uid}.isBusy === true
  - drivers/{uid}.currentRideId === {rideId}

✓ Click "Start Ride"
✓ Check rides/{rideId}.status === "started"

✓ Click "Mark In Progress"
✓ Check rides/{rideId}.status === "in_progress"

✓ Click "Complete Ride"
✓ Check:
  - rides/{rideId}.status === "completed"
  - drivers/{uid}.isBusy === false
  - drivers/{uid}.currentRideId === null
```

### 6. Role Enforcement
```
✓ In Firestore Emulator, create test user:
  - users/test-customer with role: "customer"
✓ Try calling driverHeartbeat as customer → PERMISSION DENIED
```

### 7. Idempotency
```
✓ Start a ride
✓ Call startRide again → SUCCESS (no error)
✓ Complete a ride
✓ Call completeRide again → SUCCESS (no error)
```

---

## 📋 What's NOT in MVP v1 (Document but Don't Build Yet)

### Presence Cleanup
- **MVP**: Driver stays busy if app crashes mid-ride
- **Future**: Cloud Function monitors `lastSeenAtMs`, auto-cleans stale rides

### Advanced Offer Management
- **MVP**: Offers expire after 60s, no explicit decline UI
- **Future**: Decline button in UI, analytics on decline reasons

### Customer Role Validation
- **MVP**: tripRequest has no role check
- **Next Sprint**: Add role enforcement for customer endpoints

---

## ✅ Success Criteria

If ALL 7 verification steps pass:
- **Driver MVP v1 is COMPLETE**
- **Ready for Customer MVP**

If ANY step fails:
- Note which step failed
- Fix before proceeding

---

## 🚀 Next: Customer MVP

### Prerequisites
- Driver v1 verification passes
- Firebase emulators running
- `tripRequest` tested manually

### Customer MVP Scope
1. Email/password auth
2. Request ride UI (pickup/dropoff/price)
3. Watch ride status updates
4. Cancel ride (with rules)

**Do NOT start Customer until Driver v1 verification is complete.**
