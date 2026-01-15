import React, { useEffect, useState } from 'react';
import { DriverProfile, driverSetOnline, getInitializedClient, RideOffer } from '@shiftx/driver-client';
import { doc, updateDoc } from 'firebase/firestore';
import { useHeartbeat } from '../hooks/useHeartbeat';
import { useToast } from './Toast';
import { Availability } from './Availability';
import { DriverStatusCard } from './DriverStatusCard';
import { QRCodeSVG } from 'qrcode.react';
import { TabId } from './BottomNav';
import { featureFlags } from '../config/featureFlags';
import { RuntimeFlags } from '../utils/runtimeFlags';

interface DriverHomeProps {
  driverId: string;
  profile: DriverProfile | null;
  hasActiveRide: boolean;
  activeRideId?: string;
  pendingOffers: Map<string, RideOffer>;
  onCreateTestRide: () => Promise<void>;
  onViewActiveRide?: () => void;
  setActiveTab: (tab: TabId) => void;
  runtimeFlags: RuntimeFlags | null;
}

export function DriverHome({ driverId, profile, hasActiveRide, activeRideId, pendingOffers, onCreateTestRide, onViewActiveRide, setActiveTab, runtimeFlags }: DriverHomeProps) {
  const { show } = useToast();
  const isOnline = profile?.isOnline ?? false;
  const driverPhotoURL = profile?.photoURL || null;
  
  // State machine: 'offline' | 'going_online' | 'online' | 'going_offline'
  type OnlineState = 'offline' | 'going_online' | 'online' | 'going_offline';
  const [onlineState, setOnlineState] = useState<OnlineState>('offline');
  
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [isSpawningDrivers, setIsSpawningDrivers] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied' | 'unavailable'>('prompt');

  // Check if on insecure origin (not localhost and not https)
  const isInsecureOrigin = typeof window !== 'undefined' 
    && window.location.protocol !== 'https:' 
    && !['localhost', '127.0.0.1'].includes(window.location.hostname);

  // Sync state machine with profile.isOnline
  useEffect(() => {
    // Always sync when profile updates, even during transitions
    const targetState = isOnline ? 'online' : 'offline';
    if (onlineState !== targetState) {
      console.log(`[DriverHome] Syncing state: ${onlineState} -> ${targetState}`);
      setOnlineState(targetState);
    }
  }, [isOnline]);

  // Start heartbeat ONLY when state is 'online'
  const { currentLocation, gpsError, lastFixAtMs, retryGps } = useHeartbeat(onlineState === 'online');

  // Check location permission status on mount
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocationPermission('unavailable');
      return;
    }
    
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setLocationPermission(result.state as any);
        result.addEventListener('change', () => {
          setLocationPermission(result.state as any);
        });
      }).catch(() => {
        setLocationPermission('prompt');
      });
    }
  }, []);

  const handleToggleOnline = async () => {
    console.log(`[DriverHome] handleToggleOnline: current state=${onlineState}, isOnline=${isOnline}`);
    
    // Prevent re-entry while transitioning
    if (onlineState === 'going_online' || onlineState === 'going_offline') {
      console.log('[DriverHome] Already transitioning, ignoring toggle');
      return;
    }

    if (onlineState === 'offline') {
      // Check runtime flags
      if (runtimeFlags?.disableDriverOnline) {
        show('Going online is temporarily disabled. System maintenance in progress.', 'warning');
        return;
      }

      // Check if driver is approved (unless they're an admin)
      if (!profile?.approved) {
        // Check if user is admin
        const { firestore } = getInitializedClient();
        const { doc: docRef, getDoc } = await import('firebase/firestore');
        const userRef = docRef(firestore, 'users', driverId);
        const userSnap = await getDoc(userRef);
        const isAdmin = userSnap.exists() && userSnap.data()?.role === 'admin';
        
        if (!isAdmin) {
          show('Your account is pending admin approval', 'warning');
          return;
        }
      }

      // Check for profile photo before going online
      if (!driverPhotoURL) {
        show('Please upload a profile photo before going online', 'error');
        setActiveTab('profile');
        return;
      }

      // Going online
      console.log('[DriverHome] Going online...');
      setOnlineState('going_online');

      if (!('geolocation' in navigator)) {
        show('Location services are not available on this device', 'error');
        setOnlineState('offline');
        return;
      }

      // Try to get location permission
      try {
        console.log('[DriverHome] Requesting initial location permission...');
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Location request timed out'));
          }, 10000);

          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(timeoutId);
              resolve(pos);
            },
            (err) => {
              clearTimeout(timeoutId);
              reject(err);
            },
            {
              enableHighAccuracy: false,
              timeout: 9000,
              maximumAge: 300000,
            }
          );
        });
        
        console.log('[DriverHome] Location permission granted:', position.coords);
      } catch (error: any) {
        const err = error as GeolocationPositionError;
        
        let errorMsg = 'Location error. ';
        if (err?.code === 1) {
          errorMsg += 'Permission denied - enable location in browser settings, then reload this page.';
        } else if (err?.code === 2) {
          errorMsg += 'Location unavailable - check device location settings.';
        } else if (err?.code === 3 || error.message?.includes('timeout')) {
          errorMsg += 'Location timeout - trying again may help.';
        } else {
          errorMsg += error.message || 'Unknown error.';
        }
        
        show(errorMsg, 'error');
        console.error('[DriverHome] Location error:', err);
        setOnlineState('offline');
        return;
      }

      // Call backend to go online
      try {
        console.log('[DriverHome] Calling driverSetOnline(true)');
        await driverSetOnline(true);
        show('Going online', 'success');
        console.log('[DriverHome] Successfully went online');
        // State will be synced by useEffect when profile updates
      } catch (error) {
        show(`Failed to go online: ${(error as Error).message}`, 'error');
        console.error('[DriverHome] Failed to go online:', error);
        setOnlineState('offline');
      }
    } else if (onlineState === 'online') {
      // Going offline
      console.log('[DriverHome] Going offline...');
      setOnlineState('going_offline');

      try {
        console.log('[DriverHome] Calling driverSetOnline(false)');
        await driverSetOnline(false);
        show('Going offline', 'success');
        console.log('[DriverHome] Successfully went offline');
        // State will be synced by useEffect when profile updates
      } catch (error) {
        show(`Failed to go offline: ${(error as Error).message}`, 'error');
        console.error('[DriverHome] Failed to go offline:', error);
        setOnlineState('online');
      }
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

  const customerAppUrl = import.meta.env.DEV 
    ? 'http://localhost:5173'
    : 'https://shiftx-95c4b-customer.web.app';
  const inviteUrl = `${customerAppUrl}?driverId=${driverId}`;
  
  const handleCopyInviteLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    show('Invite link copied to clipboard', 'success');
  };

  // Get top pending offer if exists
  const topOffer = profile?.currentRideId ? null : pendingOffers.size > 0 ? Array.from(pendingOffers.entries())[0] : null;

  // Determine GPS status for DriverStatusCard
  const gpsStatus: 'loading' | 'success' | 'error' = 
    onlineState !== 'online' ? 'loading' :
    gpsError ? 'error' : 
    currentLocation ? 'success' : 
    'loading';

  const isTransitioning = onlineState === 'going_online' || onlineState === 'going_offline';

  return (
    <div className="driver-home" style={{ paddingBottom: '80px' }}>
      {/* Card 1: Driver Status - New Component */}
      <DriverStatusCard
        driverId={driverId}
        isOnline={onlineState === 'online'}
        gpsStatus={gpsStatus}
        currentLocation={currentLocation}
        gpsError={gpsError}
        lastFixAtMs={lastFixAtMs}
        onToggleOnline={handleToggleOnline}
        onRetryGps={retryGps}
        isTransitioning={isTransitioning || hasActiveRide}
        hasPhoto={!!driverPhotoURL}
        disableGoOnline={runtimeFlags?.disableDriverOnline || false}
      />

      {/* Insecure Origin Warning */}
      {isInsecureOrigin && (
        <div className="info-banner">
          <p>⚠️ Location may not work on insecure origins. Use localhost or https.</p>
        </div>
      )}

      {/* Card 2: Current Work */}
      <div className="control-card">
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem' }}>💼 Current Work</h3>
        
        {hasActiveRide && activeRideId ? (
          <div style={{ 
            padding: '12px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="status-pill" style={{ backgroundColor: 'rgba(59, 130, 246, 0.9)', color: '#fff' }}>
                🚗 Active Ride
              </span>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                {activeRideId.slice(0, 8)}
              </span>
            </div>
            <button
              onClick={onViewActiveRide}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'rgba(59, 130, 246, 0.9)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              📍 Open Active Ride
            </button>
          </div>
        ) : topOffer ? (
          <div style={{ 
            padding: '12px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="status-pill" style={{ backgroundColor: 'rgba(16, 185, 129, 0.9)', color: '#000' }}>
                ⚡ New Offer
              </span>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                {topOffer[0].slice(0, 8)}
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', margin: '8px 0' }}>
              Expires: {Math.max(0, Math.floor(((topOffer[1].expiresAtMs || 0) - Date.now()) / 1000))}s
            </p>
            <button
              onClick={() => setActiveTab('rides')}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.9)',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              👀 View Offer
            </button>
          </div>
        ) : (
          <div style={{ 
            padding: '16px',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.4)',
            backgroundColor: 'rgba(255,255,255,0.02)',
            borderRadius: '8px',
            border: '1px dashed rgba(255,255,255,0.1)'
          }}>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>No requests yet</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem' }}>
              {onlineState === 'online' ? 'Waiting for ride requests...' : 'Go online to receive requests'}
            </p>
          </div>
        )}
      </div>

      {/* Card 3: Quick Actions */}
      <div className="control-card">
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem' }}>⚡ Quick Actions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => setShowAvailability(!showAvailability)}
            className="quick-action-button"
          >
            ⏰ {showAvailability ? 'Hide' : 'Set'} Availability
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className="quick-action-button"
          >
            🚗 Vehicle & Rates
          </button>
          <button
            onClick={handleCopyInviteLink}
            className="quick-action-button"
          >
            🔗 Invite Preferred Customers
          </button>
        </div>
      </div>
      {/* Expanded Availability Section */}
      {showAvailability && (
        <div className="control-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>⏰ Set Availability</h3>
            <button
              onClick={() => setShowAvailability(false)}
              style={{
                padding: '4px 12px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.8)',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Hide
            </button>
          </div>
          <Availability />
        </div>
      )}

      {/* Warning Banners */}
      {isInsecureOrigin && (
        <div className="info-banner" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.3)' }}>
          <p style={{ color: '#fbbf24' }}>
            ⚠️ <strong>Insecure origin detected</strong><br />
            Geolocation may not work reliably over HTTP. Use HTTPS in production.
          </p>
        </div>
      )}

      {locationPermission === 'denied' && onlineState === 'offline' && (
        <div className="info-banner" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <p style={{ color: '#ef4444' }}>
            ⚠️ <strong>Location permission denied</strong><br />
            Enable location access in your browser settings, then click the button below.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            🔄 Reload App
          </button>
        </div>
      )}

      {/* Dev Tools */}
      {featureFlags.enableDevTools && (
        <div className="control-card">
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem' }}>🧪 Dev Tools</h3>
        
        <div style={{ marginBottom: '12px' }}>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '8px' }}>Test Ride</p>
          <button
            onClick={handleCreateTestRide}
            disabled={isCreatingTest || onlineState !== 'online'}
            className="secondary-button"
            style={{ width: '100%' }}
          >
            {isCreatingTest ? 'Creating...' : 'Create test ride'}
          </button>
          {onlineState !== 'online' && <p className="text-muted small">Go online to create test rides</p>}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '8px' }}>Spawn Fake Drivers</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleSpawnDrivers(5, true)}
              disabled={isSpawningDrivers}
              className="secondary-button"
              style={{ flex: 1, fontSize: '0.85rem', padding: '8px' }}
            >
              5 Online
            </button>
            <button
              onClick={() => handleSpawnDrivers(10, true)}
              disabled={isSpawningDrivers}
              className="secondary-button"
              style={{ flex: 1, fontSize: '0.85rem', padding: '8px' }}
            >
              10 Online
            </button>
            <button
              onClick={() => handleSpawnDrivers(5, false)}
              disabled={isSpawningDrivers}
              className="secondary-button"
              style={{ flex: 1, fontSize: '0.85rem', padding: '8px' }}
            >
              5 Offline
            </button>
          </div>
        </div>

        <div>
          <button
            onClick={handleRunCleanup}
            disabled={isSpawningDrivers}
            className="secondary-button"
            style={{ width: '100%' }}
          >
            {isSpawningDrivers ? 'Running...' : '🧹 Run Cleanup Job'}
          </button>
          <p className="text-muted small" style={{ marginTop: '8px', fontSize: '0.75rem' }}>
            Cancels stuck rides, expires old offers, marks ghost drivers offline
          </p>
        </div>
        </div>
      )}
    </div>
  );
}
