import React from 'react';
import { User, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { useToast } from './Toast';

interface AuthGateProps {
  user: User | null;
  auth: ReturnType<typeof import('firebase/auth').getAuth>;
  loading?: boolean;
  children: React.ReactNode;
}

export function AuthGate({ user, auth, loading = false, children }: AuthGateProps) {
  const { show } = useToast();
  const [signingIn, setSigningIn] = React.useState(false);
  const [isSignUp, setIsSignUp] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      show('Email and password required', 'error');
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
          <h1>ShiftX Driver</h1>
          <p>{isSignUp ? 'Create your driver account' : 'Sign in to get started'}</p>
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
                marginBottom: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff',
                fontSize: '14px',
              }}
            />
            <button type="submit" disabled={signingIn} className="primary-button">
              {signingIn ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            style={{
              marginTop: '12px',
              background: 'none',
              border: 'none',
              color: '#60a5fa',
              cursor: 'pointer',
              fontSize: '14px',
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
      <div className="app-header">
        <h1>ShiftX Driver</h1>
        <button onClick={handleSignOut} className="secondary-button">
          Sign out
        </button>
      </div>
      <div className="app-content">{children}</div>
    </div>
  );
}
