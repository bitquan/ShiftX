# Stripe Payment Integration - Setup Guide

## ✅ Implementation Complete

The Stripe "Authorize on Accept, Capture on Complete" payment flow has been fully implemented.

---

## Payment Flow

1. **Customer requests ride** → No payment created yet
2. **Driver accepts** → PaymentIntent created with `capture_method: manual`
3. **Customer authorizes payment** → Card is authorized (hold placed)
4. **Driver completes ride** → Payment is captured
5. **If cancelled before completion** → Authorization is cancelled (hold released)

---

## Setup Instructions

### 1. Get Stripe Keys

1. Sign up at https://stripe.com (use test mode)
2. Get your test keys from https://dashboard.stripe.com/test/apikeys
   - **Secret Key** (sk_test_...)
   - **Publishable Key** (pk_test_...)

### 2. Configure Firebase Functions

Set the Stripe secret key as an environment variable:

```bash
# Option A: Using Firebase config (recommended for deployed functions)
firebase functions:config:set stripe.secret_key="sk_test_YOUR_SECRET_KEY"

# Option B: Using .env file (for local emulator)
cd functions
echo "STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY" > .env
```

### 3. Configure Customer App

Create `.env.local` in `packages/customer-app/`:

```bash
cd packages/customer-app
cp .env.local.example .env.local
# Edit .env.local and add your publishable key:
# VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
```

### 4. Rebuild and Restart

```bash
# Rebuild functions
cd functions
npm run build

# Restart Firebase emulators (if running)
# Stop current emulators (Ctrl+C)
# Then start again:
firebase emulators:start --only auth,functions,firestore

# Customer app will hot-reload automatically if dev server is running
```

---

## Testing the Payment Flow

### Test Card Numbers

Use these test cards (from Stripe):
- **Success**: 4242 4242 4242 4242
- **Requires authentication**: 4000 0025 0000 3155
- **Declined**: 4000 0000 0000 0002

Use any future date and any 3-digit CVC.

### Test Scenario

1. **Request a ride** as customer
2. **Accept the ride** as driver
   - Check Functions logs: `PaymentIntent created for ride...`
   - Check Firestore: ride doc should have `paymentIntentId` and `paymentStatus: 'requires_payment_method'`

3. **Authorize payment** in customer app
   - Enter test card: 4242 4242 4242 4242
   - Click "Authorize Payment"
   - Should see "✅ Payment Authorized"
   - Check Firestore: `paymentStatus: 'authorized'`
   - Check Stripe Dashboard: Payment should show as "Uncaptured"

4. **Complete the ride** as driver
   - Check Functions logs: `Payment captured for ride...`
   - Check Firestore: `paymentStatus: 'captured'`
   - Check Stripe Dashboard: Payment should show as "Succeeded"

5. **Test cancellation** (separate ride)
   - Accept ride → Authorize payment
   - Cancel before completing
   - Check Stripe Dashboard: Payment should be "Canceled"

---

## Firestore Schema Changes

The `rides` collection now includes these payment fields:

```typescript
{
  paymentStatus?: 'none' | 'requires_payment_method' | 'requires_action' | 'authorized' | 'captured' | 'cancelled' | 'failed';
  paymentIntentId?: string;
  paymentAuthorizedAtMs?: number;
  paymentCapturedAtMs?: number;
  paymentCancelledAtMs?: number;
  paymentLastError?: string;
}
```

---

## New Cloud Functions

### `customerConfirmPayment`
- **Purpose**: Get clientSecret for Stripe.js to authorize payment
- **Input**: `{ rideId: string }`
- **Output**: `{ clientSecret: string, status: string, amount: number }`
- **Auth**: Requires authenticated customer (must be ride owner)

### `setPaymentAuthorized`
- **Purpose**: Mark payment as authorized after Stripe confirms
- **Input**: `{ rideId: string }`
- **Output**: `{ ok: boolean, status: string }`
- **Auth**: Requires authenticated customer (must be ride owner)

---

## UI Changes

### Customer App

**RideStatus.tsx**:
- Shows "⚠️ Payment Authorization Required" when ride is accepted
- Displays PaymentAuthorize component with Stripe card form
- Shows payment status badge:
  - ✅ Authorized - waiting for driver
  - ⏳ Waiting for authorization
  - ❌ Failed

**PaymentAuthorize.tsx** (new):
- Stripe Elements card input
- Handles authorization flow
- Test card helper text
- Error handling and retry

---

## Monitoring & Debugging

### Check Payment Status

**Firestore Console**:
```
rides/{rideId}
  - paymentStatus: "authorized" | "captured" | etc.
  - paymentIntentId: "pi_..."
```

**Stripe Dashboard**:
https://dashboard.stripe.com/test/payments
- Search by payment intent ID
- View authorization/capture events

### Common Issues

**"No Stripe key found"**:
- Check environment variables are set
- Restart Firebase emulators after setting config

**"Payment authorization failed"**:
- Check browser console for Stripe errors
- Verify publishable key is correct (starts with pk_test_)
- Check card details are valid

**"Payment not captured"**:
- Check Functions logs for capture errors
- Verify ride status is "completed"
- Check Stripe Dashboard for payment status

---

## Security Notes

- ✅ Customer never sees secret key (server-side only)
- ✅ Card details never touch your servers (Stripe.js handles)
- ✅ Client secret is single-use and ride-specific
- ✅ Authorization requires customer authentication
- ✅ Capture requires driver authentication + ride completion

---

## Next Steps (Optional Enhancements)

1. **Webhook handling**: Listen to Stripe webhooks for async events
2. **Refunds**: Add refund capability for completed rides
3. **Partial capture**: Support tipping by capturing more than authorized
4. **Payment methods**: Save cards for faster future payments
5. **Receipts**: Email receipts after successful capture
6. **Disputes**: Handle chargebacks and disputes

---

## Files Modified

**Backend (functions/src/)**:
- `index.ts` - Added payment logic to accept/complete/cancel handlers
- `eventLog.ts` - Added payment event types

**Frontend (packages/customer-app/src/)**:
- `components/PaymentAuthorize.tsx` - New Stripe payment form
- `components/RideStatus.tsx` - Payment UI integration
- `.env.local.example` - Environment variable template

**Dependencies**:
- `functions/package.json` - Added `stripe`
- `customer-app/package.json` - Added `@stripe/stripe-js`, `@stripe/react-stripe-js`

---

## Support

For Stripe API documentation: https://stripe.com/docs/api
For test card numbers: https://stripe.com/docs/testing
