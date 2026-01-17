# ShiftX Developer Onboarding

This guide gets a new developer productive quickly while preventing common misconfigurations (especially around Firebase emulators and Stripe mode). Follow in order.

---

## 1) Prerequisites

- Node.js 18+ (LTS)
- Firebase CLI (`npm install -g firebase-tools`)
- Java (for Firestore emulator): `brew install --cask temurin`

---

## 2) Install dependencies

From repo root:

- Root: `npm install`
- Apps:
  - `packages/customer-app` → `npm install`
  - `packages/driver-app` → `npm install`
  - `packages/admin-dashboard` → `npm install`
- Functions:
  - `functions` → `npm install`

---

## 3) Environment and secrets

### Firebase emulators (local)
Create `functions/.env.local` with **test** keys only:
```
STRIPE_SECRET_KEY_TEST=sk_test_...
STRIPE_SECRET_KEY=sk_test_...   # optional fallback
```

### Deployed test mode (non-emulator)
If you deploy to a staging project with **test mode**:
- Set Secret Manager `STRIPE_SECRET_KEY_TEST`
- Set `STRIPE_MODE=test`

**Never** use live keys in test mode. The backend hard-fails on key/mode mismatch.

---

## 4) Run local services

Use VS Code tasks or run manually:

- **Firebase emulators**: Auth + Functions + Firestore
- **Customer app**: `packages/customer-app`
- **Driver app**: `packages/driver-app`
- **Admin dashboard**: `packages/admin-dashboard`

Ports (default):
- Customer: 5173
- Driver: 4173
- Admin: 5175
- Functions emulator: 5002
- Firestore emulator: 8081
- Auth emulator: 9099

---

## 5) Create a dev admin (optional)

The repo includes a helper script for admin setup when using emulators.

---

## 6) Stripe Connect checklist (test mode)

1. `config/runtimeFlags.enableStripeConnect = true`
2. Driver has Connect account in **test** mode (`stripeConnectAccountId_test`)
3. Driver has `stripeConnectStatus_test = 'active'`
4. Driver has `connectEnabledOverride = true`
5. Payment logs show: **"✅ Using Stripe Connect for pilot driver"**

Connect routing uses destination charges (transfer_data + application_fee_amount + on_behalf_of). A fallback transfer is created after capture if routing wasn’t attached at creation.

---

## 7) Smoke test flow (high-level)

1. Customer requests ride
2. Driver accepts
3. Customer authorizes payment
4. Driver completes ride
5. Verify payment captured + transfer routed

---

## 8) Common pitfalls

- Using live Stripe keys in test mode (blocked by strict checks)
- Emulator not connected in the client (leads to live data)
- Missing `enableStripeConnect` flag or `connectEnabledOverride`

---

## 9) Helpful docs

- [docs/DEVELOPMENT.md](DEVELOPMENT.md)
- [docs/SETUP.md](SETUP.md)
- [docs/STRIPE_CONNECT_SETUP.md](STRIPE_CONNECT_SETUP.md)
- [docs/deployment/STRIPE_SETUP.md](deployment/STRIPE_SETUP.md)
