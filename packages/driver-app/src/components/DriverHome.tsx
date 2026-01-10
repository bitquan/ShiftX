import React, { useEffect, useState } from 'react';
import { DriverProfile, driverSetOnline, getInitializedClient } from '@shiftx/driver-client';
import { doc, updateDoc } from 'firebase/firestore';
import { useHeartbeat } from '../hooks/useHeartbeat';
import { useToast } from './Toast';
import { Availability } from './Availability';
import { QRCodeSVG } from 'qrcode.react';

interface DriverHomeProps {
  driverId: string;
  profile: DriverProfile | null;
  hasActiveRide: boolean;
  activeRideId?: string;
  onCreateTestRide: () => Promise<void>;
  onViewActiveRide?: () => void;
}

export function DriverHome({ driverId, profile, hasActiveRide, activeRideId, onCreateTestRide, onViewActiveRide }: DriverHomeProps) {
  const { show } = useToast();
  const isOnline = profile?.isOnline ?? false;
  const [isToggling, setIsToggling] = useState(false);
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [isSpawningDrivers, setIsSpawningDrivers] = useState(false);

  // Start heartbeat when online, stop when offline
  useHeartbeat(isOnline);

  const handleToggleOnline = async () => {
    setIsToggling(true);
    try {
      await driverSetOnline(!isOnline);
      show(isOnline ? 'Going offline' : 'Going online', 'success');
    } catch (error) {
      show(`Failed to toggle online status: ${(error as Error).message}`, 'error');
    } finally {
      setIsToggling(false);
    }
  };

  const handleCreateTestRide = async () => {
    setIsCreatingTest(true);
    try {
      await onCreateTestRide();
      show('Test ride created', 'success');
    } catch (error) {
      show(`Failed to create test ride: ${(error as Error).message}`, 'error');
    } finally {
      setIsCreatingTest(false);
    }
  };

  const handleSpawnDrivers = async (count: number, online: boolean) => {
    setIsSpawningDrivers(true);
    try {
      const { functions } = getInitializedClient();
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const devSeedDrivers = httpsCallable(functions, 'devSeedDrivers');
      const result = await devSeedDrivers({ count, online });
      const data = result.data as { message: string; count: number };
      show(`✅ ${data.message}`, 'success');
    } catch (error) {
      show(`Failed to spawn drivers: ${(error as Error).message}`, 'error');
    } finally {
      setIsSpawningDrivers(false);
    }
  };

  const handleRunCleanup = async () => {
    setIsSpawningDrivers(true); // Reuse loading state
    try {
      const { functions } = getInitializedClient();
      const { httpsCallable } = await import('firebase/functions');
      const manualCleanup = httpsCallable(functions, 'manualCleanup');
      const result = await manualCleanup({});
      const data = result.data as { cancelledRides: number; expiredOffers: number; offlineDrivers: number };
      show(`🧹 Cleanup: ${data.cancelledRides} rides cancelled, ${data.expiredOffers} offers expired, ${data.offlineDrivers} drivers offline`, 'success');
    } catch (error) {
      show(`Failed to run cleanup: ${(error as Error).message}`, 'error');
    } finally {
      setIsSpawningDrivers(false);
    }
  };

  const inviteUrl = `${window.location.origin}/invite?driver=${driverId}`;
  
  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    show('Invite link copied to clipboard', 'success');
  };

  return (
    <div className="driver-home" style={{ paddingBottom: '80px' }}>
      <div className="driver-header">
        <div className="driver-info">
          <p className="driver-id">Driver ID: <code>{driverId}</code></p>
          <p className="driver-status">
            <span className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
              {isOnline ? '● Online' : '○ Offline'}
            </span>
          </p>
        </div>
        <button
          onClick={handleToggleOnline}
          disabled={isToggling || hasActiveRide}
          className={`toggle-button ${isOnline ? 'going-offline' : 'going-online'}`}
        >
          {isToggling ? 'Updating...' : isOnline ? 'Go offline' : 'Go online'}
        </button>
      </div>

      {hasActiveRide && (
        <div className="info-banner clickable" onClick={onViewActiveRide} style={{ cursor: 'pointer' }}>
          <p>
            ⚠️ You have an active ride: <code>{activeRideId}</code>
            <br />
            <strong>Click here to view it, or </strong>
            <button 
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const { firestore } = getInitializedClient();
                  await updateDoc(doc(firestore, 'drivers', driverId), {
                    isBusy: false,
                    currentRideId: null,
                    currentRideStatus: null,
                  });
                  show('Driver state cleared', 'success');
                } catch (err) {
                  show(`Failed to clear state: ${(err as Error).message}`, 'error');
                }
              }}
              style={{ 
                marginLeft: '8px', 
                padding: '4px 8px', 
                fontSize: '12px',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              force clear
            </button>
          </p>
        </div>
      )}

      <div className="test-section">
        <h2>🔗 Invite Preferred Customers</h2>
        <p className="text-muted">Share this QR code or link with customers to become their preferred driver</p>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
          <QRCodeSVG value={inviteUrl} size={180} />
          <button
            onClick={handleCopyInviteLink}
            className="secondary-button"
          >
            📋 Copy Invite Link
          </button>
        </div>
      </div>

      <div className="test-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ margin: 0 }}>⏰ Scheduled Rides</h2>
          <button
            onClick={() => setShowAvailability(!showAvailability)}
            className="secondary-button"
            style={{ fontSize: '0.9rem' }}
          >
            {showAvailability ? 'Hide' : 'Set Availability'}
          </button>
        </div>
        {showAvailability ? (
          <Availability />
        ) : (
          <p className="text-muted">Set your weekly availability to accept scheduled rides from preferred customers</p>
        )}
      </div>

      <div className="test-section">
        <h2>Test Ride</h2>
        <p className="text-muted">Create a test ride to receive an offer</p>
        <button
          onClick={handleCreateTestRide}
          disabled={isCreatingTest || !isOnline}
          className="primary-button"
        >
          {isCreatingTest ? 'Creating...' : 'Create test ride'}
        </button>
        {!isOnline && <p className="text-muted small">Go online to create test rides</p>}
      </div>

      <div className="test-section">
        <h2>🧪 Dev Tools</h2>
        <p className="text-muted">Spawn fake drivers for testing</p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            onClick={() => handleSpawnDrivers(5, true)}
            disabled={isSpawningDrivers}
            className="secondary-button"
          >
            {isSpawningDrivers ? 'Spawning...' : '5 Online Drivers'}
          </button>
          <button
            onClick={() => handleSpawnDrivers(10, true)}
            disabled={isSpawningDrivers}
            className="secondary-button"
          >
            {isSpawningDrivers ? 'Spawning...' : '10 Online Drivers'}
          </button>
          <button
            onClick={() => handleSpawnDrivers(5, false)}
            disabled={isSpawningDrivers}
            className="secondary-button"
          >
            {isSpawningDrivers ? 'Spawning...' : '5 Offline Drivers'}
          </button>
        </div>
        <div style={{ marginTop: '12px' }}>
          <button
            onClick={handleRunCleanup}
            disabled={isSpawningDrivers}
            className="secondary-button"
            style={{ width: '100%' }}
          >
            {isSpawningDrivers ? 'Running...' : '🧹 Run Cleanup Job'}
          </button>
          <p className="text-muted small" style={{ marginTop: '8px' }}>
            Cancels stuck rides, expires old offers, marks ghost drivers offline
          </p>
        </div>
      </div>
    </div>
  );
}
