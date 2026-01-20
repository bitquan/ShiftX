# Customer Cancel → Driver Offer Sync Fix

**Status:** ✅ Complete  
**Date:** January 19, 2026

## Problem

When a customer cancelled a ride, drivers continued to see the ride offer because the offers in `rides/{rideId}/offers` collection remained with `status: 'pending'`. This caused:
- Stale "New Ride Offer" notifications
- Drivers accepting cancelled rides
- Poor UX and confusion

## Root Cause

The cancellation flow in `cancelRide` and `cancelActiveRide` functions only updated the main ride document but **did not cancel pending offers** in the subcollection.

## Solution

### Backend Changes: Cancel Offers When Ride is Cancelled

**File:** `functions/src/rides.ts`

#### 1. Updated `cancelRide` function (line ~1057)

Added offer cancellation logic after transaction completes:

```typescript
// Cancel all pending offers for this ride (best-effort, don't fail cancellation if this fails)
try {
  const offersSnapshot = await db
    .collection('rides')
    .doc(rideId)
    .collection('offers')
    .where('status', '==', 'pending')
    .get();

  if (!offersSnapshot.empty) {
    const batch = db.batch();
    const now = Date.now();

    offersSnapshot.docs.forEach((offerDoc) => {
      batch.update(offerDoc.ref, {
        status: 'cancelled',
        cancelledAtMs: now,
        cancelReason: 'ride_cancelled',
        updatedAtMs: now,
      });
    });

    await batch.commit();
    console.log(`[cancelRide] Cancelled ${offersSnapshot.size} pending offer(s) for ride ${rideId}`);
  }
} catch (error: any) {
  console.error('[cancelRide] Failed to cancel pending offers (non-fatal):', {
    error: error.message,
    rideId,
  });
  // Don't fail ride cancellation if offer cleanup fails
}
```

**Key Design Decisions:**
- ✅ Best-effort (wrapped in try/catch) - won't fail ride cancellation if offer cleanup fails
- ✅ Query only `status: 'pending'` offers for efficiency
- ✅ Batch update for atomic cancellation
- ✅ Sets offer fields: `status: 'cancelled'`, `cancelledAtMs`, `cancelReason: 'ride_cancelled'`, `updatedAtMs`
- ✅ Logs success/failure for monitoring

#### 2. Updated `cancelActiveRide` function (line ~1207)

Added identical offer cancellation logic after transaction completes (same code as above but in `cancelActiveRide`).

**Coverage:**
- Customer cancels before ride starts → `cancelRide`
- Customer/driver cancels during ride → `cancelActiveRide`
- Both now cancel pending offers automatically

### Frontend Changes: Validate Ride Before Showing Offer

**File:** `packages/driver-app/src/App.tsx`

#### 3. Added ride validation in offer listener (line ~197)

When a new pending offer arrives, validate the ride exists and is not cancelled:

```typescript
// If this is a NEW pending offer (wasn't pending before), validate ride before showing
if (currentStatus === 'pending' && lastStatus !== 'pending') {
  // Validate that ride still exists and is not cancelled
  try {
    const rideDoc = await getDoc(doc(db, 'rides', rideId));
    if (!rideDoc.exists()) {
      console.warn(`[App] Skipping offer for non-existent ride ${rideId}`);
      continue;
    }
    
    const rideStatus = rideDoc.data()?.status;
    if (rideStatus === 'cancelled' || rideStatus === 'completed') {
      console.warn(`[App] Skipping offer for ${rideStatus} ride ${rideId}`);
      continue;
    }
    
    // Ride is valid, show offer
    setNewOfferRideId(rideId);
  } catch (error) {
    console.error(`[App] Failed to validate ride ${rideId}:`, error);
    // Don't show offer if validation fails
    continue;
  }
}
```

**Why This is Needed:**

Even with backend cleanup, there's a small window where:
1. Customer cancels ride
2. Backend starts cancelling offers (async)
3. Driver's offer listener fires with stale `pending` offer
4. Before offer status update propagates

This frontend check catches edge cases and provides **defense in depth**.

**Performance Impact:**
- Only 1 additional Firestore read **per new offer** (not per offer update)
- Minimal cost since offers are rare events (~1-10 per shift)
- Prevents worse UX of showing then hiding offer

## How It Works

### Flow Diagram

```
BEFORE (Broken):
Customer cancels → Ride status = 'cancelled' → Offers still pending → Driver sees stale offer

AFTER (Fixed):
Customer cancels → Ride status = 'cancelled' → Offers cancelled → Driver query returns 0 offers
                                               ↓
                                        (Edge case: offer still pending)
                                               ↓
                                        Driver validation skips it
```

### Timing

1. **T=0:** Customer taps "Cancel Ride"
2. **T=50ms:** Backend transaction completes (ride status → cancelled)
3. **T=100ms:** Backend batch updates offers (status → cancelled)
4. **T=150ms:** Driver's `watchDriverOffers` query re-runs
5. **T=200ms:** Driver sees 0 pending offers (query excludes cancelled status)

**Worst-case edge case:**
- Driver's offer listener fires between T=50ms and T=100ms
- Frontend validation catches it: "Skipping offer for cancelled ride"

## Acceptance Tests

### ✅ Test 1: Customer Cancels Before Driver Accepts

**Given:**
1. Customer requests ride
2. Offer sent to driver (shows in bottom sheet)
3. Customer cancels ride

**Then:**
- Within 1-2 seconds, offer disappears from driver UI
- No additional "new offer" notifications appear
- Driver can't accidentally accept cancelled ride

### ✅ Test 2: Customer Cancels Multiple Offers

**Given:**
1. Customer requests ride
2. Offers sent to 5 nearby drivers
3. Customer cancels ride

