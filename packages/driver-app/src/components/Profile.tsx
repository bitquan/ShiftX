import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from './Toast';

interface ProfileProps {
  driverId: string;
  onboardingStatus: string;
}

export function Profile({ driverId, onboardingStatus }: ProfileProps) {
  const { show } = useToast();
  
  // Driver invite URL points to customer app
  const customerAppUrl = import.meta.env.DEV 
    ? window.location.origin.replace('4173', '5173')
    : window.location.origin;
  const inviteUrl = `${customerAppUrl}?driverId=${driverId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    show('Invite link copied to clipboard', 'success');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Become my preferred customer',
          text: 'Set me as your preferred driver',
          url: inviteUrl,
        });
        show('Shared successfully', 'success');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          show('Share failed', 'error');
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="driver-home" style={{ paddingBottom: '80px' }}>
      <h2>👤 Driver Profile</h2>
      
      <div className="test-section">
        <h3>Account Info</h3>
        <div style={{ marginTop: '0.75rem' }}>
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>Driver ID:</strong> <code>{driverId}</code>
          </p>
          <p>
            <strong>Status:</strong> <span style={{ 
              color: onboardingStatus === 'active' ? '#10b981' : '#fbbf24',
              fontWeight: '600'
            }}>{onboardingStatus}</span>
          </p>
        </div>
      </div>

      <div className="test-section">
        <h3>🔗 Invite Preferred Customers</h3>
        <p className="text-muted">Share this QR code or link with customers to become their preferred driver</p>
        
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '12px', 
          marginTop: '12px' 
        }}>
          <QRCodeSVG value={inviteUrl} size={180} />
          
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button
              onClick={handleCopyLink}
              className="secondary-button"
              style={{ flex: 1 }}
            >
              📋 Copy Link
            </button>
            <button
              onClick={handleShare}
              className="primary-button"
              style={{ flex: 1 }}
            >
              📤 Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
