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

// Define the Stripe secret key
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

// Initialize Stripe lazily
let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) {
    const key = stripeSecretKey.value();
    if (!key) {
      console.warn('STRIPE_SECRET_KEY is not set - Connect functions will not work');
      throw new HttpsError(
        'failed-precondition',
        'Stripe Connect not configured. Please contact support.'
      );
    }
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

/**
 * createConnectAccount - Create a Stripe Connect account for a driver
 */
export const createConnectAccount = onCall(
  { ...callableOptions, invoker: 'public', secrets: [stripeSecretKey] },
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

    try {
      // Check if driver exists
      const driverRef = db.collection('drivers').doc(uid);
      const driverSnap = await driverRef.get();

      if (!driverSnap.exists) {
        throw new HttpsError('not-found', 'Driver profile not found');
      }

      const driverData = driverSnap.data();

      // Check if already has Connect account
      if (driverData?.stripeConnectAccountId) {
        return {
          accountId: driverData.stripeConnectAccountId,
          status: driverData.stripeConnectStatus || 'pending',
          alreadyExists: true,
        };
      }

      // Get user email
      const userSnap = await db.collection('users').doc(uid).get();
      const email = userSnap.data()?.email;

      // Create Stripe Connect account
      const account = await stripe.accounts.create({
        type: 'express',
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          firebaseUid: uid,
        },
      });

      // Save to Firestore
      await driverRef.update({
        stripeConnectAccountId: account.id,
        stripeConnectStatus: 'pending',
        updatedAtMs: Date.now(),
      });

      // Log to admin logs
      await db.collection('adminLogs').add({
        type: 'stripe_connect_account_created',
        driverId: uid,
        accountId: account.id,
        timestampMs: Date.now(),
      });

      return {
        accountId: account.id,
        status: 'pending',
        alreadyExists: false,
      };
    } catch (error: any) {
      console.error('Error creating Connect account:', error);
      throw new HttpsError('internal', `Failed to create Connect account: ${error.message}`);
    }
  }
);

/**
 * getConnectOnboardingLink - Get onboarding link for a driver to complete Stripe verification
 */
export const getConnectOnboardingLink = onCall(
  { ...callableOptions, invoker: 'public', secrets: [stripeSecretKey] },
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

    try {
      // Get driver's Connect account ID
      const driverSnap = await db.collection('drivers').doc(uid).get();
      const accountId = driverSnap.data()?.stripeConnectAccountId;

      if (!accountId) {
        throw new HttpsError('not-found', 'No Stripe Connect account found. Please create one first.');
      }

      // Determine return URL based on environment
      const returnUrl = request.data?.returnUrl || 'https://shiftx-95c4b-driver.web.app/profile';
      const refreshUrl = request.data?.refreshUrl || returnUrl;

      // Create account link
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      return {
        url: accountLink.url,
        expiresAt: accountLink.expires_at,
      };
    } catch (error: any) {
      console.error('Error creating onboarding link:', error);
      throw new HttpsError('internal', `Failed to create onboarding link: ${error.message}`);
    }
  }
);

/**
 * getConnectStatus - Get the current status of a driver's Stripe Connect account
 */
export const getConnectStatus = onCall(
  { ...callableOptions, invoker: 'public', secrets: [stripeSecretKey] },
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

    try {
      // Get driver's Connect account ID
      const driverRef = db.collection('drivers').doc(uid);
      const driverSnap = await driverRef.get();
      const accountId = driverSnap.data()?.stripeConnectAccountId;

      if (!accountId) {
        return {
          status: 'none',
          hasAccount: false,
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
        stripeConnectStatus: status,
        updatedAtMs: Date.now(),
      });

      return {
        status,
        hasAccount: true,
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
