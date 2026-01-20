/**
 * Phase 3F: Safety Rails - Environment Warning Banner
 * 
 * Shows prominent warning when dev environment connects to production Firebase.
 */

import React, { useState, useEffect } from 'react';
import { validateEnvironment } from '../utils/environmentGuard';

export const EnvironmentWarningBanner: React.FC = () => {
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const check = validateEnvironment();
    if (check.warnings.length > 0) {
      setWarnings(check.warnings);
    }
  }, []);

  if (warnings.length === 0 || isDismissed) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        color: '#000',
        padding: '0.75rem 1rem',
        zIndex: 999999,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        borderBottom: '3px solid #b45309',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}
      >
        <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>⚠️</div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontWeight: 'bold',
              fontSize: '1.1rem',
              marginBottom: '0.25rem',
            }}
          >
            Environment Warning
          </div>
          <div
            style={{
              fontSize: '0.9rem',
              lineHeight: '1.5',
              fontFamily: "'Monaco', 'Courier New', monospace",
            }}
          >
            {warnings.map((warn, idx) => (
              <div key={idx}>{warn}</div>
            ))}
          </div>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          style={{
            background: 'rgba(0,0,0,0.2)',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.9rem',
            color: '#000',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
