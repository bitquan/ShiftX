import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { callableOptions } from './cors';

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Helper to detect if running in emulator
function isEmulator() {
  return process.env.FUNCTIONS_EMULATOR === 'true' || !!process.env.FIREBASE_EMULATOR_HUB;
}

type StripeMode = 'test' | 'live';

function getStripeMode(): StripeMode {
  if (isEmulator()) return 'test';
  return process.env.STRIPE_MODE === 'live' ? 'live' : 'test';
}

// Define the Stripe secret keys
const stripeSecretKeyLive = defineSecret('STRIPE_SECRET_KEY_LIVE');
const stripeSecretKeyTest = defineSecret('STRIPE_SECRET_KEY_TEST');

// Initialize Stripe lazily with STRICT mode enforcement
let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) {
    const emulator = isEmulator();
    const mode = getStripeMode();

    // 🔒 STRICT MODE: No fallback allowed
    if (emulator) {
      // DEV/EMULATOR: MUST use TEST key, MUST start with sk_test_
      const key = process.env.STRIPE_SECRET_KEY_TEST;

      // Hard crash if test key is missing in dev
      if (!key) {
        throw new HttpsError(
          'failed-precondition',
          '❌ MISSING STRIPE_SECRET_KEY_TEST in functions/.env.local - This is required for dev/emulator mode'
        );
      }

      // Hard crash if not a test key
      if (!key.startsWith('sk_test_')) {
        throw new HttpsError(
          'failed-precondition',
          `❌ INVALID KEY: Expected sk_test_* in emulator, got ${key.substring(0, 10)}... - Remove LIVE keys from dev environment!`
        );
      }

      console.log('🧪 [Stripe Connect] STRICT MODE ENFORCED:');
      console.log('   Environment: EMULATOR/DEV');
      console.log('   Key Type: TEST (sk_test_...)');
      console.log('   Key Prefix:', key.substring(0, 15) + '...');

      stripe = new Stripe(key, {
        apiVersion: '2025-12-15.clover',
      });
      return stripe;
    }

    if (mode === 'test') {
      const key = stripeSecretKeyTest.value();
      if (!key) {
        throw new HttpsError(
          'failed-precondition',
          '❌ MISSING STRIPE_SECRET_KEY_TEST in Secret Manager - This is required for STRIPE_MODE=test'
        );
      }
      if (!key.startsWith('sk_test_')) {
        throw new HttpsError(
          'failed-precondition',
          `❌ INVALID KEY: Expected sk_test_* in STRIPE_MODE=test, got ${key.substring(0, 10)}...`
        );
      }

      console.log('🧪 [Stripe Connect] STRICT MODE ENFORCED:');
      console.log('   Environment: PRODUCTION');
      console.log('   Mode: TEST');
      console.log('   Key Type: TEST (sk_test_...)');
      console.log('   Key Prefix:', key.substring(0, 15) + '...');

      stripe = new Stripe(key, {
        apiVersion: '2025-12-15.clover',
      });
      return stripe;
    }

    // PRODUCTION: MUST use LIVE key, MUST start with sk_live_
    const key = stripeSecretKeyLive.value();

    // Hard crash if live key is missing in production
    if (!key) {
      throw new HttpsError(
        'failed-precondition',
        '❌ MISSING STRIPE_SECRET_KEY_LIVE in Secret Manager - This is required for production'
      );
    }

    // Hard crash if not a live key
    if (!key.startsWith('sk_live_')) {
      throw new HttpsError(
        'failed-precondition',
        `❌ INVALID KEY: Expected sk_live_* in production, got ${key.substring(0, 10)}... - Use TEST keys in STRIPE_MODE=test only!`
      );
    }

    console.log('🚀 [Stripe Connect] STRICT MODE ENFORCED:');
    console.log('   Environment: PRODUCTION');
    console.log('   Key Type: LIVE (sk_live_...)');
    console.log('   Key Prefix:', key.substring(0, 15) + '...');

    stripe = new Stripe(key, {
      apiVersion: '2025-12-15.clover',
    });
  }
  return stripe;
}

/**
 * Check if Stripe Connect is enabled via runtime flag
 */
