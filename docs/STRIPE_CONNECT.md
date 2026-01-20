# Stripe Connect Integration Guide

## Overview

ShiftX uses **Stripe Connect** to enable driver payouts. When a ride is completed, the customer's payment is automatically split between the driver and the platform using Stripe's destination charges.

### Key Concepts

- **Platform Account:** ShiftX's main Stripe account
- **Connected Account:** Each driver's Stripe Express account
- **Destination Charge:** Payment goes to platform, then transferred to driver
- **Application Fee:** Platform's commission ($3.00 per ride)

---

## Architecture

### Payment Flow

```
Customer Payment ($15.00)
    ↓
Platform Stripe Account (receives full amount)
    ↓
Automatic Transfer to Driver Connect Account ($12.00)
    ↓
Platform keeps Application Fee ($3.00)
```

### Fee Structure

| Party | Amount | Description |
|-------|--------|-------------|
| **Customer Pays** | $15.00 | Ride fare + rider fee |
| **Driver Receives** | $12.00 | Ride fare - driver fee |
| **Platform Keeps** | $3.00 | Rider fee + driver fee |

**Breakdown:**
- Base fare: $13.50
- Rider fee: $1.50 (added to customer charge)
- Driver fee: $1.50 (deducted from driver payout)
- Total platform fee: $3.00

---

## Setup Process

### 1. Enable Stripe Connect

In Stripe Dashboard:
1. Navigate to **Connect** → **Settings**
2. Choose **Express** account type
3. Configure branding (logo, colors)
4. Set statement descriptor: "SHIFTX"

### 2. Configure Platform Settings

```typescript
// In Stripe Dashboard → Connect → Settings
{
  "account_type": "express",
  "business_type": "individual",
  "capabilities": ["card_payments", "transfers"],
  "country": "US"
}
```

### 3. Webhook Configuration

Add webhook endpoint: `https://your-functions-url/stripeWebhook`

**Required Events:**
- `account.updated` - Track verification status
- `capability.updated` - Monitor charges/payouts enabled
- `payment_intent.succeeded` - Confirm payment captured
- `transfer.created` - Link transfer to ride
- `transfer.failed` - Alert on failed transfers
- `payout.failed` - Alert on payout failures

### 4. Environment Variables

Set in Cloud Functions:
```bash
# Test mode (for development)
STRIPE_SECRET_KEY_TEST=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET_TEST=whsec_xxxxx

# Live mode (for production)
firebase functions:secrets:set STRIPE_SECRET_KEY_LIVE
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET_LIVE
```

---

## Driver Onboarding Flow

### Step 1: Create Connect Account

Driver calls from app:
```typescript
import { httpsCallable } from 'firebase/functions';

const createConnectAccount = httpsCallable(functions, 'createConnectAccount');
const result = await createConnectAccount();

// Result: { accountId, status: 'pending', mode: 'test' }
```

Backend creates Stripe Express account:
```typescript
const account = await stripe.accounts.create({
  type: 'express',
  country: 'US',
  email: driverEmail,
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true }
  },
  business_type: 'individual',
  metadata: {
    driverId: uid,
    environment: 'test' // or 'live'
  }
});
```

Stored in Firestore:
```typescript
// drivers/{uid}
{
  stripeConnectAccountId_test: 'acct_xxxxx',
  connectStatus_test: 'pending',
  connectOnboardingComplete_test: false
}
```

### Step 2: Get Onboarding Link

```typescript
const getOnboardingLink = httpsCallable(functions, 'getConnectOnboardingLink');
const result = await getOnboardingLink({
  returnUrl: 'https://driver.shiftx.com/onboarding/complete',
  refreshUrl: 'https://driver.shiftx.com/onboarding'
});

// Result: { url: 'https://connect.stripe.com/express/onboarding/...', expiresAt: 1234567890 }
```

### Step 3: Driver Completes Onboarding

Driver is redirected to Stripe's onboarding flow to provide:
- Personal information (name, DOB, SSN/EIN)
- Bank account details for payouts
- Tax information (W-9 or equivalent)
- Identity verification (photo ID)

### Step 4: Verification & Activation

Stripe verifies the information and sends webhook:
```typescript
// Event: account.updated
{
  "id": "acct_xxxxx",
  "charges_enabled": true,
  "payouts_enabled": true,
  "details_submitted": true
}
```

