import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, db, auth } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from './Toast';

interface ReceiptProps {
  pickup?: { lat: number; lng: number };
  dropoff?: { lat: number; lng: number };
  pickupLabel?: string;
  dropoffLabel?: string;
  finalAmountCents: number;
  paymentStatus?: string;
  completedAtMs?: number;
  rideId: string;
  driverId?: string;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function Receipt({
  pickup,
  dropoff,
  pickupLabel,
  dropoffLabel,
  finalAmountCents,
  paymentStatus,
  completedAtMs,
  rideId,
  driverId,
}: ReceiptProps) {
  const { show } = useToast();
  const [settingPreferred, setSettingPreferred] = useState(false);
  const [isPreferred, setIsPreferred] = useState(false);
  const [checkingPreferred, setCheckingPreferred] = useState(true);
  const completedDate = completedAtMs ? new Date(completedAtMs) : new Date();

  // Check if this driver is already the preferred driver
  useEffect(() => {
    const checkPreferredDriver = async () => {
      const user = auth.currentUser;
      if (!user || !driverId) {
        setCheckingPreferred(false);
        return;
      }

      try {
        const customerDoc = await getDoc(doc(db, 'customers', user.uid));
        if (customerDoc.exists()) {
          const data = customerDoc.data();
          if (data.preferredDriverId === driverId) {
            setIsPreferred(true);
          }
        }
      } catch (error) {
        console.error('Failed to check preferred driver:', error);
      } finally {
        setCheckingPreferred(false);
      }
    };

    checkPreferredDriver();
  }, [driverId]);

  const handleSetPreferredDriver = async () => {
    if (!driverId) {
      show('Driver information not available', 'error');
      return;
    }

    setSettingPreferred(true);
    try {
      const callable = httpsCallable(functions, 'setPreferredDriver');
      await callable({ driverId });
      setIsPreferred(true);
      show('Driver set as preferred!', 'success');
    } catch (error: any) {
      console.error('Failed to set preferred driver:', error);
      show(error.message || 'Failed to set preferred driver', 'error');
    } finally {
      setSettingPreferred(false);
    }
  };

  return (
    <div style={{
      padding: '1.5rem',
      borderRadius: '12px',
      backgroundColor: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{
        textAlign: 'center',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
        <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', color: '#fff' }}>
          Trip Complete
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
          {completedDate.toLocaleDateString()} • {completedDate.toLocaleTimeString()}
        </p>
      </div>

      {/* Trip Details */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1rem',
        }}>
          <div style={{
            width: '32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '4px',
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0,255,140,0.95)',
              marginBottom: '4px',
            }} />
            <div style={{
              width: '2px',
              flex: 1,
              backgroundColor: 'rgba(255,255,255,0.2)',
              marginBottom: '4px',
            }} />
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '2px',
              backgroundColor: '#ef4444',
            }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                Pickup
              </div>
              <div style={{ fontSize: '0.9rem', color: '#fff' }}>
                {pickupLabel || `${pickup?.lat.toFixed(4)}, ${pickup?.lng.toFixed(4)}`}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                Dropoff
              </div>
              <div style={{ fontSize: '0.9rem', color: '#fff' }}>
                {dropoffLabel || `${dropoff?.lat.toFixed(4)}, ${dropoff?.lng.toFixed(4)}`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Summary */}
      <div style={{
        padding: '1rem',
        borderRadius: '8px',
        backgroundColor: 'rgba(0,255,140,0.05)',
        border: '1px solid rgba(0,255,140,0.2)',
        marginBottom: '1rem',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}>
          <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
            Total Charged
          </span>
          <span style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: 'rgba(0,255,140,0.95)',
          }}>
            {formatCents(finalAmountCents)}
          </span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
            Payment Status
          </span>
          <span style={{
            fontSize: '0.8rem',
            color: paymentStatus === 'captured' ? 'rgba(0,255,140,0.95)' : 'rgba(255,193,7,0.95)',
          }}>
            {paymentStatus === 'captured' ? '✓ Paid' : paymentStatus || 'Unknown'}
          </span>
        </div>
      </div>

      {/* Set as Preferred Driver Button */}
      {driverId && !checkingPreferred && (
        <>
          {!isPreferred ? (
            <button
              onClick={handleSetPreferredDriver}
              disabled={settingPreferred}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '1rem',
                backgroundColor: 'rgba(255,193,7,0.1)',
                border: '2px solid rgba(255,193,7,0.3)',
                borderRadius: '8px',
                color: 'rgba(255,193,7,0.95)',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: settingPreferred ? 'not-allowed' : 'pointer',
                opacity: settingPreferred ? 0.6 : 1,
                transition: 'all 0.2s',
              }}
            >
              {settingPreferred ? '⭐ Setting...' : '⭐ Set as Preferred Driver'}
            </button>
          ) : (
            <div style={{
              padding: '12px',
              marginBottom: '1rem',
              backgroundColor: 'rgba(0,255,140,0.1)',
              border: '2px solid rgba(0,255,140,0.3)',
              borderRadius: '8px',
              color: 'rgba(0,255,140,0.95)',
              fontSize: '0.9rem',
              fontWeight: '600',
              textAlign: 'center',
            }}>
              ✓ This is your preferred driver
            </div>
          )}
        </>
      )}
      {checkingPreferred && driverId && (
        <div style={{
          padding: '12px',
          marginBottom: '1rem',
          backgroundColor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          color: 'rgba(255,255,255,0.5)',
          fontSize: '0.85rem',
          textAlign: 'center',
        }}>
          Loading...
        </div>
      )}

      {/* Ride ID */}
      <div style={{
        fontSize: '0.75rem',
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
      }}>
        Ride ID: {rideId.slice(0, 8)}...
      </div>
    </div>
  );
}
