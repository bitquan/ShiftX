import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { callableOptions as baseCorsOptions } from './cors';
import { getFeeBreakdown } from './platformFees';

const db = admin.firestore();

// Helper to detect if running in emulator
function isEmulator() {
  return process.env.FUNCTIONS_EMULATOR === 'true' || !!process.env.FIREBASE_EMULATOR_HUB;
}

// Only define live secret (emulator uses .env.local, never Secret Manager)
const stripeSecretLive = defineSecret('STRIPE_SECRET_KEY_LIVE');

// Conditionally include secrets only in production
const callableOptions = isEmulator() 
  ? baseCorsOptions
  : {
      ...baseCorsOptions,
      secrets: [stripeSecretLive],
    };

// Get Stripe from environment or throw error
function getStripe() {
  const emulator = isEmulator();
  const mode = emulator ? 'test' : (process.env.STRIPE_MODE === 'test' ? 'test' : 'live');
  
  // ✅ Emulator ALWAYS uses .env.local
  if (emulator) {
    const key = process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new HttpsError('failed-precondition', 'Missing STRIPE_SECRET_KEY_TEST in functions/.env.local');
    }
    const keyType = key.startsWith('sk_test') ? 'TEST' : 'LIVE';
    console.log(`[Stripe] mode=${mode} key=${keyType} emulator=${emulator}`);
    
    if (keyType !== 'TEST') {
      console.error(`⚠️  MISMATCH: mode=${mode} but key=${keyType} - this will cause "No such payment_intent" errors!`);
    }
    
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require('stripe');
    return new Stripe(key, { apiVersion: '2023-10-16' });
  }
  
  // ✅ Production uses Secret Manager (live)
  const liveKey = stripeSecretLive.value();
  if (!liveKey) {
    throw new HttpsError('failed-precondition', 'Missing STRIPE_SECRET_KEY_LIVE in Secret Manager');
  }
  
  const keyType = liveKey.startsWith('sk_test') ? 'TEST' : 'LIVE';
  console.log(`[Stripe] mode=${mode} key=${keyType} emulator=${emulator}`);
  
  if (mode === 'live' && keyType !== 'LIVE') {
    console.error(`⚠️  MISMATCH: mode=${mode} but key=${keyType} - using test key in production!`);
  }
  
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Stripe = require('stripe');
  return new Stripe(liveKey, { apiVersion: '2023-10-16' });
}

/**
 * Check if Stripe Connect is enabled
 */
async function isStripeConnectEnabled(): Promise<boolean> {
  try {
    const flagsSnap = await db.collection('config').doc('runtimeFlags').get();
    return flagsSnap.exists && flagsSnap.data()?.enableStripeConnect === true;
  } catch (error) {
    console.error('Error checking Stripe Connect flag:', error);
    return false;
  }
}

/**
 * Get driver's Stripe Connect account info
 */
async function getDriverConnectInfo(driverId: string): Promise<{
  accountId: string | null;
  status: string;
}> {
  try {
    const driverSnap = await db.collection('drivers').doc(driverId).get();
    if (!driverSnap.exists) {
      return { accountId: null, status: 'none' };
    }
    
    const driverData = driverSnap.data();
    return {
      accountId: driverData?.stripeConnectAccountId || null,
      status: driverData?.stripeConnectStatus || 'none',
    };
  } catch (error) {
    console.error('Error getting driver Connect info:', error);
    return { accountId: null, status: 'none' };
  }
}

/**
 * customerConfirmPayment - Get Stripe payment intent for a ride
 */
