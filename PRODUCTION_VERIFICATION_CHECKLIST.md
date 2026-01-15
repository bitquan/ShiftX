# Production Verification Checklist

**Date:** January 14, 2026  
**Status:** All critical fixes deployed ✅

## Deployment Summary

### 1. Storage Rules (✅ Deployed)
- **Path:** `profile-photos/{userId}/{fileName}`
- **Rules:** Owner can write, anyone can read
- **Storage bucket:** `shiftx-95c4b.firebasestorage.app`

### 2. Firestore Rules (✅ Deployed)
- **Config/admins:** Locked down to authenticated users + admin write
- **Events:** Customers/drivers can read their ride events
- **Rides:** Proper access control for rider/customer/driver/admin
- **Offers:** Driver-specific access

### 3. Stale Offer Prevention (✅ Deployed)
- **Client-side filtering:** `expiresAtMs > Date.now()` in App.tsx
- **Ride status validation:** AvailableRides.tsx checks ride status
- **Modal expiration:** OfferModal auto-closes expired offers
- **Backend cleanup:** `scheduledCleanup` runs every 2 minutes

### 4. Firebase Initialization (✅ Fixed)
- **Driver app:** Centralized in firebase.ts, imported first in main.tsx
- **Named app:** 'shiftx-driver-client' via driver-client package
- **No circular imports:** Firebase instances exported from single source

### 5. Cloud Functions (✅ Deployed)
- **acceptRide:** v2 callable function (us-central1, 128MB, nodejs20)
- **scheduledCleanup:** v2 scheduled function (every 2 min, us-central1, 256MB, nodejs20)

---

## Verification Tests

### Customer App Tests (https://shiftx-95c4b-customer.web.app)

#### ✅ Authentication & Profile
- [ ] Sign in with Google/email
- [ ] Upload profile photo
  - Expected: Upload succeeds (no 403 storage/unauthorized)
  - Expected: Photo displays after refresh
- [ ] View profile settings

#### ✅ Ride Request Flow
- [ ] Request a ride
- [ ] Authorize payment with Stripe test card
  - Card: `4242 4242 4242 4242`
  - Expected: Payment authorized, shows "Waiting for driver"
- [ ] View "📊 Ride Timeline"
  - Expected: Timeline appears and stays visible
  - Expected: No flicker or disappear on status changes
- [ ] Monitor ride status updates

#### ✅ Ride History
- [ ] View completed rides
- [ ] Check ride timeline for historical rides

### Driver App Tests (https://shiftx-95c4b-driver.web.app)

#### ✅ Authentication & Profile
- [ ] Sign in with Google/email
- [ ] Upload profile photo
  - Expected: Upload succeeds (no 403 storage/unauthorized)
  - Expected: Photo displays after refresh
- [ ] View driver profile

#### ✅ Offer Flow
- [ ] Go online
- [ ] Receive ride offer
  - Expected: Offer modal appears
  - Expected: Timer counts down from 60s
- [ ] Accept offer
  - Expected: Transitions to "Waiting for payment"
  - Expected: Other pending offers disappear

#### ✅ Stale Offer Prevention (CRITICAL)
- [ ] Go online, receive offer
- [ ] Wait for offer to expire (60s)
  - Expected: Offer modal shows "Offer expired"
  - Expected: Offer card shows "EXPIRED"
- [ ] Reload page (F5)
  - Expected: Expired offer does NOT reappear ✅
  - Expected: No offers shown
- [ ] Request new ride from customer
- [ ] Two drivers go online
- [ ] One driver accepts
  - Expected: Other driver sees "Taken by another driver"
  - Expected: Offer disappears from list

#### ✅ Firebase Initialization (CRITICAL)
- [ ] Open driver app
- [ ] Check browser console
  - Expected: NO "Firebase: No Firebase App '[DEFAULT]'" error ✅
  - Expected: "[Firebase] Driver app initialized with project: shiftx-95c4b"
- [ ] Reload page multiple times
  - Expected: No app/no-app errors
- [ ] Open offer modal
  - Expected: No Firebase initialization errors

#### ✅ Active Ride Flow
- [ ] Customer authorizes payment
  - Expected: Driver sees "Start Ride" button
- [ ] Start ride
  - Expected: Status → "in_progress"
- [ ] Complete ride
  - Expected: Status → "completed"
  - Expected: Driver marked not busy
  - Expected: Can go online again

### Admin Dashboard Tests (https://shiftx-95c4b-admin.web.app)

#### ✅ Authentication
- [ ] Sign in as admin
  - Expected: Email must be in config/admins collection

#### ✅ Driver Management
- [ ] View pending driver applications
- [ ] Approve a driver
  - Expected: Driver can now go online
- [ ] Disable a driver
  - Expected: Driver cannot go online

#### ✅ Ride Monitoring
- [ ] View active rides
- [ ] View ride details
  - Expected: Can see rider, driver, status, timeline
- [ ] View ride history

---

## Backend Cleanup Verification

### Scheduled Cleanup (every 2 minutes)
Check Firebase Console → Functions → scheduledCleanup logs:

#### ✅ Offer Expiration
- [ ] Time-based expiration:
  - Offers with `expiresAtMs <= now` → `status: 'expired'`
- [ ] Taken by other driver:
  - Pending offers on accepted rides → `status: 'taken_by_other'`