Backend updates driver status:
```typescript
// drivers/{uid}
{
  connectStatus_test: 'active',
  connectOnboardingComplete_test: true,
  connectChargesEnabled_test: true,
  connectPayoutsEnabled_test: true
}
```

---

## Runtime Operation

### Check Driver Eligibility

Before allowing driver to accept rides:
```typescript
const getConnectStatus = httpsCallable(functions, 'getConnectStatus');
const status = await getConnectStatus();

if (status.status !== 'active' || !status.chargesEnabled) {
  // Show onboarding prompt
  console.log('Complete Stripe Connect onboarding to receive payouts');
}
```

### Create Ride with Connect Transfer

When ride is accepted (in `acceptRide` function):
```typescript
const ride = await rideRef.get();
const driver = await driverRef.get();

// Create PaymentIntent with destination charge
const paymentIntent = await stripe.paymentIntents.create({
  amount: ride.data().totalChargeCents,
  currency: 'usd',
  capture_method: 'manual', // Authorize now, capture later
  transfer_data: {
    destination: driver.data().stripeConnectAccountId_test,
    amount: ride.data().driverPayoutCents
  },
  application_fee_amount: ride.data().platformFeeCents,
  metadata: {
    rideId: ride.id,
    driverId: driver.id,
    customerId: ride.data().customerId
  }
});
```

### Complete Ride with Capture

When ride is completed (in `completeRide` function):
```typescript
// Capture the payment
const capturedIntent = await stripe.paymentIntents.capture(paymentIntentId);

// Transfer is created automatically
// Webhook: transfer.created
{
  "id": "tr_xxxxx",
  "amount": 1200, // $12.00 to driver
  "destination": "acct_driver_xxxxx",
  "source_transaction": "py_xxxxx"
}

// Update ride with transfer ID
await rideRef.update({
  connectTransferId: transfer.id,
  transferStatus: 'pending'
});
```

---

## Mode Isolation (Test vs Live)

### Separate Accounts Per Mode

**Important:** Drivers must have separate Connect accounts for test and live mode.

```typescript
// Firestore structure
drivers/{uid}: {
  // Test mode
  stripeConnectAccountId_test: 'acct_test_xxxxx',
  connectStatus_test: 'active',
  
  // Live mode
  stripeConnectAccountId_live: 'acct_live_xxxxx',
  connectStatus_live: 'pending'
}
```

### Mode Detection

Backend automatically detects mode:
```typescript
function getStripeMode(): 'test' | 'live' {
  const allowLive = runtimeFlags.allowLivePayments;
  return allowLive ? 'live' : 'test';
}

const mode = getStripeMode();
const connectAccountId = driver[`stripeConnectAccountId_${mode}`];
```

### Switching to Live Mode

**Requirements before enabling live mode:**
1. All drivers complete live mode onboarding
2. Platform account verified in live mode
3. Business information submitted to Stripe
4. Bank account added for payouts
5. Tax information on file

**Enable live mode:**
```typescript
// Update runtime flags
await db.doc('config/runtimeFlags').update({
  allowLivePayments: true,
  livePaymentPilotUids: [] // Empty = all drivers eligible
});
```

---

## Testing

### Test Mode Onboarding

Use Stripe's test mode credentials:
- **SSN:** `000-00-0000`
- **Routing:** `110000000`
- **Account:** `000123456789`

### Simulate Payouts

In test mode, payouts are simulated:
```bash
# Trigger payout in Stripe CLI
stripe trigger payout.paid
```

### Test Scenarios

#### Successful Ride with Payout
```typescript
// 1. Driver creates Connect account (test mode)
const { accountId } = await createConnectAccount();

// 2. Complete onboarding (use test credentials)
const { url } = await getConnectOnboardingLink();
// Navigate to URL, fill form

// 3. Request ride
const { rideId } = await tripRequest({ ... });

// 4. Accept ride (creates PaymentIntent with transfer)
await acceptRide({ rideId });

// 5. Customer authorizes payment
await customerConfirmPayment({ rideId });

// 6. Complete ride (captures payment, transfers to driver)
await completeRide({ rideId });

// 7. Check driver ledger
const { todayCents, entries } = await getDriverLedgerSummary();
// Should show $12.00 entry
```

#### Failed Transfer
```typescript
// Simulate failed transfer (invalid account)
// Webhook: transfer.failed
{
  "id": "tr_xxxxx",
  "failure_code": "account_closed",
  "failure_message": "The destination account is not active"
}

// Backend logs error and notifies admin
await db.collection('adminLogs').add({
  action: 'transfer_failed',
  details: {
    rideId,
    transferId: 'tr_xxxxx',
    error: 'account_closed'
  },
  timestamp: Date.now()
});
```

