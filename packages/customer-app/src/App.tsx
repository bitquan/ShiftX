import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { AuthGate } from './components/AuthGate';
import { RequestRide } from './components/RequestRide';
import { RideStatus } from './components/RideStatus';
import { RideHistory } from './components/RideHistory';
import { Invite } from './components/Invite';
import { Profile } from './components/Profile';
import { CustomerWallet } from './components/CustomerWallet';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DebugPanel } from './components/DebugPanel';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { ProdDiagnostics } from './components/ProdDiagnostics';
import { validateProductionConfig, showConfigErrorModal } from './utils/configValidation';
import { RebookPayload } from './types/rebook';
import { MaintenanceBanner } from './components/MaintenanceBanner';
import { watchRuntimeFlags, RuntimeFlags } from './utils/runtimeFlags';
import { logStripeMode } from './utils/stripeMode';
import './styles.css';

type AppState = 'request-ride' | 'ride-status' | 'ride-history' | 'wallet' | 'invite';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [appState, setAppState] = useState<AppState>('request-ride');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<'pending' | 'active' | 'suspended' | null>(null);
  const [rideId, setRideId] = useState<string | null>(null);
  const [inviteDriverId, setInviteDriverId] = useState<string | null>(null);
  const [rebookPayload, setRebookPayload] = useState<RebookPayload | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null);
  const [runtimeFlags, setRuntimeFlags] = useState<RuntimeFlags | null>(null);

  // Log Stripe mode on startup
  useEffect(() => {
    logStripeMode();
  }, []);

  // Validate configuration on startup
  useEffect(() => {
    const validation = validateProductionConfig();
    if (!validation.valid) {
      showConfigErrorModal(validation);
    } else if (validation.warnings.length > 0) {
      console.warn('Configuration warnings:', validation.warnings);
    }
  }, []);

  // Check for invite route on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const driverId = params.get('driverId');
    if (driverId) {
      setInviteDriverId(driverId);
      setAppState('invite');
      // Clear the query string
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Auth setup
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (customer) => {
      setUser(customer);
      setIsLoadingAuth(false);

      // Create user and customer docs on first login
      if (customer) {
        try {
          const userRef = doc(db, 'users', customer.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              email: customer.email,
              createdAtMs: Date.now(),
              role: 'customer',
            });
            setUserPhotoURL(null);
          } else {
            // Load photoURL from user profile
            setUserPhotoURL(userSnap.data()?.photoURL || null);
          }

          const customerRef = doc(db, 'customers', customer.uid);
          const customerSnap = await getDoc(customerRef);
          
          if (!customerSnap.exists()) {
            await setDoc(customerRef, {
              onboardingStatus: 'active',
              createdAtMs: Date.now(),
              updatedAtMs: Date.now(),
            });
            setOnboardingStatus('active');
          } else {
            const status = customerSnap.data()?.onboardingStatus || 'active';
            setOnboardingStatus(status);
          }
        } catch (error) {
          console.error('Failed to create user/customer docs:', error);
        }
      } else {
        // User signed out - clear localStorage
        localStorage.removeItem('rideId');
        setRideId(null);
        setOnboardingStatus(null);
        setUserPhotoURL(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Runtime flags listener
  useEffect(() => {
    const unsubscribe = watchRuntimeFlags((flags) => {
      console.log('[App] Runtime flags updated:', flags);
      setRuntimeFlags(flags);
    });

    return () => unsubscribe();
  }, []);

  // Check for stored rideId on mount
  useEffect(() => {
    const storedRideId = localStorage.getItem('rideId');
    if (storedRideId && user && onboardingStatus === 'active') {
      setRideId(storedRideId);
      setAppState('ride-status');
    }
  }, [user, onboardingStatus]);

  // Subscribe to user profile changes (for photoURL updates)
  useEffect(() => {
    if (!user) return;
    
    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setUserPhotoURL(snap.data()?.photoURL || null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleRideRequested = (newRideId: string) => {
    setRideId(newRideId);
    setAppState('ride-status');
  };

  const handleRideRetry = (newRideId: string) => {
    setRideId(newRideId);
    setAppState('ride-status');
  };

  const handleInviteComplete = () => {
    setInviteDriverId(null);
    setAppState('request-ride');
  };

  const handleRideCompleted = () => {
    localStorage.removeItem('rideId');
    setRideId(null);
    setAppState('request-ride');
  };

  const handleViewHistory = () => {
    setAppState('ride-history');
  };

  const handleBackToRequest = () => {
    setAppState('request-ride');
  };

  const handleSelectHistoricalRide = (selectedRideId: string) => {
    // Navigate to ride-status view to show full details
    setRideId(selectedRideId);
    setAppState('ride-status');
  };

  const handleRequestAgain = (
    pickup: { lat: number; lng: number }, 
    dropoff: { lat: number; lng: number },
    serviceClass?: string
  ) => {
    // Create rebook payload and navigate to request screen
    const payload: RebookPayload = {
      pickup: { lat: pickup.lat, lng: pickup.lng },
      dropoff: { lat: dropoff.lat, lng: dropoff.lng },
      serviceClass: (serviceClass as 'shiftx' | 'shift_lx' | 'shift_black') || undefined,
    };
    setRebookPayload(payload);
    setAppState('request-ride');
  };

  // Show onboarding screens if not active
  if (user && onboardingStatus && onboardingStatus !== 'active') {
    return (
      <ToastProvider>
        <AuthGate user={user} auth={auth} loading={isLoadingAuth} userPhotoURL={userPhotoURL} onProfileClick={() => setShowProfile(true)}>
          <div className="screen-container">
            <div className="card">
              <h2>Account Status: {onboardingStatus}</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)' }}>
                {onboardingStatus === 'pending' && 'Your account is being set up. Please wait...'}
                {onboardingStatus === 'suspended' && 'Your account has been suspended. Please contact support.'}
              </p>
            </div>
          </div>
        </AuthGate>
      </ToastProvider>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        {runtimeFlags?.maintenanceMessage && (
          <MaintenanceBanner message={runtimeFlags.maintenanceMessage} type="warning" />
        )}
        <AuthGate user={user} auth={auth} loading={isLoadingAuth} userPhotoURL={userPhotoURL} onProfileClick={() => setShowProfile(true)}>
          {appState === 'invite' && (
            <Invite driverId={inviteDriverId} onComplete={handleInviteComplete} />
          )}

        {user && onboardingStatus === 'active' && (
          <>
            {appState === 'request-ride' && (
              <>
                <RequestRide 
                  onRideRequested={handleRideRequested}
                  rebookPayload={rebookPayload}
                  onRebookConsumed={() => setRebookPayload(null)}
                  userPhotoURL={userPhotoURL}
                  runtimeFlags={runtimeFlags}
                />
                <div style={{ marginTop: '1rem', textAlign: 'center', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button
                    onClick={handleViewHistory}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'white',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '1rem',
                    }}
                  >
                    📋 Ride History
                  </button>
                  <button
                    onClick={() => setAppState('wallet')}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'white',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '1rem',
                    }}
                  >
                    💳 Wallet
                  </button>
                </div>
              </>
            )}
            {appState === 'ride-history' && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={handleBackToRequest}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'white',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '1rem',
                    }}
                  >
                    ← Back to Request
                  </button>
                </div>
                <RideHistory 
                  onSelectRide={handleSelectHistoricalRide} 
                  onRequestAgain={handleRequestAgain}
                />
              </>
            )}
            {appState === 'wallet' && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={handleBackToRequest}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'white',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '1rem',
                    }}
                  >
                    ← Back to Request
                  </button>
                </div>
                <CustomerWallet />
              </>
            )}
            {appState === 'ride-status' && rideId && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={handleBackToRequest}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: 'white',
                      padding: '0.75rem 1.5rem',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      fontSize: '1rem',
                    }}
                  >
                    ← Back to Request
                  </button>
                </div>
                <RideStatus
                  rideId={rideId}
                  onRideCompleted={handleRideCompleted}
                  onRideRetry={handleRideRetry}
                  runtimeFlags={runtimeFlags}
                />
              </>
            )}
          </>
        )}

        {/* Profile Modal */}
        {showProfile && <Profile onClose={() => setShowProfile(false)} />}
      </AuthGate>
      <ProdDiagnostics />
      <DebugPanel />
      <DiagnosticsPanel user={user} />
    </ToastProvider>
    </ErrorBoundary>
  );
}
