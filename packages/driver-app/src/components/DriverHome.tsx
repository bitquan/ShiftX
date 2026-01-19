import React, { useEffect, useState } from 'react';
import { DriverProfile, driverSetOnline, getInitializedClient, RideOffer } from '@shiftx/driver-client';
import { useHeartbeat } from '../hooks/useHeartbeat';
import { useToast } from './Toast';
import { BottomSheet } from './BottomSheet';
import { DriverSheetCollapsed } from './DriverSheetCollapsed';
import { DriverSheetExpanded } from './DriverSheetExpanded';
import { CameraToggle } from './CameraToggle';
import { TabId } from './BottomNav';
import { RuntimeFlags } from '../utils/runtimeFlags';
import { MapShell } from '../layout/MapShell';
import { SharedMap } from './map/SharedMap';
import { EnvironmentBadge } from './EnvironmentBadge';
import { DriverUiState } from '../utils/mapDriverUiState';

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
  const [cameraMode, setCameraMode] = useState<'follow' | 'overview'>('follow');

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

  // Simple placeholder map for Phase 1  
  const driverLocation = currentLocation ?? { lat: 38.8976, lng: -77.0369 }; // DC default

  // Build UI state for mapping
  const driverUiState: DriverUiState = {
    profile,
    hasActiveRide,
    activeRideId,
    pendingOffers,
    onlineState,
    isTransitioning,
    gpsStatus,
    currentLocation,
    gpsError,
  };
  
  // TODO Phase 3: Determine if there's an active route (pickup or dropoff navigation)
  const hasActiveRoute = false; // Will be true when en_route_to_pickup or en_route_to_dropoff

  return (
    <MapShell
      map={
        <SharedMap
          center={driverLocation}
          driverLocation={driverLocation}
          pickup={null}
          dropoff={null}
          routeCoords={null}
          shouldFit={false}
        />
      }
      topCenter={<EnvironmentBadge />}
      rightStack={
        <CameraToggle
          mode={cameraMode}
          onModeChange={setCameraMode}
          hasRoute={hasActiveRoute}
        />
      }
      bottomPanel={
        <BottomSheet
          defaultSnap="collapsed"
          collapsedContent={
            <DriverSheetCollapsed
              state={driverUiState}
              onToggleOnline={handleToggleOnline}
            />
          }
          expandedContent={
            <DriverSheetExpanded
              state={driverUiState}
              driverId={driverId}
              driverPhotoURL={driverPhotoURL}
              onToggleOnline={handleToggleOnline}
              onRetryGps={retryGps}
              onCreateTestRide={handleCreateTestRide}
              onViewActiveRide={onViewActiveRide}
              setActiveTab={setActiveTab}
              runtimeFlags={runtimeFlags}
              isInsecureOrigin={isInsecureOrigin}
              showAvailability={showAvailability}
              setShowAvailability={setShowAvailability}
              isCreatingTest={isCreatingTest}
              isSpawningDrivers={isSpawningDrivers}
              onSpawnDrivers={handleSpawnDrivers}
              onCleanupTestData={handleRunCleanup}
            />
          }
        />
      }
    />
  );
}
