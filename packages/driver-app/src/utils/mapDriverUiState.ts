import { DriverProfile, RideOffer } from '@shiftx/driver-client';

export interface DriverUiState {
  // From props
  profile: DriverProfile | null;
  hasActiveRide: boolean;
  activeRideId?: string;
  pendingOffers: Map<string, RideOffer>;
  
  // From local state
  onlineState: 'offline' | 'going_online' | 'online' | 'going_offline';
  isTransitioning: boolean;
  
  // GPS state
  gpsStatus: 'loading' | 'success' | 'error';
  currentLocation: { lat: number; lng: number } | null;
  gpsError: string | null;
}

export interface MappedUiContent {
  mode: 'offline' | 'idle' | 'offer' | 'assigned' | 'en_route_pickup' | 'arrived_pickup' | 'en_route_dropoff' | 'completed';
  title: string;
  subtitle: string;
  primaryActions: UiAction[];
  secondaryInfo?: string;
}

export interface UiAction {
  label: string;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  tooltip?: string; // For TODO buttons
}

/**
 * Maps current driver state to UI presentation (Phase 2 - UI only, no logic changes)
 * This is a pure function that determines what to show based on existing state
 */
export function mapDriverUiState(state: DriverUiState): MappedUiContent {
  const { profile, hasActiveRide, activeRideId, pendingOffers, onlineState, isTransitioning, gpsStatus, currentLocation, gpsError } = state;
  
  // Offline mode
  if (onlineState === 'offline' || onlineState === 'going_offline') {
    return {
      mode: 'offline',
      title: 'You\'re Offline',
      subtitle: isTransitioning ? 'Going offline...' : 'Tap "Go Online" to start accepting rides',
      primaryActions: [],
    };
  }
  
  // Transitioning to online
  if (onlineState === 'going_online') {
    return {
      mode: 'idle',
      title: 'Going Online',
      subtitle: 'Connecting...',
      primaryActions: [],
    };
  }
  
  // Has active ride
  if (hasActiveRide && activeRideId) {
    // TODO: In Phase 3, get actual ride data from Firestore to determine ride state
    // For now, just show generic active ride state
    return {
      mode: 'assigned',
      title: 'Active Ride',
      subtitle: `Ride ID: ${activeRideId.slice(0, 8)}...`,
      primaryActions: [
        {
          label: 'View Ride Details',
          variant: 'primary',
          disabled: true,
          tooltip: 'TODO: Wire up ride state listener in Phase 3',
        },
      ],
      secondaryInfo: 'Navigation and ride status coming in Phase 3',
    };
  }
  
  // Has pending offers
  if (pendingOffers.size > 0) {
    const offer = Array.from(pendingOffers.values())[0];
    // TODO Phase 3: Get actual address from geocoding
    const pickupAddress = 'Pickup location';
    const dropoffAddress = 'Dropoff location';
    
    return {
      mode: 'offer',
      title: 'New Ride Request',
      subtitle: `${pickupAddress} → ${dropoffAddress}`,
      primaryActions: [
        {
          label: 'Accept',
          variant: 'primary',
          disabled: true,
          tooltip: 'TODO: Wire up existing accept handler',
        },
        {
          label: 'Decline',
          variant: 'secondary',
          disabled: true,
          tooltip: 'TODO: Wire up existing decline handler',
        },
      ],
      secondaryInfo: 'TODO Phase 3: Show estimated fare and distance',
    };
  }
  
  // Online and idle (waiting for requests)
  if (onlineState === 'online') {
    // Check GPS status
    if (gpsStatus === 'error' || !currentLocation) {
      return {
        mode: 'idle',
        title: 'GPS Issue',
        subtitle: gpsError || 'Unable to get your location',
        primaryActions: [],
        secondaryInfo: 'Fix GPS to start receiving ride requests',
      };
    }
    
    return {
      mode: 'idle',
      title: 'Online',
      subtitle: 'Waiting for ride requests...',
      primaryActions: [],
      secondaryInfo: currentLocation ? `📍 ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : undefined,
    };
  }
  
  // Fallback
  return {
    mode: 'offline',
    title: 'Unknown State',
    subtitle: 'Please refresh the app',
    primaryActions: [],
  };
}
