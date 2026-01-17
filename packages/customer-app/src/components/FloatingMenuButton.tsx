interface FloatingMenuButtonProps {
  onClick: () => void;
}

export function FloatingMenuButton({ onClick }: FloatingMenuButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'fixed',
        zIndex: 1400,
        left: '16px',
        top: 'calc(env(safe-area-inset-top) + 4px)',
        borderRadius: '16px',
        padding: '8px 12px',
        background: 'rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        color: 'white',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        cursor: 'pointer',
        fontSize: '20px',
        lineHeight: '1',
      }}
      aria-label="Open menu"
    >
      ☰
    </button>
  );
}
