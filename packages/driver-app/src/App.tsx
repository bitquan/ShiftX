import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User, setPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, app } from './firebase';
import {
  DriverProfile,
  RideOffer,
  createTestRide,
  watchDriverOffers,
  watchDriverProfile,
} from '@shiftx/driver-client';
import { AuthGate } from './components/AuthGate';
import { DriverHome } from './components/DriverHome';
import { OfferModal } from './components/OfferModal';
import { AvailableRides } from './components/AvailableRides';
import { ActiveRide } from './components/ActiveRide';
import { Profile } from './components/Profile';
import { Wallet } from './components/Wallet';
import { RideHistory } from './components/RideHistory';
import { BottomNav, TabId } from './components/BottomNav';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { ProdDiagnostics } from './components/ProdDiagnostics';
import { MaintenanceBanner } from './components/MaintenanceBanner';
import { watchRuntimeFlags, RuntimeFlags } from './utils/runtimeFlags';
import './styles.css';

type AppState = 'auth' | 'home' | 'active-ride';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [pendingOffers, setPendingOffers] = useState<Map<string, RideOffer>>(new Map());
  const [appState, setAppState] = useState<AppState>('auth');
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<'pending' | 'active' | 'suspended' | null>(null);
  const lastOfferStatusRef = useRef<Map<string, string>>(new Map()); // Track last status per rideId
  const [newOfferRideId, setNewOfferRideId] = useState<string | null>(null); // For showing modal on NEW offers
  const isSigningOutRef = useRef(false); // Prevent auto sign-in during sign out
  const [runtimeFlags, setRuntimeFlags] = useState<RuntimeFlags | null>(null);

  // Auth setup
  useEffect(() => {
    // Set persistence to indexedDB for reliable login across sessions
    setPersistence(auth, indexedDBLocalPersistence).catch((err) => {
      console.error('Failed to set auth persistence:', err);
    });
    
    const unsubscribe = onAuthStateChanged(auth, async (driver) => {
      setUser(driver);
      setIsLoadingAuth(false);

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
      (driverOffers) => {
        const now = Date.now();
        const pendingMap = new Map<string, RideOffer>();
        
        driverOffers.forEach(({ rideId, offer }) => {
          if (!offer) return;
          
          // Client-side expiration check
          const expiresAtMs = offer.expiresAtMs || 0;
          if (expiresAtMs <= now) {
            console.log(`[App] Filtering out expired offer for ride ${rideId}`);
            return;
          }
          
          // Deduplicate: track status transitions, only keep pending offers
          const lastStatus = lastOfferStatusRef.current.get(rideId);
          const currentStatus = offer.status;
          
          // If this is a NEW pending offer (wasn't pending before), show modal
          if (currentStatus === 'pending' && lastStatus !== 'pending') {
            setNewOfferRideId(rideId);
          }
          
          // Update last known status for this rideId
          lastOfferStatusRef.current.set(rideId, currentStatus);
          
          // Only keep offers that are still pending
          if (currentStatus === 'pending') {
            pendingMap.set(rideId, offer);
          }
        });
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

    if (!user) {
      setAppState('auth');
    } else if (currentRideId && rideStatus && rideStatus !== 'completed') {
      setAppState('active-ride');
    } else {
      setAppState('home');
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
    setAppState('active-ride');
  };

  const handleOfferAccepted = () => {
    setNewOfferRideId(null); // Close modal
    // State will update via listener as driver profile changes
  };

  const handleOfferExpired = () => {
    setNewOfferRideId(null); // Close modal but offer stays in list
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

  // Render based on app state
  const currentRideId = driverProfile?.currentRideId;

  console.log('Rendering appState:', appState, { user: !!user, currentRideId, pendingOffersCount: pendingOffers.size });

  return (
    <ErrorBoundary>
      <ToastProvider>
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
              />
            )}
            
            {activeTab === 'rides' && (
              <div style={{ paddingBottom: '80px' }}>
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
            
            <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
          </>
        )}

        {/* Show modal only for NEW offers */}
        {newOfferRideId && pendingOffers.has(newOfferRideId) && onboardingStatus === 'active' && (
          <OfferModal
            key={newOfferRideId}
            rideId={newOfferRideId}
            offer={pendingOffers.get(newOfferRideId)!}
            onAccepted={handleOfferAccepted}
            onExpired={handleOfferExpired}
            runtimeFlags={runtimeFlags}
          />
        )}

        {appState === 'active-ride' && user && currentRideId && onboardingStatus === 'active' && (
          <ActiveRide
            rideId={currentRideId}
            currentStatus={driverProfile?.currentRideStatus || 'accepted'}
            onStatusUpdate={handleRideStatusUpdate}
            onCancelled={() => {
              // Ride will be cleared via listener when driver profile updates
              setAppState('home');
            }}
          />
        )}
      </AuthGate>
      <DiagnosticsPanel user={user} />
      <ProdDiagnostics />
    </ToastProvider>
    </ErrorBoundary>
  );
}
