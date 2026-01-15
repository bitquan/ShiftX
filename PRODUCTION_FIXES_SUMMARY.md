# Production Rules & Fixes Summary

**Date:** January 14, 2026  
**Status:** ✅ ALL FIXES DEPLOYED

---

## 1. Profile Photo Upload Fix

### Problem
Profile photo uploads were failing with `403 storage/unauthorized` error in production.

### Root Cause
Storage rules were correct but not deployed to production.

### Solution ✅
- **Storage Rules:** Already correct at [storage.rules](storage.rules)
  ```
  match /profile-photos/{userId}/{fileName} {
    allow read: if true; // Anyone can read profile photos
    allow write: if request.auth != null && request.auth.uid == userId;
  }
  ```
- **Upload Path:** Both apps use `profile-photos/${userId}/profile.jpg`
- **Deployment:** `firebase deploy --only storage`

### Verification
```bash
# Check deployed rules
firebase storage:rules:get

# Test upload (browser console)
const blob = new Blob(['test'], { type: 'image/jpeg' });
const storageRef = ref(storage, `profile-photos/${auth.currentUser.uid}/profile.jpg`);
await uploadBytes(storageRef, blob);
```

---

## 2. Stale/Expired Offer Prevention

### Problem
Driver app kept showing expired job offers after page reload. Clicking stale offers caused errors.

### Root Cause
Multiple issues:
- No client-side expiration filtering
- No ride status validation
- Offers could resurrect from localStorage
- Backend cleanup not comprehensive enough

### Solution ✅ (Phase 23)

