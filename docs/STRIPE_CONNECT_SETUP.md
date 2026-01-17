# Stripe Connect Setup Guide

## Overview

This document covers the implementation of **Task A2.4 - Stripe Connect Express onboarding** for driver payouts.

## What Was Built

### 1. Cloud Functions (✅ Already Existed)

Located in `/functions/src/connect.ts`:

- **`createConnectAccount()`**
  - Creates Stripe Express account for driver
  - Requests `card_payments` and `transfers` capabilities
  - Saves mode-specific account ID to `drivers/{uid}`
    - `stripeConnectAccountId_test` (STRIPE_MODE=test or emulator)
    - `stripeConnectAccountId_live` (STRIPE_MODE=live)
  - Sets mode-specific status:
    - `stripeConnectStatus_test: 'pending'`
    - `stripeConnectStatus_live: 'pending'`
  - Logs creation to `adminLogs` collection

- **`getConnectOnboardingLink()`**
  - Generates account onboarding link
  - Returns URL that opens Stripe Express onboarding flow
  - Accepts `returnUrl` and `refreshUrl` parameters

- **`getConnectStatus()`**
  - Fetches current Connect account status from Stripe
  - Returns account details and capabilities

### 2. Webhook Handling (✅ Already Existed)

Located in `/functions/src/webhooks/stripe.ts`:

- **`account.updated` handler**
  - Listens for Stripe account updates
  - When `charges_enabled && payouts_enabled`:
    - Sets `stripeConnectStatus: 'active'`
    - Updates `stripeConnectChargesEnabled` and `stripeConnectPayoutsEnabled`
  - Handles disabled accounts (sets status to 'disabled')

- **`capability.updated` handler**
  - Tracks individual capability status changes
  - Stores in `stripeCapabilities` map on driver doc

### 3. Driver App Wallet UI (✅ Updated)

Located in `/packages/driver-app/src/components/Wallet.tsx`:

**Features:**
- Checks `enableStripeConnect` runtime flag
- Shows "Coming soon" banner when flag is OFF
- Shows status-based banners when flag is ON:
  - **No account**: "Set Up Payouts" button
  - **Pending**: "Complete your payout setup" + "Set Up Payouts" button
  - **Active**: "Payouts Active" with confirmation message
- `handleSetupPayouts()` function:
  - Creates Connect account if needed
  - Gets onboarding link
  - Opens in new window/tab

### 4. Admin Dashboard (✅ Enhanced)

Located in `/packages/admin-dashboard/src/components/Drivers.tsx`:

**Features:**
- Shows payout status badge for each driver:
  - 💸 **Payouts Active** (green)
  - ⏳ **Payout Setup Pending** (yellow)
  - ⚠️ **Payouts Disabled** (red)
- Displays Stripe Connect account ID below status badge
- Color-coded badges with borders

## Database Schema

### `drivers/{uid}` Document

```typescript
{
  stripeConnectAccountId_test?: string;      // Stripe account ID (acct_xxx) for TEST mode
  stripeConnectAccountId_live?: string;      // Stripe account ID (acct_xxx) for LIVE mode
  stripeConnectStatus_test?: 'none' | 'pending' | 'active' | 'disabled';
  stripeConnectStatus_live?: 'none' | 'pending' | 'active' | 'disabled';
  stripeConnectChargesEnabled?: boolean;     // From webhook
  stripeConnectPayoutsEnabled?: boolean;     // From webhook
  stripeCapabilities?: {                     // From webhook
    card_payments?: 'active' | 'inactive' | 'pending';
    transfers?: 'active' | 'inactive' | 'pending';
  };
  connectEnabledOverride?: boolean;          // ✅ Pilot toggle (Task A2.5)
}
```

### `config/runtimeFlags` Document

```typescript
{
  enableStripeConnect: boolean;  // Global feature flag
}
```

### `adminLogs` Collection

```typescript
{
  action: 'enable_connect_pilot' | 'disable_connect_pilot';
  adminUid: string;
  adminEmail: string;
  details: {
    driverId: string;
    driverEmail: string;
    enabled: boolean;
    stripeConnectAccountId: string;
  };
  timestamp: FieldValue.serverTimestamp();
  timestampMs: number;
}
```

## Testing Checklist

### Prerequisites
1. ✅ Stripe test mode API keys configured
2. ✅ Stripe webhook endpoint configured
3. ✅ Functions deployed with secrets
4. ✅ `enableStripeConnect` flag set to `true` in Firestore
5. ✅ `allowLivePayments` + `livePaymentPilotUids` configured before any LIVE use

### Mode Selection (STRIPE_MODE)

Connect uses **mode-specific account IDs** and **mode-specific Stripe keys**.

- Emulator: always TEST, uses `STRIPE_SECRET_KEY_TEST` from `functions/.env.local`.
- Deployed with `STRIPE_MODE=test`: uses Secret Manager `STRIPE_SECRET_KEY_TEST`.
- Deployed with `STRIPE_MODE=live` (default): uses Secret Manager `STRIPE_SECRET_KEY_LIVE`.

