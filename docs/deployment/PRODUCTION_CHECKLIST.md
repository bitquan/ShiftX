# Production Deployment Checklist

## Pre-Deployment Checklist

### Environment Configuration
- [ ] Verify `packages/customer-app/.env` has all `VITE_*` variables set
- [ ] Verify `packages/driver-app/.env` has all `VITE_*` variables set
- [ ] Confirm Stripe publishable key is **TEST mode** (`pk_test_*`)
- [ ] Confirm Firebase project ID matches production (`shiftx-95c4b`)
- [ ] Verify no emulator URLs hardcoded in production code

### Stripe Configuration
- [ ] Stripe secret key set in Firebase Functions: `firebase functions:secrets:set STRIPE_SECRET_KEY`
- [ ] Stripe secret is **TEST mode** (`sk_test_*`)
- [ ] Stripe webhook endpoints configured (if using webhooks)
- [ ] Publishable key in `.env` matches secret key mode

### Firebase Functions
- [ ] All functions listed in `functions/src/index.ts` are exported
- [ ] Functions use correct region (`us-central1`)
- [ ] CORS configured with production domains
- [ ] Required functions exist:
  - `driverSetOnline`
  - `driverHeartbeat`
  - `tripRequest`
  - `acceptRide`
  - `cancelRide`
  - `getRideEvents`
  - `customerConfirmPayment`
  - `addPaymentMethod`
  - `setPaymentAuthorized` ⭐ NEW

### Firestore
- [ ] Security rules allow driver location updates
- [ ] Security rules prevent direct ride mutations
- [ ] Indexes created for common queries
- [ ] Test rules with emulator before deploying

### Code Quality
- [ ] TypeScript builds without errors (`npm run build` in functions/)
- [ ] Customer app builds without errors (`npm run build` in packages/customer-app/)
- [ ] Driver app builds without errors (`npm run build` in packages/driver-app/)
- [ ] No console.error statements in production (or wrapped with proper logging)
- [ ] Feature flags configured correctly

## Deployment Steps

### Option 1: Use Deploy Script (Recommended)
```bash
./scripts/deploy.sh
```

### Option 2: Manual Deployment
```bash
# 1. Build and deploy functions
cd functions
npm run build
cd ..
firebase deploy --only functions

# 2. Deploy Firestore rules
firebase deploy --only firestore

# 3. Build and deploy customer app
cd packages/customer-app
npm run build
cd ../..
firebase deploy --only hosting:shiftx-95c4b-customer

# 4. Build and deploy driver app
cd packages/driver-app
npm run build
cd ../..
firebase deploy --only hosting:shiftx-95c4b-driver
```

## Post-Deployment Verification

### Immediate Checks (< 5 minutes)
- [ ] Customer app loads without errors: https://shiftx-95c4b-customer.web.app
- [ ] Driver app loads without errors: https://shiftx-95c4b-driver.web.app
- [ ] HTTPS certificate is valid (no warnings)
- [ ] Firebase Authentication works (can sign in/up)
- [ ] Debug panel shows correct environment info (🔧 icon)

### Debug Panel Checks
Open debug panel on customer app and verify:
- [ ] **Stripe Key Mode**: Shows `✅ TEST`
- [ ] **Firebase Project**: Shows correct project ID
- [ ] **Emulator Mode**: Shows `✅ PROD (Live)`
- [ ] **Functions Reachable**: Shows `✅ Yes`
- [ ] **Payment Functions**: Shows `✅ Working`
- [ ] **HTTPS**: Shows `✅ Secure`

### Functional Testing (10-15 minutes)

#### Customer Flow
1. [ ] Customer can sign up / sign in
2. [ ] Customer sees map with current location
3. [ ] Customer can see online drivers on map
4. [ ] Customer can enter pickup and dropoff locations
5. [ ] Customer can request a ride
6. [ ] Ride request creates offers for nearby drivers
7. [ ] Customer can view ride history

#### Driver Flow
1. [ ] Driver can sign up / sign in
2. [ ] Driver can set vehicle info and rates
3. [ ] Driver can go online
4. [ ] Driver location updates every 5 seconds (check Firestore)
5. [ ] Driver appears on customer map when online
6. [ ] Driver receives ride offers (when customer requests)
7. [ ] Driver can accept ride

#### Payment Flow ⭐ CRITICAL
1. [ ] Customer can authorize payment
2. [ ] Payment UI loads Stripe card element
3. [ ] Test card works: `4242 4242 4242 4242`
4. [ ] Payment authorization succeeds
5. [ ] No "processing error" message
6. [ ] Console shows detailed error logs if failure occurs
7. [ ] Check Functions logs: `firebase functions:log --only customerConfirmPayment,setPaymentAuthorized`

