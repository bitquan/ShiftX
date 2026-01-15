import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { callableOptions } from './cors';

// Define the Stripe secret key
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Initialize Stripe lazily
let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) {
    const key = stripeSecretKey.value();
    if (!key) {
      console.warn('STRIPE_SECRET_KEY is not set - wallet functions will not work');
      throw new HttpsError(
        'failed-precondition',
        'Payment system not configured. Please contact support.'
      );
    }
    stripe = new Stripe(key, {
      apiVersion: '2025-12-15.clover',
    });
  }
  return stripe;
}

/**
 * createSetupIntent - Create a SetupIntent for adding a payment method
 */
export const createSetupIntent = onCall(
  { ...callableOptions, invoker: 'public', secrets: [stripeSecretKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

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
  { ...callableOptions, invoker: 'public', secrets: [stripeSecretKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const stripe = getStripe();
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
  { ...callableOptions, invoker: 'public', secrets: [stripeSecretKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

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
  { ...callableOptions, invoker: 'public', secrets: [stripeSecretKey] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

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