async function isConnectEnabled(): Promise<boolean> {
  try {
    const flagsDoc = await db.collection('config').doc('runtimeFlags').get();
    return flagsDoc.data()?.enableStripeConnect === true;
  } catch (error) {
    console.error('Error checking Connect flag:', error);
    return false;
  }
}

async function assertLiveConnectAllowed(uid: string) {
  if (getStripeMode() !== 'live') return;

  const flagsSnap = await db.collection('config').doc('runtimeFlags').get();
  const flags = flagsSnap.data() || {};

  const allowLivePayments = flags.allowLivePayments === true;
  const pilotUids: string[] = Array.isArray(flags.livePaymentPilotUids) ? flags.livePaymentPilotUids : [];

  if (!allowLivePayments || !pilotUids.includes(uid)) {
    throw new HttpsError(
      'failed-precondition',
      'LIVE Connect is disabled. Enable allowLivePayments and whitelist pilot UIDs.'
    );
  }
}

/**
 * createConnectAccount - Create a Stripe Connect account for a driver
 * MODE-AWARE: Creates test accounts in dev, live accounts in production
 */
export const createConnectAccount = onCall(
  isEmulator()
    ? { ...callableOptions, invoker: 'public' }
    : { ...callableOptions, invoker: 'public', secrets: [stripeSecretKeyLive, stripeSecretKeyTest] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Check if Connect is enabled
    const enabled = await isConnectEnabled();
    if (!enabled) {
      throw new HttpsError(
        'failed-precondition',
        'Stripe Connect is not enabled yet. Feature coming soon!'
      );
    }

    const stripe = getStripe();
    const emulator = isEmulator();
    const mode = getStripeMode();

    await assertLiveConnectAllowed(uid);
    
    // Determine mode-specific field names
    const accountIdField = mode === 'test' ? 'stripeConnectAccountId_test' : 'stripeConnectAccountId_live';
    const statusField = mode === 'test' ? 'stripeConnectStatus_test' : 'stripeConnectStatus_live';

    // 🔍 PRE-FLIGHT LOGGING
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [CREATE CONNECT ACCOUNT] Pre-flight check:');
    console.log('   Environment:', emulator ? 'EMULATOR/DEV' : 'PRODUCTION');
    console.log('   Mode:', mode.toUpperCase());
    console.log('   Expected livemode:', !emulator);
    console.log('   Account Field:', accountIdField);
    console.log('   Driver UID:', uid);

    try {
      // Use transaction to prevent race conditions
      const driverRef = db.collection('drivers').doc(uid);
      
      const result = await db.runTransaction(async (transaction) => {
        const driverSnap = await transaction.get(driverRef);

        if (!driverSnap.exists) {
          throw new HttpsError('not-found', 'Driver profile not found');
        }

        const driverData = driverSnap.data();

        // ✅ CHECK FOR EXISTING ACCOUNT IN THIS MODE
        const existingAccountId = driverData?.[accountIdField];
        if (existingAccountId) {
          console.log(`✓ [CREATE CONNECT ACCOUNT] Reusing existing ${mode} account:`, existingAccountId);
          return {
            accountId: existingAccountId,
            status: driverData?.[statusField] || 'pending',
            mode,
            alreadyExists: true,
          };
        }

        // Get user email
        const userSnap = await db.collection('users').doc(uid).get();
        const email = userSnap.data()?.email;

        // Create Stripe Connect account
        const account: any = await stripe.accounts.create({
          type: 'express',
          email: email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: 'individual',
          metadata: {
            firebaseUid: uid,
            mode: mode, // Track which mode this account was created in
          },
        });

        // 🔍 VERIFY ACTUAL MODE AFTER CREATION
        console.log('✅ [CREATE CONNECT ACCOUNT] Account created:');
        console.log('   Account ID:', account.id);
        console.log('   Actual Mode:', account.livemode ? '🚀 LIVE' : '🧪 TEST');
        console.log('   Expected Mode:', mode.toUpperCase());
        console.log('   ⚠️  MODE MISMATCH:', (mode === 'test' && account.livemode) || (mode === 'live' && !account.livemode) ? 'YES - CRITICAL ERROR!' : 'No');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // 🚨 HARD FAIL ON MODE MISMATCH
        if (mode === 'test' && account.livemode) {
          throw new HttpsError(
            'internal',
            `🚨 FATAL: Created LIVE account in ${mode.toUpperCase()} mode! Account: ${account.id}. Check your Stripe keys immediately.`
          );
        }
        if (mode === 'live' && !account.livemode) {
          throw new HttpsError(
            'internal',
            `🚨 FATAL: Created TEST account in ${mode.toUpperCase()} mode! Account: ${account.id}. Check your Stripe keys immediately.`
          );
        }

        // Save to Firestore with mode-specific field
        transaction.update(driverRef, {
          [accountIdField]: account.id,
          [statusField]: 'pending',
          updatedAtMs: Date.now(),
        });

        // Log to admin logs
        await db.collection('adminLogs').add({
          type: 'stripe_connect_account_created',
          driverId: uid,
          accountId: account.id,
          mode: mode,
          timestampMs: Date.now(),
        });

        return {
          accountId: account.id,
          status: 'pending',
          mode,
          alreadyExists: false,
        };
      });

      return result;
    } catch (error: any) {
      console.error('[CREATE CONNECT ACCOUNT] Error:', error);
      throw new HttpsError('internal', `Failed to create Connect account: ${error.message}`);
    }
  }
);

