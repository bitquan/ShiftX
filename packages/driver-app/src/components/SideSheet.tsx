import React, { useState, useEffect } from 'react';
import './sideSheet.css';

export type NavItem = 'home' | 'rides' | 'wallet' | 'profile';

type Environment = 'DEV' | 'PROD';

interface EnvironmentInfo {
  env: Environment;
  hostname: string;
  stripeMode: 'TEST' | 'LIVE';
  firebaseMode: 'EMULATOR' | 'PRODUCTION';
}

interface SideSheetProps {
  activeItem: NavItem;
  onItemChange: (item: NavItem) => void;
  isOpen: boolean;
  onClose: () => void;
  onSignOut?: () => void;
}

export function SideSheet({ activeItem, onItemChange, isOpen, onClose, onSignOut }: SideSheetProps) {
  const [envInfo, setEnvInfo] = useState<EnvironmentInfo | null>(null);

  useEffect(() => {
    const hostname = window.location.hostname;
    const isDev = hostname === '127.0.0.1' || hostname === 'localhost';
    
    // Detect Stripe mode from publishable key
    const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
    const isTestStripe = stripeKey.startsWith('pk_test_');
    
    // Detect Firebase emulator
    const isEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

    setEnvInfo({
      env: isDev ? 'DEV' : 'PROD',
      hostname,
      stripeMode: isTestStripe ? 'TEST' : 'LIVE',
      firebaseMode: isEmulator ? 'EMULATOR' : 'PRODUCTION',
    });
  }, []);

  const navItems: Array<{ id: NavItem; label: string; icon: string }> = [
    { id: 'home', label: 'Map', icon: '🗺️' },
    { id: 'rides', label: 'Ride History', icon: '🚗' },
    { id: 'wallet', label: 'Wallet', icon: '💰' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ];

  const handleItemClick = (item: NavItem) => {
    onItemChange(item);
    onClose(); // Close drawer after selection
  };

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="side-sheet-backdrop"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}

      {/* Side sheet drawer */}
      <nav
        className={`side-sheet ${isOpen ? 'open' : ''}`}
        aria-label="Main navigation"
      >
        <div className="side-sheet-header">
          <h1 className="side-sheet-brand">ShiftX</h1>
          <button
            onClick={onClose}
            className="side-sheet-close"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <ul className="side-sheet-nav">
          {navItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleItemClick(item.id)}
                className={`side-sheet-item ${activeItem === item.id ? 'active' : ''}`}
                aria-current={activeItem === item.id ? 'page' : undefined}
              >
                <span className="side-sheet-icon">{item.icon}</span>
                <span className="side-sheet-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* Environment Info Section */}
        {envInfo && (
          <div className="side-sheet-environment" style={{ flexShrink: 0, marginTop: 'auto' }}>
            <h3 className="environment-title">Environment</h3>
            <div className="environment-badges">
              <div className={`env-badge ${envInfo.env === 'DEV' ? 'dev' : 'prod'}`}>
                {envInfo.env}
              </div>
              <div className={`env-badge ${envInfo.stripeMode === 'TEST' ? 'test' : 'live'}`}>
                Stripe: {envInfo.stripeMode}
              </div>
              <div className={`env-badge ${envInfo.firebaseMode === 'EMULATOR' ? 'emulator' : 'production'}`}>
                Firebase: {envInfo.firebaseMode}
              </div>
            </div>
            <p className="environment-hostname">{envInfo.hostname}</p>
          </div>
        )}

        {/* Sign Out Button */}
        {onSignOut && (
          <div style={{ 
            padding: '1rem', 
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            flexShrink: 0  // Don't shrink
          }}>
            <button
              onClick={() => {
                onSignOut();
                onClose();
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(239,68,68,0.5)',
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                fontWeight: '600',
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              <span>🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        )}

        <div className="side-sheet-footer" style={{ flexShrink: 0 }}>
          <p className="side-sheet-version">ShiftX Driver v1.0</p>
        </div>
      </nav>
    </>
  );
}