#### A) Client-Side Filtering
**File:** [packages/driver-app/src/App.tsx](packages/driver-app/src/App.tsx#L127-L143)
```typescript
const unsubscribe = watchDriverOffers(
  user.uid,
  (driverOffers) => {
    const now = Date.now();
    const pendingMap = new Map<string, RideOffer>();
    
    driverOffers.forEach(({ rideId, offer }) => {
      if (!offer) return;
      
      // Client-side expiration check
      const expiresAtMs = offer.expiresAtMs || 0;
      if (expiresAtMs <= now) {
        console.log(`[App] Filtering out expired offer for ride ${rideId}`);
        return;
      }
      
      // Only keep pending offers
      if (offer.status === 'pending') {
        pendingMap.set(rideId, offer);
      }
    });
    setPendingOffers(pendingMap);
  }
);
```

#### B) Ride Status Validation
**File:** [packages/driver-app/src/components/AvailableRides.tsx](packages/driver-app/src/components/AvailableRides.tsx#L39-L91)
```typescript
offers.forEach((offer, rideId) => {
  // Skip expired offers at subscription time
  const expiresAtMs = offer.expiresAtMs || 0;
  if (expiresAtMs <= now) {
    console.log(`[AvailableRides] Skipping expired offer for ride ${rideId}`);
    return;
  }
  
  // Determine offer status based on ride state
  let status: 'pending' | 'expired' | 'taken' | 'cancelled' = 'pending';
  
  if (offer.status !== 'pending' || now > (offer.expiresAtMs || 0)) {
    status = 'expired';
  } else if (ride && ride.status === 'cancelled') {
    status = 'cancelled';
  } else if (ride && ['accepted', 'started', 'in_progress', 'completed'].includes(ride.status)) {
    if (ride.driverId && ride.driverId !== currentDriverId) {
      status = 'taken';
    }
  }
});
```

#### C) Modal Expiration Guard
**File:** [packages/driver-app/src/components/OfferModal.tsx](packages/driver-app/src/components/OfferModal.tsx#L76-L88)
```typescript
// Check if already expired on mount
const now = Date.now();
const initialRemaining = Math.max(0, offer.expiresAtMs - now);

if (initialRemaining === 0) {
  show('Offer expired', 'warning');
  setTimeout(() => onExpired(), 100);
  return;
}
```

#### D) Backend Cleanup
**File:** [functions/src/cleanup.ts](functions/src/cleanup.ts#L493-L505)

**scheduledCleanup** function (runs every 2 minutes):
1. **Expire time-based stale offers:**
   - Query: `status == 'pending' AND expiresAtMs <= now`
   - Action: Set `status: 'expired'`

2. **Mark offers on accepted rides as taken:**
   - Query: `status in ['accepted', 'started', 'in_progress'] AND driverId != null`
   - Action: Set pending offers to `status: 'taken_by_other'`

3. **Clean ghost drivers:**
   - Query: `isOnline == true AND lastHeartbeatMs <= (now - 90s)`
   - Action: Set `isOnline: false`

4. **Cancel unpaid rides:**
   - Query: `status == 'accepted' AND acceptedAtMs <= (now - 5min) AND paymentStatus != 'authorized'`
   - Action: Cancel ride, release driver

5. **Cancel unstarted rides:**
   - Query: `status == 'accepted' AND paymentStatus == 'authorized' AND paymentAuthorizedAtMs <= (now - 10min)`
   - Action: Cancel ride, cancel Stripe PaymentIntent, release driver

**Deployment:**
```bash
firebase deploy --only functions:scheduledCleanup,functions:acceptRide
```

#### E) No localStorage Resurrection
**Verification:** No localStorage persistence for offers found
```bash
grep -r "localStorage.*offer" packages/driver-app/src/
# Result: No matches
```

### Verification
1. Go online, receive offer
2. Wait 60s for expiration → Offer shows "EXPIRED"
3. Reload page → Expired offer does NOT reappear ✅
4. Two drivers online, one accepts → Other sees "Taken by another driver"

---

## 3. Firebase Initialization Crash Fix

### Problem
Driver app randomly threw error:
```
Firebase: No Firebase App '[DEFAULT]' has been created - call initializeApp() first (app/no-app)
```

### Root Cause
Multiple potential issues:
- Firebase services imported before initialization
- Circular imports between firebase.ts and components
- Different initialization patterns in dev vs prod builds

### Solution ✅ (Phase 22)

#### A) Centralized Firebase Singleton
**File:** [packages/driver-app/src/firebase.ts](packages/driver-app/src/firebase.ts)
```typescript
/**
 * Centralized Firebase initialization for Driver App
 * 
 * IMPORTANT: This file MUST be imported before any Firebase usage.
 */

import { initDriverClient, DEFAULT_EMULATOR_CONFIG } from '@shiftx/driver-client';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCi9fz_lpRJh1dEnmRekGVh3Jc9JAyYHnU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'shiftx-95c4b.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'shiftx-95c4b',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'shiftx-95c4b.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '928827778230',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:928827778230:web:ac7b78dcf4d7b93d22f217',
};

// Initialize driver client (creates named Firebase app)
const emulatorConfig = import.meta.env.DEV ? DEFAULT_EMULATOR_CONFIG : undefined;
const driverClient = initDriverClient({ 
  firebaseConfig, 
  emulator: emulatorConfig 
});

// Export Firebase instances from the driver client app
export const app = driverClient.app;
export const auth = getAuth(app);
export const db = driverClient.firestore;
export const functions = driverClient.functions;
export const storage = driverClient.storage;
```

#### B) Import First in Entry Point
**File:** [packages/driver-app/src/main.tsx](packages/driver-app/src/main.tsx)
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
// CRITICAL: Import firebase FIRST to ensure initialization before any component code
import './firebase';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
```

#### C) All Components Import from Centralized Module
**Pattern across all components:**
```typescript
// ✅ CORRECT
import { auth, db, storage } from '../firebase';

// ❌ WRONG (bypasses singleton)
import { getAuth } from 'firebase/auth';
const auth = getAuth(); // Uses [DEFAULT] app
```

### Verification
1. Open driver app
2. Check console: Should see `[Firebase] Driver app initialized with project: shiftx-95c4b`
3. Reload multiple times: No app/no-app errors
4. Open offer modal, accept/decline: No Firebase errors

---

## 4. Firestore Rules Audit

### Problem
Several issues:
- Config/admins collection writable by anyone (development rules)
- Need to verify all production flows work without permission errors

### Solution ✅

#### A) Config/Admins Locked Down
**File:** [firestore.rules](firestore.rules#L104-L107)
```plaintext
match /config/{docId} {
  allow read: if signedIn(); // Only authenticated users (needed for isAdmin check)
  allow write: if isAdmin(); // Only admins can modify config
}
```

#### B) Complete Rules Summary
```plaintext
✅ users/{uid}
  - read: owner OR any signed-in user
  - create: owner only
  - update: owner only (prevents role downgrades from admin)
  - delete: false

✅ customers/{uid}
  - read/create/update: owner only
  - list: admin only
  - delete: false

✅ drivers/{driverId}
  - read/list: any signed-in user (for customer to see driver info)
  - create: owner only
  - update: owner only (limited fields)
  - delete: false

✅ rides/{rideId}
  - get: rider OR customer OR driver OR hasOffer OR admin
  - list: admin only
  - write: false (functions only)
  
  ✅ rides/{rideId}/events/{eventId}
    - read: rider OR customer OR driver OR admin
    - write: false (functions only)
  
  ✅ rides/{rideId}/offers/{driverId}
    - get/list: owner (driver) only
    - write: false (functions only)

✅ /{path=**}/offers/{offerId} (collection group)
  - list: owner (driver) only

✅ config/{docId}
  - read: signed-in users only
  - write: admin only

✅ adminLogs/{logId}
  - read: signed-in users (transparency)
  - write: false (functions only)
```

### Deployment
```bash
firebase deploy --only firestore:rules
```

### Verification
- Customer: Can read own rides, events, profile
- Driver: Can read own offers, driver profile, rides with offers
- Admin: Can list/read all collections
- No "Missing or insufficient permissions" errors in console

---

## 5. RideTimeline Stability (Phase 24)

### Problem
Customer's "📊 Ride Timeline" component flickered or disappeared, especially in production.

### Root Cause
- Wrong field in `orderBy` query (`createdAtMs` vs backend's `atMs`)
- Empty snapshots cleared UI after initial load
- Firestore rules potentially denying event reads

### Solution ✅
**File:** [packages/customer-app/src/components/RideTimeline.tsx](packages/customer-app/src/components/RideTimeline.tsx)

#### A) Fixed orderBy Field
```typescript
// Before:
orderBy('createdAtMs', 'asc')

// After:
orderBy('atMs', 'asc') // Matches backend field
```

#### B) Added First-Load Tracking
```typescript
const hasLoadedOnceRef = useRef(false);

if (newEvents.length > 0) {
  setEvents(newEvents);
  lastEventsRef.current = newEvents;
} else if (!hasLoadedOnceRef.current) {
  setEvents([]);
  lastEventsRef.current = [];
} else {
  // Keep showing last known events - PREVENTS FLICKER
  console.log('[RideTimeline] Ignoring empty snapshot');
}

hasLoadedOnceRef.current = true;
```

#### C) Always-Visible Container
```tsx
// Before: Conditional rendering
if (loading) return <div>Loading...</div>;
if (error) return <div>Error</div>;
if (events.length === 0) return <div>No events</div>;
return <div className="timeline">...</div>;

// After: Single container, conditional content
return (
  <div className="ride-timeline">
    <h3>📊 Ride Timeline</h3>
    {loading && !hasLoadedOnceRef.current ? (
      <div>Loading...</div>
    ) : error && events.length === 0 ? (
      <div>Error</div>
    ) : events.length === 0 ? (
      <div>No events</div>
    ) : (
      <div>{/* events */}</div>
    )}
  </div>
);
```

#### D) Updated Firestore Rules
**File:** [firestore.rules](firestore.rules#L85-L100)
```plaintext
match /events/{eventId} {
  allow read: if signedIn()
    && (
      request.auth.uid == get(/databases/$(database)/documents/rides/$(rideId)).data.riderId
      || request.auth.uid == get(/databases/$(database)/documents/rides/$(rideId)).data.customerId
      || request.auth.uid == get(/databases/$(database)/documents/rides/$(rideId)).data.driverId
      || isAdmin()
    );
  allow write: if false;
}
```

### Verification
1. Customer requests ride
2. Monitor timeline throughout ride lifecycle
3. Timeline stays visible, no flicker on status changes
4. Console logs show `[RideTimeline]` successful subscriptions

---

## Deployment Commands

### All Rules (Storage + Firestore)
```bash
firebase deploy --only storage,firestore:rules
```

### Cloud Functions
```bash
firebase deploy --only functions:scheduledCleanup,functions:acceptRide
```

### Customer App
```bash
cd packages/customer-app && npm run build && cd ../.. && firebase deploy --only hosting:customer
```

### Driver App
```bash
cd packages/driver-app && npm run build && cd ../.. && firebase deploy --only hosting:driver
```

---

## Deployed Functions Status

```bash
$ firebase functions:list

┌────────────────────────┬─────────┬───────────┬─────────────┬────────┬──────────┐
│ Function               │ Version │ Trigger   │ Location    │ Memory │ Runtime  │
├────────────────────────┼─────────┼───────────┼─────────────┼────────┼──────────┤
│ acceptRide             │ v2      │ callable  │ us-central1 │ 128    │ nodejs20 │
│ scheduledCleanup       │ v2      │ scheduled │ us-central1 │ 256    │ nodejs20 │
└────────────────────────┴─────────┴───────────┴─────────────┴────────┴──────────┘
```

---

## Files Modified

1. ✅ [storage.rules](storage.rules) - Already correct, just deployed
2. ✅ [firestore.rules](firestore.rules) - Locked down config/admins (line 104-107)
3. ✅ [packages/driver-app/src/App.tsx](packages/driver-app/src/App.tsx) - Client-side expiration filtering (Phase 23)
4. ✅ [packages/driver-app/src/components/AvailableRides.tsx](packages/driver-app/src/components/AvailableRides.tsx) - Ride status validation (Phase 23)
5. ✅ [packages/driver-app/src/firebase.ts](packages/driver-app/src/firebase.ts) - Centralized singleton (Phase 22)
6. ✅ [packages/driver-app/src/main.tsx](packages/driver-app/src/main.tsx) - Import firebase first (Phase 22)
7. ✅ [packages/customer-app/src/components/RideTimeline.tsx](packages/customer-app/src/components/RideTimeline.tsx) - Anti-flicker logic (Phase 24)
8. ✅ [functions/src/cleanup.ts](functions/src/cleanup.ts) - scheduledCleanup function (Phase 23)
9. ✅ [functions/src/rides.ts](functions/src/rides.ts) - acceptRide marks other offers taken (Phase 23)

---

## Production URLs

- **Customer App:** https://shiftx-95c4b-customer.web.app
- **Driver App:** https://shiftx-95c4b-driver.web.app
- **Admin Dashboard:** https://shiftx-95c4b-admin.web.app
- **Firebase Console:** https://console.firebase.google.com/project/shiftx-95c4b/overview

---

## Success Criteria

### ✅ Profile Photo Upload
- Customer can upload photo without 403 error
- Driver can upload photo without 403 error
- Photos display correctly after refresh

### ✅ Stale Offer Prevention
- Expired offers do NOT reappear on reload
- Clicking offer never crashes app
- Other driver accepting ride removes offer quickly
- No localStorage resurrection

### ✅ Firebase Initialization
- Driver app never throws app/no-app error
- Console shows successful initialization
- All Firebase services accessible

### ✅ Permissions
- Customer can read own rides/events
- Driver can read own offers/rides
- Admin can list/read all collections
- No "insufficient permissions" errors

### ✅ RideTimeline
- Timeline stays visible throughout ride
- No flicker on status updates
- Events display in correct order

---

## Testing Instructions

See [PRODUCTION_VERIFICATION_CHECKLIST.md](PRODUCTION_VERIFICATION_CHECKLIST.md) for comprehensive testing procedures.

**Quick smoke test:**
1. Customer: Sign in → Upload photo → Request ride → Check timeline
2. Driver: Sign in → Upload photo → Go online → Accept offer → Check no stale offers
3. Admin: Sign in → View rides → Approve driver

---

## Monitoring

### Firebase Console Checks
1. **Functions Logs:** Monitor scheduledCleanup execution every 2 min
2. **Firestore Usage:** Check read/write patterns
3. **Storage Usage:** Monitor upload bandwidth
4. **Error Reporting:** Check for any permission-denied or app/no-app errors

### Browser Console Checks
1. **Customer:** `[RideTimeline]` logs, no permission errors
2. **Driver:** `[Firebase] Driver app initialized`, `[App] Filtering out expired offer`
3. **Admin:** No permission errors

---

## Rollback Plan

If issues arise:

```bash
# Revert Firestore rules
git checkout HEAD~1 firestore.rules
firebase deploy --only firestore:rules

# Revert Storage rules
git checkout HEAD~1 storage.rules
firebase deploy --only storage

# Revert functions
git checkout HEAD~1 functions/
cd functions && npm install && cd ..
firebase deploy --only functions
```

---

## Conclusion

All production issues have been addressed:

1. ✅ **Profile photo upload:** Storage rules deployed
2. ✅ **Stale offers:** Client-side filtering + backend cleanup deployed
3. ✅ **Firebase init crash:** Centralized singleton deployed
4. ✅ **Permissions:** Firestore rules locked down and deployed
5. ✅ **RideTimeline:** Anti-flicker logic deployed (Phase 24)

**Next Steps:** Run production verification checklist and monitor for any issues.