export const customerConfirmPayment = onCall<{ rideId: string }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { rideId } = request.data;
    if (!rideId) {
      throw new HttpsError('invalid-argument', 'rideId required');
    }

    // Get ride
    const rideRef = db.collection('rides').doc(rideId);
    const rideSnap = await rideRef.get();

    if (!rideSnap.exists) {
      throw new HttpsError('not-found', 'Ride not found');
    }

    const ride = rideSnap.data();

    // Verify user is the customer
    if (ride?.customerId !== uid) {
      throw new HttpsError('permission-denied', 'Not authorized');
    }

    // Check if ride can be paid
    if (ride?.status !== 'accepted' && ride?.status !== 'started' && ride?.status !== 'in_progress') {
      throw new HttpsError('failed-precondition', `Ride is ${ride?.status}, payment not available yet`);
    }

    const amountCents = ride?.priceCents || ride?.estimatedFareCents || 0;
    if (amountCents <= 0) {
      throw new HttpsError('invalid-argument', 'Invalid ride amount');
    }

    try {
      const stripe = getStripe();

      // Get customer info to check for saved payment methods
      const customerRef = db.collection('customers').doc(uid);
      const customerSnap = await customerRef.get();
      const customerData = customerSnap.data();

      // Get saved payment method from Stripe customer (with mode mismatch handling)
      let savedPaymentMethod: any = null;
      if (customerData?.stripeCustomerId) {
        try {
          const stripeCustomer = await stripe.customers.retrieve(customerData.stripeCustomerId);
          const defaultPmId = (stripeCustomer as any).invoice_settings?.default_payment_method;
          
          if (defaultPmId) {
            const pm = await stripe.paymentMethods.retrieve(defaultPmId);
            savedPaymentMethod = {
              id: pm.id,
              last4: pm.card?.last4,
              brand: pm.card?.brand,
              expMonth: pm.card?.exp_month,
              expYear: pm.card?.exp_year,
            };
            console.log('[customerConfirmPayment] Found saved payment method:', savedPaymentMethod);
          }
        } catch (error: any) {
          if (error.code === 'resource_missing') {
            console.warn('[customerConfirmPayment] Customer not found in current Stripe mode, proceeding without saved payment method');
          } else {
            console.error('[customerConfirmPayment] Error retrieving payment method:', error);
          }
        }
      }

      // Create or retrieve payment intent
      let paymentIntentId = ride?.stripePaymentIntentId;
      let clientSecret: string | undefined;
      let status: string | undefined;

      if (paymentIntentId) {
        // Retrieve existing payment intent (with mode mismatch handling)
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          clientSecret = paymentIntent.client_secret!;
          status = paymentIntent.status;
          
          console.log('[customerConfirmPayment] Reusing existing PaymentIntent:', {
            id: paymentIntentId,
            status,
          });
          
          // If already succeeded or captured, return it as-is
          if (status === 'succeeded' || status === 'requires_capture') {
            return {
              clientSecret: clientSecret || '',
              amount: amountCents,
              status,
              savedPaymentMethod,
            };
          }
          
          // Otherwise, return the existing PI for confirmation
          return {
            clientSecret: clientSecret || '',
            amount: paymentIntent.amount,
            status,
            savedPaymentMethod,
          };
        } catch (error: any) {
          if (error.code === 'resource_missing' || error.message?.includes('No such payment_intent')) {
            console.warn('[customerConfirmPayment] Payment intent not found in current Stripe mode, clearing stale PI and creating new one', {
              rideId,
              paymentIntentId,
            });
            
            // Clear stale PI from ride document
            await rideRef.update({
              paymentIntentId: admin.firestore.FieldValue.delete(),
              stripePaymentIntentId: admin.firestore.FieldValue.delete(),
              paymentStatus: 'none',
              updatedAtMs: Date.now(),
            });
            
            paymentIntentId = null; // Will create new one below
          } else {
            throw error;
          }
        }
      }
      
      if (!paymentIntentId) {
        // Get fee breakdown
        const fees = getFeeBreakdown(amountCents);
        
        // Check if Stripe Connect is enabled
        const connectEnabled = await isStripeConnectEnabled();
        let useConnect = false;
        let driverAccountId: string | null = null;
        
        // If Connect is enabled and ride has a driver, check driver's Connect status
        if (connectEnabled && ride.driverId) {
          const connectInfo = await getDriverConnectInfo(ride.driverId);
          if (connectInfo.status === 'active' && connectInfo.accountId) {
            useConnect = true;
            driverAccountId = connectInfo.accountId;
            console.log('[customerConfirmPayment] Using Stripe Connect for driver:', {
              driverId: ride.driverId,
              accountId: driverAccountId,
            });
          }
        }
        
        // Calculate total charge (base fare + rider fee)
        const totalChargeCents = fees.totalChargeCents;
        
        // Create new payment intent with MANUAL capture
        const createParams: any = {
          amount: totalChargeCents, // Customer pays fare + rider fee
          currency: 'usd',
          customer: customerData?.stripeCustomerId,
          capture_method: 'manual', // Authorize now, capture on ride completion
          metadata: {
            rideId,
            customerId: uid,
            fareCents: fees.fareCents.toString(),
            riderFeeCents: fees.riderFeeCents.toString(),
            driverFeeCents: fees.driverFeeCents.toString(),
            platformFeeCents: fees.platformFeeCents.toString(),
            driverPayoutCents: fees.driverPayoutCents.toString(),
            connectEnabled: connectEnabled.toString(),
          },
        };
        
        // If using Connect, add destination charges + application fee
        if (useConnect && driverAccountId) {
          createParams.application_fee_amount = fees.platformFeeCents;
          createParams.transfer_data = {
            destination: driverAccountId,
          };
          createParams.metadata.stripeConnectAccountId = driverAccountId;
          
          console.log('[customerConfirmPayment] Connect enabled - fee structure:', {
            totalCharge: totalChargeCents,
            platformFee: fees.platformFeeCents,
            driverPayout: fees.driverPayoutCents,
            destination: driverAccountId,
          });
        }
        
        // If customer has saved payment method, attach it
        if (savedPaymentMethod?.id) {
          createParams.payment_method = savedPaymentMethod.id;
          createParams.confirm = false; // Client will confirm
          console.log('[customerConfirmPayment] Using saved payment method:', savedPaymentMethod.id);
        } else {
          // No saved method, use automatic payment methods
          createParams.automatic_payment_methods = {
            enabled: true,
            allow_redirects: 'never',
          };
        }
        
        // Create PI and save to Firestore atomically using transaction
        // This prevents double creation if function is called concurrently
        const paymentIntent = await stripe.paymentIntents.create(createParams);

        clientSecret = paymentIntent.client_secret!;
        paymentIntentId = paymentIntent.id;
        status = paymentIntent.status;
        
        console.log('[customerConfirmPayment] Created PaymentIntent:', {
          id: paymentIntentId,
          amount: totalChargeCents,
          status,
          capture_method: paymentIntent.capture_method,
          connect: useConnect,
        });
        
        // Log Connect routing details for verification
        if (useConnect && driverAccountId) {
          console.log('[customerConfirmPayment] ✅ CONNECT ROUTING:', {
            connectDestination: driverAccountId,
            application_fee_amount: fees.platformFeeCents,
          });
        }

        // Save payment intent ID and fee breakdown to ride using transaction
        // to ensure only one PI gets saved even if called concurrently
        try {
          await db.runTransaction(async (transaction) => {
            const freshRideSnap = await transaction.get(rideRef);
            const freshRide = freshRideSnap.data();
            
            // Check if another call already created a PI
            if (freshRide?.stripePaymentIntentId && freshRide.stripePaymentIntentId !== paymentIntentId) {
              console.warn('[customerConfirmPayment] Race condition detected - using existing PI instead:', {
                existing: freshRide.stripePaymentIntentId,
                new: paymentIntentId,
              });
              // Cancel the PI we just created since another one won the race
              // (don't await - let it happen async to avoid transaction timeout)
              stripe.paymentIntents.cancel(paymentIntentId).catch((err: any) => 
                console.error('Failed to cancel duplicate PI:', err)
              );
              // Return the existing PI instead of throwing error
              paymentIntentId = freshRide.stripePaymentIntentId;
              return; // Exit transaction without updating
            }
            
            const updateData: any = {
              stripePaymentIntentId: paymentIntentId,
              fareCents: fees.fareCents,
              riderFeeCents: fees.riderFeeCents,
              driverFeeCents: fees.driverFeeCents,
              totalChargeCents: fees.totalChargeCents,
              platformFeeCents: fees.platformFeeCents,
              driverPayoutCents: fees.driverPayoutCents,
              updatedAtMs: Date.now(),
            };
            
            if (useConnect && driverAccountId) {
              updateData.stripeConnectAccountId = driverAccountId;
              updateData.transferDestination = driverAccountId;
            }
            
            transaction.update(rideRef, updateData);
          });
          
          // If we used the existing PI due to race condition, retrieve it
          if (paymentIntentId !== paymentIntent.id) {
            const existingPI = await stripe.paymentIntents.retrieve(paymentIntentId);
            clientSecret = existingPI.client_secret!;
            status = existingPI.status;
            console.log('[customerConfirmPayment] Using existing PI from race condition:', {
              id: paymentIntentId,
              status,
            });
          }
        } catch (error) {
          console.error('[customerConfirmPayment] Transaction error:', error);
          // Cancel the PI we created if transaction failed
          await stripe.paymentIntents.cancel(paymentIntentId).catch((err: any) => 
            console.error('Failed to cancel PI after transaction error:', err)
          );
          throw error;
        }
      }

      return {
        clientSecret,
        amount: amountCents,
        status,
        savedPaymentMethod,
      };
    } catch (error: any) {
      console.error('Stripe error:', error);
      throw new HttpsError('internal', error.message || 'Payment setup failed');
    }
  }
);

