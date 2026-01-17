interface FloatingBackButtonProps {
  onClick: () => void;
  label?: string;
}

export function FloatingBackButton({ onClick, label = 'Back' }: FloatingBackButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top) + 52px)',
        left: '12px',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 14px',
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.2)',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        color: '#fff',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.7)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)';
      }}
    >
      <span style={{ fontSize: '16px' }}>←</span>
      {label}
    </button>
  );
}
