# ShiftX Cloud Functions

Server-side business logic for the ShiftX rideshare platform. Built with TypeScript and Firebase Cloud Functions (Gen 2).

## 🔧 Functions Overview

### Callable Functions (23)

**Ride Lifecycle:**
- `tripRequest` - Create new ride request
- `acceptRide` - Driver accepts ride offer
- `declineOffer` - Driver declines offer
- `startRide` - Driver starts ride (arrives at pickup)
- `progressRide` - Transition to in_progress
- `completeRide` - Complete ride + capture payment
- `cancelRide` - Cancel pre-started ride
- `cancelActiveRide` - Cancel active ride + refund
- `getRideEvents` - Fetch ride event log
- `getRideHistory` - Get customer's past rides

**Payment:**
- `customerConfirmPayment` - Create/retrieve payment intent
- `addPaymentMethod` - Attach payment method to customer
- `getPaymentState` - Get payment status
- `setPaymentAuthorized` - Mark payment authorized

**Wallet:**
- `createSetupIntent` - For saved payment methods
- `listPaymentMethods` - List customer's cards
- `setDefaultPaymentMethod` - Set default card
- `detachPaymentMethod` - Remove saved card

**Driver:**
- `driverSetOnline` - Toggle online/offline
- `driverHeartbeat` - Send location update
- `setDriverAvailability` - Set weekly hours
- `getDriverLedgerSummary` - Get earnings summary
- `setPreferredDriver` - Generate QR code

**Stripe Connect:**
- `createConnectAccount` - Create driver payout account
- `getConnectOnboardingLink` - Get onboarding URL
- `getConnectStatus` - Check verification status

**Admin:**
- `approveDriver` - Approve/disable driver
- `listDrivers` - Get all drivers (admin only)
- `toggleConnectPilot` - Manage live payments whitelist

**Blocking & Reporting:**
- `driverBlockCustomer` - Block customer
- `driverUnblockCustomer` - Unblock customer
- `createReport` - Report user/ride issue
- `getBlockedCustomers` - List blocked customers

### Scheduled Functions (1)

- `scheduledCleanup` - Runs every 2 minutes
  - Cancels expired rides
  - Expires pending offers
  - Marks ghost drivers offline
  - Handles payment timeouts

### Webhook Functions (1)

- `stripeWebhook` - Handles 11 Stripe event types
  - Payment intents (succeeded, failed, canceled)
  - Setup intents
  - Account updates
  - Transfers and payouts

## 🏗️ Tech Stack

- **Runtime:** Node.js 20
- **Language:** TypeScript 5.3
- **Platform:** Firebase Cloud Functions (Gen 2)
- **Database:** Firestore
- **Payments:** Stripe + Stripe Connect
- **Secrets:** Firebase Secret Manager

## 📦 Setup

### Prerequisites

- Node.js 18+ (LTS recommended)
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project with billing enabled

### Install Dependencies

```bash
cd functions
npm install
```

### Environment Variables

Create `.env` file for local development:

```bash
# Stripe Test Mode (for emulator)
STRIPE_SECRET_KEY_TEST=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET_TEST=whsec_xxxxx

# Environment
FUNCTIONS_EMULATOR=true
NODE_ENV=development

# Feature Flags
ENABLE_STRIPE_CONNECT=true
ALLOW_LIVE_PAYMENTS=false
```

**For production:** Use Firebase Secret Manager (see below)

## 🚀 Development

### Local Emulator

```bash
# From project root
firebase emulators:start --only functions

# Or just functions
cd functions
npm run serve
```

Functions available at: http://localhost:5002

### Build TypeScript

```bash
npm run build
```

Output: `lib/`

### Linting

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

## 🌐 Deployment

### Deploy All Functions

```bash
# From project root
firebase deploy --only functions

# Or from functions directory
npm run deploy
```

### Deploy Specific Function

```bash
firebase deploy --only functions:tripRequest
```

### Set Production Secrets

```bash
# Set secrets (interactive prompt)
firebase functions:secrets:set STRIPE_SECRET_KEY_LIVE
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET_LIVE

# Verify secrets
firebase functions:secrets:access STRIPE_SECRET_KEY_LIVE
```

### Environment-Specific Deployment

```bash
# Development
firebase use dev
firebase deploy --only functions

# Production
firebase use prod
firebase deploy --only functions
```

## 📂 Project Structure