The backend will **hard-fail** if the key type doesn’t match the mode to prevent accidental live account creation in test.

### Live Gate (Pilot Only)

LIVE payments/Connect are blocked unless:

- `config/runtimeFlags.allowLivePayments = true`
- `config/runtimeFlags.livePaymentPilotUids` includes the customer or driver UID

### Test Flow

#### 1. Driver Onboarding Flow
- [ ] Open Driver App → Wallet
- [ ] Verify "Set Up Payouts" button appears (flag ON)
- [ ] Click "Set Up Payouts"
- [ ] Verify `createConnectAccount()` called
- [ ] Verify Stripe Express onboarding opens
- [ ] Complete onboarding in Stripe
- [ ] Return to app
- [ ] Verify status updates to "active" (via webhook)

#### 2. Webhook Testing
- [ ] Create Connect account via function
- [ ] Use Stripe CLI to trigger `account.updated` webhook:
  ```bash
  stripe trigger account.updated
  ```
- [ ] Verify driver doc updates to `stripeConnectStatus: 'active'`
- [ ] Check `stripeConnectChargesEnabled` and `stripeConnectPayoutsEnabled` set to `true`

#### 3. Admin Dashboard Verification
- [ ] Open Admin Dashboard → Drivers
- [ ] Verify payout status badges appear
- [ ] Verify account ID displayed
- [ ] Check color coding matches status

#### 4. Flag OFF Testing
- [ ] Set `enableStripeConnect: false` in Firestore
- [ ] Reload Driver App → Wallet
- [ ] Verify "Coming soon" banner appears
- [ ] Verify "Set Up Payouts" button hidden
- [ ] Try calling `createConnectAccount()` directly
- [ ] Verify function returns error "Feature coming soon!"

## Pilot Rollout (Task A2.5 - ✅ IMPLEMENTED)

### Overview
Per-driver pilot toggle allows controlled rollout of Stripe Connect to individual drivers before enabling globally.

### Implementation

**1. Cloud Function: `toggleConnectPilot`**
- Admin-only function to enable/disable Connect for specific drivers
- Validates driver has active Connect account before enabling
- Logs all changes to `adminLogs` collection

**2. Payment Logic Enhancement**
Connect routing now requires THREE conditions (all must be true):
```typescript
const canUseConnect = 
  runtimeFlags.enableStripeConnect === true &&  // Global flag ON
  driver.connectEnabledOverride === true &&      // Pilot enabled for driver
  driver.stripeConnectStatus === 'active';       // Driver onboarded
```

**3. Admin Dashboard UI**
- Shows "Enable Pilot" button for drivers with active Connect accounts
- Button changes to "🚀 Pilot Enabled" when active
- Only appears after driver completes onboarding

### Usage Flow

1. **Enable Global Flag**: Set `enableStripeConnect: true` in Firestore
2. **Driver Onboarding**: Driver completes Stripe onboarding (status → `active`)
3. **Admin Enables Pilot**: Admin clicks "Enable Pilot" for specific driver
4. **Driver Receives Payouts**: Next completed ride uses Connect routing
5. **Verify in Stripe**: Check Stripe Dashboard for transfers
6. **Scale Gradually**: Enable more drivers as you verify success

### Testing Checklist

- [ ] Deploy functions with new `toggleConnectPilot` function
- [ ] Admin clicks "Enable Pilot" for test driver
- [ ] Verify `connectEnabledOverride: true` in driver doc
- [ ] Complete test ride with pilot driver
- [ ] Check payment logs for "✅ CONNECT ROUTING" message
- [ ] Verify transfer appears in Stripe Dashboard
- [ ] Test disabling pilot (button should toggle off)
- [ ] Verify subsequent rides don't use Connect

### Monitoring

**Payment Function Logs:**
```
[customerConfirmPayment] ✅ Using Stripe Connect for pilot driver: {
  driverId: "abc123",
  accountId: "acct_xxx",
  pilotEnabled: true
}
```

**Routing Confirmation (Destination Charge):**
```
transfer_data.destination = acct_xxx
application_fee_amount = platformFeeCents
on_behalf_of = acct_xxx
transfer_group = ride_<rideId>
```

**Skipped Routing Logs:**
```
[customerConfirmPayment] ⏭️  Skipping Connect routing: {
  driverId: "abc123",
  pilotEnabled: false,  // ← Pilot not enabled
  status: "active",
  hasAccount: true
}
```

**Admin Logs:**
```javascript
{
  action: "enable_connect_pilot",
  adminUid: "admin123",
  adminEmail: "admin@example.com",
  details: {
    driverId: "driver123",
    enabled: true,
    stripeConnectAccountId: "acct_xxx"
  }
}
```

### Verification Checklist (Test Mode)

Use this after enabling pilot and updating functions:

1. **Enable pilot** for the driver in Admin → Drivers.
2. **Create a fresh test ride** and complete it end-to-end.
3. **Check function logs** for:
   - “routing to connect”
   - “pilot enabled”
   - “destination acct_…”
