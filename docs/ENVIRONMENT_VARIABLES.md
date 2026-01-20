# Environment Variables Reference

## Overview

ShiftX uses environment variables for configuration across all packages. This document lists all required and optional environment variables for each component.

---

## Customer App (`packages/customer-app`)

### File: `.env` or `.env.local`

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY_TEST=pk_test_xxxxx
VITE_STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_xxxxx

# Feature Flags (optional)
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=false

# API Configuration (optional)
VITE_FUNCTIONS_REGION=us-central1
```

### Environment-Specific Files

- `.env.development` - Development configuration
- `.env.production` - Production configuration
- `.env.local.example` - Template for local development

### Required vs Optional

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_FIREBASE_*` | ✅ Yes | None | Firebase project credentials |
| `VITE_STRIPE_PUBLISHABLE_KEY_TEST` | ✅ Yes | None | Stripe test mode public key |
| `VITE_STRIPE_PUBLISHABLE_KEY_LIVE` | ⚠️ Production | None | Stripe live mode public key |
| `VITE_ENABLE_ANALYTICS` | ❌ No | `false` | Enable Firebase Analytics |
| `VITE_ENABLE_DEBUG` | ❌ No | `false` | Enable debug logging |

---

## Driver App (`packages/driver-app`)

### File: `.env` or `.env.local`

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Mapbox Configuration
VITE_MAPBOX_ACCESS_TOKEN=pk.xxxxx

# Capacitor Configuration (for iOS builds)
VITE_APP_ID=com.shiftx.driver
VITE_APP_NAME=ShiftX Driver

# Feature Flags
VITE_ENABLE_GPS_TRACKING=true
VITE_GPS_UPDATE_INTERVAL=5000
VITE_GPS_DISTANCE_THRESHOLD=20
```

### iOS-Specific Configuration

For Capacitor iOS builds, also configure:
- `packages/driver-app/capacitor.config.ts`
- `packages/driver-app/ios/App/App/Info.plist` (location permissions)

### Required vs Optional

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_FIREBASE_*` | ✅ Yes | None | Firebase project credentials |
| `VITE_MAPBOX_ACCESS_TOKEN` | ✅ Yes | None | Mapbox API token for navigation |
| `VITE_ENABLE_GPS_TRACKING` | ❌ No | `true` | Enable GPS heartbeat |
| `VITE_GPS_UPDATE_INTERVAL` | ❌ No | `5000` | GPS update interval (ms) |

---

## Admin Dashboard (`packages/admin-dashboard`)

### File: `.env` or `.env.local`

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef

# Admin Configuration
VITE_ADMIN_CHECK_INTERVAL=30000
VITE_ENABLE_ADMIN_LOGS=true
```

### Required vs Optional

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_FIREBASE_*` | ✅ Yes | None | Firebase project credentials |
| `VITE_ADMIN_CHECK_INTERVAL` | ❌ No | `30000` | Admin status check interval (ms) |
| `VITE_ENABLE_ADMIN_LOGS` | ❌ No | `true` | Log admin actions |

---

## Cloud Functions (`functions/`)

### File: `.env`

**Note:** Cloud Functions use Firebase Secret Manager for sensitive values in production. Local `.env` is for emulator development only.

```bash
# Stripe Configuration
STRIPE_SECRET_KEY_TEST=sk_test_xxxxx
STRIPE_SECRET_KEY_LIVE=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET_TEST=whsec_xxxxx
STRIPE_WEBHOOK_SECRET_LIVE=whsec_xxxxx

# Environment
FUNCTIONS_EMULATOR=false
NODE_ENV=development

# Feature Flags
ENABLE_STRIPE_CONNECT=true
ALLOW_LIVE_PAYMENTS=false
```

### Production Secrets

In production, these are stored in Firebase Secret Manager:
```bash
# Set production secrets
firebase functions:secrets:set STRIPE_SECRET_KEY_LIVE
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET_LIVE
```

Access in functions:
```typescript
import { defineSecret } from 'firebase-functions/params';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY_LIVE');

export const myFunction = onCall(
  { secrets: [stripeSecretKey] },
  async (request) => {
    const key = stripeSecretKey.value();
    // Use key...
  }
);
```

