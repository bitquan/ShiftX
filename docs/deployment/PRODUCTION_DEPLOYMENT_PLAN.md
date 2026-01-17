# ShiftX Production Deployment Plan (Web + Backend + iOS)

**Goal:** safe production rollout with strict environment controls and payment safety.

---

## 1) Environment Lockdown (Required)

### Payment mode gate (backend enforced)

- **Default mode = TEST** unless `STRIPE_MODE=live` is explicitly set.
- **LIVE is blocked** unless:
  - `config/runtimeFlags.allowLivePayments = true`
  - UID is in `config/runtimeFlags.livePaymentPilotUids` (customer or driver)

This prevents accidental live charges outside a pilot whitelist.

### Keys

- **Dev/Emulator**: `sk_test_...` only
- **Prod (live)**: `sk_live_...` only
- Hard fail if a key/mode mismatch is detected.

### Return URLs (Connect)

- **Non-emulator** must be **HTTPS**.
- No localhost URLs in production.

---

## 2) Web Deploy (Customer + Driver + Admin)

### Build

```
cd packages/customer-app && npm run build
cd ../driver-app && npm run build
cd ../admin-dashboard && npm run build
```

### Deploy Hosting

```
firebase deploy --only hosting:customer
firebase deploy --only hosting:driver
firebase deploy --only hosting:admin
```

### Verify

- Admin logs in and can see drivers/flags
- Customer → request ride
- Driver → accept/start/complete

### Release build hardening

- Debug panels and dev tools are disabled in production builds.
- Remove any debug URLs/routes before release.

---

## 3) Backend Deploy (Functions + Rules)

### Build + Deploy

```
cd functions && npm run build
firebase deploy --only functions
```

### Firestore rules & indexes

```
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

---

## 4) Stripe LIVE Configuration

### Required

- **Webhook endpoint** (LIVE): `/stripeWebhook`
- **Signing secret** set in Secret Manager:
  - `STRIPE_WEBHOOK_SECRET_LIVE`
- **Connect enabled** and **capabilities**:
  - `card_payments`
  - `transfers`

### Verify

- Webhook logs show “Verified with LIVE secret”
- `account.updated` webhooks set Connect status to active

---

## 5) Firebase Project Separation

Create separate Firebase projects and configs:

- **dev** (emulators)
- **staging** (optional)
- **prod**

Add environment-specific config files for web:

- `.env.development`
- `.env.staging`
- `.env.production`

---

## 6) iOS Deployment (TestFlight + App Store Connect)

### Build flavors

- Create **dev/staging/prod** build configurations in Xcode
- Bundle IDs per environment (e.g. `com.shiftx.app.dev`, `com.shiftx.app`, etc.)

### TestFlight Steps

1. Archive build in Xcode (Prod configuration)
2. Upload to App Store Connect
3. Add internal testers
4. Verify build installs and can authenticate

### Required iOS Permissions (Info.plist)

Add the following strings:

- `NSLocationWhenInUseUsageDescription`
  - “We use your location to match you with nearby drivers and provide live trip tracking.”
- `NSLocationAlwaysAndWhenInUseUsageDescription`
  - “We use your location to support active rides and navigation, even in the background.”
- `NSLocationAlwaysUsageDescription` (if background location is enabled)
  - “We use your location to support active rides and navigation.”
- If using background mode: enable **Location updates** under **Background Modes**.

---

## 7) Pilot Rollout (LIVE)

1. Add pilot UIDs to `livePaymentPilotUids`.
2. Set `allowLivePayments=true`.
3. Onboard 1–2 real drivers.
4. Run $1–$5 live rides.
5. Verify:
   - Payment succeeds
   - Transfer hits connected account
   - Fees match expectations

---

## 8) Post-Deploy Monitoring

- Admin “Payments Audit” view
- Webhook event logs stored in `stripeEvents`
- Alerts in `adminLogs` for:
  - transfer failed
  - payout failed
  - captured payment with missing transfer

---

## 9) Rollback

If issues arise:

1. Set `allowLivePayments=false`
2. Remove UIDs from `livePaymentPilotUids`
3. Redeploy functions if needed
