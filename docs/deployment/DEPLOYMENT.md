# ShiftX Deployment Guide

## Prerequisites

1. **Firebase Project Setup**
   - Create or select a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Note your project ID (e.g., `shiftx-95c4b`)
   - Enable Authentication, Firestore, and Functions

2. **Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

3. **Stripe Account**
   - Create account at [Stripe Dashboard](https://dashboard.stripe.com)
   - Get API keys (use test mode for now)

## Environment Configuration

### 1. Customer App (.env)

Create/update `packages/customer-app/.env`:

```env
VITE_MAPBOX_TOKEN=your_mapbox_token
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
```

### 2. Driver App (.env)

Create/update `packages/driver-app/.env`:

```env
VITE_MAPBOX_TOKEN=your_mapbox_token
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### 3. Firebase Functions Secrets

Set Stripe secret key (server-side):

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
# Enter your sk_test_... key when prompted
```

Or use environment config:

```bash
firebase functions:config:set stripe.secret_key="sk_test_your_key"
```

## Firebase Hosting Setup

### Create Hosting Sites

You need two Firebase Hosting sites (one for customer, one for driver):

1. Go to [Firebase Console](https://console.firebase.google.com) > Hosting
2. Click "Add another site"
3. Create site: `shiftx-customer` (or your-project-customer)
4. Create site: `shiftx-driver` (or your-project-driver)

### Configure .firebaserc

Update `.firebaserc` with your actual site names:

```json
{
  "projects": {
    "default": "your-project-id"
  },
  "targets": {
    "your-project-id": {
      "hosting": {
        "customer": ["your-project-customer"],
        "driver": ["your-project-driver"]
      }
    }
  }
}
```

## Deployment Steps

### Initial Deployment (Everything)

```bash
# 1. Build all apps
npm run build:all

# 2. Deploy everything
npm run deploy:all
```

### Incremental Deployments

**Deploy Customer App Only:**
```bash
npm run build:customer
npm run deploy:customer
```

**Deploy Driver App Only:**
```bash
npm run build:driver
npm run deploy:driver
```

**Deploy Functions Only:**
```bash
npm run build:functions
npm run deploy:functions
```

**Deploy Firestore Rules:**
```bash
npm run deploy:rules
```

**Deploy Firestore Indexes:**
```bash
npm run deploy:indexes
```

## Post-Deployment

### 1. Verify Hosting URLs

After deployment, Firebase will show your hosting URLs:
- Customer: `https://shiftx-customer.web.app`
- Driver: `https://shiftx-driver.web.app`

### 2. Test Production Build Locally

Before deploying, test production builds:

```bash
# Build customer app
cd packages/customer-app
npm run build
npm run preview  # Vite preview on http://localhost:4173

# Build driver app
cd packages/driver-app
npm run build
npm run preview
```

### 3. Configure Stripe Webhooks (Future)

When you need webhook support:
1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://your-region-your-project.cloudfunctions.net/stripeWebhook`
3. Select events: `payment_intent.succeeded`, `payment_intent.canceled`

## Firestore Security Rules

Rules are automatically deployed with `deploy:all` or `deploy:rules`.

Verify rules in Firebase Console > Firestore > Rules.

## Troubleshooting

### Build Fails

**Check environment variables:**
```bash
# In each app directory
cat .env
```

**Check for TypeScript errors:**
```bash
cd packages/customer-app && npm run build
cd packages/driver-app && npm run build
cd functions && npm run build
```

### Functions Not Working

**Check secrets are set:**
```bash
firebase functions:secrets:access STRIPE_SECRET_KEY
```

**Check function logs:**
```bash
firebase functions:log
```

### Emulator Still Connecting in Production

Make sure you're building with production mode:
```bash
NODE_ENV=production npm run build:all
```

The apps check `import.meta.env.DEV` and only connect to emulators when it's `true`.

## Security Checklist

Before production:

- [ ] Remove all demo/test API keys from code
- [ ] Set proper Firebase security rules
- [ ] Enable App Check (optional but recommended)
- [ ] Set up Stripe webhook endpoint
- [ ] Configure CORS for your domains
- [ ] Review Functions secrets
- [ ] Enable Firebase Authentication email verification (optional)
- [ ] Set up monitoring/alerts

## Monitoring

View logs and metrics:

**Functions:**
```bash
firebase functions:log
# Or in Firebase Console > Functions > Logs
```

**Hosting:**
- Firebase Console > Hosting > Dashboard

**Firestore:**
- Firebase Console > Firestore > Usage

## Rollback

If something goes wrong:

```bash
# Rollback hosting
firebase hosting:clone SOURCE_SITE_ID:VERSION_ID TARGET_SITE_ID

# Rollback functions
# (manually redeploy previous version)
```

## Cost Estimation

With current setup on Firebase's free tier (Spark Plan):

- **Hosting**: Free for first 10GB/month
- **Functions**: Free for first 2M invocations/month
- **Firestore**: Free for 50K reads, 20K writes, 20K deletes per day
- **Authentication**: Free for unlimited users

For production usage, consider upgrading to Blaze Plan (pay-as-you-go).

## Next Steps

1. Set up CI/CD (GitHub Actions)
2. Configure custom domains
3. Enable PWA features (manifest, service worker)
4. Set up monitoring alerts
5. Plan for Stripe live mode transition