/**
 * addPaymentMethod - Add a payment method for a customer
 */
export const addPaymentMethod = onCall<{ paymentMethodId: string }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { paymentMethodId } = request.data;
    if (!paymentMethodId) {
      throw new HttpsError('invalid-argument', 'paymentMethodId required');
    }

    try {
      const stripe = getStripe();
      const customerRef = db.collection('customers').doc(uid);
      const customerSnap = await customerRef.get();

      let stripeCustomerId = customerSnap.data()?.stripeCustomerId;

      // Create Stripe customer if doesn't exist
      if (!stripeCustomerId) {
        const userSnap = await db.collection('users').doc(uid).get();
        const email = userSnap.data()?.email;

        const customer = await stripe.customers.create({
          email,
          metadata: { firebaseUid: uid },
        });

        stripeCustomerId = customer.id;
        await customerRef.set(
          { stripeCustomerId, updatedAtMs: Date.now() },
          { merge: true }
        );
      }

      // Attach payment method to customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });

      // Set as default payment method
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      await customerRef.update({
        defaultPaymentMethod: paymentMethodId,
        updatedAtMs: Date.now(),
      });

      return { ok: true };
    } catch (error: any) {
      console.error('Stripe error:', error);
      throw new HttpsError('internal', error.message || 'Failed to add payment method');
    }
  }
);