#### ✅ Ride Cancellation
- [ ] Search timeout:
  - Rides in `offered`/`dispatching` with `searchExpiresAtMs <= now` → `status: 'cancelled'`
- [ ] Payment timeout:
  - Rides in `accepted` without payment auth after 5 min → `status: 'cancelled'`
- [ ] Driver no-start timeout:
  - Rides in `accepted` with payment but no start after 10 min → `status: 'cancelled'`
  - Expected: Stripe PaymentIntent cancelled

#### ✅ Ghost Driver Cleanup
- [ ] Drivers marked online with stale heartbeat (>90s) → `isOnline: false`

---

## Console Error Monitoring

### Customer App Console (SHOULD BE CLEAN)
- [ ] No "Missing or insufficient permissions" errors
- [ ] No "storage/unauthorized" errors
- [ ] No Firebase initialization errors
- [ ] "[RideTimeline]" logs show successful subscriptions

### Driver App Console (SHOULD BE CLEAN)
- [ ] No "Firebase: No Firebase App '[DEFAULT]'" errors ✅
- [ ] No "Missing or insufficient permissions" errors
- [ ] No "storage/unauthorized" errors
- [ ] "[Firebase] Driver app initialized" message present
- [ ] "[App] Filtering out expired offer" when appropriate

### Admin Dashboard Console (SHOULD BE CLEAN)
- [ ] No permission errors
- [ ] Can read rides, drivers, users collections

---

## Common Issues & Solutions

### Issue: Profile photo upload fails (403)
**Root Cause:** Storage rules not deployed  
**Solution:** ✅ FIXED - Rules deployed with `firebase deploy --only storage`

### Issue: Expired offers reappear on reload
**Root Cause:** Client not filtering by `expiresAtMs`  
**Solution:** ✅ FIXED - App.tsx filters `expiresAtMs <= now`

### Issue: Firebase app/no-app crash
**Root Cause:** Firebase services imported before initialization  
**Solution:** ✅ FIXED - Centralized firebase.ts, imported first in main.tsx

### Issue: RideTimeline flickers/disappears
**Root Cause:** Wrong orderBy field, no first-load tracking  
**Solution:** ✅ FIXED - Changed to `orderBy('atMs')`, added `hasLoadedOnceRef`

### Issue: Config/admins writable by anyone
**Root Cause:** Development rules in production  
**Solution:** ✅ FIXED - Locked down to `isAdmin()` write, `signedIn()` read

---

## Deployment Commands Reference

```bash
# Deploy storage rules only
firebase deploy --only storage

# Deploy firestore rules only
firebase deploy --only firestore:rules

# Deploy both storage and firestore rules
firebase deploy --only storage,firestore:rules

# Deploy specific cloud functions
firebase deploy --only functions:scheduledCleanup,functions:acceptRide

# Deploy customer app
cd packages/customer-app && npm run build && cd ../.. && firebase deploy --only hosting:customer

# Deploy driver app
cd packages/driver-app && npm run build && cd ../.. && firebase deploy --only hosting:driver

# Deploy admin dashboard
cd packages/admin-dashboard && npm run build && cd ../.. && firebase deploy --only hosting:admin
```

---

## Production URLs

- **Customer App:** https://shiftx-95c4b-customer.web.app
- **Driver App:** https://shiftx-95c4b-driver.web.app
- **Admin Dashboard:** https://shiftx-95c4b-admin.web.app
- **Firebase Console:** https://console.firebase.google.com/project/shiftx-95c4b/overview

---

## Test Stripe Cards

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Auth fails: 4000 0000 0000 9995
CVV: Any 3 digits
Expiry: Any future date
ZIP: Any 5 digits
```

---

## Verification Status

| Component | Status | Last Verified |
|-----------|--------|---------------|
| Storage rules | ✅ Deployed | 2026-01-14 |
| Firestore rules | ✅ Deployed | 2026-01-14 |
| Customer app | ✅ Deployed | 2026-01-14 |
| Driver app | ✅ Deployed | 2026-01-14 |
| Admin dashboard | ✅ Deployed | 2026-01-14 |
| Functions (acceptRide) | ✅ Deployed | us-central1 |
| Functions (scheduledCleanup) | ✅ Deployed | us-central1 |
| Stale offer prevention | ✅ Implemented | Phase 23 |
| Firebase init fix | ✅ Implemented | Phase 22 |
| RideTimeline fix | ✅ Implemented | Phase 24 |

---

## Next Steps

1. **Manual Testing:** Run through all test scenarios above
2. **Monitor Logs:** Watch Firebase Console for errors during testing
3. **Load Testing:** Test with multiple concurrent users
4. **Edge Cases:** Test network interruptions, browser refresh, deep links
5. **Performance:** Monitor function execution times and costs

---

## Known Limitations

1. **Scheduled cleanup:** Runs every 2 minutes (may take up to 2 min to clean expired offers)
2. **Offer TTL:** 60 seconds (configurable in driver-client package)
3. **Payment auth timeout:** 5 minutes (configurable in cleanup.ts)
4. **Driver start timeout:** 10 minutes after payment (configurable in cleanup.ts)
5. **Heartbeat timeout:** 90 seconds (ghost driver cleanup)

---

## Support Contacts

- **Project ID:** shiftx-95c4b
- **Region:** us-central1
- **Storage Bucket:** shiftx-95c4b.firebasestorage.app
- **Documentation:** /docs folder in repo
