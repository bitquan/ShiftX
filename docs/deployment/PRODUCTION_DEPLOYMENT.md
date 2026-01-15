# Production Deployment Guide

**Last Updated:** January 14, 2026  
**Status:** All services deployed and operational ✅

---

## 🌐 Production URLs

- **Customer App:** https://shiftx-95c4b-customer.web.app
- **Driver App:** https://shiftx-95c4b-driver.web.app
- **Admin Dashboard:** https://shiftx-95c4b-admin.web.app
- **Cloud Functions:** us-central1 (19 deployed functions)

---

## 📋 Deployment History

### January 14, 2026 - Full Production Deployment

**Deployed Components:**
1. ✅ Cloud Functions (19/20 functions)
2. ✅ Customer App (Firebase Hosting)
3. ✅ Driver App (Firebase Hosting)
4. ✅ Admin Dashboard (Firebase Hosting)
5. ✅ Firestore Rules
6. ✅ Admin User Setup

**Key Features Deployed:**
- PR4: Stripe payment state machine (authorize on accept, capture on complete)
- PR2: Real-time stability (timeline persistence, payment UI, offer reconciliation)
- CORS configuration for all domains
- Comprehensive smoke test (automated E2E)
- Admin dashboard with driver management

---

## 🚀 Deployment Procedures

### Prerequisites

1. **Firebase CLI authenticated:**
   ```bash
   firebase login
   firebase projects:list  # Verify access to shiftx-95c4b
   ```

2. **Production environment variables set:**
   - Customer app: `.env.production` with `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...`
   - Driver app: `.env.production` with `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...`
   - Functions secrets: `STRIPE_SECRET_KEY` set to `sk_live_...`

3. **Build all packages:**
   ```bash
   cd functions && npm run build
   cd ../packages/customer-app && npm run build
   cd ../packages/driver-app && npm run build
   cd ../packages/admin-dashboard && npm run build
   ```

### Deploy Everything

```bash
firebase deploy
```

### Deploy Individual Components

#### Functions Only
```bash
firebase deploy --only functions
```

**Specific functions:**
```bash
firebase deploy --only functions:tripRequest,functions:acceptRide,functions:startRide
```

#### Hosting Only
```bash
# All hosting sites
firebase deploy --only hosting

# Individual sites
firebase deploy --only hosting:customer
firebase deploy --only hosting:driver
firebase deploy --only hosting:admin
```

#### Firestore Rules Only
```bash
firebase deploy --only firestore:rules
```

---

## 🔧 Function Deployment Details

### Deployed Functions (19/20)

**Ride Lifecycle:**
- ✅ `tripRequest` - Create ride request
- ✅ `acceptRide` - Driver accepts offer
- ✅ `declineOffer` - Driver declines offer
- ✅ `startRide` - Driver starts ride (payment-gated)
- ✅ `progressRide` - Mark ride as in progress
- ✅ `completeRide` - Complete ride and capture payment
- ✅ `cancelRide` - Cancel ride
- ✅ `updateRideStatus` - Update ride status

**Driver Management:**
- ✅ `driverSetOnline` - Set driver online/offline
- ❌ `driverHeartbeat` - Location updates (failed: CPU quota)
- ✅ `setDriverAvailability` - Set availability schedule
- ✅ `getDriverLedgerSummary` - Get earnings summary
- ✅ `approveDriver` - Admin approve driver
- ✅ `listDrivers` - Admin list all drivers

**Payment:**
- ✅ `customerConfirmPayment` - Create PaymentIntent
- ✅ `getPaymentState` - Get payment status
- ✅ `setPaymentAuthorized` - Mark payment authorized
- ✅ `addPaymentMethod` - Add payment method

**History:**
- ✅ `getRideEvents` - Get ride event timeline
- ✅ `getRideHistory` - Get user ride history

### Known Issues

**driverHeartbeat deployment failure:**
- Error: CPU quota exceeded
- Impact: Driver location updates may not work in production
- Workaround: Use client-side Firestore writes for driver location
- Status: Needs investigation and quota increase

---

## 🌍 CORS Configuration

All Cloud Functions are configured with CORS for:

**Production Domains:**
- `https://shiftx-customer.web.app`
- `https://shiftx-driver.web.app`
- `https://shiftx-admin.web.app`

**Legacy Firebase Hosting:**
- `https://shiftx-95c4b-customer.web.app`
- `https://shiftx-95c4b-driver.web.app`
- `https://shiftx-95c4b-admin.web.app`

**Development:**
- `http://localhost:5173` (customer-app)
- `http://localhost:5174` (driver-app)
- `http://localhost:5175` (admin-dashboard)

---

## 🔐 Admin Setup

### Creating Production Admin User

1. **Ensure service account key exists:**
   ```bash
   ls serviceAccountKey.json
   ```

