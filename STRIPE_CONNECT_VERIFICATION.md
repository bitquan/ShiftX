# Stripe Connect Verification Guide

## Quick Verification: Is Connect Routing Working?

### When Flag is OFF (Default)

**Expected Behavior:**
- Normal PaymentIntent created (no Connect fields)
- No `application_fee_amount` or `transfer_data`
- Ride document has NO `stripeConnectAccountId` field

**Check Logs:**
```
[customerConfirmPayment] Created PaymentIntent: {
  id: "pi_...",
  amount: 1150,
  status: "requires_payment_method",
  connect: false  ← Should be false
}
```

**Check Ride Document:**
```typescript
{
  stripePaymentIntentId: "pi_...",
  fareCents: 1000,
  totalChargeCents: 1150,
  platformFeeCents: 300,
  driverPayoutCents: 850,
  // NO stripeConnectAccountId field
  // NO transferDestination field
}
```

---

### When Flag is ON (Connect Enabled)

**Expected Behavior:**
- PaymentIntent with destination charges
- Has `application_fee_amount: 300`
- Has `transfer_data.destination: "acct_..."`
- Ride document includes `stripeConnectAccountId`

**Check Logs:**
```
[customerConfirmPayment] Using Stripe Connect for driver: {
  driverId: "...",
  accountId: "acct_..."
}

[customerConfirmPayment] Connect enabled - fee structure: {
  totalCharge: 1150,
  platformFee: 300,
  driverPayout: 850,
  destination: "acct_..."
}

[customerConfirmPayment] Created PaymentIntent: {
  id: "pi_...",
  amount: 1150,
  status: "requires_payment_method",
  connect: true  ← Should be true
}

[customerConfirmPayment] ✅ CONNECT ROUTING: {
  connectDestination: "acct_...",
  application_fee_amount: 300
}
```

**Check Ride Document:**
```typescript
{
  stripePaymentIntentId: "pi_...",
  fareCents: 1000,
  totalChargeCents: 1150,
  platformFeeCents: 300,
  driverPayoutCents: 850,
  stripeConnectAccountId: "acct_...",  ← Present
  transferDestination: "acct_..."       ← Present
}
```

**Check Stripe Dashboard:**

1. Go to: https://dashboard.stripe.com/test/payments
2. Find the PaymentIntent (pi_...)
3. Verify:
   - ✅ Amount: $11.50
   - ✅ Application fee: $3.00
   - ✅ Transfer destination: acct_...
   - ✅ Status: requires_payment_method → requires_capture → succeeded

---

## Step-by-Step Testing

### Setup (One-Time)

**1. Enable Flag in Emulator:**
```bash
# Open Firebase Emulator UI: http://localhost:4000
# Navigate to: Firestore → config → runtimeFlags
# Set: enableStripeConnect = true
```

**2. Create Test Connect Account:**
```bash
# Method 1: Via Stripe Dashboard (easiest)
1. Go to: https://dashboard.stripe.com/test/connect/accounts
2. Click "Add Account"
3. Select "Express" account type
4. Complete onboarding form
5. Copy account ID: acct_...

# Method 2: Via Stripe API
curl https://api.stripe.com/v1/accounts \
  -u sk_test_...: \
  -d type=express \
  -d country=US \
  -d email=testdriver@example.com \
  -d capabilities[card_payments][requested]=true \
  -d capabilities[transfers][requested]=true
```

**3. Update Driver Document:**
```typescript
// In Firebase Emulator or Firebase Console
await db.collection('drivers').doc(driverId).update({
  stripeConnectAccountId: "acct_...",  // From step 2
  stripeConnectStatus: "active"
});
```

### Test Flow

**1. Request Ride**
- Customer app → Request ride
- Use pickup/dropoff locations
- Select service class

**2. Accept Ride**
- Driver app → Accept ride
- Ensure it's the driver with Connect account

**3. Complete Trip**
- Driver app → Start trip
- Driver app → Complete trip
- Fare calculated: e.g., $10.00

**4. Authorize Payment**
- Customer app → Add payment method
- Use test card: `4242 4242 4242 4242`
- Authorize payment

**5. Verify in Logs**

Look for these exact log lines:
```
✓ [customerConfirmPayment] Using Stripe Connect for driver
✓ [customerConfirmPayment] Connect enabled - fee structure
✓ [customerConfirmPayment] ✅ CONNECT ROUTING:
   { connectDestination: "acct_...", application_fee_amount: 300 }
```

**6. Verify in Stripe Dashboard**

https://dashboard.stripe.com/test/payments

