import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import Stripe from 'stripe';

const db = admin.firestore();

// Define secrets for both live and test modes (optional for initial deployment)
const STRIPE_SECRET_KEY_LIVE = defineSecret('STRIPE_SECRET_KEY_LIVE');
const STRIPE_SECRET_KEY_TEST = defineSecret('STRIPE_SECRET_KEY_TEST');
const STRIPE_WEBHOOK_SECRET_LIVE = defineSecret('STRIPE_WEBHOOK_SECRET_LIVE');
const STRIPE_WEBHOOK_SECRET_TEST = defineSecret('STRIPE_WEBHOOK_SECRET_TEST');

// Get Stripe instance for the appropriate mode
function getStripe(isLiveMode: boolean) {
  const stripeKey = isLiveMode 
    ? STRIPE_SECRET_KEY_LIVE.value() 
    : STRIPE_SECRET_KEY_TEST.value();
    
  if (!stripeKey) {
    console.error(`Stripe ${isLiveMode ? 'LIVE' : 'TEST'} key not configured`);
    return null;
  }
  
  return new Stripe(stripeKey, { apiVersion: '2025-12-15.clover' });
}

export const stripeWebhook = onRequest(
  {
    secrets: [
      STRIPE_SECRET_KEY_LIVE,
      STRIPE_SECRET_KEY_TEST,
      STRIPE_WEBHOOK_SECRET_LIVE,
      STRIPE_WEBHOOK_SECRET_TEST,
    ],
    region: 'us-central1',
    invoker: 'public',
  },
  async (req, res) => {
    // Only accept POST requests
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const sig = req.headers['stripe-signature'];

    if (!sig || typeof sig !== 'string') {
      console.error('[Webhook] Missing stripe-signature header');
      res.status(400).send('Webhook signature missing');
      return;
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      console.error('[Webhook] Missing raw body');
      res.status(400).send('Webhook body missing');
      return;
    }

    let event: Stripe.Event;
    let isLiveMode = false;

    // Try to verify signature with LIVE secret first, then TEST
    try {
      const liveSecret = STRIPE_WEBHOOK_SECRET_LIVE.value();
      const testSecret = STRIPE_WEBHOOK_SECRET_TEST.value();

      // If secrets not configured yet, accept the webhook but log warning
      if (!liveSecret && !testSecret) {
        console.warn('[Webhook] ⚠️ No webhook secrets configured - accepting without verification (UNSAFE)');
        event = JSON.parse(rawBody.toString()) as Stripe.Event;
        isLiveMode = false;
      } else {
        const stripe = getStripe(true);
        const stripeTest = getStripe(false);

        try {
          if (liveSecret && stripe) {
            event = stripe.webhooks.constructEvent(rawBody, sig, liveSecret);
            isLiveMode = true;
            console.log('[Webhook] ✅ Verified with LIVE secret');
          } else {
            throw new Error('No live secret');
          }
        } catch (liveError) {
          // Try test secret
          if (testSecret && stripeTest) {
            event = stripeTest.webhooks.constructEvent(rawBody, sig, testSecret);
            isLiveMode = false;
            console.log('[Webhook] ✅ Verified with TEST secret');
          } else {
            throw liveError;
          }
        }
      }
    } catch (err: any) {
      console.error('[Webhook] ❌ Signature verification failed:', err.message);
      res.status(400).send(`Webhook signature verification failed: ${err.message}`);
      return;
    }

    // Verify livemode matches what we detected
    if (event.livemode !== isLiveMode) {
      console.warn(
        `[Webhook] ⚠️ Mode mismatch: verified as ${isLiveMode ? 'LIVE' : 'TEST'} but event.livemode=${event.livemode}`
      );
    }

    console.log(`[Webhook] 📨 Event: ${(event as any).type} (${isLiveMode ? 'LIVE' : 'TEST'}) [${event.id}]`);

    // Check if we've already processed this event (idempotent)
    const eventRef = db.collection('stripeEvents').doc(event.id);
    const existingEvent = await eventRef.get();

    if (existingEvent.exists) {
      console.log(`[Webhook] ⏭️  Event ${event.id} already processed, skipping`);
      res.status(200).json({ received: true, status: 'already_processed' });
      return;
    }

    // Store the event for audit trail
    await eventRef.set({
      eventId: event.id,
      type: (event as any).type,
      livemode: isLiveMode,
      created: event.created,
      objectId: ((event as any).data?.object as any)?.id || null,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      rawEvent: event,
    });

    try {
      const eventType = (event as any).type as string;
      const eventData = (event as any).data;

      switch (eventType) {
        case 'payment_intent.amount_capturable_updated':
          await handlePaymentIntentAmountCapturableUpdated(eventData.object as any);
          break;

        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(eventData.object as any);
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentIntentFailed(eventData.object as any);
          break;

        case 'payment_intent.canceled':
          await handlePaymentIntentCanceled(eventData.object as any);
          break;

        case 'setup_intent.succeeded':
          await handleSetupIntentSucceeded(eventData.object as any);
          break;

        case 'setup_intent.setup_failed':
          await handleSetupIntentFailed(eventData.object as any);
          break;

        case 'account.updated':
          await handleAccountUpdated(eventData.object as any);
          break;

        case 'capability.updated':
          await handleCapabilityUpdated(eventData.object as any, (event as any).account, event.livemode);
          break;

        case 'transfer.created':
          await handleTransferCreated(eventData.object as any);
          break;

        case 'transfer.failed':
          await handleTransferFailed(eventData.object as any);
          break;

        case 'payout.failed':
          await handlePayoutFailed(eventData.object as any, (event as any).account, event.livemode);
          break;

        default:
          console.log('[Webhook] Unhandled event type:', eventType);
      }

      console.log(`[Webhook] ✅ Successfully processed ${eventType}`);
      res.json({ received: true, status: 'processed' });
    } catch (error: any) {
      console.error('[Webhook] ❌ Error processing event:', error);
      // Still return 200 so Stripe doesn't retry
      res.status(200).json({ received: true, status: 'error', error: error.message });
    }
  }
);

