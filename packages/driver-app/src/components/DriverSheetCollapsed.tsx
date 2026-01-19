import React from 'react';
import { mapDriverUiState, DriverUiState } from '../utils/mapDriverUiState';
import './driverSheetContent.css';

interface DriverSheetCollapsedProps {
  state: DriverUiState;
  onToggleOnline: () => void;
}

/**
 * Collapsed view - compact one-line summary
 */
export function DriverSheetCollapsed({ state, onToggleOnline }: DriverSheetCollapsedProps) {
  const uiContent = mapDriverUiState(state);
  const { profile, onlineState, gpsStatus } = state;
  
  const getStatusIcon = () => {
    if (onlineState === 'offline') return '⚫️';
    if (onlineState === 'going_online' || onlineState === 'going_offline') return '🟡';
    if (gpsStatus === 'error') return '⚠️';
    if (uiContent.mode === 'offer') return '🔔';
    if (uiContent.mode === 'assigned' || state.hasActiveRide) return '🚗';
    return '🟢';
  };
  
  return (
    <div className="driver-sheet-collapsed">
      <div className="collapsed-status">
        <span className="status-icon">{getStatusIcon()}</span>
        <div className="status-text">
          <div className="status-title">{uiContent.title}</div>
          <div className="status-subtitle">{uiContent.subtitle}</div>
        </div>
      </div>
      
      {onlineState === 'offline' && (
        <button 
          className="collapsed-action-btn primary"
          onClick={onToggleOnline}
          disabled={state.isTransitioning}
        >
          Go Online
        </button>
      )}
      
      {onlineState === 'online' && !state.hasActiveRide && (
        <button 
          className="collapsed-action-btn secondary"
          onClick={onToggleOnline}
          disabled={state.isTransitioning}
        >
          Go Offline
        </button>
      )}
      
      {uiContent.mode === 'offer' && (
        <div className="collapsed-offer-badge">
          New Request
        </div>
      )}
    </div>
  );
}