/**
 * getConnectOnboardingLink - Get onboarding link for a driver to complete Stripe verification
 * MODE-AWARE: Uses mode-specific account ID fields
 */
export const getConnectOnboardingLink = onCall(
  isEmulator()
    ? { ...callableOptions, invoker: 'public' }
    : { ...callableOptions, invoker: 'public', secrets: [stripeSecretKeyLive, stripeSecretKeyTest] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Check if Connect is enabled
    const enabled = await isConnectEnabled();
    if (!enabled) {
      throw new HttpsError(
        'failed-precondition',
        'Stripe Connect is not enabled yet. Feature coming soon!'
      );
    }

    const stripe = getStripe();
    const emulator = isEmulator();
    const mode = getStripeMode();

    await assertLiveConnectAllowed(uid);
    
    // Determine mode-specific field names
    const accountIdField = mode === 'test' ? 'stripeConnectAccountId_test' : 'stripeConnectAccountId_live';

    // 🔍 PRE-FLIGHT LOGGING
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [CREATE ONBOARDING LINK] Pre-flight check:');
    console.log('   Environment:', emulator ? 'EMULATOR/DEV' : 'PRODUCTION');
    console.log('   Mode:', mode.toUpperCase());
    console.log('   Account Field:', accountIdField);

    try {
      // Get driver's Connect account ID for this mode
      const driverSnap = await db.collection('drivers').doc(uid).get();
      const accountId = driverSnap.data()?.[accountIdField];

      if (!accountId) {
        throw new HttpsError('not-found', `No Stripe Connect account found for ${mode} mode. Please create one first.`);
      }

      console.log('   Account ID:', accountId);

      // Determine return URL based on environment
      // In emulator/dev: use localhost HTTP (Stripe TEST mode allows this)
      // In production: use HTTPS hosted URL (required for LIVE mode)
      let returnUrl: string;
      let refreshUrl: string;
      
      if (emulator) {
        // Use localhost for TEST mode
        returnUrl = request.data?.returnUrl || 'http://localhost:5174/wallet';
        refreshUrl = request.data?.refreshUrl || returnUrl;
        console.log('[Connect Onboarding] Using TEST mode localhost URLs:', { returnUrl, refreshUrl });
      } else {
        // Use HTTPS for production or deployed test mode
        returnUrl = request.data?.returnUrl || 'https://shiftx-95c4b-driver.web.app/wallet';
        refreshUrl = request.data?.refreshUrl || returnUrl;

        const isHttps = (url: string) => url.startsWith('https://');
        if (!isHttps(returnUrl) || !isHttps(refreshUrl)) {
          throw new HttpsError(
            'invalid-argument',
            'returnUrl/refreshUrl must be HTTPS in non-emulator environments'
          );
        }

        console.log('[Connect Onboarding] Using HTTPS URLs:', { returnUrl, refreshUrl });
      }

      // 🔍 LOG MODE BEFORE CREATING LINK
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔍 [CREATE ONBOARDING LINK] Pre-flight check:');
      console.log('   Environment:', emulator ? 'EMULATOR/DEV' : 'PRODUCTION');
      console.log('   Expected Mode:', mode === 'test' ? 'TEST (livemode=false)' : 'LIVE (livemode=true)');
      console.log('   Account ID:', accountId);

      // Create account link
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      // 🔍 VERIFY THE ACCOUNT'S ACTUAL MODE
      const accountDetails: any = await stripe.accounts.retrieve(accountId);
      console.log('✅ [CREATE ONBOARDING LINK] Link created:');
      console.log('   Link URL:', accountLink.url.substring(0, 50) + '...');
      console.log('   Account Mode:', accountDetails.livemode ? '🚀 LIVE' : '🧪 TEST');
      console.log('   Expected Mode:', mode.toUpperCase());
      console.log('   ⚠️  MODE MISMATCH:', (mode === 'test' && accountDetails.livemode) || (mode === 'live' && !accountDetails.livemode) ? 'YES - CRITICAL ERROR!' : 'No');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // 🚨 HARD FAIL ON MODE MISMATCH
      if (mode === 'test' && accountDetails.livemode) {
        throw new HttpsError(
          'internal',
          `🚨 FATAL: Attempting to onboard LIVE account in ${mode.toUpperCase()} mode! Account: ${accountId}. Check your Stripe keys immediately.`
        );
      }
      if (mode === 'live' && !accountDetails.livemode) {
        throw new HttpsError(
          'internal',
          `🚨 FATAL: Attempting to onboard TEST account in ${mode.toUpperCase()} mode! Account: ${accountId}. Check your Stripe keys immediately.`
        );
      }

      console.log('[Connect Onboarding] Link created successfully:', {
        accountId,
        emulator,
        expiresAt: accountLink.expires_at,
      });

      return {
        url: accountLink.url,
        expiresAt: accountLink.expires_at,
      };
    } catch (error: any) {
      console.error('[Connect Onboarding] Error creating link:', error);
      throw new HttpsError('internal', `Failed to create onboarding link: ${error.message}`);
    }
  }
);

