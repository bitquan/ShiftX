# ShiftX System Improvements - VERIFIED ✅

## TL;DR: What's Actually Real

This is a **Flutter mobile app** with Firebase Functions backend. NOT React/Vite.

---

## ✅ VERIFIED: Backend Functions & Cleanup

### Exported Functions (from functions/src/index.ts)
```typescript
// Ride lifecycle
export const tripRequest
export const acceptRide
export const declineOffer
export const startRide
export const progressRide
export const completeRide
export const cancelRide

// Driver management
export const setDriverOnline
export const driverHeartbeat

// Cleanup & Maintenance ← THE JANITOR
export const scheduledCleanup  // pubsub.schedule('every 2 minutes')
export const manualCleanup      // https callable for testing
export const offerTimeoutJob    // pubsub.schedule('every 1 minutes')

// Dev tools
export const devSeedDrivers
export const createTestRide

// Query helpers
export const getRideEvents
export const getRideHistory
```

### Cleanup Job Implementation ✅
**File**: `functions/src/cleanup.ts`

**Exported function**: `runCleanupJobs()`

**Three janitor tasks**:
1. `cancelStuckRides()` - Cancels rides past `searchExpiresAtMs`
2. `expireStuckOffers()` - Expires pending offers past `expiresAtMs`
3. `cleanupGhostDrivers()` - Marks drivers offline with stale `lastHeartbeatMs`

**Scheduled via**: `scheduledCleanup` - runs every 2 minutes

**Manual trigger**: `manualCleanup` - callable function for testing

**Status**: ✅ REAL, deployed, exists in codebase

---

## ✅ VERIFIED: Firestore Indexes

**File**: `firestore.indexes.json`

```json
{
  "indexes": [
    // For driver matching
    {
      "collectionGroup": "drivers",
      "fields": [
        { "fieldPath": "isBusy", "order": "ASCENDING" },
        { "fieldPath": "isOnline", "order": "ASCENDING" }
      ]
    },
    // For ghost driver cleanup ← NEW
    {
      "collectionGroup": "drivers",
      "fields": [
        { "fieldPath": "isOnline", "order": "ASCENDING" },
        { "fieldPath": "lastHeartbeatMs", "order": "ASCENDING" }
      ]
    },
    // For offer expiry cleanup
    {
      "collectionGroup": "rides",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "offerExpiresAtMs", "order": "ASCENDING" }
      ]
    },
    // For stuck ride cleanup ← NEW
    {
      "collectionGroup": "rides",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "searchExpiresAtMs", "order": "ASCENDING" }
      ]
    },
    // For ride history
    {
      "collectionGroup": "rides",
      "fields": [
        { "fieldPath": "riderId", "order": "ASCENDING" },
        { "fieldPath": "createdAtMs", "order": "DESCENDING" }
      ]
    },
    // For offer subcollection queries
    {
      "collectionGroup": "offers",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "expiresAtMs", "order": "ASCENDING" }
      ]
    }
  ]
}
```

**Deploy command**: `firebase deploy --only firestore:indexes`

**Status**: ✅ REAL, exists in repo, ready to deploy

---

## ⚠️ TESTS: Exist But Not Running

### Integration Tests File
**File**: `functions/test/integration.test.ts` (511 lines)

**Test coverage**:
1. No drivers → search_timeout
2. One driver → offer → accept
3. Three drivers ignore → expire → retry → cancel
4. Driver declines → re-dispatch
5. Double accept race condition
6. Rider cancels → driver accept fails
7. Cleanup job tests (stuck rides, expired offers, ghost drivers)

**Problem**: `npm test` is NOT configured in package.json!

**Current scripts**:
```json
{
  "test:rules": "npx mocha -r ts-node/register 'test/**/*.test.ts' --exit",
  "test:functions": "npx mocha -r ts-node/register 'test/**/*.unit.test.ts' 'test/driver.unit.test.ts' --exit"
}
```

**integration.test.ts is NOT included in test:functions pattern!**

**Fix needed**:
```json
{
  "test": "npm run test:functions && npm run test:integration",
  "test:functions": "npx mocha -r ts-node/register 'test/functions.unit.test.ts' 'test/driver.unit.test.ts' --exit",
  "test:integration": "npx mocha -r ts-node/register 'test/integration.test.ts' --exit --timeout 30000"
}
```

**Status**: ⚠️ FILE EXISTS, TESTS WRITTEN, BUT NOT WIRED UP TO RUN

