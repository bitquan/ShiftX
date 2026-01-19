import React from 'react';
import { DriverProfile, RideOffer } from '@shiftx/driver-client';
import { DriverStatusCard } from './DriverStatusCard';
import { Availability } from './Availability';
import { TabId } from './BottomNav';
import { featureFlags } from '../config/featureFlags';
import { RuntimeFlags } from '../utils/runtimeFlags';
import './driverBottomPanel.css';

interface DriverBottomPanelProps {
  // Driver state
  driverId: string;
  profile: DriverProfile | null;
  hasActiveRide: boolean;
  activeRideId?: string;
  pendingOffers: Map<string, RideOffer>;
  
  // Online state
  onlineState: 'offline' | 'going_online' | 'online' | 'going_offline';
  isTransitioning: boolean;
  
  // GPS
  gpsStatus: 'loading' | 'success' | 'error';
  currentLocation: { lat: number; lng: number } | null;
  gpsError: string | null;
  lastFixAtMs: number | null;
  
  // Flags & UI
  runtimeFlags: RuntimeFlags | null;
  showAvailability: boolean;
  isInsecureOrigin: boolean;
  locationPermission: 'prompt' | 'granted' | 'denied' | 'unavailable';
  
  // Handlers
  onToggleOnline: () => void;
  onRetryGps: () => void;
  onViewActiveRide?: () => void;
  setActiveTab: (tab: TabId) => void;
  setShowAvailability: (show: boolean) => void;
  onCopyInviteLink: () => void;
  onCreateTestRide: () => void;
  onSpawnDrivers: (count: number, online: boolean) => void;
  onRunCleanup: () => void;
  
  // Loading states
  isCreatingTest: boolean;
  isSpawningDrivers: boolean;
}