/**
 * getConnectStatus - Get the current status of a driver's Stripe Connect account
 * MODE-AWARE: Checks mode-specific account ID fields
 */
export const getConnectStatus = onCall(
  isEmulator()
    ? { ...callableOptions, invoker: 'public' }
    : { ...callableOptions, invoker: 'public', secrets: [stripeSecretKeyLive, stripeSecretKeyTest] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Check if Connect is enabled
    const enabled = await isConnectEnabled();
    if (!enabled) {
      throw new HttpsError(
        'failed-precondition',
        'Stripe Connect is not enabled yet. Feature coming soon!'
      );
    }

    const stripe = getStripe();
    const mode = getStripeMode();

    await assertLiveConnectAllowed(uid);
    const accountIdField = mode === 'test' ? 'stripeConnectAccountId_test' : 'stripeConnectAccountId_live';
    const statusField = mode === 'test' ? 'stripeConnectStatus_test' : 'stripeConnectStatus_live';

    try {
      // Get driver's Connect account ID for this mode
      const driverRef = db.collection('drivers').doc(uid);
      const driverSnap = await driverRef.get();
      const accountId = driverSnap.data()?.[accountIdField];

      if (!accountId) {
        return {
          status: 'none',
          hasAccount: false,
          mode,
        };
      }

      // Retrieve account from Stripe
      const account = await stripe.accounts.retrieve(accountId);

      // Determine status
      let status = 'pending';
      if (account.charges_enabled && account.payouts_enabled) {
        status = 'active';
      } else if (account.details_submitted) {
        status = 'submitted';
      }

      // Update Firestore with latest status
      await driverRef.update({
        [statusField]: status,
        updatedAtMs: Date.now(),
      });

      return {
        status,
        hasAccount: true,
        mode,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requiresAction: !account.charges_enabled || !account.payouts_enabled,
      };
    } catch (error: any) {
      console.error('Error getting Connect status:', error);
      throw new HttpsError('internal', `Failed to get Connect status: ${error.message}`);
    }
  }
);
