import React, { useEffect, useMemo, useRef, useState } from 'react';
import { connectAuthEmulator, getAuth, onAuthStateChanged, User } from 'firebase/auth';
import {
  DEFAULT_EMULATOR_CONFIG,
  DriverProfile,
  RideOffer,
  createTestRide,
  initDriverClient,
  watchDriverOffers,
  watchDriverProfile,
} from '@shiftx/driver-client';
import { AuthGate } from './components/AuthGate';
import { DriverHome } from './components/DriverHome';
import { OfferModal } from './components/OfferModal';
import { AvailableRides } from './components/AvailableRides';
import { ActiveRide } from './components/ActiveRide';
import { Profile } from './components/Profile';
import { BottomNav, TabId } from './components/BottomNav';
import { ToastProvider } from './components/Toast';
import './styles.css';

const PROJECT_ID = 'demo-no-project';
const AUTH_EMULATOR_PORT = 9099;
const firebaseConfig = {
  projectId: PROJECT_ID,
  apiKey: 'demo',
  authDomain: `${PROJECT_ID}.firebaseapp.com`,
};

const authEmulatorUrl = `http://${DEFAULT_EMULATOR_CONFIG.functionsHost}:${AUTH_EMULATOR_PORT}`;

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

  const memoizedClient = useMemo(() => initDriverClient({ firebaseConfig, emulator: DEFAULT_EMULATOR_CONFIG }), []);
  const auth = useMemo(() => getAuth(memoizedClient.app), [memoizedClient.app]);

  // Auth setup
  useEffect(() => {
    connectAuthEmulator(auth, authEmulatorUrl);
    const unsubscribe = onAuthStateChanged(auth, async (driver) => {
      setUser(driver);
      setIsLoadingAuth(false);

      // Create user and driver docs on first login
      if (driver) {
        try {
          const { firestore } = memoizedClient;
          const { doc, getDoc, setDoc } = await import('firebase/firestore');
          
          const userRef = doc(firestore, 'users', driver.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              email: driver.email,
              createdAtMs: Date.now(),
              role: 'driver',
            });
          }

          const driverRef = doc(firestore, 'drivers', driver.uid);
          const driverSnap = await getDoc(driverRef);
          
          if (!driverSnap.exists()) {
            await setDoc(driverRef, {
              isOnline: false,
              isBusy: false,
              onboardingStatus: 'pending',
              createdAtMs: Date.now(),
              updatedAtMs: Date.now(),
            });
            setOnboardingStatus('pending');
          } else {
            const status = driverSnap.data()?.onboardingStatus || 'pending';
            setOnboardingStatus(status);
          }
        } catch (error) {
          console.error('Failed to create user/driver docs:', error);
        }
      } else {
        setOnboardingStatus(null);
      }
    });
    return () => unsubscribe();
  }, [auth, memoizedClient]);

  // Driver profile listener
  useEffect(() => {
    if (!user || onboardingStatus !== 'active') {
      setDriverProfile(null);
      return;
    }

    const unsubscribe = watchDriverProfile(
      user.uid,
      (profile) => {
        setDriverProfile(profile);
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
      return;
    }

    const unsubscribe = watchDriverOffers(
      user.uid,
      (driverOffers) => {
        const pendingMap = new Map<string, RideOffer>();
        driverOffers.forEach(({ rideId, offer }) => {
          if (!offer) return;
          
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
          // If transitioned to 'expired' or 'rejected', it will be removed from pendingMap
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
    <ToastProvider>
      <AuthGate user={user} auth={auth} loading={isLoadingAuth}>
        {user && onboardingStatus === 'pending' && (
          <div className="auth-gate">
            <div className="auth-card">
              <h2>Onboarding Pending</h2>
              <p>Your driver account is under review. You'll be notified when approved.</p>
              <p style={{ marginTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                Contact support if you have questions.
              </p>
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
                onCreateTestRide={handleCreateTestRide}
                onViewActiveRide={handleViewActiveRide}
              />
            )}
            
            {activeTab === 'rides' && (
              <div style={{ paddingBottom: '80px' }}>
                <h2 style={{ marginBottom: '16px' }}>🚗 Available Rides</h2>
                <AvailableRides
                  offers={pendingOffers}
                  onOfferAccepted={handleOfferAccepted}
                  onOfferDeclined={handleOfferDeclined}
                />
              </div>
            )}
            
            {activeTab === 'profile' && (
              <Profile
                driverId={user.uid}
                onboardingStatus={onboardingStatus}
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
          />
        )}

        {appState === 'active-ride' && user && currentRideId && onboardingStatus === 'active' && (
          <ActiveRide
            rideId={currentRideId}
            currentStatus={driverProfile?.currentRideStatus || 'accepted'}
            onStatusUpdate={handleRideStatusUpdate}
          />
        )}
      </AuthGate>
    </ToastProvider>
  );
}
