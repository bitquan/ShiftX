import React, { useState, useEffect } from 'react';

interface DriverStatusCardProps {
  driverId: string;
  isOnline: boolean;
  gpsStatus: 'loading' | 'success' | 'error';
  currentLocation: { lat: number; lng: number } | null;
  gpsError?: string | null;
  lastFixAtMs?: number | null;
  onToggleOnline: () => void;
  onRetryGps?: () => void;
  isTransitioning: boolean;
  hasPhoto?: boolean;
  disableGoOnline?: boolean;
}

/**
 * Control Center: Single status card showing driver state and primary action.
 * Design: Left (ID) | Center (Status) | Right (Button)
 */
export function DriverStatusCard({
  driverId,
  isOnline,
  gpsStatus,
  currentLocation,
  gpsError,
  lastFixAtMs,
  onToggleOnline,
  onRetryGps,
  isTransitioning,
  hasPhoto = true,
  disableGoOnline = false,
}: DriverStatusCardProps) {
  const [timeAgo, setTimeAgo] = useState<string>('');

  // Update "last seen" timer every second
  useEffect(() => {
    if (!lastFixAtMs || !isOnline) {
      setTimeAgo('');
      return;
    }

    const updateTimer = () => {
      const seconds = Math.floor((Date.now() - lastFixAtMs) / 1000);
      if (seconds < 2) setTimeAgo('Just now');
      else if (seconds < 60) setTimeAgo(`${seconds}s ago`);
      else setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lastFixAtMs, isOnline]);
  return (
    <div className="driver-status-card">
      {/* Header: Driver ID (subtle) */}
      <div className="status-card-header">
        <span className="driver-id">ID: {driverId.slice(0, 8)}</span>
      </div>

      {/* Main Content: Status Pills */}
      <div className="status-card-main">
        {/* Online/Offline Status */}
        <div className={`status-pill ${isOnline ? 'status-online' : 'status-offline'}`}>
          <span className="status-dot"></span>
          {isOnline ? 'Online' : 'Offline'}
        </div>

        {/* GPS Status */}
        <div className="gps-status">
          {gpsStatus === 'loading' && (
            <span className="gps-text gps-loading">📡 Getting location...</span>
          )}
          {gpsStatus === 'success' && currentLocation && (
            <div className="gps-success-box">
              <span className="gps-text gps-success">
                📍 GPS: {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
              </span>
              {timeAgo && <span className="gps-time-ago">{timeAgo}</span>}
            </div>
          )}
          {gpsStatus === 'error' && (
            <div className="gps-error-box">
              <span className="gps-text gps-error">
                ⚠️ GPS: {gpsError || 'Error'}
              </span>
              {onRetryGps && (
                <button onClick={onRetryGps} className="gps-retry-btn">
                  Retry
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Photo Required Warning */}
      {!hasPhoto && !isOnline && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '6px',
          marginTop: '12px',
        }}>
          <p style={{ 
            margin: 0, 
            fontSize: '0.85rem', 
            color: '#ef4444',
            textAlign: 'center'
          }}>
            📸 Profile photo required to go online
          </p>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={onToggleOnline}
        disabled={isTransitioning || (!hasPhoto && !isOnline) || (disableGoOnline && !isOnline)}
        className={`btn-toggle-online ${isOnline ? 'btn-go-offline' : 'btn-go-online'}`}
        style={{
          opacity: ((!hasPhoto && !isOnline) || (disableGoOnline && !isOnline)) ? 0.5 : 1,
          cursor: ((!hasPhoto && !isOnline) || (disableGoOnline && !isOnline)) ? 'not-allowed' : 'pointer',
        }}
      >
        {isTransitioning ? '...' : isOnline ? 'Go Offline' : disableGoOnline ? 'System Maintenance' : !hasPhoto ? 'Photo Required' : 'Go Online'}
      </button>
    </div>
  );
}
