# 🔒 Stripe Connect Strict Mode Enforcement

## What Changed

Your Firebase Functions now **enforce strict key usage** with zero fallback:

### ✅ Development/Emulator Mode
- **REQUIRES**: `STRIPE_SECRET_KEY_TEST` starting with `sk_test_`
- **CRASHES** if: Key is missing OR not a test key
- **VERIFIES**: All Stripe objects have `livemode: false`

### ✅ Production Mode  
- **REQUIRES**: `STRIPE_SECRET_KEY_LIVE` starting with `sk_live_`
- **CRASHES** if: Key is missing OR not a live key
- **VERIFIES**: All Stripe objects have `livemode: true`

## New Logging Output

When you create a Connect account or onboarding link, you'll see:

```
🧪 [Stripe Connect] STRICT MODE ENFORCED:
   Environment: EMULATOR/DEV
   Key Type: TEST (sk_test_...)
   Key Prefix: sk_test_51SWRZ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 [CREATE CONNECT ACCOUNT] Pre-flight check:
   Environment: EMULATOR/DEV
   Expected Mode: TEST (livemode=false)
   Driver UID: abc123...
   Email: driver@example.com

✅ [CREATE CONNECT ACCOUNT] Account created:
   Account ID: acct_1SqKHeBufosuVNyD
   Actual Mode: 🧪 TEST
   ⚠️  MODE MISMATCH DETECTED! No
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## If You See Mode Mismatch

**🚨 If you ever see "MODE MISMATCH DETECTED! YES":**

1. **STOP IMMEDIATELY** - You're using wrong keys
2. Check `/functions/.env.local` - should ONLY have test keys
3. Check Firebase Secret Manager - production should have live key
4. Remove any `STRIPE_SECRET_KEY_LIVE` from local environment
5. Restart emulators after fixing

## File Modified

[functions/src/connect.ts](functions/src/connect.ts) - Lines 13-70, 158-195, 278-310

## No More Mystery

The logs will now **definitively show**:
- ✅ Which environment you're in (emulator vs production)
- ✅ Which key type is loaded (test vs live)  
- ✅ What mode Stripe objects are actually in (livemode true/false)
- ✅ Whether there's a mismatch (and crashes if there is)

**You can't accidentally use live mode in dev anymore.** 🎉