### Required vs Optional

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY_TEST` | ✅ Yes | None | Stripe test mode secret key |
| `STRIPE_SECRET_KEY_LIVE` | ⚠️ Production | None | Stripe live mode secret key |
| `STRIPE_WEBHOOK_SECRET_TEST` | ✅ Yes | None | Stripe test webhook signing secret |
| `STRIPE_WEBHOOK_SECRET_LIVE` | ⚠️ Production | None | Stripe live webhook signing secret |
| `ENABLE_STRIPE_CONNECT` | ❌ No | `true` | Enable driver payouts |
| `ALLOW_LIVE_PAYMENTS` | ❌ No | `false` | Allow live Stripe charges |

---

## Shared Configuration

### Firebase Project Setup

All packages share the same Firebase project configuration. Get these values from:
1. Firebase Console → Project Settings → General
2. Scroll to "Your apps" section
3. Select your web app
4. Copy configuration values

### Stripe Keys

Get Stripe keys from:
1. [Stripe Dashboard](https://dashboard.stripe.com)
2. Developers → API Keys
3. Use **test mode** keys for development
4. Use **live mode** keys for production

**Test Mode:**
- Publishable: `pk_test_xxxxx`
- Secret: `sk_test_xxxxx`

**Live Mode:**
- Publishable: `pk_live_xxxxx`
- Secret: `sk_live_xxxxx`

### Webhook Secrets

Configure webhooks:
1. Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-functions-url/stripeWebhook`
3. Select events: `payment_intent.*`, `setup_intent.*`, `transfer.*`, `account.*`
4. Copy signing secret

---

## Security Best Practices

### 1. Never Commit Secrets

✅ **Do:**
- Use `.env.example` files as templates
- Add `.env` to `.gitignore`
- Use Firebase Secret Manager in production

❌ **Don't:**
- Commit `.env` files with real keys
- Hardcode API keys in source code
- Share secrets via Slack/email

### 2. Use Environment-Specific Keys

| Environment | Stripe Keys | Firebase Project |
|-------------|-------------|------------------|
| Local Dev | Test mode | Development project |
| Staging | Test mode | Staging project |
| Production | Live mode | Production project |

### 3. Rotate Keys Regularly

- Rotate Stripe keys every 90 days
- Rotate webhook secrets if compromised
- Update Firebase API keys if exposed

### 4. Limit Key Permissions

- Use restricted API keys when possible
- Limit Firebase API key to specific domains
- Use Stripe restricted keys for specific operations

---

## Environment Detection

### Frontend (Vite)

```typescript
// Detect environment
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;
const mode = import.meta.env.MODE; // 'development' | 'production'

// Access variables
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
```

### Backend (Functions)

```typescript
// Detect environment
const isDev = process.env.NODE_ENV === 'development';
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

// Access variables
const stripeKey = process.env.STRIPE_SECRET_KEY_TEST;
```

---

## Template Files

### `.env.example` for Customer App

```bash
# Firebase Configuration (get from Firebase Console)
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Stripe (get from Stripe Dashboard)
VITE_STRIPE_PUBLISHABLE_KEY_TEST=pk_test_xxxxx
# VITE_STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_xxxxx # Uncomment for production

# Optional Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=true
```

### `.env.example` for Functions

```bash
# Stripe Test Mode (for local development)
STRIPE_SECRET_KEY_TEST=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET_TEST=whsec_xxxxx

# Production keys should be stored in Firebase Secret Manager
# STRIPE_SECRET_KEY_LIVE=sk_live_xxxxx
# STRIPE_WEBHOOK_SECRET_LIVE=whsec_xxxxx

# Environment
FUNCTIONS_EMULATOR=true
NODE_ENV=development

# Feature Flags
ENABLE_STRIPE_CONNECT=true
ALLOW_LIVE_PAYMENTS=false
```

---

## Troubleshooting

### Issue: Firebase app not initialized

**Cause:** Missing or incorrect Firebase config variables

**Solution:**
```bash
# Check all VITE_FIREBASE_* variables are set
echo $VITE_FIREBASE_API_KEY
echo $VITE_FIREBASE_PROJECT_ID

# Copy from .env.example
cp .env.example .env
# Edit .env with real values
```

### Issue: Stripe publishable key invalid

**Cause:** Using wrong mode key or expired key

**Solution:**
- Check you're using `pk_test_*` in development
- Verify key is active in Stripe Dashboard
- Check for typos in `.env` file

### Issue: Functions can't access secrets

**Cause:** Secrets not deployed to Secret Manager

**Solution:**
```bash
# Set secrets in production
firebase functions:secrets:set STRIPE_SECRET_KEY_LIVE

# Redeploy functions
firebase deploy --only functions
```

---

## Deployment Checklist

Before deploying to production:

- [ ] All `.env` files use production values
- [ ] Stripe live mode keys are set
- [ ] Firebase production project is selected
- [ ] Secrets are stored in Firebase Secret Manager
- [ ] Webhook endpoints are configured for production URLs
- [ ] Analytics and monitoring are enabled
- [ ] Debug flags are disabled
- [ ] API keys are restricted to production domains

---

**Last Updated:** January 20, 2026
