import React, { Component, ReactNode } from 'react';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  source?: 'driver-app' | 'customer-app' | 'admin-dashboard';
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Log error to Cloud Functions
    this.logError(error, errorInfo);
  }

  async logError(error: Error, errorInfo: React.ErrorInfo) {
    try {
      const logError = httpsCallable(functions, 'logError');
      await logError({
        error: error.name,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        severity: 'high',
        source: this.props.source || 'driver-app',
        environment: import.meta.env.MODE,
      });
    } catch (logErr) {
      console.error('Failed to log error to Cloud Functions:', logErr);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          padding: '2rem',
          maxWidth: '600px',
          margin: '2rem auto',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>
            Something went wrong
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              backgroundColor: 'rgba(0,255,140,0.95)',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
