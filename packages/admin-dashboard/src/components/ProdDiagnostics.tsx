import { useEffect, useState } from 'react';
import { auth, app } from '../firebase';

const BUILD_MARKER = "SHIFTX_DEBUG_PANEL_v1";

interface DiagnosticInfo {
  appName: string;
  projectId: string;
  authDomain: string;
  isEmulator: boolean;
  origin: string;
  apiKeyLastChars: string;
  currentUser: { uid: string; email: string | null } | null;
  isDev: boolean;
  buildMarker: string;
}

export function ProdDiagnostics() {
  if (!import.meta.env.DEV) {
    return null;
  }
  const [info, setInfo] = useState<DiagnosticInfo | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if explicitly enabled via URL param
    const params = new URLSearchParams(window.location.search);
    const showDebug = params.get('debug') === '1';
    setVisible(showDebug);

    if (showDebug) {
      const diagnostics: DiagnosticInfo = {
        appName: 'ShiftX Admin',
        projectId: app.options.projectId || 'unknown',
        authDomain: app.options.authDomain || 'unknown',
        isEmulator: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
        origin: window.location.origin,
        apiKeyLastChars: app.options.apiKey ? app.options.apiKey.slice(-6) : 'missing',
        currentUser: auth.currentUser ? {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email
        } : null,
        isDev: import.meta.env.DEV,
        buildMarker: BUILD_MARKER,
      };

      setInfo(diagnostics);

      // Listen for auth changes
      const unsubscribe = auth.onAuthStateChanged((user) => {
        setInfo(prev => prev ? {
          ...prev,
          currentUser: user ? { uid: user.uid, email: user.email } : null
        } : null);
      });

      return unsubscribe;
    }
  }, []);

  if (!visible || !info) return null;

  const hasIssues = 
    info.projectId === 'demo-no-project' ||
    info.apiKeyLastChars === 'missing' ||
    (info.isEmulator && !info.isDev);

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: hasIssues ? 'rgba(220, 38, 38, 0.95)' : 'rgba(34, 34, 34, 0.95)',
      color: '#fff',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '11px',
      fontFamily: 'monospace',
      zIndex: 10000,
      maxWidth: '400px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      border: hasIssues ? '2px solid #dc2626' : '1px solid rgba(255,255,255,0.2)'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        paddingBottom: '8px'
      }}>
        <strong>{hasIssues ? '⚠️ Config Issues' : '✓ Production Diagnostics'}</strong>
        <button 
          onClick={() => setVisible(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '16px',
            padding: '0 4px'
          }}
        >×</button>
      </div>
      
      <div style={{ display: 'grid', gap: '4px' }}>
        <Row label="App" value={info.appName} />
        <Row label="Mode" value={info.isDev ? 'Development' : 'Production'} 
          warn={!info.isDev && info.isEmulator} />
        <Row label="Origin" value={info.origin} />
        <Row label="Project ID" value={info.projectId} 
          warn={info.projectId === 'demo-no-project'} />
        <Row label="Auth Domain" value={info.authDomain} />
        <Row label="API Key (last 6)" value={info.apiKeyLastChars} 
          warn={info.apiKeyLastChars === 'missing'} />
        <Row label="Emulator Mode" value={info.isEmulator ? 'Yes' : 'No'} 
          warn={info.isEmulator && !info.isDev} />
        <Row label="Current User" 
          value={info.currentUser ? `${info.currentUser.email} (${info.currentUser.uid.slice(0, 8)}...)` : 'Not signed in'} />
        <Row label="Build" value={info.buildMarker} />
      </div>

      {hasIssues && (
        <div style={{ 
          marginTop: '12px', 
          paddingTop: '12px', 
          borderTop: '1px solid rgba(255,255,255,0.2)',
          fontSize: '10px',
          opacity: 0.9
        }}>
          <strong>Action needed:</strong> Check .env.production and firebase.ts config
        </div>
      )}
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ opacity: 0.7 }}>{label}:</span>
      <span style={{ 
        fontWeight: 'bold',
        color: warn ? '#fbbf24' : '#fff'
      }}>
        {warn && '⚠️ '}{value}
      </span>
    </div>
  );
}