2. **Run admin setup script:**
   ```bash
   node scripts/createProdAdmin.js
   ```

3. **Enter credentials (or use defaults):**
   - Email: `admin@shiftx.com`
   - Password: `admin123`

4. **Verify admin access:**
   - Navigate to https://shiftx-95c4b-admin.web.app
   - Sign in with admin credentials
   - Should see driver list

### Admin Firestore Setup

Admin users are stored in:
- `config/admins` - Document with `uids` array
- `users/{adminUid}` - User document with `role: 'admin'`

---

## ✅ Post-Deployment Verification

### 1. Check Function Deployment
```bash
firebase functions:list
```

### 2. Run Smoke Test (Production Mode)
```bash
node scripts/smokeTest.js --mode prod --api-key YOUR_API_KEY
```

### 3. Manual Verification Checklist

**Customer App:**
- [ ] Can request a ride
- [ ] Timeline shows real-time events
- [ ] Payment authorization works
- [ ] Can see ride history
- [ ] "Request Again" works

**Driver App:**
- [ ] Can go online
- [ ] Receives ride offers
- [ ] Can accept/decline offers
- [ ] Payment status shows correctly
- [ ] Can start ride (after payment authorized)
- [ ] Earnings dashboard shows correct totals

**Admin Dashboard:**
- [ ] Can log in with admin credentials
- [ ] Sees list of drivers
- [ ] Can approve/disable drivers
- [ ] Real-time online status updates

### 4. Check Firebase Console

- **Hosting:** All three sites show "Deployed"
- **Functions:** 19/20 functions show "Healthy"
- **Firestore:** Data structure correct
- **Auth:** Users can sign up and log in

---

## 🐛 Troubleshooting

### Deployment Fails

**Check Firebase CLI version:**
```bash
firebase --version  # Should be 13.0.0 or higher
```

**Clear functions cache:**
```bash
rm -rf functions/lib
cd functions && npm run build
```

### CORS Errors in Production

**Verify CORS configuration in functions:**
```typescript
// functions/src/payment.ts, driver.ts, rides.ts
const callableOptions = {
  region: 'us-central1' as const,
  cors: [
    'https://shiftx-95c4b-customer.web.app',
    'https://shiftx-95c4b-driver.web.app',
    'https://shiftx-95c4b-admin.web.app',
    // ... other domains
  ],
};
```

**Redeploy functions:**
```bash
firebase deploy --only functions
```

### Admin Login Fails

**Verify admin user exists:**
```bash
firebase auth:export users.json --project shiftx-95c4b
cat users.json | grep "admin@shiftx.com"
```

**Check Firestore admin config:**
```bash
# In Firebase Console, check:
# config/admins -> uids array contains admin UID
# users/{adminUid} -> role === 'admin'
```

### Functions Not Responding

**Check logs:**
```bash
firebase functions:log --only functionName
```

**Common issues:**
- Cold start timeout (increase timeout in function options)
- CPU quota exceeded (upgrade Firebase plan)
- CORS not configured (add domain to allowlist)

---

## 📊 Monitoring

### Firebase Console

- **Functions:** https://console.firebase.google.com/project/shiftx-95c4b/functions
- **Hosting:** https://console.firebase.google.com/project/shiftx-95c4b/hosting
- **Firestore:** https://console.firebase.google.com/project/shiftx-95c4b/firestore

### Key Metrics to Watch

- **Function invocations:** Should increase with usage
- **Function errors:** Should be <1%
- **Hosting bandwidth:** Monitor for unexpected spikes
- **Firestore reads/writes:** Optimize if costs increase

---

## 🔄 Rollback Procedure

If deployment causes issues:

1. **Rollback functions:**
   ```bash
   firebase deploy --only functions
   # (Deploy previous working version)
   ```

2. **Rollback hosting:**
   ```bash
   firebase hosting:clone shiftx-95c4b-customer:previous shiftx-95c4b-customer:live
   ```

3. **Restore Firestore rules:**
   ```bash
   firebase deploy --only firestore:rules
   # (Deploy previous rules version)
   ```

---

## 📝 Next Steps

### Immediate
- [ ] Monitor function logs for errors
- [ ] Set up alerts for function failures
- [ ] Configure custom domains (shiftx.app, etc.)

### Short-term
- [ ] Fix driverHeartbeat CPU quota issue
- [ ] Set up CI/CD pipeline
- [ ] Add production monitoring (Sentry, LogRocket)

### Long-term
- [ ] Implement Stripe Connect for driver payouts
- [ ] Add real-time chat support
- [ ] Build native mobile apps

---

**For questions or issues, refer to:**
- [docs/INDEX.md](../INDEX.md) - Full documentation index
- [docs/PROJECT_STATUS.md](../PROJECT_STATUS.md) - Current project status
- [README.md](../../README.md) - Project overview