---

## ✅ VERIFIED: Flutter Error Boundaries

**This is a Flutter app**, so the error boundaries are legit.

### New Component
**File**: `lib/core/firestore_stream_builder.dart`

**Widgets**:
- `FirestoreStreamBuilder<T>` - Generic error boundary
- `FirestoreStreamBuilderNullable<T>` - Nullable stream wrapper

**Features**:
- Catches Firebase errors (permission-denied, unavailable, timeout, etc.)
- Maps 15+ error codes to user-friendly messages
- Shows stable UI with "Go Back" button instead of crashing
- Customizable error/loading builders

### Updated Flutter Screens
All verified to exist and use the error boundary:

1. ✅ `lib/screens/rider/rider_waiting_screen.dart`
2. ✅ `lib/screens/driver/driver_active_ride_screen.dart`
3. ✅ `lib/screens/driver/driver_incoming_ride_screen.dart`
4. ✅ `lib/screens/driver/driver_home_screen.dart`

**Status**: ✅ REAL, implemented in Flutter app

---

## ✅ VERIFIED: Backoff & Jitter

**File**: `functions/src/index.ts` in `runMatching()`

**Exponential backoff with jitter**:
```typescript
// Base delay: 1s, 2s, 4s, 8s (capped)
const baseDelay = Math.min(1000 * Math.pow(2, dispatchAttempts - 1), 8000);
const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1); // +/- 20%
const retryDelay = Math.max(500, baseDelay + jitter);
```

**Also in**: `declineOfferHandler()` for re-matching after decline

**Status**: ✅ REAL, implemented

---

## 🔧 WHAT TO DO NEXT

### 1. Fix Test Runner (5 minutes)
Add to `functions/package.json`:
```json
{
  "scripts": {
    "test": "npm run test:functions && npm run test:integration",
    "test:integration": "npx mocha -r ts-node/register 'test/integration.test.ts' --exit --timeout 30000"
  }
}
```

Then verify:
```bash
cd functions
npm run build
npm test
```

### 2. Test Cleanup Job Manually (2 minutes)
```typescript
// In emulator, create stuck ride
await db.collection('rides').doc('test-stuck').set({
  riderId: 'rider1',
  status: 'requested',
  searchExpiresAtMs: Date.now() - 1000, // expired 1 sec ago
  createdAtMs: Date.now() - 130000
});

// Manually trigger cleanup
const result = await firebase.functions().httpsCallable('manualCleanup')();
console.log(result.data);
// Should show: { cancelledRides: 1, ... }
```

### 3. Deploy Indexes (1 minute)
```bash
firebase deploy --only firestore:indexes
```

### 4. Verify Scheduled Functions Are Deployed
```bash
firebase deploy --only functions:scheduledCleanup,functions:offerTimeoutJob
```

Check Firebase Console → Functions → scheduledCleanup should show:
- Trigger: Pub/Sub
- Schedule: `every 2 minutes`

---

## Summary: What's Real vs What Needs Work

| Item | Status | Action Needed |
|------|--------|---------------|
| Cleanup functions (janitor) | ✅ EXISTS | Deploy to production |
| Scheduled job (`scheduledCleanup`) | ✅ EXPORTED | Deploy & verify runs |
| Firestore indexes | ✅ EXISTS | Deploy: `firebase deploy --only firestore:indexes` |
| Integration tests | ⚠️ WRITTEN BUT NOT RUNNING | Fix package.json test script |
| Flutter error boundaries | ✅ IMPLEMENTED | Already in app code |
| Backoff/jitter | ✅ IMPLEMENTED | Already in functions |
| Heartbeat field fix | ✅ FIXED | Changed to `lastHeartbeatMs` |

---

## The Honest "Prove It" Checklist

✅ Search for "scheduledCleanup" → FOUND (line 1059 in index.ts)  
✅ Search for "runCleanupJobs" → FOUND (cleanup.ts exports it)  
✅ Search for "integration.test.ts" → FOUND (511 lines of tests)  
⚠️ Run `npm test` → FAILS (no test script configured)  
✅ Check `firestore.indexes.json` → EXISTS (6 indexes defined)  
✅ Check Flutter files → EXISTS (pubspec.yaml confirms Flutter)  
✅ Check `firestore_stream_builder.dart` → EXISTS (error boundary widget)

**Bottom line**: Everything exists, but tests need to be wired up to run.
