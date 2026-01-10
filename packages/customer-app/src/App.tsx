import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { AuthGate } from './components/AuthGate';
import { RequestRide } from './components/RequestRide';
import { RideStatus } from './components/RideStatus';
import { RideHistory } from './components/RideHistory';
import { Invite } from './components/Invite';
import { ToastProvider } from './components/Toast';
import './styles.css';

type AppState = 'request-ride' | 'ride-status' | 'ride-history' | 'invite';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [appState, setAppState] = useState<AppState>('request-ride');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState<'pending' | 'active' | 'suspended' | null>(null);
  const [rideId, setRideId] = useState<string | null>(null);
  const [inviteDriverId, setInviteDriverId] = useState<string | null>(null);

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
      }
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
    // Just set the ride ID without changing state - history view will show the details
    setRideId(selectedRideId);
  };

  // Show onboarding screens if not active
  if (user && onboardingStatus && onboardingStatus !== 'active') {
    return (
      <ToastProvider>
        <AuthGate user={user} auth={auth} loading={isLoadingAuth}>
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
    <ToastProvider>
      <AuthGate user={user} auth={auth} loading={isLoadingAuth}>
        {appState === 'invite' && (
          <Invite driverId={inviteDriverId} onComplete={handleInviteComplete} />
        )}

        {user && onboardingStatus === 'active' && (
          <>
            {appState === 'request-ride' && (
              <>
                <RequestRide onRideRequested={handleRideRequested} />
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
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
                    📋 View Ride History
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
                <RideHistory onSelectRide={handleSelectHistoricalRide} />
                
                {/* Show selected ride details below history */}
                {rideId && (
                  <div style={{ marginTop: '2rem' }}>
                    <RideStatus
                      rideId={rideId}
                      onRideCompleted={() => setRideId(null)}
                      onRideRetry={handleRideRetry}
                    />
                  </div>
                )}
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
                />
              </>
            )}
          </>
        )}
      </AuthGate>
    </ToastProvider>
  );
}
