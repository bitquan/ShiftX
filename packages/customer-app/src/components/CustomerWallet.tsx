import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { httpsCallable } from 'firebase/functions';
import { functions, db, auth } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useToast } from './Toast';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
console.log('[CustomerWallet] Stripe key configured:', !!stripePublishableKey);

const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface SetupFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function SetupForm({ onSuccess, onCancel }: SetupFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { show } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.origin,
        },
        redirect: 'if_required',
      });

      if (error) {
        show(error.message || 'Failed to save card', 'error');
        setIsProcessing(false);
        return;
      }

      if (setupIntent && setupIntent.payment_method) {
        // Set as default payment method
        const setDefaultFn = httpsCallable(functions, 'setDefaultPaymentMethod');
        await setDefaultFn({ paymentMethodId: setupIntent.payment_method });
        
        show('Card saved successfully!', 'success');
        onSuccess();
      }
    } catch (error: any) {
      console.error('Setup error:', error);
      show(error.message || 'Failed to save card', 'error');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          style={{
            flex: 1,
            padding: '12px',
            background: isProcessing ? '#666' : 'linear-gradient(135deg, rgba(0,255,140,0.95) 0%, rgba(0,200,120,0.9) 100%)',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
          }}
        >
          {isProcessing ? 'Saving...' : 'Save Card'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          style={{
            flex: 1,
            padding: '12px',
            background: 'transparent',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function CustomerWallet() {
  const { show } = useToast();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupClientSecret, setSetupClientSecret] = useState<string | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [defaultSummary, setDefaultSummary] = useState<any>(null);
  const [stripeNotConfigured, setStripeNotConfigured] = useState(false);

  // Listen to customer document for default payment method summary
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'customers', user.uid), (snap) => {
      if (snap.exists()) {
        setDefaultSummary(snap.data().defaultPaymentMethodSummary || null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load payment methods
  const loadPaymentMethods = async () => {
    setLoading(true);
    try {
      const listFn = httpsCallable(functions, 'listPaymentMethods');
      const result = await listFn();
      const data = result.data as any;
      setPaymentMethods(data.paymentMethods || []);
      setStripeNotConfigured(false);
    } catch (error: any) {
      console.error('Failed to load payment methods:', error);
      if (error.code === 'functions/failed-precondition') {
        setStripeNotConfigured(true);
      } else {
        show('Failed to load payment methods', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const handleAddCard = async () => {
    try {
      const createSetupFn = httpsCallable(functions, 'createSetupIntent');
      const result = await createSetupFn();
      const data = result.data as any;
      setSetupClientSecret(data.clientSecret);
      setShowAddCard(true);
    } catch (error: any) {
      console.error('Failed to create setup intent:', error);
      if (error.code === 'functions/failed-precondition') {
        show('Payment system not configured. Please contact support.', 'error');
      } else {
        show('Failed to start card setup', 'error');
      }
    }
  };

  const handleSetupSuccess = () => {
    setShowAddCard(false);
    setSetupClientSecret(null);
    loadPaymentMethods();
  };

  const handleRemoveCard = async (paymentMethodId: string) => {
    if (!confirm('Remove this payment method?')) return;

    try {
      const detachFn = httpsCallable(functions, 'detachPaymentMethod');
      await detachFn({ paymentMethodId });
      show('Payment method removed', 'success');
      loadPaymentMethods();
    } catch (error: any) {
      console.error('Failed to remove payment method:', error);
      show('Failed to remove payment method', 'error');
    }
  };

  if (loading) {
    return (
      <div className="screen-container">
        <div className="card">
          <h2>💳 Wallet</h2>
          <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.5)' }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (stripeNotConfigured) {
    return (
      <div className="screen-container">
        <div className="card">
          <h2>💳 Wallet</h2>
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: 'rgba(255,193,7,0.1)',
            border: '1px solid rgba(255,193,7,0.3)',
            borderRadius: '12px',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
            <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '0.5rem' }}>
              Wallet Not Available
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1rem' }}>
              The payment system is not configured in development mode.
            </p>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
              You can still request rides and test payment during ride flow.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-container">
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>💳 Wallet</h2>

        {!showAddCard ? (
          <>
            {/* Default Card Display */}
            {defaultSummary || paymentMethods.length > 0 ? (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', marginBottom: '1rem' }}>
                  Saved Payment Method
                </h3>
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '2px solid rgba(0,255,140,0.3)',
                  borderRadius: '12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                        {defaultSummary?.brand?.toUpperCase() || paymentMethods[0]?.brand?.toUpperCase() || 'CARD'} •••• {defaultSummary?.last4 || paymentMethods[0]?.last4 || '****'}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
                        Expires {defaultSummary?.expMonth || paymentMethods[0]?.expMonth}/{defaultSummary?.expYear || paymentMethods[0]?.expYear}
                      </div>
                    </div>
                    <div style={{
                      padding: '6px 12px',
                      backgroundColor: 'rgba(0,255,140,0.1)',
                      border: '1px solid rgba(0,255,140,0.3)',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      color: 'rgba(0,255,140,0.95)',
                      fontWeight: '600',
                    }}>
                      ✓ DEFAULT
                    </div>
                  </div>
                </div>

                {/* All Payment Methods List */}
                {paymentMethods.length > 1 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.75rem' }}>
                      Other Cards
                    </h4>
                    {paymentMethods.filter(pm => !pm.isDefault).map((pm) => (
                      <div
                        key={pm.id}
                        style={{
                          padding: '1rem',
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          marginBottom: '0.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.9rem', color: '#fff' }}>
                            {pm.brand.toUpperCase()} •••• {pm.last4}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                            Expires {pm.expMonth}/{pm.expYear}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveCard(pm.id)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'rgba(255,68,68,0.1)',
                            border: '1px solid rgba(255,68,68,0.3)',
                            borderRadius: '6px',
                            color: 'rgba(255,68,68,0.95)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px dashed rgba(255,255,255,0.2)',
                borderRadius: '12px',
                marginBottom: '1.5rem',
              }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💳</div>
                <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '0.5rem' }}>
                  No Payment Method Saved
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                  Add a card to request rides faster
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button
                onClick={handleAddCard}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(135deg, rgba(0,255,140,0.95) 0%, rgba(0,200,120,0.9) 100%)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                {paymentMethods.length > 0 ? '+ Add Another Card' : '+ Add Payment Method'}
              </button>
            </div>
          </>
        ) : (
          /* Add Card Form */
          <div>
            <h3 style={{ fontSize: '1rem', color: '#fff', marginBottom: '1.5rem' }}>
              Add Payment Method
            </h3>
            {!stripePromise ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.6)',
              }}>
                <p>⚠️ Stripe is not configured</p>
              </div>
            ) : !setupClientSecret ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'rgba(255,255,255,0.6)',
              }}>
                <p>Loading...</p>
              </div>
            ) : (
              <Elements stripe={stripePromise} options={{ clientSecret: setupClientSecret }}>
                <SetupForm
                  onSuccess={handleSetupSuccess}
                  onCancel={() => {
                    setShowAddCard(false);
                    setSetupClientSecret(null);
                  }}
                />
              </Elements>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
