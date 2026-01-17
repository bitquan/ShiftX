import { onCall, HttpsError } from 'firebase-functions/v2/https';
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

async function assertLivePaymentsAllowed(uid: string) {
  if (getStripeMode() !== 'live') return;

  const flagsSnap = await db.collection('config').doc('runtimeFlags').get();
  const flags = flagsSnap.data() || {};

  const allowLivePayments = flags.allowLivePayments === true;
  const pilotUids: string[] = Array.isArray(flags.livePaymentPilotUids) ? flags.livePaymentPilotUids : [];

  if (!allowLivePayments || !pilotUids.includes(uid)) {
    throw new HttpsError(
      'failed-precondition',
      'LIVE payments are disabled. Enable allowLivePayments and whitelist pilot UIDs.'
    );
  }
}

// Initialize Stripe lazily
let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) {
    const emulator = isEmulator();
    const mode = getStripeMode();
    
    console.error('[getStripe] Initializing - isEmulator:', emulator);
    console.error('[getStripe] ENV:', {
      FUNCTIONS_EMULATOR: process.env.FUNCTIONS_EMULATOR,
      HAS_TEST_KEY: !!process.env.STRIPE_SECRET_KEY_TEST,
      HAS_KEY: !!process.env.STRIPE_SECRET_KEY,
    });
    
    // ✅ Emulator ALWAYS uses .env.local with TEST keys
    if (emulator) {
      const key = process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY;
      if (!key) {
        console.error('[getStripe] ❌ NO KEY FOUND');
        throw new HttpsError('failed-precondition', 'Missing STRIPE_SECRET_KEY_TEST in functions/.env.local');
      }
      const keyType = key.startsWith('sk_test') ? 'TEST' : 'LIVE';
      
      console.error('[getStripe] ✅ Using key type:', keyType);
      
      if (keyType !== 'TEST') {
        throw new HttpsError('failed-precondition', 'LIVE key detected in emulator! Use TEST keys only.');
      }
      
      stripe = new Stripe(key, {
        apiVersion: '2025-12-15.clover',
      });
    } else {
      // ✅ Production or deployed test mode: Read from environment variable
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) {
        throw new HttpsError(
          'failed-precondition',
          'STRIPE_SECRET_KEY not configured'
        );
      }

      if (mode === 'test' && !key.startsWith('sk_test')) {
        throw new HttpsError('failed-precondition', 'STRIPE_MODE=test requires sk_test_* key');
      }
      if (mode === 'live' && !key.startsWith('sk_live')) {
        throw new HttpsError('failed-precondition', 'STRIPE_MODE=live requires sk_live_* key');
      }
      
      stripe = new Stripe(key, {
        apiVersion: '2025-12-15.clover',
      });
    }
  }
  return stripe;
}

/**
 * createSetupIntent - Create a SetupIntent for adding a payment method
 */
export const createSetupIntent = onCall(
  { ...callableOptions, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    await assertLivePaymentsAllowed(uid);

    // DEBUG: Log environment detection
    console.error('[createSetupIntent] ENV CHECK:', {
      FUNCTIONS_EMULATOR: process.env.FUNCTIONS_EMULATOR,
      FIREBASE_EMULATOR_HUB: process.env.FIREBASE_EMULATOR_HUB,
      hasSTRIPE_SECRET_KEY_TEST: !!process.env.STRIPE_SECRET_KEY_TEST,
      hasSTRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
    });

    const stripe = getStripe();
    try {
      // Get or create Stripe customer
      const customerRef = db.collection('customers').doc(uid);
      const customerSnap = await customerRef.get();
      
      let stripeCustomerId: string;
      
      const customerData = customerSnap.data();
      if (customerSnap.exists && customerData?.stripeCustomerId) {
        stripeCustomerId = customerData.stripeCustomerId;
        
        // Verify the customer exists in Stripe (handles test/live mode mismatches)
        try {
          await stripe.customers.retrieve(stripeCustomerId);
        } catch (customerError: any) {
          if (customerError.code === 'resource_missing') {
            console.warn(`Customer ${stripeCustomerId} not found in current Stripe mode, creating new one`);
            // Customer doesn't exist (likely wrong mode), create a new one
            const userSnap = await db.collection('users').doc(uid).get();
            const userData = userSnap.data();
            const email = userSnap.exists ? userData?.email : undefined;
            
            const customer = await stripe.customers.create({
              email,
              metadata: {
                firebaseUid: uid,
              },
            });
            
            stripeCustomerId = customer.id;
            
            // Update Firestore with new customer ID
            await customerRef.set({
              stripeCustomerId,
              updatedAtMs: Date.now(),
            }, { merge: true });
          } else {
            throw customerError;
          }
        }
      } else {
        // Get user email for Stripe customer creation
        const userSnap = await db.collection('users').doc(uid).get();
        const userData = userSnap.data();
        const email = userSnap.exists ? userData?.email : undefined;
        
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email,
          metadata: {
            firebaseUid: uid,
          },
        });
        
        stripeCustomerId = customer.id;
        
        // Save to Firestore
        await customerRef.set({
          stripeCustomerId,
          updatedAtMs: Date.now(),
        }, { merge: true });
      }

      // Create SetupIntent
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        usage: 'off_session',
        metadata: {
          firebaseUid: uid,
        },
      });

      return {
        clientSecret: setupIntent.client_secret,
        stripeCustomerId,
      };
    } catch (error: any) {
      console.error('Error creating setup intent:', error);
      throw new HttpsError('internal', `Failed to create setup intent: ${error.message}`);
    }
  }
);

