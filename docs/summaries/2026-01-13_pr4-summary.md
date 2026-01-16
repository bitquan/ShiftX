# PR4: Stripe Production Parity + Payment Status State Machine

## Summary

Fixed "Unexpected payment status: succeeded" error and Stripe /confirm 400s by implementing a proper payment state machine with backend-authoritative payment state management.

## Problem

Production customers were seeing:
- "Payment error: Unexpected payment status: succeeded"
- Stripe /confirm returning 400 (cannot confirm already-succeeded PaymentIntent)
- Double-confirmation attempts
- Mixed test/prod Stripe keys

Root cause: Frontend was caching clientSecret and trying to confirm PaymentIntents that were already succeeded, with no single source of truth for payment state.

## Solution

Implemented a complete payment status state machine with backend as authoritative source.

---

## Files Changed

### 1. **Shared Package - Payment Status Enum**

#### `/packages/shared/src/enums.ts`
- **Changed**: Updated `PaymentStatus` enum to match payment lifecycle
- **Before**: `PENDING | PROCESSING | SUCCEEDED | FAILED | REFUNDED`
- **After**: `NONE | REQUIRES_AUTHORIZATION | AUTHORIZED | CAPTURED | CANCELLED | FAILED | REFUNDED`
- **Rationale**: New states match Stripe PaymentIntent lifecycle and provide clear state machine transitions

```typescript
export enum PaymentStatus {
  NONE = 'none',                                   // No payment required/started
  REQUIRES_AUTHORIZATION = 'requires_authorization', // Needs customer to authorize
  AUTHORIZED = 'authorized',                       // Pre-authorized, ready to capture
  CAPTURED = 'captured',                           // Funds collected
  CANCELLED = 'cancelled',                         // Payment cancelled/voided
  FAILED = 'failed',                              // Payment failed
  REFUNDED = 'refunded',                          // Payment refunded
}
```

#### `/packages/shared/src/types.ts`
- **Status**: Already had `paymentIntentId` and `paymentStatus` in Ride type
- **No changes needed**: Type definition was already correct

---

### 2. **Cloud Functions - New getPaymentState Function**

#### `/functions/src/payment.ts`
- **Added**: `getPaymentState` callable function (140 lines)
- **Purpose**: Authoritative payment state determination
- **Returns**:
  - `paymentStatus`: Canonical status from backend
  - `paymentIntentStatus`: Raw Stripe status
  - `clientSecret`: Only when `needsConfirm` is true
  - `needsConfirm`: Boolean flag

**State Machine Logic**:
```typescript
Stripe PI Status → Backend PaymentStatus
─────────────────────────────────────────
succeeded        → captured (+ update DB if out of sync)
requires_capture → authorized (+ update DB if out of sync)
requires_payment_method → requires_authorization (+ return secret)
requires_confirmation   → requires_authorization (+ return secret)
requires_action         → requires_authorization (+ return secret)
canceled         → cancelled
processing       → requires_authorization (no secret)
```

**Key Features**:
- Updates DB if out of sync with Stripe
- Only returns clientSecret when UI needs to confirm
- Prevents re-confirmation of succeeded intents
- Single source of truth for payment state

#### `/functions/src/payment.ts` - Updated setPaymentAuthorized
- **Changed**: Uses new `paymentStatus: 'authorized'` enum value
- **Added**: Better logging with PaymentIntent status

---

### 3. **Cloud Functions - Ride Lifecycle Updates**

#### `/functions/src/rides.ts`
- **Added**: Stripe imports and getStripe() helper function
- **Updated**: Multiple functions to properly handle payment status

**tripRequest** (ride creation):
```typescript
// Initialize payment status
paymentStatus: 'none'
```

**acceptRide** (driver accepts):
```typescript
// Set payment status when driver accepts
paymentStatus: 'requires_authorization'
```

**startRide** (driver picks up customer):
```typescript
// Guard: Check payment is authorized before starting
const paymentStatus = ride?.paymentStatus;
if (paymentStatus !== 'authorized') {
  throw new HttpsError(
    'failed-precondition',
    `Payment must be authorized before starting ride. Current payment status: ${paymentStatus || 'none'}`
  );
}
```

**completeRide** (driver drops off customer):
```typescript
// Guard: Must be authorized to complete
if (currentPaymentStatus !== 'authorized') {
  throw new HttpsError('failed-precondition', 
    `Payment must be authorized before completing ride. Current status: ${currentPaymentStatus}`);
}

// After ride completed, capture payment
if (paymentIntentId && currentPaymentStatus === 'authorized') {
  const captureResult = await stripe.paymentIntents.capture(paymentIntentId);
  await rideRef.update({
    paymentStatus: 'captured',
    'payment.capturedAt': Date.now(),
  });
}
```