/**
 * Handle payment_intent.amount_capturable_updated
 * Fired when authorization succeeds
 */
async function handlePaymentIntentAmountCapturableUpdated(paymentIntent: any) {
  const rideId = paymentIntent.metadata?.rideId;
  if (!rideId) {
    console.log('[Webhook] No rideId in metadata, skipping');
    return;
  }
  
  console.log('[Webhook] Payment authorized:', {
    rideId,
    amount: paymentIntent.amount_capturable,
    status: paymentIntent.status,
  });
  
  const rideRef = db.collection('rides').doc(rideId);
  
  await rideRef.update({
    paymentStatus: 'authorized',
    stripePaymentIntentStatus: paymentIntent.status,
    paymentAuthorizedAtMs: Date.now(),
    updatedAtMs: Date.now(),
  });
  
  // Log event
  await logWebhookEvent(rideId, 'payment_authorized', {
    amount: paymentIntent.amount_capturable,
    status: paymentIntent.status,
  });
}

/**
 * Handle payment_intent.succeeded
 * Fired when capture succeeds
 */
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  const rideId = paymentIntent.metadata?.rideId;
  if (!rideId) {
    console.log('[Webhook] No rideId in metadata, skipping');
    return;
  }
  
  console.log('[Webhook] Payment captured:', {
    rideId,
    amount: paymentIntent.amount_received,
    status: paymentIntent.status,
  });
  
  const rideRef = db.collection('rides').doc(rideId);
  
  // Get the ride to extract fee information
  const rideSnap = await rideRef.get();
  const ride = rideSnap.data();
  
  const updateData: any = {
    paymentStatus: 'captured',
    stripePaymentIntentStatus: paymentIntent.status,
    paymentCapturedAtMs: Date.now(),
    updatedAtMs: Date.now(),
  };
  
  // If Connect was used, log payout details
  if (paymentIntent.transfer_data?.destination) {
    updateData.stripeConnectAccountId = paymentIntent.transfer_data.destination;
    updateData.transferDestination = paymentIntent.transfer_data.destination;
    
    // Platform fee is automatically deducted by Stripe
    if (ride) {
      updateData.driverPayoutCents = ride.driverPayoutCents || 0;
      updateData.platformFeeCents = ride.platformFeeCents || 0;
    }
  }
  
  await rideRef.update(updateData);

  // Alert if Connect routing was expected but no transfer destination exists
  const connectEnabled = paymentIntent.metadata?.connectEnabled === 'true';
  if (connectEnabled && !paymentIntent.transfer_data?.destination) {
    await rideRef.update({
      paymentAuditTransferMissing: true,
      paymentAuditAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });

    await db.collection('adminLogs').add({
      action: 'payment_captured_missing_transfer',
      details: {
        rideId,
        paymentIntentId: paymentIntent.id,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      timestampMs: Date.now(),
    });
  }
  
  // Log event
  await logWebhookEvent(rideId, 'payment_captured', {
    amount: paymentIntent.amount_received,
    status: paymentIntent.status,
    connectUsed: !!paymentIntent.transfer_data,
  });
}

