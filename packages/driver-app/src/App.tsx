import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User, setPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, app } from './firebase';
import { signOut } from 'firebase/auth';
import {
  DriverProfile,
  RideOffer,
  createTestRide,
  watchDriverOffers,
  watchDriverProfile,
} from '@shiftx/driver-client';
import { AuthGate } from './components/AuthGate';
import { DriverHome } from './components/DriverHome';
import { AvailableRides } from './components/AvailableRides';
import { Profile } from './components/Profile';
import { Wallet } from './components/Wallet';
import { RideHistory } from './components/RideHistory';
import { SideSheet, NavItem } from './components/SideSheet';
import { MenuButton } from './components/MenuButton';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { ProdDiagnostics } from './components/ProdDiagnostics';
import { MaintenanceBanner } from './components/MaintenanceBanner';
import { EnvironmentBadge } from './components/EnvironmentBadge';
import { EnvironmentWarningBanner } from './components/EnvironmentWarningBanner';
import { watchRuntimeFlags, RuntimeFlags } from './utils/runtimeFlags';
import { logEvent } from './utils/eventLog';
import './styles.css';

type AppState = 'auth' | 'home';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [pendingOffers, setPendingOffers] = useState<Map<string, RideOffer>>(new Map());
  const [appState, setAppState] = useState<AppState>('auth');
  const [activeTab, setActiveTab] = useState<NavItem>('home');
  const [navHistory, setNavHistory] = useState<NavItem[]>(['home']);
  const [isSideSheetOpen, setIsSideSheetOpen] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<'pending' | 'active' | 'suspended' | null>(null);
  const lastOfferStatusRef = useRef<Map<string, string>>(new Map()); // Track last status per rideId
  const [newOfferRideId, setNewOfferRideId] = useState<string | null>(null); // For showing modal on NEW offers
  const isSigningOutRef = useRef(false); // Prevent auto sign-in during sign out
  const [runtimeFlags, setRuntimeFlags] = useState<RuntimeFlags | null>(null);
  const [gpsDebugData, setGpsDebugData] = useState<{ currentLocation: { lat: number; lng: number } | null; gpsError: string | null; lastFixAtMs: number | null; hasGpsFix: boolean } | null>(null);

  // Auth setup
  useEffect(() => {
    // Set persistence to indexedDB for reliable login across sessions
    setPersistence(auth, indexedDBLocalPersistence).catch((err) => {
      console.error('Failed to set auth persistence:', err);
    });
    
    const unsubscribe = onAuthStateChanged(auth, async (driver) => {
      setUser(driver);
      setIsLoadingAuth(false);

      if (driver) {
        logEvent('auth', 'User signed in', { uid: driver.uid, email: driver.email });
      } else {
        logEvent('auth', 'User signed out');
      }

      // Create user and driver docs on first login
      if (driver) {
        try {
          const userRef = doc(db, 'users', driver.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              email: driver.email,
              createdAtMs: Date.now(),
              role: 'driver',
            });
            logEvent('system', 'Created new user document', { uid: driver.uid });
          }

          const driverRef = doc(db, 'drivers', driver.uid);
          const driverSnap = await getDoc(driverRef);
          
          if (!driverSnap.exists()) {
            await setDoc(driverRef, {
              isOnline: false,
              isBusy: false,
              onboardingStatus: 'active',
              approved: false,
              createdAtMs: Date.now(),
              updatedAtMs: Date.now(),
            });
            setOnboardingStatus('active');
          } else {
            const status = driverSnap.data()?.onboardingStatus || 'active';
            setOnboardingStatus(status);
          }
        } catch (error) {
          console.error('Failed to create user/driver docs:', error);
        }
      } else {
        setOnboardingStatus(null);
      }
    });

    return unsubscribe;
  }, []);

  // Runtime flags listener
  useEffect(() => {
    const unsubscribe = watchRuntimeFlags((flags) => {
      console.log('[App] Runtime flags updated:', flags);
      setRuntimeFlags(flags);
    });

    return () => unsubscribe();
  }, []);

  // Driver profile listener with stale currentRideId cleanup
  useEffect(() => {
    if (!user || onboardingStatus !== 'active') {
      setDriverProfile(null);
      return;
    }

    const unsubscribe = watchDriverProfile(
      user.uid,
      async (profile) => {
        // GUARD: Check if currentRideId points to a stale/completed ride
        if (profile?.currentRideId) {
          try {
            const { watchRide } = await import('@shiftx/driver-client');
            const rideRef = { current: null as any };
            
            // Fetch ride once to check status
            const unsubRide = watchRide(
              profile.currentRideId,
              (ride) => {
                rideRef.current = ride;
                unsubRide(); // Unsubscribe immediately after first read
                
                if (!ride || ['completed', 'cancelled'].includes(ride.status)) {
                  console.warn('[App] Detected stale currentRideId, cleaning up...', {
                    rideId: profile.currentRideId,
                    status: ride?.status,
                  });
                  
                  // Clear stale currentRideId from driver profile
                  import('firebase/firestore').then(({ updateDoc, doc }) => {
                    const driverRef = doc(db, 'drivers', user.uid);
                    updateDoc(driverRef, {
                      currentRideId: null,
                      currentRideStatus: null,
                      isBusy: false,
                      updatedAtMs: Date.now(),
                    }).catch((err: any) => console.error('[App] Failed to clear stale currentRideId:', err));
                  });
                  
                  // Don't set the profile with stale data
                  setDriverProfile({
                    ...profile,
                    currentRideId: undefined,
                    currentRideStatus: undefined,
                    isBusy: false,
                  });
                } else {
                  // Ride is valid, set profile normally
                  setDriverProfile(profile);
                }
              },
              (err: any) => {
                console.error('[App] Failed to verify currentRideId:', err);
                // On error, still set the profile but log warning
                setDriverProfile(profile);
              }
            );
          } catch (err) {
            console.error('[App] Error checking currentRideId:', err);
            setDriverProfile(profile);
          }
        } else {
          // No currentRideId, set profile normally
          setDriverProfile(profile);
        }
        
        if (profile?.onboardingStatus) {
          setOnboardingStatus(profile.onboardingStatus as 'pending' | 'active' | 'suspended');
        }
      },
      (err) => console.error('Profile error:', err)
    );

    return () => unsubscribe();
  }, [user, onboardingStatus]);

  // Offers listener
  useEffect(() => {
    if (!user || onboardingStatus !== 'active') {
      setPendingOffers(new Map());
      // Clear any stale offer modal state when going offline
      lastOfferStatusRef.current.clear();
      setNewOfferRideId(null);
      return;
    }

    const unsubscribe = watchDriverOffers(
      user.uid,
      async (driverOffers) => {
        const now = Date.now();
        const pendingMap = new Map<string, RideOffer>();
        
        console.log(`[App] watchDriverOffers fired with ${driverOffers.length} offer(s)`);
        logEvent('offer', `Received ${driverOffers.length} offer(s)`, { count: driverOffers.length });
        
        for (const { rideId, offer } of driverOffers) {
          if (!offer) continue;
          
          console.log(`[App] Processing offer for ride ${rideId}, status: ${offer.status}, expires: ${offer.expiresAtMs}`);
          logEvent('offer', `Processing offer ${rideId}`, { 
            status: offer.status, 
            expiresAtMs: offer.expiresAtMs 
          });
          
          // Client-side expiration check
          const expiresAtMs = offer.expiresAtMs || 0;
          if (expiresAtMs <= now) {
            console.log(`[App] Filtering out expired offer for ride ${rideId}`);
            continue;
          }
          
          // Deduplicate: track status transitions, only keep pending offers
          const lastStatus = lastOfferStatusRef.current.get(rideId);
          const currentStatus = offer.status;
          
          console.log(`[App] Offer ${rideId} - lastStatus: ${lastStatus}, currentStatus: ${currentStatus}`);
          
          // If this is a NEW pending offer (wasn't pending before), validate ride before showing
          if (currentStatus === 'pending' && lastStatus !== 'pending') {
            // Validate that ride still exists and is not cancelled
            try {
              const rideDoc = await getDoc(doc(db, 'rides', rideId));
              if (!rideDoc.exists()) {
                console.warn(`[App] Skipping offer for non-existent ride ${rideId}`);
                // Mark as cancelled in lastStatus so we don't check again
                lastOfferStatusRef.current.set(rideId, 'cancelled');
                // Clear from UI if it's currently showing
                setNewOfferRideId(prev => prev === rideId ? null : prev);
                continue;
              }
              
              const rideStatus = rideDoc.data()?.status;
              console.log(`[App] Validated ride ${rideId}, status: ${rideStatus}`);
              
              // Skip offers for rides that are already taken or ended
              // Allow: requested, dispatching, offered
              // Skip: accepted, started, in_progress, completed, cancelled
              const unavailableStatuses = ['accepted', 'started', 'in_progress', 'completed', 'cancelled'];
              if (unavailableStatuses.includes(rideStatus)) {
                console.warn(`[App] Skipping offer for ride with status: ${rideStatus}`);
                // Mark as cancelled in lastStatus so we don't check again
                lastOfferStatusRef.current.set(rideId, 'cancelled');
                // Clear from UI if it's currently showing
                setNewOfferRideId(prev => prev === rideId ? null : prev);
                continue;
              }
              
              // Ride is valid, show offer
              console.log(`[App] Setting newOfferRideId to ${rideId}`);
              setNewOfferRideId(rideId);
            } catch (error) {
              console.error(`[App] Failed to validate ride ${rideId}:`, error);
              // Don't show offer if validation fails
              lastOfferStatusRef.current.set(rideId, 'error');
              setNewOfferRideId(prev => prev === rideId ? null : prev);
              continue;
            }
          }
          
          // If we've already marked this as cancelled/error, skip it
          if (lastStatus === 'cancelled' || lastStatus === 'error') {
            console.log(`[App] Skipping previously cancelled/error offer ${rideId}`);
            continue;
          }
          
          // If offer is cancelled/expired/declined, don't add to pendingMap
          if (currentStatus !== 'pending') {
            console.log(`[App] Offer ${rideId} is not pending (status: ${currentStatus}), clearing if showing`);
            // If this was the currently showing offer, clear it
            setNewOfferRideId(prev => {
              if (prev === rideId) {
                console.log(`[App] Clearing newOfferRideId because offer ${rideId} is no longer pending`);
                return null;
              }
              return prev;
            });
            continue;
          }
          
          // Update last known status for this rideId
          lastOfferStatusRef.current.set(rideId, currentStatus);
          
          // Final validation: check ride status before adding to pending map
          // This catches cases where the offer is still 'pending' but the ride was already accepted
          try {
            const rideDoc = await getDoc(doc(db, 'rides', rideId));
            const rideStatus = rideDoc.data()?.status;
            
            // Skip if ride is already taken or ended
            const unavailableStatuses = ['accepted', 'started', 'in_progress', 'completed', 'cancelled'];
            if (unavailableStatuses.includes(rideStatus)) {
              console.warn(`[App] Not adding offer to pendingMap - ride ${rideId} is ${rideStatus}`);
              lastOfferStatusRef.current.set(rideId, 'cancelled');
              setNewOfferRideId(prev => prev === rideId ? null : prev);
              continue;
            }
          } catch (error) {
            console.error(`[App] Failed to validate ride ${rideId} before adding to pendingMap:`, error);
            continue;
          }
          
          // Only keep offers that are still pending and ride is still available
          console.log(`[App] Adding offer ${rideId} to pendingMap`);
          pendingMap.set(rideId, offer);
        }
        
        console.log(`[App] Final pendingMap size: ${pendingMap.size}`);
        setPendingOffers(pendingMap);
      },
      (err) => console.error('Offers error:', err)
    );

    return () => unsubscribe();
  }, [user, onboardingStatus]);

  // Navigation state machine based on currentRideId
  useEffect(() => {
    const currentRideId = driverProfile?.currentRideId;
    const rideStatus = driverProfile?.currentRideStatus;

    console.log('Navigation state:', { user: !!user, currentRideId, rideStatus, pendingOffersCount: pendingOffers.size, driverProfile });

    // Phase 3A: Never switch to separate active-ride screen
    if (!user) {
      setAppState('auth');
    } else {
      setAppState('home'); // MapShell handles active ride state internally
    }
  }, [user, driverProfile?.currentRideId, driverProfile?.currentRideStatus, pendingOffers.size]);

  const handleCreateTestRide = async () => {
    if (!user) return;
    const rideId = `test-${Date.now()}`;
    await createTestRide({
      rideId,
      riderId: 'TEST_RIDER',
      pickup: { lat: 37.78, lng: -122.4 },
      dropoff: { lat: 37.79, lng: -122.41 },
      priceCents: 950,
    });
  };

  const handleViewActiveRide = () => {
    // Phase 3A: No longer switches screens, active ride shows in MapShell bottom sheet
  };

  const handleOfferAccepted = () => {
    setNewOfferRideId(null); // Close modal
    // State will update via listener as driver profile changes
  };

  const handleOfferExpired = () => {
    console.log('[App] handleOfferExpired called, clearing newOfferRideId');
    const expiredRideId = newOfferRideId;
    setNewOfferRideId(null); // Clear the offer from UI
    
    // Also remove from pendingOffers immediately (don't wait for listener)
    if (expiredRideId) {
      let hadOffer = false;
      setPendingOffers(prev => {
        const newMap = new Map(prev);
        hadOffer = newMap.has(expiredRideId);
        newMap.delete(expiredRideId);
        console.log(`[App] Removed offer ${expiredRideId} from pendingOffers, had offer: ${hadOffer}, new size: ${newMap.size}`);
        return newMap;
      });
      
      // Offer cancelled (toast handled by child component)
      if (hadOffer) {
        console.log('[App] Offer cancelled:', expiredRideId);
      }
    }
  };

  const handleOfferDeclined = (rideId: string) => {
    // Remove from pending offers
    const newOffers = new Map(pendingOffers);
    newOffers.delete(rideId);
    setPendingOffers(newOffers);
  };

  const handleRideStatusUpdate = (newStatus: string | null) => {
    // Status will update via listener
  };

  const handleSignOut = async () => {
    if (!window.confirm('Are you sure you want to sign out?')) return;
    
    try {
      isSigningOutRef.current = true;
      await signOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Navigation handlers
  const handleTabChange = (tab: NavItem) => {
    setActiveTab(tab);
    setNavHistory((prev) => [...prev, tab]); // Add to history
    setIsSideSheetOpen(false); // Close drawer on navigation
  };

  const handleNavigateBack = () => {
    // Remove current tab from history and go to previous
    setNavHistory((prev) => {
      if (prev.length <= 1) {
        // No history, go to home
        setActiveTab('home');
        return ['home'];
      }
      
      const newHistory = prev.slice(0, -1);
      const previousTab = newHistory[newHistory.length - 1];
      setActiveTab(previousTab);
      return newHistory;
    });
  };

  const handleOpenMenu = () => {
    setIsSideSheetOpen(true);
  };

  // Auto-close drawer on tab change (bonus feature)
  useEffect(() => {
    setIsSideSheetOpen(false);
  }, [activeTab]);

  // Render based on app state
  const currentRideId = driverProfile?.currentRideId;

  console.log('Rendering appState:', appState, { user: !!user, currentRideId, pendingOffersCount: pendingOffers.size });

  return (
    <ErrorBoundary>
      <ToastProvider>
      <div className="safe-area-shell">
      <EnvironmentWarningBanner />
      <EnvironmentBadge />
      {runtimeFlags?.maintenanceMessage && (
        <MaintenanceBanner message={runtimeFlags.maintenanceMessage} type="warning" />
      )}
      <AuthGate user={user} loading={isLoadingAuth} isSigningOutRef={isSigningOutRef} driverProfile={driverProfile} currentRideId={currentRideId}>
        {user && onboardingStatus === 'pending' && (
          <div className="auth-gate">
            <div className="auth-card">
              <h2>Onboarding Pending</h2>
              <p>Your driver account is under review. You'll be notified when approved.</p>
              <p style={{ marginTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                Contact support if you have questions.
              </p>
              <button
                onClick={async () => {
                  try {
                    const { updateDoc } = await import('firebase/firestore');
                    await updateDoc(doc(db, 'drivers', user.uid), {
                      onboardingStatus: 'active'
                    });
                    setOnboardingStatus('active');
                  } catch (error) {
                    console.error('Failed to activate:', error);
                  }
                }}
                style={{
                  marginTop: '16px',
                  padding: '12px 24px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                🚀 Activate Account (Dev Only)
              </button>
            </div>
          </div>
        )}

        {user && onboardingStatus === 'suspended' && (
          <div className="auth-gate">
            <div className="auth-card">
              <h2>Account Suspended</h2>
              <p>Your driver account has been suspended. Please contact support for assistance.</p>
            </div>
          </div>
        )}

        {appState === 'home' && user && onboardingStatus === 'active' && (
          <>
            {/* Menu button for all screens */}
            <MenuButton onClick={() => setIsSideSheetOpen(true)} />
            
            {activeTab === 'home' && (
              <DriverHome
                driverId={user.uid}
                profile={driverProfile}
                hasActiveRide={!!currentRideId}
                activeRideId={currentRideId ?? undefined}
                pendingOffers={pendingOffers}
                onCreateTestRide={handleCreateTestRide}
                onViewActiveRide={handleViewActiveRide}
                setActiveTab={setActiveTab}
                runtimeFlags={runtimeFlags}
                onGpsDataUpdate={setGpsDebugData}
                onOfferAccepted={handleOfferAccepted}
                onOfferExpired={handleOfferExpired}
              />
            )}
              
              {activeTab === 'rides' && (
              <div style={{ padding: '20px' }}>
                <h2 style={{ marginBottom: '16px' }}>� Ride History</h2>
                <RideHistory driverId={user.uid} />
              </div>
            )}
            
            {activeTab === 'wallet' && (
              <Wallet />
            )}
            
            {activeTab === 'profile' && (
              <Profile
                driverId={user.uid}
                onboardingStatus={onboardingStatus}
                runtimeFlags={runtimeFlags}
              />
            )}
            
            {/* Side sheet navigation drawer */}
            <SideSheet
              activeItem={activeTab}
              onItemChange={setActiveTab}
              isOpen={isSideSheetOpen}
              onClose={() => setIsSideSheetOpen(false)}
              onSignOut={handleSignOut}
            />
          </>
        )}

        {/* Phase 3B: Offers now render inside MapShell bottom sheet */}
        {/* Phase 3A: Active ride now renders inside MapShell bottom sheet */}
      </AuthGate>
      <DiagnosticsPanel user={user} gpsData={gpsDebugData ?? undefined} />
      <ProdDiagnostics />
      </div>
    </ToastProvider>
    </ErrorBoundary>
  );
}
