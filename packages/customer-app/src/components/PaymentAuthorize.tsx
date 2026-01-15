import { useState, useEffect, useRef } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { useToast } from './Toast';

// Initialize Stripe with your publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

// Log Stripe mode (only in dev)
if (import.meta.env.DEV) {
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
  const mode = stripeKey.startsWith('pk_test_') 
    ? 'TEST MODE' 
    : stripeKey.startsWith('pk_live_') 
      ? '🚨 LIVE MODE 🚨' 
      : 'UNKNOWN MODE';
  console.log(`[Stripe] Using ${mode}: ${stripeKey.substring(0, 15)}...`);
}

interface PaymentAuthorizeProps {
  rideId: string;
  amount: number; // in cents
  onSuccess: () => void;
  disabled?: boolean;
}

function PaymentForm({ rideId, amount, onSuccess, disabled = false }: PaymentAuthorizeProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { show } = useToast();
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirmingRef = useRef(false); // Prevent multiple confirms
  const [savedPaymentMethod, setSavedPaymentMethod] = useState<{
    id?: string;
    last4?: string;
    brand?: string;
    expMonth?: number;
    expYear?: number;
  } | null>(null);
  const [showNewCard, setShowNewCard] = useState(false);

  // Get payment state on mount
  useEffect(() => {
    const getPaymentState = async () => {
      try {
        // Call new getPaymentState function for authoritative state
        const getStateFn = httpsCallable(functions, 'getPaymentState');
        const result = await getStateFn({ rideId });
        const data = result.data as { 
          paymentStatus: string;
          paymentIntentStatus: string | null;
          clientSecret: string | null;
          needsConfirm: boolean;
        };
        
        console.log('[PaymentAuthorize] Payment state:', {
          paymentStatus: data.paymentStatus,
          paymentIntentStatus: data.paymentIntentStatus,
          needsConfirm: data.needsConfirm,
          hasClientSecret: !!data.clientSecret,
        });
        
        // Handle different payment states
        switch (data.paymentStatus) {
          case 'captured':
            // Payment already completed
            show('Payment already completed', 'success');
            onSuccess();
            return;
            
          case 'authorized':
            // Payment already authorized, no need to confirm again
            show('Payment already authorized', 'success');
            onSuccess();
            return;
            
          case 'requires_authorization':
            // Payment needs confirmation
            if (data.needsConfirm && data.clientSecret) {
              setClientSecret(data.clientSecret);
            } else {
              // PaymentIntent exists but not ready for confirm (e.g., processing)
              setError('Payment is being processed. Please wait...');
            }
            break;
            
          case 'cancelled':
          case 'failed':
            setError(`Payment ${data.paymentStatus}. Please try again.`);
            break;
            
          case 'none':
          default:
            // No payment yet, need to create one
            console.log('[PaymentAuthorize] Creating new payment intent...');
            const confirmPaymentFn = httpsCallable(functions, 'customerConfirmPayment');
            const confirmResult = await confirmPaymentFn({ rideId });
            const confirmData = confirmResult.data as { 
              clientSecret: string; 
              status: string;
              savedPaymentMethod?: {
                id?: string;
                last4?: string;
                brand?: string;
                expMonth?: number;
                expYear?: number;
              };
            };
            
            if (confirmData.status === 'requires_capture' || confirmData.status === 'succeeded') {
              onSuccess();
              return;
            }
            
            setClientSecret(confirmData.clientSecret);
            
            if (confirmData.savedPaymentMethod) {
              setSavedPaymentMethod(confirmData.savedPaymentMethod);
            }
        }
      } catch (error: any) {
        console.error('[PaymentAuthorize] Error getting payment state:', {
          code: error?.code,
          message: error?.message,
          details: error?.details,
        });
        const errorMsg = error?.message || 'Failed to initialize payment';
        setError(errorMsg);
        show(errorMsg, 'error');
      }
    };

    getPaymentState();
  }, [rideId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !clientSecret) {
      return;
    }

    // Prevent multiple confirms
    if (confirmingRef.current) {
      console.log('[PaymentAuthorize] Already confirming, ignoring duplicate submit');
      return;
    }

    confirmingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      let paymentIntent;
      
      // Use saved payment method if available and user didn't choose to add new card
      if (savedPaymentMethod && !showNewCard) {
        // Confirm with saved payment method
        const result = await stripe.confirmCardPayment(clientSecret, {
          payment_method: savedPaymentMethod.id,
        });
        
        if (result.error) {
          setError(result.error.message || 'Payment failed');
          show(result.error.message || 'Payment authorization failed', 'error');
          confirmingRef.current = false;
          setLoading(false);
          return;
        }
        
        paymentIntent = result.paymentIntent;
      } else {
        // Confirm with new card
        if (!elements) {
          throw new Error('Payment form not loaded');
        }
        
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
          throw new Error('Card element not found');
        }

        const result = await stripe.confirmCardPayment(
          clientSecret,
          {
            payment_method: {
              card: cardElement,
            },
          }
        );

        if (result.error) {
          setError(result.error.message || 'Payment failed');
          show(result.error.message || 'Payment authorization failed', 'error');
          confirmingRef.current = false;
          setLoading(false);
          return;
        }
        
        paymentIntent = result.paymentIntent;
      }

      if (paymentIntent?.status === 'requires_capture' || paymentIntent?.status === 'succeeded') {
        // Authorization succeeded, update backend
        const setAuthorizedFn = httpsCallable(functions, 'setPaymentAuthorized');
        await setAuthorizedFn({ rideId });

        show('Payment authorized successfully!', 'success');
        onSuccess();
      } else if (paymentIntent?.status === 'requires_action') {
        // 3DS authentication required - Stripe.js will handle this
        throw new Error('Additional authentication required');
      } else {
        console.error('[PaymentAuthorize] Unexpected payment status:', paymentIntent?.status);
        throw new Error(`Payment confirmation returned unexpected status: ${paymentIntent?.status}`);
      }
    } catch (error: any) {
      console.error('[PaymentAuthorize] Payment error:', {
        function: 'confirmCardPayment / setPaymentAuthorized',
        code: error?.code,
        message: error?.message,
        details: error?.details,
        stripeError: error?.type,
        stripeDeclineCode: error?.decline_code,
      });
      const errorMsg = error?.decline_code 
        ? `Card declined: ${error.decline_code}`
        : error?.message || 'A processing error occurred';
      setError(errorMsg);
      show(errorMsg, 'error');
    } finally {
      confirmingRef.current = false;
      setLoading(false);
    }
  };

  if (error && !clientSecret) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ 
          fontSize: '0.9rem', 
          color: '#ef4444',
          backgroundColor: 'rgba(239,68,68,0.1)',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid rgba(239,68,68,0.3)',
        }}>
          {error}
        </div>
        <div style={{ 
          fontSize: '0.8rem', 
          color: 'rgba(255,255,255,0.5)', 
          marginTop: '1rem' 
        }}>
          Check console for details
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
          Loading payment form...
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: '#fff' }}>
          Authorize Payment
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1rem' }}>
          Amount: <strong style={{ color: 'rgba(0,255,140,0.95)' }}>
            ${(amount / 100).toFixed(2)}
          </strong>
        </p>
        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1rem' }}>
          Your card will be authorized but not charged until the ride is completed.
        </p>
      </div>

      {/* Show saved payment method if available */}
      {savedPaymentMethod && !showNewCard ? (
        <div>
          <div style={{
            marginBottom: '1.5rem',
            padding: '16px',
            backgroundColor: 'rgba(0,255,140,0.05)',
            border: '1px solid rgba(0,255,140,0.3)',
            borderRadius: '8px',
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
                  Saved Payment Method
                </div>
                <div style={{ fontSize: '1rem', color: '#fff', fontWeight: '600' }}>
                  {savedPaymentMethod.brand?.toUpperCase()} •••• {savedPaymentMethod.last4}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                  Expires {savedPaymentMethod.expMonth}/{savedPaymentMethod.expYear}
                </div>
              </div>
              <div style={{ fontSize: '2rem' }}>💳</div>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => setShowNewCard(true)}
            style={{
              width: '100%',
              padding: '10px',
              marginBottom: '1rem',
              backgroundColor: 'transparent',
              color: 'rgba(33,150,243,0.95)',
              border: '1px solid rgba(33,150,243,0.3)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Use a different card
          </button>
        </div>
      ) : (
        <div>
          {savedPaymentMethod && (
            <button
              type="button"
              onClick={() => setShowNewCard(false)}
              style={{
                width: '100%',
                padding: '10px',
                marginBottom: '1rem',
                backgroundColor: 'transparent',
                color: 'rgba(33,150,243,0.95)',
                border: '1px solid rgba(33,150,243,0.3)',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              ← Use saved card ({savedPaymentMethod.brand?.toUpperCase()} •••• {savedPaymentMethod.last4})
            </button>
          )}
          
          <div style={{
            marginBottom: '1.5rem',
            padding: '14px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
          }}>
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#fff',
                    '::placeholder': {
                      color: 'rgba(255,255,255,0.4)',
                    },
                    iconColor: '#fff',
                  },
                  invalid: {
                    color: '#ef4444',
                    iconColor: '#ef4444',
                  },
                    },
                hidePostalCode: false,
              }}
            />
          </div>
          
          {!savedPaymentMethod && (
            <p style={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.4)',
              marginBottom: '1rem',
            }}>
              Your payment method will be saved for future rides.
            </p>
          )}
        </div>
      )}

      {error && (
        <div style={{
          marginBottom: '1rem',
          padding: '12px',
          backgroundColor: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '6px',
          fontSize: '0.85rem',
          color: '#ef4444',
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading || disabled}
        style={{
          width: '100%',
          padding: '14px',
          backgroundColor: (loading || disabled) ? '#666' : 'rgba(0,255,140,0.95)',
          color: (loading || disabled) ? '#fff' : '#000',
          border: 'none',
          borderRadius: '8px',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {loading 
          ? 'Authorizing...'
          : disabled
            ? 'Payment Disabled'
          : savedPaymentMethod && !showNewCard 
            ? 'Confirm Payment' 
            : 'Authorize Payment'}
      </button>

      {!savedPaymentMethod && (
        <p style={{
          marginTop: '1rem',
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.4)',
          textAlign: 'center',
        }}>
          Test card: 4242 4242 4242 4242 • Any future date • Any CVC
        </p>
      )}
    </form>
  );
}

export function PaymentAuthorize({ rideId, amount, onSuccess, disabled = false }: PaymentAuthorizeProps) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm rideId={rideId} amount={amount} onSuccess={onSuccess} disabled={disabled} />
    </Elements>
  );
}
