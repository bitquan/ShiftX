# Payment Status State Machine - Quick Reference

## Payment Status Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                         RIDE LIFECYCLE                              │
└─────────────────────────────────────────────────────────────────────┘

  Customer Requests Ride
         │
         ▼
    paymentStatus: 'none'
    rideStatus: 'requested'
         │
         │ (Driver accepts)
         ▼
    paymentStatus: 'requires_authorization'
    rideStatus: 'accepted'
         │
         │ (Customer authorizes payment via UI)
         │ (Stripe creates PI with capture_method: manual)
         │ (Customer confirms with card)
         ▼
    paymentStatus: 'authorized'
    rideStatus: 'accepted'
    Stripe PI: 'requires_capture'
         │
         │ (Driver can now start ride)
         │ GUARD: paymentStatus === 'authorized'
         ▼
    rideStatus: 'started'
         │
         ▼
    rideStatus: 'in_progress'
         │
         │ (Driver completes ride)
         │ GUARD: paymentStatus === 'authorized'
         ▼
    Capture Stripe PaymentIntent
         │
         ▼
    paymentStatus: 'captured'
    rideStatus: 'completed'
    Stripe PI: 'succeeded'
         │
         ▼
    🎉 DONE!


  CANCEL PATH (any time before capture):
         │
         ▼
    Cancel Stripe PaymentIntent
         │
         ▼
    paymentStatus: 'cancelled'
    rideStatus: 'cancelled'
    Stripe PI: 'canceled'
```

---

## State Definitions

| Status | Meaning | Stripe PI Status | Customer Can | Driver Can |
|--------|---------|-----------------|--------------|------------|
| `none` | No payment started | N/A | Request ride | - |
| `requires_authorization` | Needs customer to authorize | N/A or `requires_payment_method` | Enter card info | Wait |
| `authorized` | Pre-authorized (hold) | `requires_capture` | Wait for pickup | Start & complete ride |
| `captured` | Funds collected | `succeeded` | View receipt | View earnings |
| `cancelled` | Payment voided | `canceled` | Request new ride | Accept new rides |
| `failed` | Payment failed | `failed` | Try again | - |
| `refunded` | Funds returned | N/A | - | - |

---

## State Transitions

### Valid Transitions

```
none → requires_authorization  (driver accepts)
requires_authorization → authorized  (customer confirms payment)
requires_authorization → cancelled  (ride cancelled before payment)
authorized → captured  (ride completed)
authorized → cancelled  (ride cancelled after payment)
captured → refunded  (admin refunds)
* → failed  (payment/capture fails)
```

### Invalid Transitions (Blocked by Guards)

```
❌ none → started  (BLOCKED: must authorize payment first)
❌ requires_authorization → started  (BLOCKED: must authorize payment first)
❌ captured → captured  (BLOCKED: already captured)
❌ cancelled → authorized  (BLOCKED: cancelled rides cannot be reauthorized)
```

---

## Function Reference

### Customer-Facing Functions

#### `getPaymentState(rideId)`
**Purpose**: Get authoritative payment state  
**Returns**:
```typescript
{
  paymentStatus: 'none' | 'requires_authorization' | 'authorized' | 'captured' | 'cancelled',
  paymentIntentStatus: string | null,
  clientSecret: string | null,  // Only when needsConfirm is true
  needsConfirm: boolean
}
```

**When to call**:
- On page load (check if payment already done)
- Before showing payment form
- After page refresh

**Logic**:
```typescript
if (paymentStatus === 'captured' || paymentStatus === 'authorized') {
  // Don't show payment form, ride is ready
  onSuccess();
} else if (paymentStatus === 'requires_authorization' && needsConfirm) {
  // Show payment form
  stripe.confirmCardPayment(clientSecret, { payment_method: card });
}
```

---

#### `customerConfirmPayment(rideId)`
**Purpose**: Create or retrieve PaymentIntent  
**Returns**:
```typescript
{
  clientSecret: string,
  amount: number,
  status: string,
  savedPaymentMethod?: { id, last4, brand, expMonth, expYear }
}
```

**When to call**:
- Legacy fallback if `getPaymentState` returns `none`
- Creates new PI with `capture_method: manual`

**DO NOT CALL** if `getPaymentState` returns `authorized` or `captured`!

---

#### `setPaymentAuthorized(rideId)`
**Purpose**: Mark payment as authorized after Stripe confirm  
**Updates**:
```typescript
{
  paymentStatus: 'authorized',
  paymentAuthorized: true,
  paymentAuthorizedAtMs: now
}
```

**When to call**:
- After `stripe.confirmCardPayment()` succeeds
- Only call once per ride!

---

### Driver-Facing Functions

#### `acceptRide(rideId)`
**Updates**:
```typescript
{
  status: 'accepted',
  paymentStatus: 'requires_authorization',
  driverId: uid
}
```

**Triggers**: Customer sees payment form

---

#### `startRide(rideId)`
**Guard**: `paymentStatus === 'authorized'`  
**Updates**:
```typescript
{
  status: 'started'
}
```

**Error if**: paymentStatus !== 'authorized'

---

#### `completeRide(rideId)`
**Guard**: `paymentStatus === 'authorized'`  
**Updates**:
```typescript
{
  status: 'completed',
  paymentStatus: 'captured'
}
```

**Side effect**: Calls `stripe.paymentIntents.capture()`  
**Error if**: paymentStatus !== 'authorized'

---

#### `cancelRide(rideId, reason)`
**Updates**:
```typescript
{
  status: 'cancelled',
  paymentStatus: 'cancelled'
}
```

**Side effect**: Calls `stripe.paymentIntents.cancel()` if not captured

---

## Stripe PaymentIntent Mapping

| Stripe PI Status | Backend paymentStatus | Action Required |
|-----------------|----------------------|-----------------|
| `requires_payment_method` | `requires_authorization` | Customer enters card |
| `requires_confirmation` | `requires_authorization` | Customer confirms |
| `requires_action` | `requires_authorization` | 3DS authentication |
| `processing` | `requires_authorization` | Wait for Stripe |
| `requires_capture` | `authorized` | Driver completes ride |
| `succeeded` | `captured` | Done |
| `canceled` | `cancelled` | Ride cancelled |

---

## UI Decision Tree

### Customer App (PaymentAuthorize component)

```typescript
const { paymentStatus, needsConfirm, clientSecret } = await getPaymentState(rideId);