/**
 * listPaymentMethods - List customer's saved payment methods
 */
export const listPaymentMethods = onCall(
  { ...callableOptions, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    await assertLivePaymentsAllowed(uid);

    const stripe = getStripe();
    console.log('[listPaymentMethods] Called by user:', uid);
    try {
      // Get Stripe customer ID
      const customerSnap = await db.collection('customers').doc(uid).get();
      const customerData = customerSnap.data();
      
      if (!customerSnap.exists || !customerData?.stripeCustomerId) {
        return { paymentMethods: [], defaultPaymentMethod: null };
      }

      const stripeCustomerId = customerData.stripeCustomerId;

      // Get customer's default payment method (with error handling for mode mismatch)
      let customer;
      try {
        customer = await stripe.customers.retrieve(stripeCustomerId);
      } catch (error: any) {
        if (error.code === 'resource_missing') {
          console.warn(`Customer ${stripeCustomerId} not found in current Stripe mode, returning empty list`);
          return { paymentMethods: [], defaultPaymentMethod: null };
        }
        throw error;
      }
      
      if (customer.deleted) {
        return { paymentMethods: [], defaultPaymentMethod: null };
      }

      const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method as string | null;

      // List all payment methods
      const paymentMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'card',
      });

      const methods = paymentMethods.data.map(pm => ({
        id: pm.id,
        brand: pm.card?.brand || 'unknown',
        last4: pm.card?.last4 || '****',
        expMonth: pm.card?.exp_month || 0,
        expYear: pm.card?.exp_year || 0,
        isDefault: pm.id === defaultPaymentMethodId,
      }));

      return {
        paymentMethods: methods,
        defaultPaymentMethod: methods.find(m => m.isDefault) || methods[0] || null,
      };
    } catch (error: any) {
      console.error('Error listing payment methods:', error);
      throw new HttpsError('internal', `Failed to list payment methods: ${error.message}`);
    }
  }
);

/**
 * setDefaultPaymentMethod - Set a payment method as default
 */
export const setDefaultPaymentMethod = onCall<{ paymentMethodId: string }>(
  { ...callableOptions, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    await assertLivePaymentsAllowed(uid);

    const { paymentMethodId } = request.data;
    if (!paymentMethodId) {
      throw new HttpsError('invalid-argument', 'paymentMethodId is required');
    }

    const stripe = getStripe();
    try {
      // Get Stripe customer ID
      const customerSnap = await db.collection('customers').doc(uid).get();
      const customerData = customerSnap.data();
      
      if (!customerSnap.exists || !customerData?.stripeCustomerId) {
        throw new HttpsError('not-found', 'Stripe customer not found');
      }

      const stripeCustomerId = customerData.stripeCustomerId;

      // Set as default payment method (with error handling for mode mismatch)
      try {
        await stripe.customers.update(stripeCustomerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      } catch (error: any) {
        if (error.code === 'resource_missing') {
          throw new HttpsError('not-found', 'Customer not found in current Stripe mode. Please add a payment method first.');
        }
        throw error;
      }

      // Get payment method details to save summary
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

      // Update Firestore with summary
      await db.collection('customers').doc(uid).set({
        defaultPaymentMethodSummary: {
          brand: paymentMethod.card?.brand || 'unknown',
          last4: paymentMethod.card?.last4 || '****',
          expMonth: paymentMethod.card?.exp_month || 0,
          expYear: paymentMethod.card?.exp_year || 0,
          updatedAtMs: Date.now(),
        },
        updatedAtMs: Date.now(),
      }, { merge: true });

      return {
        ok: true,
        summary: {
          brand: paymentMethod.card?.brand || 'unknown',
          last4: paymentMethod.card?.last4 || '****',
          expMonth: paymentMethod.card?.exp_month || 0,
          expYear: paymentMethod.card?.exp_year || 0,
        },
      };
    } catch (error: any) {
      console.error('Error setting default payment method:', error);
      throw new HttpsError('internal', `Failed to set default payment method: ${error.message}`);
    }
  }
);

/**
 * detachPaymentMethod - Remove a payment method
 */
export const detachPaymentMethod = onCall<{ paymentMethodId: string }>(
  { ...callableOptions, invoker: 'public' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    await assertLivePaymentsAllowed(uid);

    const { paymentMethodId } = request.data;
    if (!paymentMethodId) {
      throw new HttpsError('invalid-argument', 'paymentMethodId is required');
    }

    const stripe = getStripe();
    try {
      // Detach payment method (with error handling for mode mismatch)
      try {
        await stripe.paymentMethods.detach(paymentMethodId);
      } catch (error: any) {
        if (error.code === 'resource_missing') {
          console.warn(`Payment method ${paymentMethodId} not found in current Stripe mode, ignoring`);
          // Still return success since the goal (method not attached) is achieved
          return { success: true };
        }
        throw error;
      }

      // Clear default payment method summary if this was the default
      const customerSnap = await db.collection('customers').doc(uid).get();
      if (customerSnap.exists) {
        await db.collection('customers').doc(uid).set({
          defaultPaymentMethodSummary: null,
          updatedAtMs: Date.now(),
        }, { merge: true });
      }

      return { ok: true };
    } catch (error: any) {
      console.error('Error detaching payment method:', error);
      throw new HttpsError('internal', `Failed to remove payment method: ${error.message}`);
    }
  }
);