function extractRideIdFromTransfer(transfer: any): string | null {
  if (transfer.metadata?.rideId) return transfer.metadata.rideId;
  if (transfer.transfer_group && transfer.transfer_group.startsWith('ride_')) {
    return transfer.transfer_group.replace('ride_', '');
  }
  return null;
}

/**
 * Handle transfer.created
 */
async function handleTransferCreated(transfer: any) {
  const rideId = extractRideIdFromTransfer(transfer);
  console.log('[Webhook] Transfer created:', {
    transferId: transfer.id,
    rideId,
    amount: transfer.amount,
    destination: transfer.destination,
  });

  if (!rideId) {
    await db.collection('adminLogs').add({
      action: 'transfer_created_unlinked',
      details: {
        transferId: transfer.id,
        destination: transfer.destination,
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      timestampMs: Date.now(),
    });
    return;
  }

  await db.collection('rides').doc(rideId).update({
    connectTransferId: transfer.id,
    connectTransferStatus: transfer.status || 'created',
    transferDestination: transfer.destination || null,
    updatedAtMs: Date.now(),
  });
}

/**
 * Handle transfer.failed
 */
async function handleTransferFailed(transfer: any) {
  const rideId = extractRideIdFromTransfer(transfer);
  console.warn('[Webhook] Transfer failed:', {
    transferId: transfer.id,
    rideId,
    amount: transfer.amount,
    destination: transfer.destination,
  });

  if (rideId) {
    await db.collection('rides').doc(rideId).update({
      connectTransferId: transfer.id,
      connectTransferStatus: 'failed',
      connectTransferFailedAtMs: Date.now(),
      connectTransferError: transfer.failure_message || transfer.failure_code || 'transfer_failed',
      updatedAtMs: Date.now(),
    });
  }

  await db.collection('adminLogs').add({
    action: 'transfer_failed',
    details: {
      transferId: transfer.id,
      rideId,
      destination: transfer.destination,
      amount: transfer.amount,
      failureCode: transfer.failure_code || null,
      failureMessage: transfer.failure_message || null,
    },
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    timestampMs: Date.now(),
  });
}

/**
 * Handle payout.failed
 */
async function handlePayoutFailed(payout: any, accountId: string | undefined, livemode: boolean) {
  console.warn('[Webhook] Payout failed:', {
    payoutId: payout.id,
    accountId,
    livemode,
    amount: payout.amount,
    failureCode: payout.failure_code,
    failureMessage: payout.failure_message,
  });

  await db.collection('adminLogs').add({
    action: 'payout_failed',
    details: {
      payoutId: payout.id,
      accountId: accountId || null,
      livemode,
      amount: payout.amount,
      failureCode: payout.failure_code || null,
      failureMessage: payout.failure_message || null,
    },
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    timestampMs: Date.now(),
  });
}

/**
 * Handle payment_intent.payment_failed
 */
async function handlePaymentIntentFailed(paymentIntent: any) {
  const rideId = paymentIntent.metadata?.rideId;
  if (!rideId) {
    console.log('[Webhook] No rideId in metadata, skipping');
    return;
  }
  
  console.log('[Webhook] Payment failed:', {
    rideId,
    status: paymentIntent.status,
    lastError: paymentIntent.last_payment_error,
  });
  
  const rideRef = db.collection('rides').doc(rideId);
  
  await rideRef.update({
    paymentStatus: 'failed',
    stripePaymentIntentStatus: paymentIntent.status,
    paymentError: paymentIntent.last_payment_error?.message || 'Payment failed',
    updatedAtMs: Date.now(),
  });
  
  // Log event
  await logWebhookEvent(rideId, 'payment_failed', {
    status: paymentIntent.status,
    error: paymentIntent.last_payment_error?.message,
  });
}

/**
 * Handle payment_intent.canceled
 */
async function handlePaymentIntentCanceled(paymentIntent: any) {
  const rideId = paymentIntent.metadata?.rideId;
  if (!rideId) {
    console.log('[Webhook] No rideId in metadata, skipping');
    return;
  }
  
  console.log('[Webhook] Payment canceled:', {
    rideId,
    status: paymentIntent.status,
  });
  
  const rideRef = db.collection('rides').doc(rideId);
  
  await rideRef.update({
    paymentStatus: 'canceled',
    stripePaymentIntentStatus: paymentIntent.status,
    updatedAtMs: Date.now(),
  });
  
  // Log event
  await logWebhookEvent(rideId, 'payment_canceled', {
    status: paymentIntent.status,
  });
}

/**
 * Handle setup_intent.succeeded
 * Customer has successfully saved a payment method
 */
async function handleSetupIntentSucceeded(setupIntent: any) {
  console.log('[Webhook] SetupIntent succeeded:', {
    setupIntentId: setupIntent.id,
    customer: setupIntent.customer,
    paymentMethod: setupIntent.payment_method,
  });

  if (!setupIntent.customer || !setupIntent.payment_method) {
    console.log('[Webhook] SetupIntent missing customer or payment_method');
    return;
  }

  // Find user by Stripe customer ID
  const usersSnap = await db.collection('users')
    .where('stripeCustomerId', '==', setupIntent.customer)
    .limit(1)
    .get();

  if (usersSnap.empty) {
    console.log('[Webhook] No user found for customer:', setupIntent.customer);
    return;
  }

  const userDoc = usersSnap.docs[0];
  await userDoc.ref.update({
    stripePaymentMethodId: setupIntent.payment_method,
    paymentMethodSetupAtMs: Date.now(),
    updatedAtMs: Date.now(),
  });

  console.log(`[Webhook] Updated user ${userDoc.id} payment method`);
}

/**
 * Handle setup_intent.setup_failed
 */
async function handleSetupIntentFailed(setupIntent: any) {
  console.log('[Webhook] SetupIntent failed:', {
    setupIntentId: setupIntent.id,
    error: setupIntent.last_setup_error?.message || 'Unknown error',
  });
}

/**
 * Handle account.updated
 * For driver Connect accounts
 */
async function handleAccountUpdated(account: any) {
  console.log('[Webhook] Account updated:', {
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
  });
  const accountIdField = account.livemode ? 'stripeConnectAccountId_live' : 'stripeConnectAccountId_test';
  const statusField = account.livemode ? 'stripeConnectStatus_live' : 'stripeConnectStatus_test';
  
  // Find driver by Connect account ID
  const driversSnap = await db.collection('drivers')
    .where(accountIdField, '==', account.id)
    .limit(1)
    .get();
  
  if (driversSnap.empty) {
    console.log('[Webhook] No driver found with Connect account:', account.id);
    return;
  }
  
  const driverDoc = driversSnap.docs[0];
  const driverId = driverDoc.id;
  
  // Determine status based on capabilities
  let status = 'pending';
  if (account.charges_enabled && account.payouts_enabled) {
    status = 'active';
  } else if (account.requirements?.disabled_reason) {
    status = 'disabled';
  }
  
  await db.collection('drivers').doc(driverId).update({
    [statusField]: status,
    stripeConnectChargesEnabled: account.charges_enabled,
    stripeConnectPayoutsEnabled: account.payouts_enabled,
    updatedAtMs: Date.now(),
  });
  
  console.log('[Webhook] Updated driver Connect status:', {
    driverId,
    status,
  });
}

/**
 * Handle capability.updated
 */
async function handleCapabilityUpdated(
  capability: any,
  accountId: string | undefined,
<<<<<<< HEAD
  livemode: boolean
=======
  _livemode?: boolean
>>>>>>> aa34f7d (Fix: gate LIVE Connect before Stripe init/secrets access)
) {
  if (!accountId) {
    console.log('[Webhook] No account ID for capability update');
    return;
  }
  
  console.log('[Webhook] Capability updated:', {
    accountId,
    capability: capability.id,
    status: capability.status,
  });
  
  // Find driver by Connect account ID
  const accountIdField = livemode ? 'stripeConnectAccountId_live' : 'stripeConnectAccountId_test';

  const driversSnap = await db.collection('drivers')
    .where(accountIdField, '==', accountId)
    .limit(1)
    .get();
  
  if (driversSnap.empty) {
    console.log('[Webhook] No driver found with Connect account:', accountId);
    return;
  }
  
  const driverDoc = driversSnap.docs[0];
  const driverId = driverDoc.id;
  
  await db.collection('drivers').doc(driverId).update({
    [`stripeCapabilities.${capability.id}`]: capability.status,
    updatedAtMs: Date.now(),
  });
}

/**
 * Log webhook event for traceability
 */
async function logWebhookEvent(
  rideId: string,
  eventType: string,
  meta?: Record<string, any>
) {
  try {
    await db.collection('rides')
      .doc(rideId)
      .collection('events')
      .add({
        type: `webhook_${eventType}`,
        atMs: Date.now(),
        meta: meta || {},
      });
  } catch (error) {
    console.error('[Webhook] Error logging event:', error);
  }
}
