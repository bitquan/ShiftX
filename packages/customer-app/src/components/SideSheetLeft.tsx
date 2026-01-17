import React, { useEffect } from 'react';

interface SideSheetLeftProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function SideSheetLeft({
  open,
  onClose,
  title = 'Menu',
  children,
}: SideSheetLeftProps) {
  // ESC to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Lock scroll behind sheet
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1200,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          transition: 'opacity 0.2s',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        style={{
          position: 'fixed',
          zIndex: 1300,
          top: 0,
          left: 0,
          height: '100%',
          width: '86vw',
          maxWidth: '360px',
          background: 'rgba(11, 15, 20, 0.9)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          transition: 'transform 0.2s ease-out',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        }}
      >
        <div
          style={{
            padding: '0 16px 12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
          }}
        >
          <div style={{ color: '#f5b43a', fontWeight: 800, fontSize: '20px' }}>
            {title}
          </div>
        </div>

        <div
          style={{
            padding: '0 16px',
            overflowY: 'auto',
            height: 'calc(100% - 56px)',
          }}
        >
          {children}
        </div>
      </aside>
    </>
  );
}
