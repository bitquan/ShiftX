import React from 'react';
import { User, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { useToast } from './Toast';
import { DebugPanel } from './DebugPanel';
import { SideSheetLeft } from './SideSheetLeft';
import { FloatingMenuButton } from './FloatingMenuButton';
import { EnvironmentBadge } from './EnvironmentBadge';

interface AuthGateProps {
  user: User | null;
  auth: ReturnType<typeof import('firebase/auth').getAuth>;
  loading?: boolean;
  children: React.ReactNode;
  userPhotoURL?: string | null;
  onProfileClick?: () => void;
}

export function AuthGate({ user, auth, loading = false, children, userPhotoURL, onProfileClick }: AuthGateProps) {
  const { show } = useToast();
  const [signingIn, setSigningIn] = React.useState(false);
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      show('Email and password required', 'error');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      show('Please enter a valid email address', 'error');
      return;
    }

    // Validate password length (Firebase requires min 6 characters)
    if (isSignUp && password.length < 6) {
      show('Password must be at least 6 characters', 'error');
      return;
    }

    setSigningIn(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        show('Account created successfully', 'success');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        show('Signed in successfully', 'success');
      }
    } catch (error) {
      const err = error as { code?: string; message: string };
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        show('Invalid email or password', 'error');
      } else if (err.code === 'auth/email-already-in-use') {
        show('Email already in use', 'error');
      } else if (err.code === 'auth/weak-password') {
        show('Password must be at least 6 characters', 'error');
      } else if (err.code === 'auth/invalid-email') {
        show('Invalid email format', 'error');
      } else {
        show(`Authentication failed: ${err.message}`, 'error');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      show('Signed out', 'info');
    } catch (error) {
      show(`Sign out failed: ${(error as Error).message}`, 'error');
    }
  };

  if (loading) {
    return (
      <div className="auth-gate">
        <div className="spinner">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-gate">
        <div className="auth-card">
          <h1>ShiftX Customer</h1>
          <p>{isSignUp ? 'Create your customer account' : 'Sign in to request a ride'}</p>
          <form onSubmit={handleSignIn} style={{ width: '100%' }}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: '14px',
              }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                marginBottom: '20px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: '14px',
              }}
            />
            <button
              type="submit"
              disabled={signingIn}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #ffb703, #fb8b24)',
                color: '#000',
                fontSize: '16px',
                fontWeight: '600',
                cursor: signingIn ? 'not-allowed' : 'pointer',
                opacity: signingIn ? 0.7 : 1,
              }}
            >
              {signingIn ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </form>
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              marginTop: '16px',
              fontSize: '14px',
              textDecoration: 'underline',
            }}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <FloatingMenuButton onClick={() => setMenuOpen(!menuOpen)} />
      
      <SideSheetLeft
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="ShiftX Customer"
      >
        {/* Badge + Profile Photo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '16px' }}>
          <EnvironmentBadge inline />
          
          {onProfileClick && (
            <button
              onClick={() => {
                setMenuOpen(false);
                onProfileClick();
              }}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: userPhotoURL ? '2px solid rgba(96,165,250,0.5)' : '2px solid rgba(255,255,255,0.1)',
                backgroundColor: userPhotoURL ? 'transparent' : 'rgba(255,255,255,0.1)',
                cursor: 'pointer',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                padding: 0,
              }}
            >
              {userPhotoURL ? (
                <img src={userPhotoURL} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                '👤'
              )}
            </button>
          )}
        </div>

        {/* Menu Items */}
        <div style={{ display: 'grid', gap: '8px' }}>
          <div onClick={() => setMenuOpen(false)}>
            <DebugPanel />
          </div>

          {onProfileClick && (
            <button
              onClick={() => {
                setMenuOpen(false);
                onProfileClick();
              }}
              style={{
                width: '100%',
                borderRadius: '12px',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
                cursor: 'pointer',
                fontSize: '15px',
                textAlign: 'left',
              }}
            >
              👤 Profile
            </button>
          )}

          <button
            onClick={handleSignOut}
            style={{
              width: '100%',
              borderRadius: '12px',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'white',
              cursor: 'pointer',
              fontSize: '15px',
              textAlign: 'left',
            }}
          >
            🚪 Sign Out
          </button>
        </div>
      </SideSheetLeft>

      <div className="app-content" style={{ paddingTop: 0 }}>{children}</div>
    </div>
  );
}
