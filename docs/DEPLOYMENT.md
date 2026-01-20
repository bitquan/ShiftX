# ShiftX Deployment Guide

**Last Updated:** January 20, 2026  
**Version:** 2.0  
**Status:** Production Ready ✅

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Web Deployment (Firebase Hosting)](#web-deployment-firebase-hosting)
4. [iOS Deployment (Capacitor)](#ios-deployment-capacitor)
5. [Cloud Functions Deployment](#cloud-functions-deployment)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Pre-Deployment Checklist](#pre-deployment-checklist)
8. [Post-Deployment Verification](#post-deployment-verification)
9. [Rollback Procedures](#rollback-procedures)
10. [Monitoring & Maintenance](#monitoring--maintenance)
11. [Troubleshooting](#troubleshooting)

---

## Overview

ShiftX is a multi-app ride-sharing platform deployed on Firebase infrastructure:

- **Customer App**: React/Vite web app (Firebase Hosting)
- **Driver App**: React/Vite web app + iOS native (Firebase Hosting + Capacitor)
- **Admin Dashboard**: React/Vite web app (Firebase Hosting)
- **Cloud Functions**: Node.js 20 serverless functions (Firebase Functions)
- **Database**: Firestore with security rules
- **Authentication**: Firebase Auth
- **Payments**: Stripe Connect with authorize-capture flow

### Production URLs

- Customer App: https://shiftx-95c4b-customer.web.app
- Driver App: https://shiftx-95c4b-driver.web.app
- Admin Dashboard: https://shiftx-95c4b-admin.web.app
- Functions: us-central1 (19 deployed)

---

## Prerequisites

### 1. Required Tools

```bash
# Node.js 20 LTS
node --version  # Should be v20.x.x

# Firebase CLI (v13.0.0+)
npm install -g firebase-tools
firebase --version

# Git
git --version

# For iOS: Xcode 15+ (macOS only)
xcodebuild -version

# For iOS: CocoaPods
pod --version
```

### 2. Firebase Access

```bash
# Login to Firebase
firebase login

# Verify project access
firebase projects:list

# Set default project
firebase use shiftx-95c4b
```

### 3. Environment Configuration

Create environment files in each package. See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for details.

**Required files:**
- `packages/customer-app/.env.production`
- `packages/driver-app/.env.production`
- `packages/admin-dashboard/.env.production`
- `functions/.env` (for local testing only)

### 4. Firebase Secret Manager

Set production secrets:

```bash
# Stripe live mode secret key
firebase functions:secrets:set STRIPE_SECRET_KEY_LIVE
# Enter: sk_live_xxxxx when prompted

# Stripe webhook secret (if using webhooks)
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET_LIVE
# Enter: whsec_xxxxx when prompted

# List all secrets
firebase functions:secrets:access STRIPE_SECRET_KEY_LIVE
```

### 5. Stripe Configuration

1. **Get API Keys**: [Stripe Dashboard](https://dashboard.stripe.com) → Developers → API Keys
2. **Configure Webhooks** (optional):
   - Endpoint: `https://us-central1-shiftx-95c4b.cloudfunctions.net/stripeWebhook`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
3. **Enable Stripe Connect** for driver payouts

---

## Web Deployment (Firebase Hosting)

### Architecture

ShiftX uses Firebase Hosting with multiple sites:

```
.firebaserc targets:
  - landing  → shiftx-95c4b (main site)
  - customer → shiftx-95c4b-customer
  - driver   → shiftx-95c4b-driver
  - admin    → shiftx-95c4b-admin
```

### Build Process

#### 1. Build All Apps

```bash
# From project root
npm run build:all
```

This runs:
- `npm run build:customer` → builds `packages/customer-app/dist`
- `npm run build:driver` → builds `packages/driver-app/dist`
- `npm run build:admin` → builds `packages/admin-dashboard/dist`
- `npm run build:functions` → builds `functions/lib`

#### 2. Build Individual Apps

```bash
# Customer app only
cd packages/customer-app
npm install
npm run build  # Output: dist/

# Driver app only
cd packages/driver-app
npm install
npm run build  # Output: dist/

# Admin dashboard only
cd packages/admin-dashboard
npm install
npm run build  # Output: dist/
```

#### 3. Production Build Configuration

**Vite environment variables** (set in `.env.production`):

```bash
# Customer App
VITE_FIREBASE_PROJECT_ID=shiftx-95c4b
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG=false

# Driver App
VITE_FIREBASE_PROJECT_ID=shiftx-95c4b
VITE_MAPBOX_ACCESS_TOKEN=pk.xxxxx
VITE_ENABLE_GPS_TRACKING=true

# Admin Dashboard
VITE_FIREBASE_PROJECT_ID=shiftx-95c4b
VITE_ADMIN_CHECK_INTERVAL=30000
```

**Build optimizations** (configured in `vite.config.ts`):

- Code splitting with React.lazy()
- Asset optimization (images, fonts)
- Cache headers for static assets (31536000s = 1 year)
- Source maps disabled in production
- Minification enabled

### Firebase Hosting Configuration

**firebase.json** hosting section:

```json
{
  "hosting": [
    {
      "target": "customer",
      "public": "packages/customer-app/dist",
      "rewrites": [
        { "source": "**", "destination": "/index.html" }
      ],
      "headers": [
        {
          "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|js|css|woff|woff2|ttf|eot)",
          "headers": [
            { "key": "Cache-Control", "value": "max-age=31536000" }
          ]
        }
      ]
    }
  ]
}
```

### Deployment Commands

#### Deploy All Hosting Sites

```bash
# Deploy all hosting targets
firebase deploy --only hosting

# With specific Firebase project
firebase deploy --only hosting --project shiftx-95c4b
```

#### Deploy Individual Sites

```bash
# Customer app
firebase deploy --only hosting:customer

# Driver app
firebase deploy --only hosting:driver

# Admin dashboard
firebase deploy --only hosting:admin
```

### Environment Switching

#### Development (Emulator)

```bash
# Start emulators
firebase emulators:start

# Apps connect to emulators via:
# - connectAuthEmulator()
# - connectFirestoreEmulator()
# - connectFunctionsEmulator()
```

#### Staging

```bash
# Use staging project
firebase use staging

# Deploy with staging env
NODE_ENV=staging npm run build:all
firebase deploy
```

#### Production

```bash
# Use production project
firebase use production

# Deploy with production env
NODE_ENV=production npm run build:all
firebase deploy --only hosting
```

### Custom Domains

#### 1. Add Custom Domain in Firebase Console

1. Go to Firebase Console → Hosting
2. Select hosting site (e.g., customer)
3. Click "Add custom domain"
4. Enter domain: `app.shiftx.com`

#### 2. Configure DNS

Add DNS records (provided by Firebase):

```
Type: A
Name: app
Value: 151.101.1.195

Type: A  
Name: app
Value: 151.101.65.195
```

#### 3. SSL Certificate

Firebase automatically provisions SSL via Let's Encrypt. Wait 24-48 hours for propagation.

#### 4. Update Environment Variables

```bash
# packages/customer-app/.env.production
VITE_APP_URL=https://app.shiftx.com

# Update CORS in functions
const allowedOrigins = [
  'https://app.shiftx.com',
  'https://driver.shiftx.com',
  // ...
];
```

### Preview Deployment

Test before production:

```bash
# Build and preview locally
npm run build:customer
cd packages/customer-app
npm run preview  # http://localhost:4173

# Preview channel (Firebase)
firebase hosting:channel:deploy preview-feature-x
# Returns: https://shiftx-95c4b-customer--preview-feature-x-abc123.web.app
```

---

## iOS Deployment (Capacitor)

### Overview

The Driver app has an iOS native wrapper using Capacitor for:
- GPS location tracking
- Push notifications
- Background processing
- Native UI components

### Prerequisites

**macOS only:**
- Xcode 15+ 
- CocoaPods
- Apple Developer Account ($99/year)
- Code signing certificates

### Build iOS App

#### 1. Install Capacitor Dependencies

```bash
cd packages/driver-app

# Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/ios

# Initialize Capacitor (if not done)
npx cap init
```

#### 2. Configure Capacitor

**capacitor.config.ts:**

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shiftx.driver',
  appName: 'ShiftX Driver',
  webDir: 'dist',
  server: {
    // Production
    url: 'https://shiftx-95c4b-driver.web.app',
    cleartext: true
  },
  ios: {
    contentInset: 'always',
    scheme: 'shiftx'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Geolocation: {
      permissions: ['location']
    }
  }
};

export default config;
```

#### 3. Build Web Assets

```bash
# Production build
npm run build

# Sync to Capacitor
npx cap sync ios
```

#### 4. Open in Xcode

```bash
# Open iOS project
npx cap open ios
```

#### 5. Configure iOS Project

**In Xcode:**

1. **Select Project** → Signing & Capabilities
   - Team: Your Apple Developer Team
   - Bundle Identifier: `com.shiftx.driver`
   - Signing Certificate: Apple Distribution

2. **Info.plist** location permissions:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>ShiftX needs your location to show nearby ride requests</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>ShiftX needs your location to track ride progress</string>

<key>UIBackgroundModes</key>
<array>
  <string>location</string>
  <string>fetch</string>
</array>
```

3. **Push Notifications**:
   - Capabilities → Push Notifications: ON
   - Capabilities → Background Modes: Remote notifications

#### 6. Build for Device

**Debug build:**

```bash
# Build in Xcode
Product → Build (⌘B)

# Run on device
Product → Run (⌘R)
```

**Release build:**

```bash
# Archive in Xcode
Product → Archive

# Organizer opens automatically
# Click "Distribute App"
```

### TestFlight Deployment

#### 1. Create App in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. My Apps → + → New App
3. Fill details:
   - Platform: iOS
   - Name: ShiftX Driver
   - Bundle ID: com.shiftx.driver
   - SKU: shiftx-driver
   - User Access: Full Access

#### 2. Archive and Upload

**In Xcode:**

1. Product → Archive
2. Organizer → Archives → Select archive → Distribute App
3. Select: App Store Connect
4. Upload options:
   - ✅ Include bitcode
   - ✅ Upload symbols
   - ✅ Manage version and build number
5. Click Upload

**Wait 5-10 minutes for processing**

#### 3. Configure TestFlight

1. App Store Connect → TestFlight
2. Select build
3. Add Internal Testers:
   - Click "+" 
   - Add by email
   - Automatic distribution ON
4. Add External Testers:
   - Create group
   - Add testers
   - Submit for review (required for external)

#### 4. Beta Testing

**Testers receive email** with TestFlight link:
1. Install TestFlight app
2. Open invite link
3. Install beta app
4. Provide feedback via TestFlight

**Monitor feedback:**
- App Store Connect → TestFlight → Feedback
- Crash logs in Xcode → Organizer → Crashes

### App Store Submission

#### 1. Prepare App Store Listing

**Required assets:**
- App icon (1024x1024px)
- Screenshots (iPhone 14 Pro Max, iPad Pro)
- App preview video (optional)
- Privacy policy URL
- Support URL

**In App Store Connect:**
1. My Apps → ShiftX Driver
2. App Store tab
3. Fill all sections:
   - Name: ShiftX Driver
   - Subtitle: Earn money delivering rides
   - Description: Full description with features
   - Keywords: ride,driver,earn,money,gig
   - Category: Travel

#### 2. Submit for Review

1. Select build from TestFlight
2. Complete all sections (marked with ⚠️)
3. Answer review questions:
   - Demo account credentials
   - Notes for review
4. Click "Submit for Review"

**Review timeline:** 24-48 hours typically

#### 3. App Review Response

**If approved:**
- Choose release timing (manual/automatic)
- App goes live on App Store

**If rejected:**
- Read rejection reason
- Fix issues
- Submit new build
- Respond in Resolution Center

### Code Signing & Certificates

#### 1. Create Certificates

**Development Certificate:**

```bash
# Generate CSR (Certificate Signing Request)
# Keychain Access → Certificate Assistant → Request from CA
# Email: your@email.com
# Common Name: Your Name
# Save to disk

# Upload CSR to Apple Developer Portal
# Certificates → + → iOS App Development
# Download certificate → Install
```

**Distribution Certificate:**

```bash
# Same process but select:
# Certificates → + → App Store and Ad Hoc
```

#### 2. Register Device (for development)

```bash
# Get device UDID
# Xcode → Window → Devices and Simulators
# Select device → Copy identifier

# Apple Developer Portal
# Devices → + → Register New Device
# Enter UDID and name
```

#### 3. Create App ID

```bash
# Apple Developer Portal
# Identifiers → + → App IDs
# Bundle ID: com.shiftx.driver
# Capabilities: Push Notifications, Background Modes
```

#### 4. Create Provisioning Profiles

**Development Profile:**
- Certificates → Your Dev Certificate
- App ID → com.shiftx.driver
- Devices → Select test devices
- Download and install

**Distribution Profile:**
- Certificates → Your Distribution Certificate
- App ID → com.shiftx.driver
- Download and install

#### 5. Configure Xcode

**Automatic signing (recommended):**
- Signing & Capabilities → Automatically manage signing
- Team: Select team
- Xcode handles profiles automatically

**Manual signing:**
- Signing & Capabilities → Manually manage signing
- Provisioning Profile: Select profile
- Signing Certificate: Select certificate

### iOS Update Workflow

**For app updates:**

1. **Update version:**

```bash
# Edit package.json
"version": "1.0.1"

# Or in Xcode: General → Version/Build
```

2. **Build and test:**

```bash
cd packages/driver-app
npm run build
npx cap sync ios
npx cap open ios
# Test in simulator and device
```

3. **Archive and upload:**
- Product → Archive
- Distribute to App Store Connect

4. **Submit update:**
- App Store Connect → Select app
- + Version → What's New
- Select new build
- Submit for Review

### Native Plugin Development

**Add native functionality:**

```bash
# Install plugin
npm install @capacitor/geolocation

# Sync to native projects
npx cap sync
```

**Custom native code:**

```swift
// ios/App/App/Plugins/MyPlugin.swift
import Capacitor

@objc(MyPlugin)
public class MyPlugin: CAPPlugin {
  @objc func doSomething(_ call: CAPPluginCall) {
    let value = call.getString("value") ?? ""
    call.resolve(["result": value])
  }
}
```

**Register plugin:**

```typescript
// capacitor.config.ts
{
  plugins: {
    MyPlugin: {
      // config
    }
  }
}
```

---

## Cloud Functions Deployment

### Overview

ShiftX uses Firebase Cloud Functions (2nd gen) for:
- Ride lifecycle management (19 functions)
- Payment processing (Stripe integration)
- Driver management and availability
- Real-time event tracking

### Function Architecture

**Runtime:** Node.js 20  
**Region:** us-central1  
**Memory:** 512MB (default), 1GB (payment functions)  
**Timeout:** 60s (default), 300s (batch operations)

### Build Functions

#### 1. Install Dependencies

```bash
cd functions
npm install
```

#### 2. Build TypeScript

```bash
# Compile TypeScript to JavaScript
npm run build

# Output: functions/lib/
# Entry: functions/lib/index.js
```

#### 3. Run Tests (Optional)

```bash
# Unit tests with emulators
npm test

# Or full test suite
firebase emulators:start --only functions,firestore
npm run test:functions
```

### Deployment Commands

#### Deploy All Functions

```bash
# From project root
firebase deploy --only functions

# With specific project
firebase deploy --only functions --project shiftx-95c4b
```

#### Deploy Individual Functions

```bash
# Single function
firebase deploy --only functions:tripRequest

# Multiple functions
firebase deploy --only functions:acceptRide,functions:startRide,functions:completeRide

# Function group (all ride functions)
firebase deploy --only functions:rides
```

#### Deploy with Secrets

```bash
# Functions using secrets must have them set first
firebase functions:secrets:set STRIPE_SECRET_KEY_LIVE

# Deploy functions that use the secret
firebase deploy --only functions:customerConfirmPayment
```

### Secret Management

#### Firebase Secret Manager (Production)

**Set secrets:**

```bash
# Interactive input
firebase functions:secrets:set STRIPE_SECRET_KEY_LIVE
# Enter value when prompted

# From environment variable
echo $STRIPE_KEY | firebase functions:secrets:set STRIPE_SECRET_KEY_LIVE

# From file
cat stripe_key.txt | firebase functions:secrets:set STRIPE_SECRET_KEY_LIVE
```

**Access in functions:**

```typescript
import { defineSecret } from 'firebase-functions/params';

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY_LIVE');

export const createPayment = onCall(
  {
    region: 'us-central1',
    secrets: [stripeSecretKey]
  },
  async (request) => {
    const stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: '2023-10-16'
    });
    // Use stripe...
  }
);
```

**List secrets:**

```bash
# List all secrets
firebase functions:secrets:list

# Get secret value (requires permissions)
firebase functions:secrets:access STRIPE_SECRET_KEY_LIVE
```

**Update secrets:**

```bash
# Update existing secret
firebase functions:secrets:set STRIPE_SECRET_KEY_LIVE
# Enter new value

# Redeploy functions that use it
firebase deploy --only functions
```

**Delete secrets:**

```bash
firebase functions:secrets:destroy STRIPE_SECRET_KEY_LIVE
```

#### Environment Variables (Legacy)

**For non-sensitive config:**

```bash
# Set config
firebase functions:config:set stripe.connect_enabled=true

# Get config
firebase functions:config:get

# Use in functions
import { config } from 'firebase-functions';
const enabled = config().stripe.connect_enabled;
```

### Function Configuration

#### Memory and Timeout

```typescript
// functions/src/rides.ts
export const completeRide = onCall(
  {
    region: 'us-central1',
    memory: '1GB',
    timeoutSeconds: 120,
    secrets: [stripeSecretKey]
  },
  async (request) => {
    // Long-running payment capture
  }
);
```

#### CORS Configuration

```typescript
// Allow multiple origins
const allowedOrigins = [
  'https://shiftx-95c4b-customer.web.app',
  'https://shiftx-95c4b-driver.web.app',
  'https://app.shiftx.com', // custom domain
  'http://localhost:5173' // development
];

export const myFunction = onCall(
  {
    region: 'us-central1',
    cors: allowedOrigins
  },
  async (request) => {
    // Handle request
  }
);
```

#### Retry Configuration

```typescript
// For idempotent operations
export const processPayment = onCall(
  {
    region: 'us-central1',
    retry: true // Auto-retry on failure
  },
  async (request) => {
    // Idempotent payment processing
  }
);
```

### Deployed Functions

#### Ride Lifecycle (9 functions)

- `tripRequest` - Create new ride request
- `acceptRide` - Driver accepts offer
- `declineOffer` - Driver declines offer
- `startRide` - Start ride (payment-gated)
- `progressRide` - Mark in progress
- `completeRide` - Complete and capture payment
- `cancelRide` - Cancel ride (refund if needed)
- `updateRideStatus` - Update status
- `getRideEvents` - Get event timeline

#### Driver Management (5 functions)

- `driverSetOnline` - Toggle online/offline
- `setDriverAvailability` - Set schedule
- `approveDriver` - Admin approval
- `listDrivers` - Admin list
- `getDriverLedgerSummary` - Earnings

#### Payment (3 functions)

- `customerConfirmPayment` - Create PaymentIntent
- `getPaymentState` - Get status
- `setPaymentAuthorized` - Mark authorized

#### Other (2 functions)

- `getRideHistory` - User history
- `addPaymentMethod` - Add payment method

**Known issue:** `driverHeartbeat` failed deployment (CPU quota)

### Rollback Procedures

#### Redeploy Previous Version

```bash
# 1. Checkout previous version
git log --oneline functions/
git checkout <commit-hash> -- functions/

# 2. Rebuild
cd functions
npm run build

# 3. Deploy
firebase deploy --only functions
```

#### Function-Specific Rollback

```bash
# Deploy last known good version
git show <commit>:functions/src/rides.ts > functions/src/rides.ts
cd functions && npm run build
firebase deploy --only functions:acceptRide
```

#### Emergency Disable

```bash
# Delete problematic function
firebase functions:delete functionName

# Or deploy no-op version
export const brokenFunction = onCall(async () => {
  throw new functions.https.HttpsError(
    'unavailable',
    'Function temporarily disabled'
  );
});
```

### Monitoring Functions

#### View Logs

```bash
# All functions
firebase functions:log

# Specific function
firebase functions:log --only tripRequest

# Last 100 lines
firebase functions:log --lines 100

# Follow logs (real-time)
firebase functions:log --follow
```

#### Firebase Console

https://console.firebase.google.com/project/shiftx-95c4b/functions

**Metrics:**
- Invocations per minute
- Execution time (p50, p95, p99)
- Memory usage
- Error rate
- Active instances

#### Alerting

**Set up alerts in Firebase Console:**
1. Functions → Metrics → Create Alert
2. Conditions:
   - Error rate > 5%
   - Execution time > 10s
   - Memory usage > 90%
3. Notification channels: Email, Slack, PagerDuty

### Function Development Best Practices

#### 1. Use TypeScript

```typescript
// Strong typing for request/response
interface TripRequestData {
  pickupLocation: { lat: number; lng: number };
  dropoffLocation: { lat: number; lng: number };
}

export const tripRequest = onCall<TripRequestData>(async (request) => {
  const { pickupLocation } = request.data;
  // Type-safe access
});
```

#### 2. Validate Input

```typescript
import { HttpsError } from 'firebase-functions/v2/https';

export const myFunction = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }
  
  const { value } = request.data;
  if (!value || typeof value !== 'string') {
    throw new HttpsError('invalid-argument', 'value must be string');
  }
});
```

#### 3. Handle Errors Gracefully

```typescript
export const myFunction = onCall(async (request) => {
  try {
    // Operation
    return { success: true };
  } catch (error) {
    console.error('Function error:', error);
    throw new HttpsError('internal', 'Operation failed');
  }
});
```

#### 4. Use Transactions

```typescript
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

await db.runTransaction(async (transaction) => {
  const rideRef = db.collection('rides').doc(rideId);
  const ride = await transaction.get(rideRef);
  
  if (ride.data()?.status !== 'requested') {
    throw new Error('Ride already accepted');
  }
  
  transaction.update(rideRef, { status: 'accepted' });
});
```

#### 5. Optimize Cold Starts

```typescript
// Initialize outside handler
const stripe = new Stripe(process.env.STRIPE_KEY, {
  apiVersion: '2023-10-16'
});
const db = getFirestore();

export const myFunction = onCall(async (request) => {
  // Use pre-initialized instances
  const payment = await stripe.paymentIntents.create({...});
});
```

---

## CI/CD Pipeline

### Overview

ShiftX uses GitHub Actions for automated testing and deployment.

**Workflows:**
- `ci.yml` - Build, test, and deploy on push
- Manual deployment triggers

### GitHub Actions Configuration

**Location:** `.github/workflows/ci.yml`

#### Workflow Triggers

```yaml
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  workflow_dispatch: # Manual trigger
```

#### Jobs

**1. build-and-test:**
- Setup Node.js 20, Flutter, Java 21
- Install dependencies
- Run unit tests
- Build functions
- Run emulator tests

**2. emulator-tests:**
- Start Firebase emulators
- Run Firestore rules tests
- Run functions tests
- Upload logs on failure

### Secrets Configuration

**Required GitHub Secrets:**

```bash
# Repository Settings → Secrets → Actions

FIREBASE_TOKEN          # Firebase CI token
STRIPE_SECRET_KEY_TEST  # Stripe test key (for testing)
STRIPE_PUBLISHABLE_KEY  # Stripe public key
```

**Get Firebase token:**

```bash
firebase login:ci
# Copy token
# Add to GitHub: Settings → Secrets → FIREBASE_TOKEN
```

### Automated Testing

#### Unit Tests

```yaml
- name: Run unit tests
  run: |
    flutter --version
    flutter test --coverage -r expanded
```

#### Integration Tests

```yaml
- name: Emulator tests
  run: |
    firebase emulators:start --config firebase.ci.json &
    # Wait for emulators...
    cd packages/rules-tests && npm test
    cd functions && npm run test:functions
```

### Automated Deployment

#### Deploy on Main Branch

Add to `.github/workflows/ci.yml`:

```yaml
jobs:
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [build-and-test, emulator-tests]
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: |
          cd packages/customer-app && npm install
          cd ../driver-app && npm install
          cd ../admin-dashboard && npm install
          cd ../../functions && npm install
      
      - name: Build all apps
        run: npm run build:all
        env:
          NODE_ENV: production
      
      - name: Deploy to Firebase
        run: firebase deploy --token ${{ secrets.FIREBASE_TOKEN }}
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

#### Deploy Specific Components

```yaml
- name: Deploy Functions Only
  if: contains(github.event.head_commit.message, '[functions]')
  run: firebase deploy --only functions
```

### Manual Deployment Triggers

**workflow_dispatch** for manual deployment:

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
      components:
        description: 'Components to deploy'
        required: true
        default: 'all'
        type: choice
        options:
          - all
          - hosting
          - functions

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to ${{ inputs.environment }}
        run: |
          firebase use ${{ inputs.environment }}
          
          if [ "${{ inputs.components }}" == "all" ]; then
            firebase deploy
          else
            firebase deploy --only ${{ inputs.components }}
          fi
```

**Trigger from GitHub UI:**
1. Actions tab
2. Select workflow
3. Run workflow
4. Choose environment and components

### Branch Protection Rules

**Configure in GitHub:**
1. Settings → Branches → Add rule
2. Branch name pattern: `main`
3. Rules:
   - ✅ Require pull request reviews (1)
   - ✅ Require status checks (CI tests)
   - ✅ Require branches to be up to date
   - ✅ Include administrators

### Deployment Notifications

**Slack integration:**

```yaml
- name: Notify Slack
  if: success()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "✅ Deployed to production",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "Deployment completed\nCommit: ${{ github.sha }}"
            }
          }
        ]
      }
```

### Deployment Artifacts

**Save build artifacts:**

```yaml
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: build-output
    path: |
      packages/customer-app/dist/
      packages/driver-app/dist/
      packages/admin-dashboard/dist/
      functions/lib/
    retention-days: 30
```

---

## Pre-Deployment Checklist

### Security Review

- [ ] **Authentication**: All routes require auth
- [ ] **Firestore Rules**: Tested and restrictive
- [ ] **API Keys**: No secrets in client code
- [ ] **CORS**: Only allow production domains
- [ ] **Input Validation**: All user inputs sanitized
- [ ] **Rate Limiting**: Implement for public endpoints
- [ ] **Secrets**: Stored in Firebase Secret Manager
- [ ] **HTTPS**: All endpoints use HTTPS
- [ ] **Dependencies**: No known vulnerabilities (`npm audit`)

**Run security checks:**

```bash
# Check for vulnerabilities
cd functions && npm audit
cd packages/customer-app && npm audit

# Check for secrets in code
git grep -i "sk_live_" 
git grep -i "api_key"

# Test Firestore rules
cd packages/rules-tests && npm test
```

### Performance Testing

#### 1. Lighthouse Audit

```bash
# Install Lighthouse
npm install -g lighthouse

# Audit customer app
lighthouse https://shiftx-95c4b-customer.web.app \
  --output html \
  --output-path ./lighthouse-report.html

# Target scores:
# Performance: 90+
# Accessibility: 95+
# Best Practices: 95+
# SEO: 90+
```

#### 2. Load Testing (Functions)

```bash
# Install Artillery
npm install -g artillery

# Create load test
cat > load-test.yml <<EOF
config:
  target: 'https://us-central1-shiftx-95c4b.cloudfunctions.net'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: 'Trip Request'
    flow:
      - post:
          url: '/tripRequest'
          json:
            pickupLocation: { lat: 37.7749, lng: -122.4194 }
            dropoffLocation: { lat: 37.8049, lng: -122.4094 }
EOF

# Run test
artillery run load-test.yml
```

#### 3. Bundle Size Check

```bash
# Analyze bundle
cd packages/customer-app
npm run build -- --mode analyze

# Check bundle sizes
ls -lh dist/assets/*.js

# Target: Main bundle < 500KB gzipped
```

### Environment Validation

```bash
# Check Firebase project
firebase use
# Should show: shiftx-95c4b (production)

# Verify environment files exist
test -f packages/customer-app/.env.production && echo "✅ Customer env" || echo "❌ Missing"
test -f packages/driver-app/.env.production && echo "✅ Driver env" || echo "❌ Missing"
test -f packages/admin-dashboard/.env.production && echo "✅ Admin env" || echo "❌ Missing"

# Check Stripe keys
grep -q "pk_live_" packages/customer-app/.env.production && echo "✅ Live Stripe key" || echo "❌ Test key"

# Verify secrets set
firebase functions:secrets:access STRIPE_SECRET_KEY_LIVE > /dev/null 2>&1 && echo "✅ Stripe secret" || echo "❌ Not set"
```

### Code Quality

```bash
# Run linters
cd functions && npm run lint
cd packages/customer-app && npm run lint
cd packages/driver-app && npm run lint

# Run TypeScript checks
cd functions && npm run build
cd packages/customer-app && npx tsc --noEmit
cd packages/driver-app && npx tsc --noEmit

# Run all tests
flutter test
cd functions && npm test
```

### Database

- [ ] **Indexes**: All required indexes created
- [ ] **Rules**: Deployed and tested
- [ ] **Backup**: Recent backup exists
- [ ] **Data Migration**: Completed if needed

```bash
# Deploy indexes
firebase deploy --only firestore:indexes

# Deploy rules
firebase deploy --only firestore:rules

# Export data (backup)
gcloud firestore export gs://shiftx-95c4b-backups/$(date +%Y%m%d)
```

### Documentation

- [ ] **README**: Up to date
- [ ] **CHANGELOG**: Updated with changes
- [ ] **API Docs**: Current
- [ ] **Runbooks**: Deployment procedures documented

---

## Post-Deployment Verification

### Automated Smoke Tests

```bash
# Run smoke test script
node scripts/smokeTest.js --mode prod --api-key YOUR_API_KEY

# Tests:
# ✅ Create ride request
# ✅ Driver accepts
# ✅ Payment authorization
# ✅ Start ride
# ✅ Complete ride
# ✅ Payment capture
```

### Manual Verification Checklist

#### Customer App

```bash
# Navigate to: https://shiftx-95c4b-customer.web.app

# Test flow:
- [ ] Sign up new user
- [ ] Request a ride
- [ ] See real-time timeline updates
- [ ] Add payment method
- [ ] Authorize payment
- [ ] View ride history
- [ ] Request again from history
- [ ] Sign out
```

#### Driver App

```bash
# Navigate to: https://shiftx-95c4b-driver.web.app

# Test flow:
- [ ] Sign up driver
- [ ] Complete onboarding
- [ ] Go online
- [ ] Receive ride offer
- [ ] Accept offer
- [ ] View payment status
- [ ] Start ride (after payment)
- [ ] Complete ride
- [ ] View earnings dashboard
```

#### Admin Dashboard

```bash
# Navigate to: https://shiftx-95c4b-admin.web.app

# Test flow:
- [ ] Sign in as admin
- [ ] View driver list
- [ ] Approve pending driver
- [ ] See real-time online status
- [ ] Disable driver
- [ ] View system metrics
```

### Function Health Checks

```bash
# Check all functions deployed
firebase functions:list

# Expected: 19/20 functions (driverHeartbeat known issue)

# Check function logs for errors
firebase functions:log --only acceptRide --lines 50

# Should see no errors in last 50 lines
```

### Database Verification

```bash
# Check Firestore rules deployed
firebase firestore:rules get

# Verify indexes
firebase firestore:indexes list

# Check data structure
# Firebase Console → Firestore → Data
# Verify collections: rides, users, drivers, offers
```

### Performance Checks

#### Response Times

```bash
# Test function response times
time curl -X POST https://us-central1-shiftx-95c4b.cloudfunctions.net/tripRequest \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"pickupLocation":{"lat":37.7749,"lng":-122.4194}}'

# Should complete in < 2s
```

#### Page Load Speed

```bash
# Test with curl
curl -w "@curl-format.txt" -o /dev/null -s https://shiftx-95c4b-customer.web.app

# curl-format.txt:
time_namelookup:  %{time_namelookup}\n
time_connect:     %{time_connect}\n
time_starttransfer: %{time_starttransfer}\n
time_total:       %{time_total}\n

# Target: time_total < 3s
```

### Monitoring Setup

#### Firebase Console Monitoring

1. **Hosting:**
   - Console → Hosting → Dashboard
   - Check: Requests/min, Bandwidth

2. **Functions:**
   - Console → Functions → Dashboard
   - Check: Invocations, Errors, Execution time

3. **Firestore:**
   - Console → Firestore → Usage
   - Check: Reads/writes per day

#### Set Up Alerts

**Function errors:**
```bash
# Console → Functions → Health → Create Alert
# Condition: Error rate > 5%
# Notification: Email to team@shiftx.com
```

**High latency:**
```bash
# Condition: p95 latency > 5s
# Notification: Slack #alerts
```

**Quota limits:**
```bash
# Condition: Function invocations > 80% quota
# Notification: Email to devops@shiftx.com
```

#### External Monitoring (Optional)

**Uptime Robot:**
```bash
# Add monitors:
# - https://shiftx-95c4b-customer.web.app (check every 5 min)
# - https://shiftx-95c4b-driver.web.app (check every 5 min)
# - https://shiftx-95c4b-admin.web.app (check every 5 min)
```

**Sentry:**
```typescript
// packages/customer-app/src/main.tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: 'https://...@sentry.io/...',
  environment: 'production',
  tracesSampleRate: 0.1
});
```

### Rollback Readiness

**Verify rollback capability:**

```bash
# 1. Note current versions
firebase hosting:sites:list
firebase functions:list

# 2. Test rollback procedure (don't execute)
git log --oneline -5

# 3. Document rollback commands
echo "git checkout <prev-commit> && firebase deploy" > ROLLBACK.sh
```

---

## Rollback Procedures

### When to Rollback

**Immediate rollback if:**
- Critical bug affecting all users
- Payment processing failures
- Security vulnerability
- Data corruption
- Service completely unavailable

**Monitor and decide:**
- Minor UI bugs
- Non-critical features broken
- Affecting < 5% of users
- Degraded performance

### Hosting Rollback

#### Automatic Rollback (Recommended)

```bash
# 1. List deployment versions
firebase hosting:list --site shiftx-95c4b-customer

# Output:
# Version    Deploy Time              Status
# 1a2b3c4d   2026-01-20T10:30:00Z    FINALIZED (current)
# 9e8f7g6h   2026-01-19T15:20:00Z    FINALIZED

# 2. Rollback to previous version
firebase hosting:clone shiftx-95c4b-customer:9e8f7g6h shiftx-95c4b-customer

# 3. Verify
# Visit: https://shiftx-95c4b-customer.web.app
```

#### Manual Rollback

```bash
# 1. Checkout previous version
git log --oneline packages/customer-app/
git checkout <commit-hash> -- packages/customer-app/

# 2. Rebuild
cd packages/customer-app
npm install
npm run build

# 3. Redeploy
firebase deploy --only hosting:customer

# 4. Verify deployment
firebase hosting:sites:get shiftx-95c4b-customer
```

#### Rollback All Hosting Sites

```bash
# Script for emergency rollback
cat > rollback-hosting.sh <<'EOF'
#!/bin/bash
set -e

PREVIOUS_VERSION=$1
if [ -z "$PREVIOUS_VERSION" ]; then
  echo "Usage: ./rollback-hosting.sh <version-hash>"
  exit 1
fi

echo "Rolling back all hosting sites to $PREVIOUS_VERSION"

firebase hosting:clone shiftx-95c4b-customer:$PREVIOUS_VERSION shiftx-95c4b-customer
firebase hosting:clone shiftx-95c4b-driver:$PREVIOUS_VERSION shiftx-95c4b-driver
firebase hosting:clone shiftx-95c4b-admin:$PREVIOUS_VERSION shiftx-95c4b-admin

echo "Rollback complete"
EOF

chmod +x rollback-hosting.sh

# Execute
./rollback-hosting.sh 9e8f7g6h
```

### Functions Rollback

#### Redeploy Previous Version

```bash
# 1. Find last working commit
git log --oneline functions/

# 2. Checkout that version
git checkout <commit-hash> -- functions/

# 3. Rebuild
cd functions
rm -rf node_modules lib
npm install
npm run build

# 4. Redeploy
firebase deploy --only functions

# 5. Monitor logs
firebase functions:log --follow
```

#### Function-Specific Rollback

```bash
# Rollback single function
git show <commit>:functions/src/rides.ts > functions/src/rides.ts

cd functions
npm run build
firebase deploy --only functions:acceptRide

# Verify
firebase functions:log --only acceptRide
```

#### Emergency Disable Function

```bash
# Option 1: Delete function
firebase functions:delete problemFunction

# Option 2: Deploy stub that returns error
cat > functions/src/emergency.ts <<EOF
import { onCall } from 'firebase-functions/v2/https';
import { HttpsError } from 'firebase-functions/v2/https';

export const problemFunction = onCall(async () => {
  throw new HttpsError('unavailable', 'Function temporarily disabled');
});
EOF

cd functions
npm run build
firebase deploy --only functions:problemFunction
```

### Database Rollback

#### Restore from Backup

```bash
# 1. List available backups
gsutil ls gs://shiftx-95c4b-backups/

# 2. Import backup
gcloud firestore import gs://shiftx-95c4b-backups/20260120

# 3. Wait for import to complete (check console)
# 4. Verify data integrity
```

#### Rollback Security Rules

```bash
# 1. Find previous rules
git log firestore.rules

# 2. Checkout previous version
git checkout <commit> -- firestore.rules

# 3. Deploy rules
firebase deploy --only firestore:rules

# 4. Test rules
cd packages/rules-tests && npm test
```

### Complete System Rollback

**Emergency procedure for major issues:**

```bash
#!/bin/bash
# rollback-all.sh

set -e

ROLLBACK_COMMIT=$1
if [ -z "$ROLLBACK_COMMIT" ]; then
  echo "Usage: ./rollback-all.sh <commit-hash>"
  exit 1
fi

echo "⚠️  ROLLING BACK TO $ROLLBACK_COMMIT"
read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted"
  exit 1
fi

# 1. Checkout previous version
git checkout $ROLLBACK_COMMIT

# 2. Rebuild everything
echo "Building functions..."
cd functions && npm install && npm run build
cd ..

echo "Building customer app..."
cd packages/customer-app && npm install && npm run build
cd ../..

echo "Building driver app..."
cd packages/driver-app && npm install && npm run build
cd ../..

echo "Building admin dashboard..."
cd packages/admin-dashboard && npm install && npm run build
cd ../..

# 3. Deploy everything
echo "Deploying to Firebase..."
firebase deploy

echo "✅ Rollback complete"
echo "Monitor: firebase functions:log --follow"
```

**Execute:**
```bash
chmod +x rollback-all.sh
./rollback-all.sh abc123def
```

### Rollback Verification

**After rollback, verify:**

```bash
# 1. Check versions deployed
firebase hosting:sites:list
firebase functions:list

# 2. Run smoke tests
node scripts/smokeTest.js --mode prod

# 3. Monitor logs for errors
firebase functions:log --follow

# 4. Check error rates in console
# Firebase Console → Functions → Health

# 5. User acceptance testing
# Test critical flows manually
```

### Communication During Rollback

**Notify stakeholders:**

```bash
# Slack message template:
🚨 PRODUCTION ROLLBACK IN PROGRESS

Reason: [Brief description]
Affected services: [Hosting/Functions/Database]
Expected downtime: [X minutes]
Rolling back to: [commit/version]
Status: [In Progress/Complete]
Monitoring: [Dashboard link]

Updates every 5 minutes.
```

### Post-Rollback Actions

1. **Root Cause Analysis:**
   - Identify what caused the issue
   - Document in incident report
   - Create Jira ticket for fix

2. **Fix Forward:**
   - Create hotfix branch
   - Fix issue
   - Test thoroughly
   - Deploy with extra monitoring

3. **Prevent Recurrence:**
   - Add tests for failure case
   - Update deployment checklist
   - Improve monitoring/alerts
   - Update documentation

---

## Monitoring & Maintenance

### Daily Monitoring

**Morning checklist:**

```bash
# 1. Check overnight errors
firebase functions:log --lines 100 | grep ERROR

# 2. Check hosting status
firebase hosting:sites:list

# 3. Review Firebase Console
# - Functions: Invocations, errors, latency
# - Hosting: Bandwidth, requests
# - Firestore: Read/write counts
# - Auth: New users, errors

# 4. Check external monitoring
# - Uptime Robot: All green
# - Sentry: Error count
```

### Weekly Maintenance

**Monday tasks:**

```bash
# 1. Review usage and costs
# Firebase Console → Usage and billing
# Check: Near any quotas?

# 2. Security updates
cd functions && npm audit
cd packages/customer-app && npm audit

# 3. Update dependencies (patch versions)
cd functions && npm update
npm run build && npm test

# 4. Review function performance
# Console → Functions → Metrics
# Check for: Increased latency, cold starts

# 5. Database cleanup
# Delete old test data
# Archive completed rides > 90 days
```

### Monthly Maintenance

**First of month:**

```bash
# 1. Review and optimize indexes
# Console → Firestore → Indexes
# Delete unused indexes

# 2. Analyze bundle sizes
cd packages/customer-app
npm run build -- --mode analyze

# 3. Review security rules
# Check for overly permissive rules
# Update based on new features

# 4. Backup verification
# Test restore from backup
gcloud firestore export gs://shiftx-95c4b-backups/monthly-$(date +%Y%m)

# 5. Update dependencies (minor versions)
npx npm-check-updates -u
npm install && npm test

# 6. Review error trends
# Sentry dashboard: Most common errors
# Create tickets for top 5 issues
```

### Quarterly Maintenance

**Strategic review:**

```bash
# 1. Performance audit
lighthouse https://shiftx-95c4b-customer.web.app

# 2. Security audit
npm audit fix
npm audit --production

# 3. Dependency major updates
npx npm-check-updates --target minor
# Review breaking changes
# Update one at a time

# 4. Infrastructure review
# Is current Firebase plan optimal?
# Need to upgrade for features?
# Cost optimization opportunities?

# 5. Disaster recovery test
# Full system rollback test
# Restore from backup test
# Failover procedures test
```

### Cost Optimization

**Reduce Firebase costs:**

```bash
# 1. Optimize Firestore reads
# - Use real-time listeners sparingly
# - Cache frequently accessed data
# - Batch reads when possible

# 2. Optimize function invocations
# - Combine related operations
# - Use background triggers
# - Implement client-side caching

# 3. Optimize hosting bandwidth
# - Enable compression
# - Optimize images (WebP)
# - Reduce bundle sizes

# 4. Archive old data
# - Move old rides to Cloud Storage
# - Delete temporary data
# - Implement data retention policy
```

### Scaling Considerations

**When to scale:**

**Current capacity (Free tier):**
- Functions: 2M invocations/month
- Firestore: 50K reads/day
- Hosting: 10GB bandwidth/month

**Scale up if:**
- Consistent > 80% quota usage
- Function cold starts affecting UX
- Database queries slow (> 1s)
- Hosting bandwidth near limit

**How to scale:**

```bash
# 1. Upgrade Firebase plan
# Console → Upgrade to Blaze (pay-as-you-go)

# 2. Increase function memory
# functions/src/rides.ts
export const myFunction = onCall({
  memory: '1GB', // Was: 512MB
  timeoutSeconds: 120 // Was: 60
}, ...)

# 3. Add database indexes
# Console → Firestore → Indexes
# Create composite indexes for common queries

# 4. Enable CDN for hosting
# Automatically enabled on Firebase Hosting

# 5. Optimize database structure
# Denormalize frequently accessed data
# Use subcollections for large datasets
```

---

## Troubleshooting

### Common Issues

#### 1. Build Fails

**Symptom:** `npm run build` fails

**Solutions:**

```bash
# Clear caches
rm -rf node_modules package-lock.json
npm install

# Check Node version
node --version  # Should be v20.x.x

# Check TypeScript errors
npx tsc --noEmit

# Check for missing dependencies
npm install --save-dev @types/node

# Build with verbose output
npm run build -- --verbose
```

#### 2. Deployment Hangs

**Symptom:** `firebase deploy` stuck at "uploading"

**Solutions:**

```bash
# Cancel and retry
Ctrl+C
firebase deploy --only hosting:customer

# Check Firebase CLI version
firebase --version  # Should be 13.0.0+
npm install -g firebase-tools@latest

# Clear Firebase cache
rm -rf ~/.cache/firebase

# Check network
curl -I https://firebase.google.com

# Deploy without hosting
firebase deploy --except hosting
```

#### 3. CORS Errors

**Symptom:** "No 'Access-Control-Allow-Origin' header"

**Solutions:**

```typescript
// functions/src/payment.ts
const allowedOrigins = [
  'https://shiftx-95c4b-customer.web.app',
  'https://app.shiftx.com', // Add your domain
  'http://localhost:5173'
];

export const myFunction = onCall({
  cors: allowedOrigins
}, ...)

// Redeploy
firebase deploy --only functions:myFunction
```

#### 4. Functions Timeout

**Symptom:** "Function execution took too long"

**Solutions:**

```typescript
// Increase timeout
export const myFunction = onCall({
  timeoutSeconds: 300, // 5 minutes max
  memory: '1GB'
}, ...)

// Optimize query
const rides = await db.collection('rides')
  .where('status', '==', 'active')
  .limit(100) // Add limit
  .get();

// Use batching
const batch = db.batch();
rides.forEach(ride => {
  batch.update(ride.ref, { processed: true });
});
await batch.commit();
```

#### 5. Authentication Errors

**Symptom:** "auth/invalid-api-key"

**Solutions:**

```bash
# Check .env file
cat packages/customer-app/.env.production | grep VITE_FIREBASE_API_KEY

# Verify Firebase config
# Firebase Console → Project Settings → Your apps

# Regenerate config
firebase apps:sdkconfig web > firebase-config.json

# Update .env with new values

# Rebuild and redeploy
npm run build:customer
firebase deploy --only hosting:customer
```

#### 6. Payment Failures

**Symptom:** "Payment authorization failed"

**Solutions:**

```bash
# Check Stripe keys
echo $VITE_STRIPE_PUBLISHABLE_KEY  # Should be pk_live_*

# Verify secret in functions
firebase functions:secrets:access STRIPE_SECRET_KEY_LIVE

# Check Stripe dashboard
# Dashboard → Developers → Logs
# Look for errors

# Test with Stripe test card
# Card: 4242 4242 4242 4242
# Should work in test mode

# Check function logs
firebase functions:log --only customerConfirmPayment
```

#### 7. iOS Build Errors

**Symptom:** Capacitor sync fails

**Solutions:**

```bash
# Clean iOS build
cd packages/driver-app/ios
rm -rf Pods Podfile.lock
pod install

# Update Capacitor
npm install @capacitor/core@latest @capacitor/ios@latest

# Sync again
npx cap sync ios

# Open in Xcode and clean build
npx cap open ios
# Product → Clean Build Folder (Shift+Cmd+K)
```

#### 8. Firestore Permission Denied

**Symptom:** "Missing or insufficient permissions"

**Solutions:**

```bash
# Check rules deployed
firebase firestore:rules get

# Test rules locally
cd packages/rules-tests
npm test

# Check user authentication
console.log(auth.currentUser)  # Should not be null

# Deploy updated rules
firebase deploy --only firestore:rules

# Grant temporary admin access (debugging only)
# firestore.rules
match /rides/{rideId} {
  allow read, write: if true;  // REMOVE AFTER DEBUGGING
}
```

### Debug Mode

**Enable verbose logging:**

```typescript
// packages/customer-app/src/main.tsx
if (import.meta.env.DEV) {
  // Firebase debug
  firebase.setLogLevel('debug');
  
  // Console logs
  console.log('Firebase config:', firebaseConfig);
  console.log('Stripe key:', import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
}
```

**Function debugging:**

```typescript
// functions/src/rides.ts
export const tripRequest = onCall(async (request) => {
  console.log('Request data:', JSON.stringify(request.data));
  console.log('Auth context:', JSON.stringify(request.auth));
  
  try {
    // ...
  } catch (error) {
    console.error('Error details:', error);
    throw error;
  }
});
```

### Getting Help

**Firebase Support:**
- Documentation: https://firebase.google.com/docs
- Stack Overflow: Tag [firebase]
- GitHub Issues: https://github.com/firebase/firebase-js-sdk/issues
- Community Slack: firebase-community.slack.com

**Stripe Support:**
- Documentation: https://stripe.com/docs
- Support: https://support.stripe.com
- API Status: https://status.stripe.com

**Emergency Contacts:**
- On-call engineer: [Phone number]
- DevOps team: devops@shiftx.com
- CTO: cto@shiftx.com

---

## Appendix

### A. Environment Variables Reference

See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)

### B. Firebase CLI Commands Cheat Sheet

```bash
# Authentication
firebase login
firebase logout
firebase login:ci  # CI token

# Projects
firebase projects:list
firebase use <project>
firebase use --add  # Add project

# Deployment
firebase deploy
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --except functions

# Hosting
firebase hosting:sites:list
firebase hosting:list
firebase hosting:clone <src> <dest>

# Functions
firebase functions:list
firebase functions:log
firebase functions:log --only functionName
firebase functions:delete functionName
firebase functions:secrets:set KEY
firebase functions:secrets:access KEY

# Emulators
firebase emulators:start
firebase emulators:start --only firestore,functions
firebase emulators:export ./emulator-data

# Database
firebase firestore:indexes
firebase firestore:indexes:list
firebase firestore:rules get
```

### C. NPM Scripts Reference

```bash
# Root package.json
npm run build:all          # Build all apps + functions
npm run build:customer     # Build customer app
npm run build:driver       # Build driver app
npm run build:functions    # Build functions
npm run deploy:all         # Build and deploy everything
npm run deploy:customer    # Deploy customer app
npm run deploy:driver      # Deploy driver app
npm run deploy:functions   # Deploy functions
npm run deploy:rules       # Deploy Firestore rules
npm run test:e2e           # E2E ride test

# Functions
cd functions
npm run build              # Compile TypeScript
npm run build:watch        # Watch mode
npm run lint               # ESLint
npm run serve              # Start emulators
npm run deploy             # Deploy to Firebase

# Apps
cd packages/customer-app
npm run dev                # Development server
npm run build              # Production build
npm run preview            # Preview production build
npm run lint               # ESLint
npm test                   # Run tests
```

### D. Useful Scripts

**Quick deploy script:**

```bash
#!/bin/bash
# quick-deploy.sh

COMPONENT=$1

case $COMPONENT in
  customer)
    cd packages/customer-app
    npm run build
    firebase deploy --only hosting:customer
    ;;
  driver)
    cd packages/driver-app
    npm run build
    firebase deploy --only hosting:driver
    ;;
  functions)
    cd functions
    npm run build
    firebase deploy --only functions
    ;;
  all)
    npm run build:all
    firebase deploy
    ;;
  *)
    echo "Usage: ./quick-deploy.sh [customer|driver|functions|all]"
    exit 1
    ;;
esac
```

**Monitor logs script:**

```bash
#!/bin/bash
# watch-logs.sh

echo "Monitoring Firebase Functions logs..."
firebase functions:log --follow | while read line; do
  if echo "$line" | grep -qi "error"; then
    echo -e "\033[0;31m$line\033[0m"  # Red for errors
  elif echo "$line" | grep -qi "warn"; then
    echo -e "\033[0;33m$line\033[0m"  # Yellow for warnings
  else
    echo "$line"
  fi
done
```

### E. Production Checklist PDF

Save this checklist for production deployments:

```markdown
# Production Deployment Checklist

Date: _______________
Engineer: _______________
Version: _______________

## Pre-Deployment
- [ ] All tests pass (unit, integration)
- [ ] Code review completed and approved
- [ ] Security audit completed
- [ ] Performance tests passed
- [ ] Environment variables verified
- [ ] Secrets set in Firebase Secret Manager
- [ ] Database migrations completed
- [ ] Firestore indexes created
- [ ] Backup created

## Deployment
- [ ] Firebase project set to production
- [ ] Built all apps with production env
- [ ] Deployed functions successfully
- [ ] Deployed hosting successfully
- [ ] Deployed Firestore rules
- [ ] Verified deployment versions

## Post-Deployment
- [ ] Smoke tests passed
- [ ] Manual testing completed
- [ ] Function logs show no errors
- [ ] Monitoring alerts configured
- [ ] Team notified of deployment
- [ ] Documentation updated
- [ ] Rollback plan documented

## Sign-Off
Deployed by: _______________
Verified by: _______________
Time: _______________
```

---

**Document Version:** 2.0  
**Last Updated:** January 20, 2026  
**Maintained by:** DevOps Team  
**Next Review:** April 20, 2026

---

For questions or issues, contact devops@shiftx.com or file an issue in the GitHub repository.