export function DriverBottomPanel({
  driverId,
  profile,
  hasActiveRide,
  activeRideId,
  pendingOffers,
  onlineState,
  isTransitioning,
  gpsStatus,
  currentLocation,
  gpsError,
  lastFixAtMs,
  runtimeFlags,
  showAvailability,
  isInsecureOrigin,
  locationPermission,
  onToggleOnline,
  onRetryGps,
  onViewActiveRide,
  setActiveTab,
  setShowAvailability,
  onCopyInviteLink,
  onCreateTestRide,
  onSpawnDrivers,
  onRunCleanup,
  isCreatingTest,
  isSpawningDrivers,
}: DriverBottomPanelProps) {
  const driverPhotoURL = profile?.photoURL || null;
  const topOffer = profile?.currentRideId ? null : pendingOffers.size > 0 ? Array.from(pendingOffers.entries())[0] : null;



  return (
    <div className="driver-bottom-panel">
      {/* Card 1: Driver Status */}
      <DriverStatusCard
        driverId={driverId}
        isOnline={onlineState === 'online'}
        gpsStatus={gpsStatus}
        currentLocation={currentLocation}
        gpsError={gpsError}
        lastFixAtMs={lastFixAtMs}
        onToggleOnline={onToggleOnline}
        onRetryGps={onRetryGps}
        isTransitioning={isTransitioning || hasActiveRide}
        hasPhoto={!!driverPhotoURL}
        disableGoOnline={runtimeFlags?.disableDriverOnline || false}
      />

      {/* Insecure Origin Warning */}
      {isInsecureOrigin && (
        <div className="info-banner">
          <p>⚠️ Location may not work on insecure origins. Use localhost or https.</p>
        </div>
      )}

      {/* Card 2: Current Work */}
      <div className="control-card">
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem' }}>💼 Current Work</h3>
        
        {hasActiveRide && activeRideId ? (
          <div style={{ 
            padding: '12px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="status-pill" style={{ backgroundColor: 'rgba(59, 130, 246, 0.9)', color: '#fff' }}>
                🚗 Active Ride
              </span>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                {activeRideId.slice(0, 8)}
              </span>
            </div>
            <button
              onClick={onViewActiveRide}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'rgba(59, 130, 246, 0.9)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              📍 Open Active Ride
            </button>
          </div>
        ) : topOffer ? (
          <div style={{ 
            padding: '12px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="status-pill" style={{ backgroundColor: 'rgba(16, 185, 129, 0.9)', color: '#000' }}>
                ⚡ New Offer
              </span>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                {topOffer[0].slice(0, 8)}
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', margin: '8px 0' }}>
              Expires: {Math.max(0, Math.floor(((topOffer[1].expiresAtMs || 0) - Date.now()) / 1000))}s
            </p>
            <button
              onClick={() => setActiveTab('rides')}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.9)',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              👀 View Offer
            </button>
          </div>
        ) : (
          <div style={{ 
            padding: '16px',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.4)',
            backgroundColor: 'rgba(255,255,255,0.02)',
            borderRadius: '8px',
            border: '1px dashed rgba(255,255,255,0.1)'
          }}>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>No requests yet</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem' }}>
              {onlineState === 'online' ? 'Waiting for ride requests...' : 'Go online to receive requests'}
            </p>
          </div>
        )}
      </div>

      {/* Card 3: Quick Actions */}
      <div className="control-card">
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem' }}>⚡ Quick Actions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => setShowAvailability(!showAvailability)}
            className="quick-action-button"
          >
            ⏰ {showAvailability ? 'Hide' : 'Set'} Availability
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className="quick-action-button"
          >
            🚗 Vehicle & Rates
          </button>
          <button
            onClick={onCopyInviteLink}
            className="quick-action-button"
          >
            🔗 Invite Preferred Customers
          </button>
        </div>
      </div>

      {/* Expanded Availability Section */}
      {showAvailability && (
        <div className="control-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>⏰ Set Availability</h3>
            <button
              onClick={() => setShowAvailability(false)}
              style={{
                padding: '4px 12px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.8)',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Hide
            </button>
          </div>
          <Availability />
        </div>
      )}

      {/* Warning Banners */}
      {locationPermission === 'denied' && onlineState === 'offline' && (
        <div className="info-banner" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <p style={{ color: '#ef4444' }}>
            ⚠️ <strong>Location permission denied</strong><br />
            Enable location access in your browser settings, then click the button below.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            🔄 Reload App
          </button>
        </div>
      )}

      {/* Dev Tools */}
      {featureFlags.enableDevTools && (
        <div className="control-card">
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem' }}>🧪 Dev Tools</h3>
        
          <div style={{ marginBottom: '12px' }}>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '8px' }}>Test Ride</p>
            <button
              onClick={onCreateTestRide}
              disabled={isCreatingTest || onlineState !== 'online'}
              className="secondary-button"
              style={{ width: '100%' }}
            >
              {isCreatingTest ? 'Creating...' : 'Create test ride'}
            </button>
            {onlineState !== 'online' && <p className="text-muted small">Go online to create test rides</p>}
          </div>

          <div style={{ marginBottom: '12px' }}>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '8px' }}>Spawn Fake Drivers</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => onSpawnDrivers(5, true)}
                disabled={isSpawningDrivers}
                className="secondary-button"
                style={{ flex: 1, fontSize: '0.85rem', padding: '8px' }}
              >
                5 Online
              </button>
              <button
                onClick={() => onSpawnDrivers(10, true)}
                disabled={isSpawningDrivers}
                className="secondary-button"
                style={{ flex: 1, fontSize: '0.85rem', padding: '8px' }}
              >
                10 Online
              </button>
              <button
                onClick={() => onSpawnDrivers(5, false)}
                disabled={isSpawningDrivers}
                className="secondary-button"
                style={{ flex: 1, fontSize: '0.85rem', padding: '8px' }}
              >
                5 Offline
              </button>
            </div>
          </div>

          <div>
            <button
              onClick={onRunCleanup}
              disabled={isSpawningDrivers}
              className="secondary-button"
              style={{ width: '100%' }}
            >
              {isSpawningDrivers ? 'Running...' : '🧹 Run Cleanup Job'}
            </button>
            <p className="text-muted small" style={{ marginTop: '8px', fontSize: '0.75rem' }}>
              Cancels stuck rides, expires old offers, marks ghost drivers offline
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