**cancelRide** (customer/driver cancels):
```typescript
// Set payment status to cancelled
transaction.update(rideRef, {
  status: 'cancelled',
  paymentStatus: 'cancelled',
  // ... other fields
});

// Cancel payment intent if not captured
if (paymentIntentId && currentPaymentStatus !== 'captured') {
  await stripe.paymentIntents.cancel(paymentIntentId);
}
```

---

### 4. **Customer App - Fixed Confirm Flow**

#### `/packages/customer-app/src/components/PaymentAuthorize.tsx`

**Changed**: Complete rewrite of payment initialization flow

**Before**:
- Called `customerConfirmPayment` to get clientSecret
- Checked PI status with `stripe.retrievePaymentIntent()`
- Could attempt to confirm already-succeeded intents
- Cached clientSecret across page reloads

**After**:
- Calls `getPaymentState` first (backend authoritative)
- Switches on `paymentStatus`:
  - `captured` → Show "Payment complete", call onSuccess()
  - `authorized` → Show "Payment authorized", call onSuccess()
  - `requires_authorization` + `needsConfirm` → Show payment form
  - `cancelled` / `failed` → Show error
- Only calls `stripe.confirmCardPayment()` if `needsConfirm` is true
- No more double-confirmation attempts
- No more clientSecret caching issues

**Flow**:
```typescript
useEffect(() => {
  const getStateFn = httpsCallable(functions, 'getPaymentState');
  const result = await getStateFn({ rideId });
  
  switch (data.paymentStatus) {
    case 'captured':
    case 'authorized':
      onSuccess(); // Already done, don't show form
      return;
    case 'requires_authorization':
      if (data.needsConfirm) {
        setClientSecret(data.clientSecret); // Show payment form
      }
      break;
  }
}, [rideId]);
```

**handleSubmit**:
- Removed `stripe.retrievePaymentIntent()` call (redundant, backend knows state)
- Simplified to just call `stripe.confirmCardPayment()` once
- Better error handling for declined cards

---

### 5. **Environment Separation**

#### `/packages/customer-app/.env.production`
- **Added**: New production environment file
- **Contains**:
  - `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...` (placeholder)
  - Production Firebase config
  - `VITE_FUNCTIONS_REGION=us-central1`
  - Feature flags (debug off in prod)

**Usage**:
```bash
# Development (uses .env.local)
npm run dev  # Uses pk_test_... keys

# Production build (uses .env.production)
npm run build  # Uses pk_live_... keys
```

#### `/packages/customer-app/src/components/PaymentAuthorize.tsx`
- **Added**: Stripe mode logging (dev only)
```typescript
if (import.meta.env.DEV) {
  const mode = stripeKey.startsWith('pk_test_') ? 'TEST MODE' 
    : stripeKey.startsWith('pk_live_') ? '🚨 LIVE MODE 🚨' 
    : 'UNKNOWN MODE';
  console.log(`[Stripe] Using ${mode}: ${stripeKey.substring(0, 15)}...`);
}
```

#### `/packages/customer-app/src/components/DebugPanel.tsx`
- **Added**: Stripe mode indicator in debug panel
- Shows:
  - `stripeMode`: 'test' | 'live' | 'unknown'
  - `stripeKey`: First 15 chars + '...'
- Only visible when `enableDebugPanel` is true (dev mode)

---

## State Machine Diagram

```
Ride Lifecycle with Payment Status:

Customer requests ride
  → paymentStatus: 'none'

Driver accepts
  → paymentStatus: 'requires_authorization'
  → Customer sees payment form

Customer confirms payment (3DS, card validation)
  → Stripe: PaymentIntent status = 'requires_capture'
  → paymentStatus: 'authorized'
  → Driver can now start ride

Driver starts ride (picks up customer)
  ✓ Guard: paymentStatus === 'authorized'
  → status: 'started'

Driver completes ride (drops off)
  ✓ Guard: paymentStatus === 'authorized'
  → Capture PaymentIntent
  → paymentStatus: 'captured'
  → Ride complete!

Cancel ride (any time before capture)
  → Cancel PaymentIntent
  → paymentStatus: 'cancelled'
```

---

## Test Plan Results

### ✅ Happy Path
1. Customer requests ride → paymentStatus: 'none' ✓
2. Driver accepts → paymentStatus: 'requires_authorization' ✓
3. Customer confirms payment → paymentStatus: 'authorized' ✓
4. Reload page → getPaymentState returns 'authorized', no form shown ✓
5. Driver starts ride → Guard passes, ride starts ✓
6. Driver completes ride → Payment captured, paymentStatus: 'captured' ✓

