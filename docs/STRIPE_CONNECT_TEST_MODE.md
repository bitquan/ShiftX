# Stripe Connect TEST Mode Configuration

## ✅ Fixed Issues

### Problem
Connect onboarding was failing with "return URL must use HTTPS" because:
1. Backend was using LIVE Stripe keys in emulator
2. Return URLs were hardcoded to production HTTPS URLs
3. No detection of emulator vs production environment

### Solution
Updated Connect functions to properly handle TEST mode in emulator:

## Configuration

### 1. Backend (Functions)

**Emulator Mode (Development):**
- Uses `STRIPE_SECRET_KEY_TEST` from `functions/.env.local`
- Allows HTTP localhost URLs for return/refresh
- Default return URL: `http://localhost:5173/wallet`
- Logs: `[Stripe Connect] emulator=true key=TEST`

**Production Mode:**
- Uses `STRIPE_SECRET_KEY_LIVE` from Secret Manager
- Requires HTTPS URLs
**Deployed TEST Mode (STRIPE_MODE=test):**
- Uses Secret Manager `STRIPE_SECRET_KEY_TEST`
- Requires HTTPS return/refresh URLs
- Uses mode-specific Firestore fields:
   - `stripeConnectAccountId_test`
   - `stripeConnectStatus_test`

The system auto-detects environment:
```typescript
function isEmulator() {
  return process.env.FUNCTIONS_EMULATOR === 'true' || 
         !!process.env.FIREBASE_EMULATOR_HUB;
}
```

### 3. Return URL Logic

```typescript
if (emulator) {
  // TEST mode: HTTP localhost OK
  returnUrl = 'http://localhost:5173/wallet';
} else {
  // LIVE mode: HTTPS required
  returnUrl = 'https://shiftx-95c4b-driver.web.app/wallet';
}
```

## Setup Instructions

### For Development (Emulator)

1. **Create `functions/.env.local`:**
   ```bash
   STRIPE_SECRET_KEY_TEST=sk_test_...
   STRIPE_SECRET_KEY=sk_test_...  # fallback
   ```

2. **Start emulators:**
   ```bash
   firebase emulators:start
   ```

3. **Driver app should run on:**
   ```
   http://localhost:5173
   ```

4. **Test Connect onboarding:**
   - Click "Set Up Payouts"
   - Should open Stripe TEST mode onboarding
   - Return URL will be `http://localhost:5173/wallet`

### For Production

1. **Set Secret in Firebase:**
   ```bash
   firebase functions:secrets:set STRIPE_SECRET_KEY_LIVE
   # Enter sk_live_... when prompted
   ```

2. **Deploy functions:**
   ```bash
   firebase deploy --only functions
   ```

3. **Test Connect onboarding:**
   - Click "Set Up Payouts"
   - Should open Stripe LIVE mode onboarding
   - Return URL will be HTTPS hosted domain

## Verification

### Check Logs

**Correct TEST mode logs:**
```
[Stripe Connect] emulator=true key=TEST
[Connect Onboarding] Using TEST mode localhost URLs: {
  returnUrl: 'http://localhost:5173/wallet',
  refreshUrl: 'http://localhost:5173/wallet'
}
```

**Correct LIVE mode logs:**
```
[Stripe Connect] emulator=false key=LIVE
[Connect Onboarding] Using LIVE mode HTTPS URLs: {
  returnUrl: 'https://shiftx-95c4b-driver.web.app/wallet',
  refreshUrl: 'https://shiftx-95c4b-driver.web.app/wallet'
}
```

### Warning Signs

**❌ Wrong: LIVE key in emulator**
```
[Stripe Connect] emulator=true key=LIVE
⚠️  Using LIVE key in emulator - Connect onboarding will fail!
```

**❌ Wrong: TEST key in production**
```
[Stripe Connect] emulator=false key=TEST
```

## Common Issues

### Issue: "return URL must use HTTPS"
**Cause:** Using LIVE key with HTTP localhost URL
**Fix:** Ensure `functions/.env.local` has `sk_test_...` key

### Issue: "No such account"
**Cause:** Account created in LIVE mode, trying to access in TEST mode (or vice versa)
**Fix:** Accounts are mode-specific. Create new account in current mode.

### Issue: Function can't find STRIPE_SECRET_KEY_TEST
**Cause:** Missing `functions/.env.local` file
**Fix:** Create file with TEST key as shown above

## Testing Workflow

1. ✅ Set `enableStripeConnect: true` in Firestore
2. ✅ Verify `functions/.env.local` has TEST key
3. ✅ Start emulators
4. ✅ Open driver app at `http://localhost:5173`
5. ✅ Go to Wallet
6. ✅ Click "Set Up Payouts"
7. ✅ Should see TEST mode Stripe onboarding
8. ✅ Complete onboarding
9. ✅ Return to localhost app
10. ✅ Check Firestore: `stripeConnectStatus: 'active'`

## Files Changed

- `/functions/src/connect.ts` - Added emulator detection and URL logic
- `/packages/driver-app/src/components/Wallet.tsx` - Removed hardcoded URLs

Once TEST mode is working:
1. Test pilot toggle with TEST mode accounts
2. Complete test rides
3. Verify transfers in Stripe TEST Dashboard
4. When ready for production, deploy with LIVE keys
