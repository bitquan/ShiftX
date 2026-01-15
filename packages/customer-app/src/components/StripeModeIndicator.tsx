import { getCurrentStripeMode, getStripeModeDisplay, getStripeModeColor } from '../utils/stripeMode';

export function StripeModeIndicator() {
  const mode = getCurrentStripeMode();
  const display = getStripeModeDisplay();
  const color = getStripeModeColor();
  
  // Only show in development or if mode is unknown (error state)
  if (import.meta.env.PROD && mode !== 'unknown') {
    return null;
  }
  
  return (
    <div
      style={{
        position: 'fixed',
        top: 10,
        right: 10,
        padding: '4px 12px',
        backgroundColor: color,
        color: 'white',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 600,
        zIndex: 9999,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        fontFamily: 'monospace',
        letterSpacing: '0.5px',
      }}
    >
      {display}
    </div>
  );
}