4. **Stripe test dashboard** → PaymentIntent shows:
   - “Transferred to acct_…”
5. **Connected account balance** increases in TEST mode.

If any step fails, re-check:
- `enableStripeConnect` flag
- `connectEnabledOverride` on driver
- `stripeConnectStatus_test = 'active'`
- `stripeConnectAccountId_test` present

## 6) Production guardrails (avoid shipping dev behavior)

1. **Hard-block dev simulation in live**
  - Ensure any emulator-only helpers are guarded by emulator checks.

2. **HTTPS-only return URLs in live**
  - Production must always use HTTPS for `return_url` and `refresh_url`.

3. **Never mix test and live keys**
  - Live: `sk_live_...` only
  - Test: `sk_test_...` only
  - Backend enforces this via strict key prefix checks.

## 7) Webhook reliability

- **Webhook endpoint + signing secret** must match environment.
- Events are stored in `stripeEvents` to dedupe replays (idempotent handling).
- Failure events are logged to `adminLogs` (transfer/payout failures).

## 8) Reconciliation + monitoring

- **Payments Audit** view in Admin Dashboard shows:
  - `rideId → paymentIntentId → transferId → payoutId` (when available)
- A scheduled job flags **captured payments missing transfers** and logs alerts.
- Webhook handlers update `connectTransferId` and `connectTransferStatus`.

## 9) Failure path polish

- **Cancel flow**: if payment is authorized but ride is cancelled, auth is released.
- **Refunds/Disputes**: decide whether platform or driver absorbs these and align Stripe settings accordingly.

## 10) Pilot rollout (live)

- Onboard 1–2 real drivers in LIVE.
- Enable pilot per driver.
- Run tiny test rides ($1–$5) and verify:
  - transfer lands correctly
  - fees match expectations
  - receipts/logging look clean

## Money Flow Architecture

### Without Connect (Flag OFF)
```
Customer → Stripe → Platform Account
             ↓
        Manual transfers to drivers
```

### With Connect (Flag ON + Status Active)
```
Customer → Stripe → Platform Account
             ↓ (automatic split)
          Driver Connect Account
```

**Platform Fee:** Configurable per ride, currently $1.50 default
**Transfer:** Automatic via `application_fee_amount` or destination charges

## Common Issues

### Issue: "Feature coming soon!" error
**Cause:** `enableStripeConnect` flag is OFF
**Fix:** Set flag to `true` in `config/runtimeFlags`

### Issue: Status stays "pending" after onboarding
**Cause:** Webhook not firing or not configured
**Fix:** 
1. Check Stripe webhook logs
2. Verify webhook secret configured in Functions
3. Manually trigger `account.updated` webhook

### Issue: Button says "Set Up Payouts" but account exists
**Cause:** Status not synced from Stripe
**Fix:** Call `getConnectStatus()` function to refresh

### Issue: Onboarding link expired
**Cause:** Links expire after 1 hour
**Fix:** Generate new link by clicking button again

## Security Considerations

1. **Function Auth:** All Connect functions require authentication
2. **Flag Gating:** Functions check `enableStripeConnect` flag
3. **Account Ownership:** Functions verify driver doc exists before creating account
4. **Webhook Verification:** Signature verified on all webhooks
5. **Admin Only:** Connect account management restricted to admins

## Next Steps (Task A2.5)

1. Add `connectEnabledOverride` field to driver schema
2. Add admin UI to toggle override per driver
3. Update payment capture logic to check override
4. Test with 1-2 pilot drivers
5. Monitor Stripe Dashboard for transfers
6. Scale to all drivers when verified

## Quick Start Guide

### For First Pilot Driver

1. **Enable Global Flag** (one-time setup):
   ```javascript
   // In Firestore: config/runtimeFlags
   { enableStripeConnect: true }
   ```

2. **Driver Onboards** (driver app):
   - Driver opens Wallet
   - Clicks "Set Up Payouts"
   - Completes Stripe Express onboarding
   - Status updates to `active` via webhook

3. **Admin Enables Pilot** (admin dashboard):
   - Go to Drivers list
   - Find driver with "💸 Payouts Active" badge
   - Click "🧪 Enable Pilot" button
   - Confirms driver is ready for Connect routing

4. **Complete Test Ride**:
   - Request ride with pilot driver
   - Complete ride as normal
   - Check Functions logs for "✅ CONNECT ROUTING"
   - Verify transfer in Stripe Dashboard

5. **Scale Up**:
   - Enable more drivers using same process
   - Monitor for errors/issues
   - When confident, scale to all drivers

## Resources

- [Stripe Connect Express Documentation](https://stripe.com/docs/connect/express-accounts)
- [Stripe Account Links API](https://stripe.com/docs/api/account_links)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- Cloud Functions: `/functions/src/connect.ts`
- Webhooks: `/functions/src/webhooks/stripe.ts`
- Driver UI: `/packages/driver-app/src/components/Wallet.tsx`
- Admin UI: `/packages/admin-dashboard/src/components/Drivers.tsx`
