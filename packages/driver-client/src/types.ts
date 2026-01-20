export type RideStatus =
  | 'requested'
  | 'dispatching'
  | 'offered'
  | 'accepted'
  | 'started'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type OfferStatus = 'pending' | 'accepted' | 'expired' | 'cancelled' | 'rejected';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface SavedPlace {
  address: string;
  lat: number;
  lng: number;
}

export interface VehicleInfo {
  make: string;
  model: string;
  color: string;
  plate: string;
}

export interface DriverProfile {
  isOnline?: boolean;
  isBusy?: boolean;
  approved?: boolean;
  approvalBypassByAdmin?: boolean;
  currentRideId?: string | null;
  currentRideStatus?: 'accepted' | 'started' | 'in_progress' | 'completed';
  vehicle?: string;
  vehicleClass?: 'shiftx' | 'shift_lx' | 'shift_black';
  vehicleInfo?: VehicleInfo;
  onboardingStatus?: 'pending' | 'active' | 'suspended';
  photoURL?: string;
  ratingAvg?: number;
  ratingCount?: number;
  updatedAtMs?: number;
  lastSeenAtMs?: number;
  location?: LatLng;
  licensePhotoURL?: string;
  insurancePhotoURL?: string;
  vehiclePhotoURL?: string;
  registrationPhotoURL?: string;
}

export interface UserProfile {
  role?: 'driver' | 'customer' | 'admin';
  displayName?: string;
  photoURL?: string;
  createdAtMs?: number;
}

export interface CustomerProfile {
  onboardingStatus?: 'pending' | 'active' | 'suspended';
  homePlace?: SavedPlace;
  workPlace?: SavedPlace;
  ratingAvg?: number;
  ratingCount?: number;
  createdAtMs?: number;
  updatedAtMs?: number;
}

export interface RideOffer {
  driverId: string;
  status: OfferStatus;
  quotedAtMs?: number;
  expiresAtMs?: number;
  matchMetadata?: Record<string, unknown>;
  attempts?: number;
  rideId?: string;
  pickup?: LatLng;
  dropoff?: LatLng;
  priceCents?: number;
}

export interface Ride {
  riderId: string;
  status: RideStatus;
  pickup: LatLng;
  dropoff: LatLng;
  priceCents?: number;
  requestedAtMs: number;
  driverId?: string;
  acceptedAtMs?: number;
  startedAtMs?: number;
  completedAtMs?: number;
  cancelledAtMs?: number;
  metadata?: Record<string, unknown>;
}

export interface TripRequestData {
  pickup: LatLng;
  dropoff: LatLng;
  priceCents?: number;
  metadata?: Record<string, unknown>;
}

export interface TripCancelPayload {
  rideId: string;
  reason?: string;
}

export interface CreateTestRideData {
  rideId: string;
  riderId?: string;
  pickup?: LatLng;
  dropoff?: LatLng;
  priceCents?: number;
}

export type TripUpdateStatus = 'started' | 'in_progress' | 'completed';

export interface TripRequestResult {
  rideId: string;
}