/**
 * getPaymentState - Get authoritative payment state for a ride
 * Returns the current payment status and determines what action the UI should take
 */
export const getPaymentState = onCall<{ rideId: string }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { rideId } = request.data;
    if (!rideId) {
      throw new HttpsError('invalid-argument', 'rideId required');
    }

    // Get ride
    const rideRef = db.collection('rides').doc(rideId);
    const rideSnap = await rideRef.get();

    if (!rideSnap.exists) {
      throw new HttpsError('not-found', 'Ride not found');
    }

    const ride = rideSnap.data();

    // Verify user is the customer
    if (ride?.customerId !== uid) {
      throw new HttpsError('permission-denied', 'Not authorized');
    }

    const paymentIntentId = ride?.stripePaymentIntentId || ride?.paymentIntentId;
    const currentPaymentStatus = ride?.paymentStatus || 'none';

    console.log('[getPaymentState] Initial state:', {
      rideId,
      paymentIntentId,
      currentPaymentStatus,
      rideStatus: ride?.status,
    });

    // If no payment intent, return 'none' so UI can create one
    if (!paymentIntentId) {
      return {
        paymentStatus: 'none',
        paymentIntentStatus: null,
        clientSecret: null,
        needsConfirm: false,
      };
    }

    try {
      const stripe = getStripe();
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      console.log('[getPaymentState]', {
        rideId,
        paymentIntentId,
        piStatus: paymentIntent.status,
        dbPaymentStatus: currentPaymentStatus,
      });

      // Determine the canonical payment status based on Stripe PI status
      let canonicalPaymentStatus = currentPaymentStatus;
      let needsConfirm = false;
      let clientSecret: string | null = paymentIntent.client_secret || null;

      switch (paymentIntent.status) {
        case 'succeeded':
          // Payment is fully captured
          canonicalPaymentStatus = 'captured';
          needsConfirm = false;
          clientSecret = null; // Don't return secret for completed payments
          
          // Update ride if DB is out of sync
          if (currentPaymentStatus !== 'captured') {
            await rideRef.update({
              paymentStatus: 'captured',
              updatedAtMs: Date.now(),
            });
          }
          break;

        case 'requires_capture':
          // Payment is authorized, waiting for capture
          canonicalPaymentStatus = 'authorized';
          needsConfirm = false;
          clientSecret = null; // Don't need secret for authorized payments
          
          // Update ride if DB is out of sync
          if (currentPaymentStatus !== 'authorized') {
            await rideRef.update({
              paymentStatus: 'authorized',
              paymentAuthorized: true,
              paymentAuthorizedAtMs: Date.now(),
              updatedAtMs: Date.now(),
            });
          }
          break;

        case 'requires_payment_method':
        case 'requires_confirmation':
        case 'requires_action':
          // Payment needs customer interaction
          canonicalPaymentStatus = 'requires_authorization';
          needsConfirm = true;
          // Return client secret so UI can confirm
          break;

        case 'canceled':
          canonicalPaymentStatus = 'cancelled';
          needsConfirm = false;
          clientSecret = null;
          break;

        case 'processing':
          // Payment is being processed, check back later
          canonicalPaymentStatus = 'requires_authorization';
          needsConfirm = false;
          clientSecret = null;
          break;

        default:
          console.warn('[getPaymentState] Unknown PI status:', paymentIntent.status);
          canonicalPaymentStatus = currentPaymentStatus;
          needsConfirm = false;
      }

      return {
        paymentStatus: canonicalPaymentStatus,
        paymentIntentStatus: paymentIntent.status,
        clientSecret: needsConfirm ? clientSecret : null,
        needsConfirm,
      };
    } catch (error: any) {
      console.error('[getPaymentState] Error retrieving payment intent:', error);
      
      // Handle resource_missing (PaymentIntent not found in current Stripe environment)
      if (error.code === 'resource_missing' || error.message?.includes('No such payment_intent')) {
        console.warn('[getPaymentState] PaymentIntent not found in current Stripe mode - clearing stale PI', {
          rideId,
          paymentIntentId,
          errorCode: error.code,
        });
        
        // Clear stale PaymentIntent data from ride
        await rideRef.update({
          paymentIntentId: admin.firestore.FieldValue.delete(),
          stripePaymentIntentId: admin.firestore.FieldValue.delete(),
          paymentStatus: 'none',
          updatedAtMs: Date.now(),
        });
        
        // Return 'none' so client will create a fresh PI in the correct environment
        return {
          paymentStatus: 'none',
          paymentIntentStatus: null,
          clientSecret: null,
          needsConfirm: false,
          recovered: true, // Signal that we auto-recovered from mismatch
        };
      }
      
      // Return current DB state if can't reach Stripe for other reasons
      return {
        paymentStatus: currentPaymentStatus,
        paymentIntentStatus: null,
        clientSecret: null,
        needsConfirm: false,
        error: error.message,
      };
    }
  }
);