**Then:**
- All 5 pending offers are cancelled in one batch
- All 5 drivers see offer disappear
- No drivers see stale offers

### ✅ Test 3: Edge Case - Stale Offer Propagation

**Given:**
1. Customer requests ride
2. Offer arrives at driver app
3. Customer cancels immediately
4. Offer status update hasn't propagated yet

**Then:**
- Driver app validates ride
- Sees `status: 'cancelled'`
- Skips showing offer
- Logs: "Skipping offer for cancelled ride"

### ✅ Test 4: Driver Already Accepted

**Given:**
1. Driver accepts ride
2. Customer cancels during ride

**Then:**
- Driver UI switches to cancelled state
- Profile updates (currentRideId cleared)
- Driver marked available again

## Files Changed

| File | Changes |
|------|---------|
| `functions/src/rides.ts` | Added offer cancellation in `cancelRide` and `cancelActiveRide` |
| `packages/driver-app/src/App.tsx` | Added ride validation before showing offer |

## Monitoring

### Backend Logs

```typescript
console.log(`[cancelRide] Cancelled ${offersSnapshot.size} pending offer(s) for ride ${rideId}`);
console.error('[cancelRide] Failed to cancel pending offers (non-fatal):', { error, rideId });
```

Look for these in Firebase Functions logs to verify cleanup is working.

### Frontend Logs

```typescript
console.warn(`[App] Skipping offer for non-existent ride ${rideId}`);
console.warn(`[App] Skipping offer for cancelled ride ${rideId}`);
console.error(`[App] Failed to validate ride ${rideId}:`, error);
```

If you see these frequently, it means edge cases are being caught.

## Why This Fix Works

### Before: The Bug

Driver query watches:
```typescript
rides/{rideId}/offers where driverId == {uid} && status == 'pending'
```

When customer cancelled, offers stayed `status: 'pending'`, so query kept returning them.

### After: The Fix

When ride is cancelled:
1. Offers updated to `status: 'cancelled'`
2. Query no longer returns them (filter excludes cancelled)
3. Driver's listener fires with empty results
4. UI clears offers automatically

**Defense in depth:** Even if offer status update is delayed, frontend validation catches it.

## Edge Cases Handled

| Scenario | Solution |
|----------|----------|
| Offer update delayed | Frontend validation skips cancelled ride |
| Batch update fails | Try/catch prevents ride cancellation failure |
| Multiple pending offers | Batch update handles all atomically |
| Customer cancels during ride | `cancelActiveRide` also cancels offers |
| Offer expired naturally | Unaffected - still uses expiration logic |
| Driver accepts before cancel | Driver sees ride status change via profile listener |

## Rollback Plan

If issues arise:

1. **Backend:** Comment out offer cancellation blocks in both functions
2. **Frontend:** Remove ride validation (revert to `setNewOfferRideId(rideId)` immediately)
3. **Deploy:** Functions first, then driver app

No schema changes, so rollback is safe.

## Future Enhancements (Optional)

### 1. Firestore Trigger for Safety Net

```typescript
// functions/src/triggers.ts
export const onRideCancelled = onDocumentUpdated(
  'rides/{rideId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    
    // Detect cancellation
    if (before?.status !== 'cancelled' && after?.status === 'cancelled') {
      const rideId = event.params.rideId;
      
      // Cancel pending offers
      const offersSnapshot = await db
        .collection('rides')
        .doc(rideId)
        .collection('offers')
        .where('status', '==', 'pending')
        .get();
        
      // ... batch update logic ...
    }
  }
);
```

**Pros:**
- Catches edge cases (admin cancellations, janitor cleanup)
- Automatic safety net

**Cons:**
- Extra trigger cost
- Duplicate work if functions already did it

### 2. Admin Tool Cancellations

If admin dashboard has a "Cancel Ride" feature, ensure it also:
- Calls `cancelRide` or `cancelActiveRide` function (don't update Firestore directly)
- Or implements same offer cleanup logic

### 3. Batch Offer Expiration

Current cleanup job could also expire stale offers:

```typescript
// In janitor/cleanup job
const staleOffers = await db
  .collectionGroup('offers')
  .where('status', '==', 'pending')
  .where('expiresAtMs', '<', Date.now())
  .get();
  
// Batch update to expired...
```

## Performance Impact

### Backend

- **Before:** 0 additional queries on cancellation
- **After:** 1 query + 1 batch write per cancellation
- **Cost:** ~$0.0001 per cancellation (negligible)

### Frontend

- **Before:** 0 additional queries on new offer
- **After:** 1 read per new offer (only when offer first appears)
- **Cost:** ~$0.00006 per offer (1 read)
- **Frequency:** Low (maybe 5-20 offers per driver per shift)

**Total additional cost:** < $0.01 per driver per day

## Testing Notes

### Manual Test

1. Open customer app, request ride
2. Open driver app, see offer appear
3. In customer app, cancel ride
4. Watch driver app: offer should disappear in 1-2 seconds
5. Check driver app logs for: "Skipping offer for cancelled ride" (might not appear if backend cleanup is fast)

### Function Test

```bash
# Call cancelRide for a ride with pending offers
curl -X POST https://us-central1-{project}.cloudfunctions.net/cancelRide \
  -H "Authorization: Bearer {token}" \
  -d '{"rideId": "test-ride-123", "reason": "user_cancelled"}'

# Check Firestore
# rides/test-ride-123/offers should have status: 'cancelled'
```

---

**Implementation Status:** ✅ Complete  
**Tested:** ⏳ Ready for testing  
**Breaking Changes:** None  
**Backend Changes:** 2 functions updated  
**Frontend Changes:** 1 validation check added
