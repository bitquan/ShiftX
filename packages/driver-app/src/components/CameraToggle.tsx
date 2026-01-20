import React from 'react';
import './cameraToggle.css';

type CameraMode = 'follow' | 'overview';

interface CameraToggleProps {
  mode: CameraMode;
  onModeChange: (mode: CameraMode) => void;
  hasRoute?: boolean; // Only show overview if there's a route
}

/**
 * Camera mode toggle - switches between following driver and overview of route
 */
export function CameraToggle({ mode, onModeChange, hasRoute = false }: CameraToggleProps) {
  // If no route, only allow follow mode
  if (!hasRoute) {
    return null;
  }
  
  const toggleMode = () => {
    onModeChange(mode === 'follow' ? 'overview' : 'follow');
  };
  
  return (
    <div className="camera-toggle">
      <button
        className={`camera-btn active`}
        onClick={toggleMode}
        aria-label={mode === 'follow' ? 'Switch to overview' : 'Switch to follow'}
      >
        <span className="icon">{mode === 'follow' ? '📍' : '🗺️'}</span>
        <span className="label">{mode === 'follow' ? 'Follow' : 'Overview'}</span>
      </button>
    </div>
  );
}
