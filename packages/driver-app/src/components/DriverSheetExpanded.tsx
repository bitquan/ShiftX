import React from 'react';
import { mapDriverUiState, DriverUiState, UiAction } from '../utils/mapDriverUiState';
import { DriverStatusCard } from './DriverStatusCard';
import { TabId } from './BottomNav';
import { RuntimeFlags } from '../utils/runtimeFlags';
import { featureFlags } from '../config/featureFlags';
import './driverSheetContent.css';

interface DriverSheetExpandedProps {
  state: DriverUiState;
  driverId: string;
  driverPhotoURL: string | null;
  onToggleOnline: () => void;
  onRetryGps: () => void;
  onCreateTestRide: () => void;
  onViewActiveRide?: () => void;
  setActiveTab: (tab: TabId) => void;
  runtimeFlags: RuntimeFlags | null;
  isInsecureOrigin: boolean;
  showAvailability: boolean;
  setShowAvailability: (show: boolean) => void;
  isCreatingTest: boolean;
  isSpawningDrivers: boolean;
  onSpawnDrivers: (count: number, online: boolean) => Promise<void>;
  onCleanupTestData: () => void;
}

/**
 * Expanded view - full details and actions
 */
export function DriverSheetExpanded(props: DriverSheetExpandedProps) {
  const {
    state,
    driverId,
    driverPhotoURL,
    onToggleOnline,
    onRetryGps,
    onCreateTestRide,
    onViewActiveRide,
    setActiveTab,
    runtimeFlags,
    isInsecureOrigin,
    showAvailability,
    setShowAvailability,
    isCreatingTest,
    isSpawningDrivers,
    onSpawnDrivers,
    onCleanupTestData,
  } = props;
  
  const uiContent = mapDriverUiState(state);
  const { profile, onlineState, gpsStatus, pendingOffers, hasActiveRide, activeRideId } = state;
  
  return (
    <div className="driver-sheet-expanded">
      {/* Card 1: Driver Status Card (always shown) */}
      <DriverStatusCard
        driverId={driverId}
        isOnline={onlineState === 'online'}
        gpsStatus={gpsStatus}
        currentLocation={state.currentLocation}
        gpsError={state.gpsError}
        lastFixAtMs={state.gpsError ? null : Date.now()} // TODO: Get actual lastFixAtMs
        onToggleOnline={onToggleOnline}
        onRetryGps={onRetryGps}
        isTransitioning={state.isTransitioning || hasActiveRide}
        hasPhoto={!!driverPhotoURL}
        disableGoOnline={runtimeFlags?.disableDriverOnline || false}
      />

      {/* Insecure Origin Warning */}
      {isInsecureOrigin && (
        <div className="card warning-card">
          <h3>⚠️ Insecure Connection</h3>
          <p>Geolocation may not work on non-HTTPS origins (except localhost).</p>
          <p>Deploy to Firebase Hosting or use a secure connection for full functionality.</p>
        </div>
      )}

      {/* Card 2: Current Work (mapped UI state) */}
      <div className="card">
        <h3>
          {uiContent.mode === 'offer' && '🔔 '}
          {uiContent.mode === 'assigned' && '🚗 '}
          {uiContent.title}
        </h3>
        
        <p className="subtitle">{uiContent.subtitle}</p>
        
        {uiContent.secondaryInfo && (
          <p className="secondary-info">{uiContent.secondaryInfo}</p>
        )}
        
        {/* Render mapped actions */}
        {uiContent.primaryActions.length > 0 && (
          <div className="action-buttons">
            {uiContent.primaryActions.map((action: UiAction, idx: number) => (
              <button
                key={idx}
                className={`btn ${action.variant || 'primary'}`}
                onClick={action.onClick}
                disabled={action.disabled}
                title={action.tooltip}
              >
                {action.label}
                {action.disabled && action.tooltip && ' (TODO)'}
              </button>
            ))}
          </div>
        )}
        
        {/* Show active ride button if applicable */}
        {hasActiveRide && activeRideId && onViewActiveRide && (
          <button className="btn secondary" onClick={onViewActiveRide}>
            View Active Ride
          </button>
        )}
      </div>

      {/* Card 3: Quick Actions (only when online and idle) */}
      {onlineState === 'online' && !hasActiveRide && pendingOffers.size === 0 && (
        <div className="card">
          <h3>Quick Actions</h3>
          <div className="quick-actions">
            <button className="btn secondary" onClick={() => setActiveTab('rides')}>
              Ride History
            </button>
            <button className="btn secondary" onClick={() => setActiveTab('profile')}>
              My Profile
            </button>
          </div>
        </div>
      )}

      {/* Dev Tools (only in development) */}
      {featureFlags?.enableDevTools && (
        <div className="card dev-card">
          <h3>🛠️ Dev Tools</h3>
          <div className="dev-actions">
            <button
              className="btn secondary"
              onClick={onCreateTestRide}
              disabled={isCreatingTest || !state.currentLocation}
            >
              {isCreatingTest ? 'Creating...' : 'Create Test Ride'}
            </button>
            <button
              className="btn secondary"
              onClick={() => onSpawnDrivers(5, true)}
              disabled={isSpawningDrivers}
            >
              {isSpawningDrivers ? 'Spawning...' : 'Spawn 5 Test Drivers'}
            </button>
            <button className="btn secondary" onClick={onCleanupTestData}>
              Cleanup Test Data
            </button>
          </div>
          
          <div className="runtime-flags">
            <strong>Runtime Flags:</strong>
            <pre>{JSON.stringify(runtimeFlags, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