### Browser Testing
- [ ] Chrome (desktop)
- [ ] Safari (desktop)
- [ ] Chrome (mobile)
- [ ] Safari (iOS)
- [ ] Hard refresh tested (Cmd+Shift+R / Ctrl+Shift+R)

### Firebase Console Checks
- [ ] Functions: All 9 functions show "Healthy" status
- [ ] Hosting: Both sites show recent deployment timestamp
- [ ] Authentication: Email/password provider enabled
- [ ] Firestore: Rules show last updated timestamp
- [ ] Firestore: Sample ride/driver docs exist with correct structure

### Monitoring & Logs
```bash
# Check recent function logs
firebase functions:log --limit 50

# Check specific function logs
firebase functions:log --only customerConfirmPayment

# Check for errors
firebase functions:log --only customerConfirmPayment | grep ERROR
```

## Known Issues & Solutions

### Issue: "Processing error occurred" during payment
**Root Cause**: `setPaymentAuthorized` function was missing
**Fix**: Function now exists in `functions/src/payment.ts` and is exported
**Verify**: Check `firebase functions:list` shows `setPaymentAuthorized`

### Issue: Browser shows old cached code
**Symptoms**: 
- Error persists after deployment
- Console shows old bundle filename
- Payment error hasn't changed

**Solutions**:
1. Hard refresh: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
2. Clear cache: DevTools > Network > Disable cache
3. Incognito/Private window
4. Force Firebase hosting cache clear (wait 5-10 minutes)

### Issue: "Stripe not configured" error
**Root Cause**: Stripe secret not accessible to function
**Fix**:
```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
# Paste your sk_test_* key
firebase deploy --only functions
```

### Issue: CORS error on function calls
**Root Cause**: Production domain not in CORS whitelist
**Fix**: Check `functions/src/payment.ts`, `rides.ts`, `driver.ts` have:
```typescript
cors: ['https://shiftx-95c4b-customer.web.app', 'https://shiftx-95c4b-driver.web.app']
```

### Issue: Payment intent creation fails
**Possible Causes**:
1. Stripe key mode mismatch (test pk with live sk or vice versa)
2. Stripe customer ID invalid
3. Amount is 0 or negative
4. Stripe API version mismatch

**Debug**:
```bash
# Check Stripe key in functions
firebase functions:secrets:access STRIPE_SECRET_KEY

# Check customer app Stripe key
grep VITE_STRIPE_PUBLISHABLE_KEY packages/customer-app/.env

# Verify both start with same prefix (pk_test_ / sk_test_)
```

## Rollback Plan

If deployment fails or critical issues occur:

### Quick Rollback
```bash
# View recent deployments
firebase hosting:channel:list

# Rollback functions to previous version (via Firebase Console)
# Functions > Select function > Versions tab > Roll back

# Rollback hosting (requires manual redeployment of previous version)
# Keep a git tag of last working version
git checkout <last-working-tag>
./scripts/deploy.sh
```

### Emergency Hotfix
1. Fix issue in code
2. Test locally with emulator
3. Deploy only affected service:
   ```bash
   # Just functions
   firebase deploy --only functions:customerConfirmPayment
   
   # Just customer app
   firebase deploy --only hosting:shiftx-95c4b-customer
   ```

## Success Criteria

Deployment is considered successful when:
- ✅ All pre-deployment checklist items completed
- ✅ All post-deployment verification checks pass
- ✅ Debug panel shows all green checkmarks
- ✅ Payment authorization works end-to-end
- ✅ No errors in Functions logs
- ✅ Ride matching creates offers for drivers
- ✅ Driver location updates visible to customers

## Deployment Log Template

```
Deployment Date: _______________
Deployed By: _______________
Git Commit: _______________

Functions Deployed:
- [ ] customerConfirmPayment
- [ ] setPaymentAuthorized (NEW)
- [ ] addPaymentMethod
- [ ] tripRequest
- [ ] acceptRide
- [ ] cancelRide
- [ ] getRideEvents
- [ ] driverSetOnline
- [ ] driverHeartbeat

Hosting Deployed:
- [ ] Customer App
- [ ] Driver App

Firestore Updated:
- [ ] Rules
- [ ] Indexes

Post-Deployment Tests:
- [ ] Payment authorization: _______________
- [ ] Ride matching: _______________
- [ ] Driver location: _______________

Issues Encountered:
_______________________________________________
_______________________________________________

Resolution:
_______________________________________________
_______________________________________________
```

## Contact & Support

- Firebase Console: https://console.firebase.google.com/project/shiftx-95c4b
- Stripe Dashboard: https://dashboard.stripe.com/test/dashboard
- Production URLs:
  - Customer: https://shiftx-95c4b-customer.web.app
  - Driver: https://shiftx-95c4b-driver.web.app
