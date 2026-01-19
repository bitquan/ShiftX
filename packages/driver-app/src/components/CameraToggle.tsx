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
  
  return (
    <div className="camera-toggle">
      <button
        className={`camera-btn ${mode === 'follow' ? 'active' : ''}`}
        onClick={() => onModeChange('follow')}
        aria-label="Follow driver"
      >
        <span className="icon">📍</span>
        <span className="label">Follow</span>
      </button>
      
      <button
        className={`camera-btn ${mode === 'overview' ? 'active' : ''}`}
        onClick={() => onModeChange('overview')}
        aria-label="Overview of route"
      >
        <span className="icon">🗺️</span>
        <span className="label">Overview</span>
      </button>
    </div>
  );
}
