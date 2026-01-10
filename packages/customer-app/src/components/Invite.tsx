import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { useToast } from './Toast';

interface InviteProps {
  driverId: string | null;
  onComplete: () => void;
}

export function Invite({ driverId, onComplete }: InviteProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [driverInfo, setDriverInfo] = useState<{ email?: string } | null>(null);
  const { show } = useToast();

  useEffect(() => {
    if (!driverId) {
      show('No driver ID provided', 'error');
      return;
    }
    
    // In a real app, you might fetch driver info to show their name
    // For now, just show the driverId
    setDriverInfo({ email: driverId });
  }, [driverId, show]);

  const handleAcceptInvite = async () => {
    if (!driverId) {
      show('No driver ID provided', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const callable = httpsCallable(functions, 'setPreferredDriver');
      await callable({ driverId });
      
      show('Preferred driver set successfully!', 'success');
      setTimeout(onComplete, 1500);
    } catch (error: any) {
      console.error('Failed to set preferred driver:', error);
      show(error.message || 'Failed to set preferred driver', 'error');
      setIsProcessing(false);
    }
  };

  if (!driverId) {
    return (
      <div className="screen-container">
        <div className="card">
          <h2>Invalid Invite</h2>
          <p>No driver ID found in the invite link.</p>
          <button onClick={onComplete} style={{ marginTop: '1rem' }}>
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen-container">
      <div className="card">
        <h2>🚗 Driver Invite</h2>
        <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
          <p style={{ marginBottom: '1rem', color: 'rgba(255,255,255,0.8)' }}>
            You've been invited to set a preferred driver.
          </p>
          {driverInfo && (
            <div style={{ 
              background: 'rgba(255,255,255,0.05)', 
              padding: '1rem', 
              borderRadius: '0.5rem',
              marginBottom: '1rem'
            }}>
              <strong>Driver ID:</strong> {driverId}
            </div>
          )}
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
            Setting a preferred driver allows you to schedule rides with them directly.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button
            onClick={handleAcceptInvite}
            disabled={isProcessing}
            style={{
              flex: 1,
              opacity: isProcessing ? 0.6 : 1,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
            }}
          >
            {isProcessing ? 'Setting...' : 'Accept & Set Preferred Driver'}
          </button>
          <button
            onClick={onComplete}
            disabled={isProcessing}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              opacity: isProcessing ? 0.6 : 1,
              cursor: isProcessing ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
