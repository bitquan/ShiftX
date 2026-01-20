# ShiftX Cloud Functions Documentation

Complete reference for all Firebase Cloud Functions in the ShiftX platform.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Function Reference](#function-reference)
   - [Ride Lifecycle Functions](#ride-lifecycle-functions)
   - [Payment Functions](#payment-functions)
   - [Driver Functions](#driver-functions)
   - [Stripe Connect Functions](#stripe-connect-functions)
   - [Wallet Functions](#wallet-functions)
   - [Admin Functions](#admin-functions)
   - [Blocking & Reporting Functions](#blocking--reporting-functions)
4. [Scheduled Functions](#scheduled-functions)
5. [Webhook Functions](#webhook-functions)
6. [Local Development](#local-development)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## Overview

ShiftX uses Firebase Cloud Functions (2nd generation) to manage critical server-side operations. All functions enforce authentication, validate inputs, and perform transactional updates to ensure data consistency.

### Function Counts

- **23 Callable Functions** (HTTPS callables invoked by client apps)
- **1 Scheduled Function** (runs every 2 minutes)
- **1 Webhook Function** (handles Stripe events)

### Key Features

- **Transactional Updates**: All state changes use Firestore transactions
- **Authentication Required**: All callable functions enforce Firebase Auth
- **Stripe Mode Awareness**: Automatically switches between test/live modes
- **Location Validation**: Geofencing for ride start/completion
- **Payment Authorization**: Manual capture flow for ride payments
- **Admin Logging**: All admin actions are logged for audit trail

---

## Architecture

### Technology Stack

- **Runtime**: Node.js 20
- **Language**: TypeScript
- **API Version**: Firebase Functions v2
- **Stripe API**: v2025-12-15.clover
- **Max Instances**: 3 (global limit for cost control)

### Collections Used

- `rides` - Ride documents with status, payment info, timestamps
- `drivers` - Driver profiles, availability, location, earnings
- `customers` - Customer payment methods, preferences
- `users` - User authentication and profile data
- `offers` - Ride offers sent to drivers (subcollection of rides)
- `reports` - User-submitted reports
- `stripeEvents` - Audit log of processed webhooks
- `adminLogs` - Admin actions for compliance

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `STRIPE_MODE` | `test` or `live` | Production only |
| `STRIPE_SECRET_KEY_TEST` | Test mode Stripe key | Dev/Test |
| `STRIPE_SECRET_KEY_LIVE` | Live mode Stripe key | Production |
| `STRIPE_WEBHOOK_SECRET_TEST` | Test webhook signing secret | Dev/Test |
| `STRIPE_WEBHOOK_SECRET_LIVE` | Live webhook signing secret | Production |

---

## Function Reference

### Ride Lifecycle Functions

#### `tripRequest`

Create a new ride request and dispatch offers to nearby drivers.

**Request:**
```typescript
{
  pickup: {
    lat: number;        // Pickup latitude
    lng: number;        // Pickup longitude
    address?: string;   // Human-readable address
  };
  dropoff: {
    lat: number;        // Dropoff latitude
    lng: number;        // Dropoff longitude
    address?: string;   // Human-readable address
  };
  serviceClass?: 'shiftx' | 'shift_lx' | 'shift_black';
  vehicleClass?: 'shiftx' | 'shift_lx' | 'shift_black'; // alias
  estimatedFareCents?: number;
  priceCents?: number;        // alias
  distanceMeters?: number;
  durationSeconds?: number;
  metadata?: Record<string, any>;
}
```

**Response:**
```typescript
{
  rideId: string;    // New ride document ID
  status: 'requested';
}
```

**Behavior:**
1. Creates ride document with status `requested`
2. Queries online, non-busy drivers within 10 miles
3. Filters out drivers who blocked this customer
4. Creates offer documents for eligible drivers
5. Offers expire after 2 minutes

**Error Codes:**
- `unauthenticated` - User not logged in
- `invalid-argument` - Missing required fields

---

#### `acceptRide`

Driver accepts a ride offer.

**Request:**
```typescript
{
  rideId: string;
}
```

**Response:**
```typescript
{
  ok: true;
}
```

**Behavior:**
1. Validates driver is online, not busy, and approved
2. Updates ride status to `accepted`
3. Sets `paymentStatus` to `requires_authorization`
4. Marks driver as busy
5. Expires all other pending offers for this ride

**Guards:**
- Ride must be `requested` or `offered`
- Driver must be online and not busy
- Driver must be approved
- Ride can't be already taken by another driver

**Error Codes:**
- `unauthenticated` - User not authenticated
- `not-found` - Ride or driver not found
- `failed-precondition` - RIDE_CANCELLED, RIDE_COMPLETED, RIDE_TAKEN, INVALID_STATUS
- `permission-denied` - DRIVER_NOT_APPROVED

---

#### `declineOffer`

Driver declines a ride offer.

**Request:**
```typescript
{
  rideId: string;
}
```

**Response:**
```typescript
{
  ok: true;
}
```

**Behavior:**
- Updates offer status to `declined`
- Driver remains available for other offers

**Error Codes:**
- `not-found` - Offer not found
- `failed-precondition` - Offer not pending

---

#### `startRide`

Driver starts the ride after picking up the passenger.

**Request:**
```typescript
{
  rideId: string;
}
```

**Response:**
```typescript
{
  ok: true;
  status: 'started';
}
```

**Behavior:**
1. Validates driver location is within 200m of pickup
2. Validates payment is authorized
3. Updates ride status to `started`

**Guards:**
- Ride must be `accepted`
- Payment must be `authorized`
- Driver location must be fresh (<60s old)
- Driver must be within 200m of pickup

**Error Codes:**
- `permission-denied` - Not authorized to start this ride
- `failed-precondition` - PAYMENT_NOT_AUTHORIZED, TOO_FAR_FROM_PICKUP, STALE_DRIVER_LOCATION

---

#### `progressRide`

Transition ride to in_progress after passenger is picked up.

**Request:**
```typescript
{
  rideId: string;
}
```

**Response:**
```typescript
{
  ok: true;
  status: 'in_progress';
}
```

**Behavior:**
- Updates ride status from `started` to `in_progress`
- Indicates driver is en route to dropoff

**Error Codes:**
- `failed-precondition` - Ride must be started

---

#### `completeRide`

Complete the ride and capture payment.

**Request:**
```typescript
{
  rideId: string;
}
```

**Response:**
```typescript
{
  ok: true;
  status: 'completed';
}
```

**Behavior:**
1. Validates driver location is within 200m of dropoff
2. Updates ride status to `completed`
3. Captures the authorized payment
4. Creates ledger entry for driver earnings
5. Releases driver (sets busy=false)
6. Creates Stripe Connect transfer if applicable

**Guards:**
- Ride must be `in_progress`
- Payment must be `authorized`
- Driver location must be fresh (<60s old)
- Driver must be within 200m of dropoff
- Payment can't already be captured

**Error Codes:**
- `failed-precondition` - PAYMENT_NOT_AUTHORIZED, PAYMENT_ALREADY_CAPTURED, TOO_FAR_FROM_DROPOFF

---

#### `cancelRide`

Cancel a ride before or after acceptance.

**Request:**
```typescript
{
  rideId: string;
  reason?: string;
}
```

**Response:**
```typescript
{
  ok: true;
}
```

**Behavior:**
1. Updates ride status to `cancelled`
2. Releases driver if assigned
3. Cancels Stripe PaymentIntent if exists
4. Expires all pending offers

**Guards:**
- Ride can't be `completed`
- Ride can't already be `cancelled`
- Customer can't cancel after ride `started` or `in_progress`

**Error Codes:**
- `failed-precondition` - RIDE_COMPLETED, RIDE_ALREADY_CANCELLED, RIDE_STARTED (customer only)
- `permission-denied` - NOT_AUTHORIZED

---

#### `cancelActiveRide`

Cancel an active ride (started/in_progress) with automatic refund.

**Request:**
```typescript
{
  rideId: string;
  reason: string;
}
```

**Response:**
```typescript
{
  ok: true;
  refunded: boolean;
}
```

**Behavior:**
1. Cancels the ride
2. Creates full refund if payment was captured
3. Cancels PaymentIntent if not captured
4. Releases driver

**Error Codes:**
- Same as `cancelRide` plus refund errors

---

#### `getRideEvents`

Get event log for a ride.

**Request:**
```typescript
{
  rideId: string;
}
```

**Response:**
```typescript
{
  events: Array<{
    id: string;
    type: string;
    atMs: number;
    meta?: any;
  }>;
}
```

---

#### `getRideHistory`

Get customer's recent ride history.

**Request:**
```typescript
{
  limit?: number;  // Default: 10
}
```

**Response:**
```typescript
{
  rides: Array<{
    rideId: string;
    status: string;
    priceCents: number;
    finalAmountCents?: number;
    paymentStatus?: string;
    serviceClass?: string;
    createdAtMs: number;
    completedAtMs?: number;
    cancelledAtMs?: number;
    pickup?: { lat: number; lng: number };
    dropoff?: { lat: number; lng: number };
  }>;
}
```

---

### Payment Functions

#### `customerConfirmPayment`

Get or create a Stripe PaymentIntent for a ride.

**Request:**
```typescript
{
  rideId: string;
}
```

**Response:**
```typescript
{
  clientSecret: string;  // For Stripe.js confirmPayment
  amount: number;        // Amount in cents
  status: string;        // PaymentIntent status
  savedPaymentMethod?: {
    id: string;
    last4: string;
    brand: string;
    expMonth: number;
    expYear: number;
  };
}
```

**Behavior:**
1. Retrieves or creates PaymentIntent
2. Uses manual capture mode (authorize first, capture on completion)
3. Calculates platform fees (rider + driver fees)
4. Attaches Stripe Connect routing if driver has Connect account
5. Prevents race conditions with transactions

**Platform Fees:**
- Rider Fee: $1.50
- Driver Fee: $1.50
- Total Platform Fee: $3.00

**Formula:**
```
Customer Pays = Base Fare + $1.50
Driver Receives = Base Fare - $1.50
Platform Keeps = $3.00
```

**Error Codes:**
- `invalid-argument` - Invalid ride amount
- `failed-precondition` - Ride not in payable state, LIVE payments disabled

---

#### `addPaymentMethod`

Add a payment method to customer's account.

**Request:**
```typescript
{
  paymentMethodId: string;  // From Stripe.js
}
```

**Response:**
```typescript
{
  ok: true;
}
```

**Behavior:**
1. Creates Stripe customer if doesn't exist
2. Attaches payment method to customer
3. Sets as default payment method

---

#### `getPaymentState`

Get authoritative payment state for a ride.

**Request:**
```typescript
{
  rideId: string;
}
```

**Response:**
```typescript
{
  paymentStatus: 'none' | 'requires_authorization' | 'authorized' | 'captured' | 'cancelled';
  paymentIntentStatus: string | null;
  clientSecret: string | null;
  needsConfirm: boolean;
  recovered?: boolean;  // If auto-recovered from mode mismatch
}
```

**Behavior:**
- Queries Stripe for actual PaymentIntent status
- Syncs Firestore with Stripe if out of sync
- Auto-recovers from test/live mode mismatches
- Returns `needsConfirm=true` if customer action required

---

#### `setPaymentAuthorized`

Mark ride payment as authorized after Stripe confirmation.

**Request:**
```typescript
{
  rideId: string;
}
```

**Response:**
```typescript
{
  ok: true;
}
```

**Behavior:**
- Updates ride with `paymentStatus: 'authorized'`
- Stores authorization timestamp
- Allows driver to start the ride

---

### Driver Functions

#### `driverSetOnline`

Set driver online/offline status.

**Request:**
```typescript
{
  online: boolean;
}
```

**Response:**
```typescript
{
  ok: true;
}
```

**Guards:**
- Can't go offline while busy with a ride
- Approval check temporarily disabled for development

---

#### `driverHeartbeat`

Update driver's last seen timestamp and location.

**Request:**
```typescript
{
  lat?: number;
  lng?: number;
}
```

**Response:**
```typescript
{
  ok: true;
}
```

**Behavior:**
1. Updates `lastHeartbeatMs` and `lastSeenAtMs`
2. Updates driver location if provided
3. Updates active ride's `driverLocation` field

**Note:** Drivers should send heartbeats every 10-30 seconds while online.

---

#### `setDriverAvailability`

Set driver's weekly availability schedule.

**Request:**
```typescript
{
  timezone: string;  // e.g., 'America/Los_Angeles'
  intervals: Array<{
    dayOfWeek: number;     // 0=Sunday, 6=Saturday
    startMinutes: number;  // Minutes since midnight (0-1440)
    endMinutes: number;    // Minutes since midnight (0-1440)
  }>;
}
```

**Response:**
```typescript
{
  ok: true;
}
```

---

#### `getDriverLedgerSummary`

Get driver's earnings summary and recent transactions.

**Request:**
```typescript
{}
```

**Response:**
```typescript
{
  todayCents: number;
  weekCents: number;
  entries: Array<{
    rideId: string;
    amountCents: number;
    createdAtMs: number;
    type: string;
    status: string;
  }>;
}
```

**Behavior:**
- Returns today's earnings
- Returns last 7 days earnings
- Returns last 20 ledger entries

---

#### `setPreferredDriver`

Customer sets a preferred driver.

**Request:**
```typescript
{
  driverId: string;
}
```

**Response:**
```typescript
{
  ok: true;
  driverId: string;
}
```

---

### Stripe Connect Functions

#### `createConnectAccount`

Create a Stripe Connect Express account for a driver.

**Request:**
```typescript
{}
```

**Response:**
```typescript
{
  accountId: string;
  status: 'pending' | 'active' | 'disabled';
  mode: 'test' | 'live';
  alreadyExists: boolean;
}
```

**Behavior:**
1. Creates Stripe Express account
2. Stores mode-specific account ID in Firestore
3. Prevents duplicate accounts per mode
4. Uses transactions to prevent race conditions

**Mode-Aware Fields:**
- Test mode: `stripeConnectAccountId_test`
- Live mode: `stripeConnectAccountId_live`

---

#### `getConnectOnboardingLink`

Get onboarding URL for driver to complete Stripe verification.

**Request:**
```typescript
{
  returnUrl?: string;   // Where to redirect after completion
  refreshUrl?: string;  // Where to redirect if link expires
}
```

**Response:**
```typescript
{
  url: string;        // Stripe onboarding URL
  expiresAt: number;  // Unix timestamp
}
```

**Default URLs:**
- Dev/Emulator: `http://localhost:5174/wallet`
- Production: `https://shiftx-95c4b-driver.web.app/wallet`

---

#### `getConnectStatus`

Get driver's Stripe Connect account status.

**Request:**
```typescript
{}
```

**Response:**
```typescript
{
  status: 'none' | 'pending' | 'submitted' | 'active';
  hasAccount: boolean;
  mode: 'test' | 'live';
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  requiresAction?: boolean;
}
```

---

### Wallet Functions

#### `createSetupIntent`

Create a Stripe SetupIntent for adding payment methods.

**Request:**
```typescript
{}
```

**Response:**
```typescript
{
  clientSecret: string;
  stripeCustomerId: string;
}
```

---

#### `listPaymentMethods`

List customer's saved payment methods.

**Request:**
```typescript
{}
```

**Response:**
```typescript
{
  paymentMethods: Array<{
    id: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault: boolean;
  }>;
  defaultPaymentMethod: {...} | null;
}
```

---

#### `setDefaultPaymentMethod`

Set a payment method as default.

**Request:**
```typescript
{
  paymentMethodId: string;
}
```

**Response:**
```typescript
{
  ok: true;
  summary: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
}
```

---

#### `detachPaymentMethod`

Remove a saved payment method.

**Request:**
```typescript
{
  paymentMethodId: string;
}
```

**Response:**
```typescript
{
  ok: true;
}
```

---

### Admin Functions

#### `approveDriver`

Approve or disable a driver account.

**Request:**
```typescript
{
  driverId: string;
  approved: boolean;
}
```

**Response:**
```typescript
{
  ok: true;
}
```

**Behavior:**
- Updates driver's `approved` field
- If disabling, also sets driver offline
- Logs action to `adminLogs` collection

**Auth Required:** Admin status in `config/admins` document

---

#### `listDrivers`

List all drivers (for admin dashboard).

**Request:**
```typescript
{}
```

**Response:**
```typescript
{
  drivers: Array<{
    uid: string;
    email: string;
    photoURL: string | null;
    approved: boolean;
    isOnline: boolean;
    vehicleClass: string | null;
    vehicleInfo: any;
    stripeConnectAccountId: string | null;
    stripeConnectStatus: string;
    connectEnabledOverride: boolean;
    createdAtMs: number;
    stripeConnectMode: 'test' | 'live';
  }>;
}
```

---

#### `toggleConnectPilot`

Enable/disable Stripe Connect pilot for a specific driver.

**Request:**
```typescript
{
  driverId: string;
  enabled: boolean;
}
```

**Response:**
```typescript
{
  ok: true;
  enabled: boolean;
}
```

**Behavior:**
- Sets `connectEnabledOverride` flag
- Validates driver has active Connect account if enabling
- Logs action to `adminLogs`

**Auth Required:** Admin status

---

### Blocking & Reporting Functions

#### `driverBlockCustomer`

Driver blocks a customer from receiving future offers.

**Request:**
```typescript
{
  customerId: string;
  reason?: string;
}
```

**Response:**
```typescript
{
  ok: true;
}
```

**Behavior:**
- Creates document in `drivers/{driverId}/blockedCustomers/{customerId}`
- Customer won't see this driver's availability
- Driver won't receive offers from this customer

---

#### `driverUnblockCustomer`

Driver unblocks a previously blocked customer.

**Request:**
```typescript
{
  customerId: string;
}
```

**Response:**
```typescript
{
  ok: true;
}
```

---

#### `createReport`

Create a report about a user or ride issue.

**Request:**
```typescript
{
  targetUid: string;
  targetRole: 'customer' | 'driver';
  rideId?: string;
  reason: string;
  category?: string;
}
```

**Response:**
```typescript
{
  ok: true;
  reportId: string;
}
```

**Behavior:**
- Creates document in `reports` collection
- Status starts as `pending`
- Includes reporter and target details

---

#### `getBlockedCustomers`

Get list of customers blocked by this driver.

**Request:**
```typescript
{}
```

**Response:**
```typescript
{
  blocked: Array<{
    customerId: string;
    customerEmail: string;
    reason: string;
    blockedAtMs: number;
  }>;
}
```

---

## Scheduled Functions

### `scheduledCleanup`

Runs every 2 minutes to clean up stuck rides and expired offers.

**Schedule:** `every 2 minutes`

**Jobs:**

1. **Cancel stuck rides** - Rides past `searchExpiresAtMs`
2. **Expire pending offers** - Offers past `expiresAtMs` (2 minutes TTL)
3. **Mark ghost drivers offline** - Drivers with stale heartbeat (>2 minutes)
4. **Cancel unpaid rides** - Accepted rides without payment auth (10 min timeout)
5. **Cancel unstarted rides** - Authorized rides where driver didn't start (10 min timeout)
6. **Cancel stale PaymentIntents** - Rides stuck in payment limbo
7. **Flag missing transfers** - Captured payments without Connect transfer

**Metrics Returned:**
```typescript
{
  cancelledRides: number;
  expiredOffers: number;
  offlineDrivers: number;
  cancelledUnpaid: number;
  cancelledUnstarted: number;
  cancelledStalePayments: number;
  missingTransfers: number;
}
```

---

## Webhook Functions

### `stripeWebhook`

Handles Stripe webhook events for payment and Connect updates.

**Endpoint:** `https://<region>-<project>.cloudfunctions.net/stripeWebhook`

**Events Handled:**

#### Payment Events

- `payment_intent.amount_capturable_updated` - Payment authorized
- `payment_intent.succeeded` - Payment captured successfully
- `payment_intent.payment_failed` - Payment failed
- `payment_intent.canceled` - Payment cancelled

#### Setup Events

- `setup_intent.succeeded` - Payment method saved
- `setup_intent.setup_failed` - Payment method setup failed

#### Connect Events

- `account.updated` - Connect account status changed
- `capability.updated` - Connect capability status changed
- `transfer.created` - Connect transfer created
- `transfer.failed` - Connect transfer failed
- `payout.failed` - Payout to driver failed

**Security:**
- Validates webhook signature with mode-specific secrets
- Prevents replay attacks with event ID deduplication
- Stores all events in `stripeEvents` collection

**Idempotency:**
- Tracks processed events by `event.id`
- Returns 200 OK if already processed
- Prevents duplicate state changes

---

## Local Development

### Setup

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
```

2. Install dependencies:
```bash
cd functions
npm install
```

3. Create `.env.local` file:
```bash
# functions/.env.local
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_SECRET_KEY=sk_test_...  # Fallback
```

4. Build functions:
```bash
npm run build
```

### Running Emulators

Start Functions emulator:
```bash
firebase emulators:start --only functions
```

Or start all emulators:
```bash
firebase emulators:start
```

The Functions emulator runs on `http://localhost:5001`.

### Client Configuration

Point your Flutter app to the emulator:
```dart
FirebaseFunctions.instance.useFunctionsEmulator('localhost', 5001);
```

### Testing with cURL

```bash
# Test a callable function
curl -X POST http://localhost:5001/<project-id>/us-central1/driverHeartbeat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <firebase-id-token>" \
  -d '{"data": {"lat": 37.7749, "lng": -122.4194}}'
```

### Environment Detection

Functions automatically detect emulator mode:
```typescript
function isEmulator() {
  return process.env.FUNCTIONS_EMULATOR === 'true' || 
         !!process.env.FIREBASE_EMULATOR_HUB;
}
```

In emulator:
- Uses `STRIPE_SECRET_KEY_TEST` from `.env.local`
- Enforces test mode keys only
- Allows localhost URLs for redirects
- No Secret Manager access

---

## Deployment

### Prerequisites

1. Set Stripe secrets in Secret Manager:
```bash
# Test mode keys
echo "sk_test_..." | firebase functions:secrets:set STRIPE_SECRET_KEY_TEST
echo "whsec_..." | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET_TEST

# Live mode keys (production only)
echo "sk_live_..." | firebase functions:secrets:set STRIPE_SECRET_KEY_LIVE
echo "whsec_..." | firebase functions:secrets:set STRIPE_WEBHOOK_SECRET_LIVE
```

2. Set environment config:
```bash
# For production with live payments
firebase functions:config:set stripe.mode=live

# For staging with test payments
firebase functions:config:set stripe.mode=test
```

### Deploy All Functions

```bash
firebase deploy --only functions
```

### Deploy Specific Function

```bash
firebase deploy --only functions:tripRequest
firebase deploy --only functions:scheduledCleanup
```

### Deploy with Secrets

Functions that use secrets automatically request access during deployment.

### Production Checklist

- [ ] Test all functions in emulator
- [ ] Verify Stripe test mode works end-to-end
- [ ] Set LIVE Stripe keys in Secret Manager
- [ ] Set `STRIPE_MODE=live` environment variable
- [ ] Update webhook URL in Stripe dashboard
- [ ] Test webhook signature verification
- [ ] Monitor Cloud Functions logs
- [ ] Set up alerts for function errors

---

## Troubleshooting

### Common Issues

#### 1. "Missing STRIPE_SECRET_KEY_TEST" in Emulator

**Cause:** `.env.local` file not found or missing key

**Fix:**
```bash
cd functions
echo "STRIPE_SECRET_KEY_TEST=sk_test_YOUR_KEY" > .env.local
```

#### 2. "Stripe signature verification failed"

**Cause:** Webhook secret doesn't match Stripe dashboard

**Fix:**
1. Get webhook signing secret from Stripe dashboard
2. Update secret: `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET_TEST`
3. Redeploy: `firebase deploy --only functions:stripeWebhook`

#### 3. "PAYMENT_NOT_AUTHORIZED" on startRide

**Cause:** Customer hasn't confirmed payment yet

**Fix:**
1. Check ride's `paymentStatus` field
2. Ensure client calls `customerConfirmPayment` before start
3. Client must call Stripe.confirmPayment()
4. Client must call `setPaymentAuthorized` after confirmation

#### 4. "TOO_FAR_FROM_PICKUP" error

**Cause:** Driver location is more than 200m from pickup

**Fix:**
- Ensure driver app sends heartbeats with accurate GPS
- Check `driverHeartbeat` is being called
- Verify location permissions granted
- Consider increasing `START_RADIUS_M` constant for testing

#### 5. "resource_missing" errors in Stripe calls

**Cause:** Stripe mode mismatch (test object accessed with live key)

**Fix:**
- Check `STRIPE_MODE` environment variable
- Verify correct secret is loaded
- Functions auto-recover by clearing stale IDs

#### 6. Functions timing out

**Cause:** Long-running operations or cold starts

**Fix:**
- Increase `timeoutSeconds` in function options
- Optimize database queries
- Use batched writes
- Consider async operations for cleanup

#### 7. "Admin" functions not accessible

**Cause:** User not in admin list

**Fix:**
```javascript
// Add user to admins
db.collection('config').doc('admins').set({
  uids: ['user-uid-1', 'user-uid-2']
}, { merge: true });
```

### Debugging Tips

#### View Logs
```bash
# Real-time logs
firebase functions:log --only tripRequest

# All logs
firebase functions:log
```

#### Enable Debug Logging
```typescript
console.log('Debug:', { rideId, status, payment });
```

#### Test Individual Functions
```bash
# Use Firebase CLI shell
firebase functions:shell

# Call function
tripRequest({
  pickup: { lat: 37.7749, lng: -122.4194 },
  dropoff: { lat: 37.8044, lng: -122.2712 },
  serviceClass: 'shiftx',
  estimatedFareCents: 1500
});
```

#### Monitor Performance
- Use Firebase Console > Functions > Usage tab
- Check invocations, execution time, errors
- Set up alerts for error rates

### Error Code Reference

| Code | Meaning | Common Causes |
|------|---------|---------------|
| `unauthenticated` | No auth token | User not logged in |
| `permission-denied` | Not authorized | Wrong user or missing admin role |
| `invalid-argument` | Bad input | Missing/invalid parameters |
| `not-found` | Resource missing | Invalid ID or deleted document |
| `failed-precondition` | State error | Wrong ride/payment status |
| `internal` | Server error | Stripe error, database failure |

---

## Performance & Limits

### Function Limits

- Max instances: 3 (global setting)
- Timeout: 60s default (540s for cleanup)
- Memory: 256MB default
- Concurrency: 80 requests per instance

### Best Practices

1. **Minimize cold starts**: Keep functions warm with dummy requests
2. **Use transactions**: Prevent race conditions
3. **Batch operations**: Combine Firestore writes
4. **Cache Stripe instances**: Reuse client connections
5. **Log errors**: Use structured logging
6. **Set timeouts**: Prevent hanging requests

### Cost Optimization

- Use scheduled functions sparingly (every 2 min = 720 invocations/day)
- Batch database operations
- Set global max instances limit
- Monitor invocation counts
- Use Cloud Functions quota alerts

---

## Support

For issues or questions:
1. Check logs in Firebase Console
2. Review Stripe dashboard for payment issues
3. Test in emulator before deploying
4. Consult Firebase Functions documentation: https://firebase.google.com/docs/functions