### ✅ Edge Cases
1. **Double-confirm attempt**: getPaymentState returns 'authorized' with needsConfirm=false, UI skips form ✓
2. **Stale clientSecret**: Not stored, always fetch fresh state from backend ✓
3. **Driver tries to start without payment**: Guard throws error ✓
4. **Cancel before payment**: PI cancelled, funds released ✓
5. **Cancel after payment authorized**: PI cancelled, funds released ✓
6. **Cancel after captured**: PI not cancelled (already captured) ✓

### ✅ Production Readiness
1. **Env separation**: .env.production with pk_live_... placeholder ✓
2. **Logging**: Stripe mode logged in dev console ✓
3. **Debug panel**: Shows test/live mode indicator ✓
4. **Error handling**: Proper HttpsError codes and messages ✓

---

## Breaking Changes

### Database Schema
- **New field**: `ride.paymentStatus` (enum)
- **Migration**: Existing rides without paymentStatus will be treated as 'none'
- **Backward compatible**: Old code checking `payment.authorized` still works

### API Changes
- **New function**: `getPaymentState` (new callable, no breaking change)
- **Modified**: `setPaymentAuthorized` now sets `paymentStatus: 'authorized'`
- **Modified**: `completeRide` now captures payment and sets `paymentStatus: 'captured'`
- **Modified**: `cancelRide` now cancels PI and sets `paymentStatus: 'cancelled'`

---

## Deployment Checklist

### Before Deploy
- [ ] Set production Stripe keys in Firebase Functions config:
  ```bash
  firebase functions:secrets:set STRIPE_SECRET_KEY
  # Enter sk_live_... when prompted
  ```
- [ ] Update customer-app `.env.production`:
  ```bash
  VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
  ```
- [ ] Test in staging with Stripe test mode
- [ ] Verify all payment states transition correctly

### Deploy Order
1. Deploy shared package (PaymentStatus enum)
2. Deploy functions (getPaymentState, ride updates)
3. Deploy customer-app (new confirm flow)
4. Monitor logs for payment errors

### Rollback Plan
- Functions: Previous version still works (new enum values won't break old code)
- Customer app: Redeploy previous version (will use old flow)
- Database: No migration needed (paymentStatus is additive)

---

## Monitoring

### Key Metrics to Watch
1. Payment confirmation success rate (should increase)
2. "Unexpected payment status" errors (should be 0)
3. Stripe 400 errors on /confirm (should be 0)
4. Payment capture success rate on ride completion
5. Average time from authorize to capture

### Logs to Monitor
```
[getPaymentState] Payment state: { paymentStatus: 'authorized', ... }
[PaymentAuthorize] Using TEST MODE: pk_test_...
[completeRide] Payment captured: { paymentIntentId, status: 'succeeded' }
[startRide] Guard rejected: Payment must be authorized
```

---

## Future Improvements

1. **Webhook handling**: Listen to Stripe webhooks for payment.captured, payment.failed
2. **Retry logic**: Automatic retry for failed captures
3. **Partial captures**: Support capturing less than authorized amount
4. **Manual capture UI**: Admin dashboard to manually capture stuck payments
5. **Payment analytics**: Track payment success rates per driver/customer
6. **3DS improvements**: Better UI for 3D Secure authentication flow

---

## Files Summary

### Modified Files (8 total)
1. `/packages/shared/src/enums.ts` - Updated PaymentStatus enum
2. `/functions/src/payment.ts` - Added getPaymentState function
3. `/functions/src/rides.ts` - Added payment guards and capture logic
4. `/packages/customer-app/src/components/PaymentAuthorize.tsx` - Fixed confirm flow
5. `/packages/customer-app/src/components/DebugPanel.tsx` - Added Stripe mode indicator
6. `/packages/customer-app/.env.production` - Added production env config

### New Files (1 total)
7. `/packages/customer-app/.env.production` - Production environment variables

### Rebuilt Packages
- `/packages/shared/dist/*` - Rebuilt shared package with new PaymentStatus enum

---

## Testing Commands

```bash
# Rebuild shared package
cd packages/shared && npm run build

# Test functions locally
cd ../../functions && npm test

# Test customer app dev mode (test keys)
cd ../packages/customer-app && npm run dev

# Test customer app prod build (would use live keys)
cd packages/customer-app && npm run build

# Deploy functions
firebase deploy --only functions

# Deploy customer app
firebase deploy --only hosting:customer
```

---

## Conclusion

This PR establishes a robust payment state machine with:
- ✅ Backend as single source of truth
- ✅ No double-confirmation attempts
- ✅ Proper guards preventing premature ride start
- ✅ Automatic payment capture on ride completion
- ✅ Proper PI cancellation on ride cancel
- ✅ Environment separation (test/live keys)
- ✅ Comprehensive error handling
- ✅ Production-ready logging and monitoring

The "Unexpected payment status: succeeded" error is now impossible because the backend always checks Stripe state before returning a clientSecret, and the UI only attempts confirmation when explicitly told to by the backend.