```
functions/
├── src/
│   ├── index.ts              # Entry point (exports all functions)
│   ├── rides.ts              # Ride lifecycle functions
│   ├── payment.ts            # Payment functions
│   ├── wallet.ts             # Wallet management
│   ├── driver.ts             # Driver functions
│   ├── connect.ts            # Stripe Connect
│   ├── blocking.ts           # Blocking & reporting
│   ├── cleanup.ts            # Scheduled cleanup
│   ├── webhooks/
│   │   └── stripe.ts         # Stripe webhook handler
│   ├── utils/
│   │   ├── cors.ts           # CORS configuration
│   │   ├── runtimeFlags.ts   # Feature flags
│   │   └── stripe.ts         # Stripe client
│   └── types/                # TypeScript types
├── test/                     # Unit tests (future)
├── .env.example              # Environment template
├── package.json
└── tsconfig.json
```

## 🧪 Testing

### Manual Testing with Emulator

```bash
# Terminal 1: Start emulators
firebase emulators:start --only auth,firestore,functions

# Terminal 2: Run client apps
cd packages/customer-app && npm run dev
```

### Call Function from Client

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const tripRequest = httpsCallable(functions, 'tripRequest');

const result = await tripRequest({
  pickup: { lat: 40.7128, lng: -74.0060 },
  dropoff: { lat: 40.7580, lng: -73.9855 },
  serviceClass: 'shiftx',
  estimatedFareCents: 2500
});

console.log(result.data); // { rideId: 'xxx', status: 'requested' }
```

### Automated Smoke Test

```bash
# From project root
node scripts/smokeTest.js --mode emulator
```

## 🔐 Security

### Authentication

All callable functions require Firebase Auth:
```typescript
if (!request.auth) {
  throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
}
```

### Admin Functions

Admin functions check `config/admins` document:
```typescript
const adminsDoc = await db.doc('config/admins').get();
const adminUids = adminsDoc.data()?.uids || [];

if (!adminUids.includes(request.auth.uid)) {
  throw new functions.https.HttpsError('permission-denied', 'Admin access required');
}
```

### CORS

Allowed origins configured in `src/utils/cors.ts`:
- `localhost:*` (development)
- `*.web.app` (Firebase hosting)
- `*.firebaseapp.com` (Firebase hosting)

## 💰 Platform Fees

**Fee Structure:**
- Rider Fee: $1.50 (added to customer charge)
- Driver Fee: $1.50 (deducted from driver payout)
- Total Platform Fee: $3.00 per ride

**Example:**
- Base Fare: $13.50
- Customer Pays: $15.00 ($13.50 + $1.50)
- Driver Receives: $12.00 ($13.50 - $1.50)
- Platform Keeps: $3.00

## 📊 Monitoring

### Firebase Console

- **Functions Dashboard** → View invocations, errors, logs
- **Logs Explorer** → Search logs by function name, error level
- **Performance** → Monitor cold starts, execution time

### Alerts

Set up alerts for:
- Function errors > 5% of invocations
- Cold starts > 2 seconds
- Timeout errors
- Memory exceeded

### Useful Queries

```bash
# View recent errors
firebase functions:log --only tripRequest --lines 50

# Stream logs in real-time
firebase functions:log --follow
```

## 🐛 Troubleshooting

### Issue: Function timeout

**Solution:** Increase timeout in function definition
```typescript
export const myFunction = onCall({
  timeoutSeconds: 300,  // 5 minutes (default: 60s)
}, async (request) => {
  // ...
});
```

### Issue: CORS error

**Solution:** Check origin is whitelisted in `src/utils/cors.ts`

### Issue: Stripe mode mismatch

**Solution:** Verify `allowLivePayments` flag in `config/runtimeFlags`

### Issue: Out of memory

**Solution:** Increase memory allocation
```typescript
export const myFunction = onCall({
  memory: '1GiB',  // Default: 256MiB
}, async (request) => {
  // ...
});
```

## 📚 Documentation

- **[FUNCTIONS.md](../docs/backend/FUNCTIONS.md)** - Complete API reference
- **[STRIPE_CONNECT.md](../docs/STRIPE_CONNECT.md)** - Stripe Connect guide
- **[FIREBASE.md](../docs/FIREBASE.md)** - Firestore structure
- **[DEPLOYMENT.md](../docs/DEPLOYMENT.md)** - Deployment guide

## 🔗 Resources

- [Firebase Functions Docs](https://firebase.google.com/docs/functions)
- [Cloud Functions Gen 2](https://firebase.google.com/docs/functions/2nd-gen)
- [Stripe API](https://stripe.com/docs/api)
- [Stripe Connect](https://stripe.com/docs/connect)

---

**Last Updated:** January 20, 2026
**Functions Count:** 23 callable + 1 scheduled + 1 webhook
**Status:** Production Ready ✅