/**
 * setPaymentAuthorized - Mark ride payment as authorized after Stripe confirmation
 */
export const setPaymentAuthorized = onCall<{ rideId: string }>(
  callableOptions,
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { rideId } = request.data;
    if (!rideId) {
      throw new HttpsError('invalid-argument', 'rideId required');
    }

    // Get ride
    const rideRef = db.collection('rides').doc(rideId);
    const rideSnap = await rideRef.get();

    if (!rideSnap.exists) {
      throw new HttpsError('not-found', 'Ride not found');
    }

    const ride = rideSnap.data();

    // Verify user is the customer
    if (ride?.customerId !== uid) {
      throw new HttpsError('permission-denied', 'Not authorized');
    }

    // Get PaymentIntent to store its status
    const stripe = getStripe();
    const paymentIntentId = ride?.stripePaymentIntentId;
    let paymentIntentStatus = 'requires_capture'; // Default
    
    if (paymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        paymentIntentStatus = pi.status;
      } catch (error) {
        console.error('[setPaymentAuthorized] Error retrieving PI:', error);
      }
    }

    // Update ride with new PaymentStatus enum
    await rideRef.update({
      'payment.authorized': true,
      'payment.authorizedAt': Date.now(),
      'payment.status': paymentIntentStatus,
      'payment.intentId': paymentIntentId || null,
      // Use new PaymentStatus enum
      paymentStatus: 'authorized',
      paymentAuthorized: true,
      paymentAuthorizedAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });

    console.log('[setPaymentAuthorized] Payment authorized:', {
      rideId,
      paymentIntentId,
      status: paymentIntentStatus,
    });

    return { ok: true };
  }
);