---

## Error Handling

### Common Issues

#### 1. Account Not Onboarded

**Error:** Driver tries to accept ride without completing onboarding

**Handling:**
```typescript
const connectStatus = await getConnectStatus();
if (connectStatus.status !== 'active') {
  throw new functions.https.HttpsError(
    'failed-precondition',
    'Complete Stripe Connect onboarding to accept rides'
  );
}
```

#### 2. Charges Disabled

**Error:** Driver's Connect account has charges disabled

**Handling:**
```typescript
if (!driver.connectChargesEnabled_test) {
  throw new functions.https.HttpsError(
    'failed-precondition',
    'Your Connect account is not enabled for charges. Contact support.'
  );
}
```

#### 3. Mode Mismatch

**Error:** Using test PaymentIntent with live Connect account

**Handling:**
```typescript
const intentMode = paymentIntent.livemode ? 'live' : 'test';
const currentMode = getStripeMode();

if (intentMode !== currentMode) {
  throw new functions.https.HttpsError(
    'internal',
    `Stripe mode mismatch: intent is ${intentMode} but app is in ${currentMode} mode`
  );
}
```

#### 4. Transfer Failed

**Error:** Automatic transfer to driver fails

**Handling:**
```typescript
// Listen to webhook: transfer.failed
stripe.webhooks.on('transfer.failed', async (event) => {
  const transfer = event.data.object;
  
  // Mark ride as needing manual review
  await rideRef.update({
    transferStatus: 'failed',
    transferError: transfer.failure_message
  });
  
  // Notify admin
  await sendAdminAlert({
    type: 'transfer_failed',
    rideId: transfer.metadata.rideId,
    error: transfer.failure_message
  });
});
```

---

## Going Live Checklist

### Platform Requirements

- [ ] Stripe account verified with business information
- [ ] Bank account added for receiving platform fees
- [ ] Tax information submitted (W-9 or equivalent)
- [ ] Webhook endpoint configured for production URL
- [ ] HTTPS enabled on all endpoints
- [ ] Connect branding configured (logo, colors)

### Driver Requirements

- [ ] All drivers complete live mode onboarding
- [ ] Bank accounts verified
- [ ] Identity verification passed
- [ ] Test mode thoroughly before switching

### Code Configuration

- [ ] Set `STRIPE_SECRET_KEY_LIVE` in Firebase Secret Manager
- [ ] Set `STRIPE_WEBHOOK_SECRET_LIVE` in Firebase Secret Manager
- [ ] Update `allowLivePayments` flag in Firestore
- [ ] Configure CORS for production domains
- [ ] Enable production logging and monitoring

### Testing Before Launch

- [ ] Test ride flow end-to-end in test mode
- [ ] Verify transfers appear in driver accounts
- [ ] Test failed transfer scenarios
- [ ] Verify webhook processing
- [ ] Test onboarding flow for new drivers
- [ ] Verify mode switching logic

---

## Monitoring & Maintenance

### Key Metrics to Track

- **Onboarding Completion Rate:** % of drivers completing Connect setup
- **Transfer Success Rate:** % of successful automatic transfers
- **Payout Time:** Average time from ride completion to payout
- **Failed Transfers:** Count and reasons for failures

### Admin Dashboard Queries

```typescript
// Get drivers needing onboarding
const driversQuery = db.collection('drivers')
  .where('approved', '==', true)
  .where('connectStatus_live', '==', 'pending');

// Get rides with failed transfers
const failedTransfers = db.collection('rides')
  .where('transferStatus', '==', 'failed')
  .orderBy('completedAtMs', 'desc');
```

### Alerting

Set up alerts for:
- Failed transfers > 5% of rides
- Payout delays > 24 hours
- Driver onboarding failures
- Webhook processing errors

---

## Additional Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Express Accounts](https://stripe.com/docs/connect/express-accounts)
- [Destination Charges](https://stripe.com/docs/connect/destination-charges)
- [Connect Webhooks](https://stripe.com/docs/connect/webhooks)
- [Testing Connect](https://stripe.com/docs/connect/testing)

---

**Last Updated:** January 20, 2026
**Status:** Production Ready
**Current Mode:** Test (switching to live in progress)