Click on the PaymentIntent:
- ✅ Amount: $11.50 ($10 fare + $1.50 rider fee)
- ✅ Application fee: $3.00
- ✅ Destination: acct_... (driver's Connect account)
- ✅ Status: requires_capture (manual capture mode)

**7. Capture Payment**
- Backend captures on ride completion
- Check Stripe Dashboard again:
  - Status changes to: succeeded
  - Platform balance: +$3.00
  - Driver Connect account: +$8.50 pending

---

## Troubleshooting

### Issue: No Connect routing (flag is ON)

**Check 1: Is flag actually ON?**
```typescript
// Query Firestore
const flags = await db.collection('config').doc('runtimeFlags').get();
console.log(flags.data()?.enableStripeConnect);  // Should be true
```

**Check 2: Does driver have active Connect account?**
```typescript
const driver = await db.collection('drivers').doc(driverId).get();
console.log(driver.data()?.stripeConnectStatus);  // Must be "active"
console.log(driver.data()?.stripeConnectAccountId);  // Must be "acct_..."
```

**Check 3: Is ride assigned to correct driver?**
```typescript
const ride = await db.collection('rides').doc(rideId).get();
console.log(ride.data()?.driverId);  // Must match driver with Connect account
```

### Issue: "No such payment_intent" error

**Cause:** Key mode mismatch (test key with live PI or vice versa)

**Fix:**
1. Ensure functions/.env.local has TEST key: `sk_test_...`
2. Clear old PI from ride document
3. Create new ride from scratch

### Issue: Webhook signature verification failed

**Cause:** Wrong webhook signing secret

**Fix:**
1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click on your webhook endpoint
3. Copy "Signing secret" (starts with `whsec_...`)
4. Update `functions/.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET_TEST=whsec_...
   ```
5. Restart emulators

---

## Money Math Verification

### Example: $10 Ride

**Customer Side:**
```
Base Fare:       $10.00
Rider Fee:       $ 1.50
─────────────────────
Total Charged:   $11.50
```

**Platform Side:**
```
Total Collected:  $11.50
Rider Fee:        $ 1.50
Driver Fee:       $ 1.50
─────────────────────
Platform Keeps:   $ 3.00  (application_fee_amount)
```

**Driver Side:**
```
Base Fare:        $10.00
Driver Fee:       -$ 1.50
─────────────────────
Driver Receives:  $ 8.50  (automatic transfer via Stripe)
```

**Stripe Dashboard Verification:**
- PaymentIntent amount: $11.50 ✓
- Application fee: $3.00 ✓
- Transfer to driver: $8.50 ✓

---

## Acceptance Criteria Checklist

### Flag OFF (Current Production)
- [ ] Ride payment works normally
- [ ] Logs show `connect: false`
- [ ] NO `stripeConnectAccountId` in ride document
- [ ] PaymentIntent has NO `application_fee_amount`
- [ ] PaymentIntent has NO `transfer_data`

### Flag ON (Connect Enabled)
- [ ] Driver without Connect account → falls back to normal flow
- [ ] Driver with `status='pending'` → falls back to normal flow
- [ ] Driver with `status='active'` → Connect routing enabled
- [ ] Logs show `connect: true`
- [ ] Logs show `✅ CONNECT ROUTING` with destination and fee
- [ ] Ride document has `stripeConnectAccountId`
- [ ] Ride document has `platformFeeCents: 300`
- [ ] Ride document has `driverPayoutCents: 850`
- [ ] PaymentIntent has `application_fee_amount: 300`
- [ ] PaymentIntent has `transfer_data.destination: "acct_..."`
- [ ] Stripe Dashboard shows application fee
- [ ] Stripe Dashboard shows transfer to Connect account
- [ ] After capture, driver Connect account receives $8.50

---

## Production Deployment

### Before Enabling in Production

1. **Test thoroughly in emulator with test keys**
2. **Create pilot group:** 1-2 drivers with real Connect accounts
3. **Enable flag for pilot only:** Check driver IDs before routing
4. **Monitor logs for errors**
5. **Verify payouts arrive in driver accounts**
6. **Gradually expand to more drivers**

### Secret Manager Setup

**Live keys must be in GCP Secret Manager:**
```bash
# Add Stripe live secret key
gcloud secrets create STRIPE_SECRET_KEY_LIVE --data-file=- <<< "sk_live_..."

# Add webhook signing secret (live)
gcloud secrets create STRIPE_WEBHOOK_SECRET_LIVE --data-file=- <<< "whsec_..."
```

**Grant Functions access:**
```bash
gcloud secrets add-iam-policy-binding STRIPE_SECRET_KEY_LIVE \
  --member="serviceAccount@..." \
  --role="roles/secretmanager.secretAccessor"
```

---

## Quick Reference

**Check if Connect is working:**
```bash
# Look for this in logs
grep "CONNECT ROUTING" functions-logs.txt

# Should see:
# connectDestination: acct_...
# application_fee_amount: 300
```

**Verify money flow:**
```
Customer pays: $11.50 → Stripe
  ↓
Platform keeps: $3.00 (application fee)
  ↓
Driver receives: $8.50 (automatic transfer)
```

**Stripe Dashboard URLs:**
- Test Payments: https://dashboard.stripe.com/test/payments
- Test Connect: https://dashboard.stripe.com/test/connect/accounts
- Test Webhooks: https://dashboard.stripe.com/test/webhooks

---

**Ready to verify!** Start with flag OFF, confirm normal behavior, then enable flag and test Connect routing.
