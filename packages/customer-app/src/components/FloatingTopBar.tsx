import React from 'react';

interface FloatingTopBarProps {
  title: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export function FloatingTopBar({ title, left, right }: FloatingTopBarProps) {
  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 100,
        left: '6px',
        right: '6px',
        top: 'calc(env(safe-area-inset-top) + 0px)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          borderRadius: '10px',
          padding: '4px 8px',
          background: 'rgba(0, 0, 0, 0.35)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {left}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: '#f5b43a',
                fontWeight: 800,
                fontSize: '14px',
                lineHeight: '1',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{right}</div>
      </div>
    </div>
  );
}