if (paymentStatus === 'captured') {
  return <SuccessMessage>Payment complete!</SuccessMessage>;
}

if (paymentStatus === 'authorized') {
  return <SuccessMessage>Payment authorized! Driver can start.</SuccessMessage>;
}

if (paymentStatus === 'requires_authorization' && needsConfirm) {
  return (
    <PaymentForm>
      <CardElement />
      <ConfirmButton onClick={() => {
        const result = await stripe.confirmCardPayment(clientSecret, { payment_method: card });
        if (result.paymentIntent.status === 'requires_capture') {
          await setPaymentAuthorized(rideId);
          onSuccess();
        }
      }} />
    </PaymentForm>
  );
}

if (paymentStatus === 'cancelled' || paymentStatus === 'failed') {
  return <ErrorMessage>Payment {paymentStatus}. Please try again.</ErrorMessage>;
}

return <LoadingSpinner />;
```

---

### Driver App (Start Ride button)

```typescript
const handleStartRide = async () => {
  try {
    await startRide(rideId);
    // Success!
  } catch (error) {
    if (error.code === 'failed-precondition') {
      // Show: "Waiting for customer to authorize payment..."
      // Keep polling ride status
    }
  }
};
```

---

## Error Handling

### Common Errors

#### "Payment must be authorized before starting ride"
- **Cause**: Driver tried to start ride before customer authorized payment
- **Fix**: Wait for `paymentStatus === 'authorized'`
- **UI**: Show "Waiting for customer to authorize payment..."

#### "Unexpected payment status: succeeded"
- **Cause**: UI tried to confirm already-succeeded PaymentIntent
- **Fix**: Use `getPaymentState()` first, only confirm if `needsConfirm === true`
- **Status**: FIXED in PR4 ✅

#### "Cannot confirm PaymentIntent (400)"
- **Cause**: Stale clientSecret or already-confirmed PI
- **Fix**: Always fetch fresh state with `getPaymentState()`
- **Status**: FIXED in PR4 ✅

---

## Testing Checklist

### Happy Path
- [ ] Customer requests ride
- [ ] Driver accepts → payment form appears
- [ ] Customer confirms payment → "Payment authorized" shows
- [ ] Reload page → still shows "Payment authorized" (no form)
- [ ] Driver starts ride → succeeds
- [ ] Driver completes ride → payment captured

### Edge Cases
- [ ] Cancel before payment → PI cancelled
- [ ] Cancel after payment authorized → PI cancelled
- [ ] Try to start without payment → blocked with clear error
- [ ] Refresh during payment → state preserved
- [ ] Double-click confirm button → only one confirm attempt

### Error Handling
- [ ] Declined card → clear error message
- [ ] 3DS required → 3DS flow works
- [ ] Network error → retry logic works
- [ ] Payment timeout → proper error message

---

## Debugging

### Check Payment State
```bash
# In browser console (customer app)
const getPaymentState = httpsCallable(functions, 'getPaymentState');
const result = await getPaymentState({ rideId: 'YOUR_RIDE_ID' });
console.log(result.data);
```

### Check Ride Document
```bash
# Firebase console
rides/{rideId}

# Look for:
paymentStatus: 'authorized'
paymentIntentId: 'pi_xxx'
stripePaymentIntentId: 'pi_xxx'
```

### Check Stripe Dashboard
1. Go to Payments → PaymentIntents
2. Find PaymentIntent by ID
3. Check status: should be `requires_capture` when ride is accepted
4. Check capture_method: should be `manual`

---

## Production Checklist

- [ ] Set `STRIPE_SECRET_KEY` in Firebase Functions secrets
- [ ] Update `.env.production` with `pk_live_...` key
- [ ] Verify Stripe mode indicator shows "LIVE MODE" in console
- [ ] Test with Stripe test cards before going live
- [ ] Monitor logs for payment errors
- [ ] Set up Stripe webhooks for payment.captured, payment.failed

---

## Quick Commands

```bash
# Rebuild shared package
cd packages/shared && npm run build

# Deploy functions
firebase deploy --only functions

# Check function logs
firebase functions:log --only getPaymentState,completeRide

# Test customer app
cd packages/customer-app && npm run dev
```

---

## Contact

For questions or issues with payment flow, check:
1. `/PR4_SUMMARY.md` - Complete implementation details
2. `/PR4_IMPLEMENTATION_CHECKLIST.md` - Deployment checklist
3. This document - Quick reference
