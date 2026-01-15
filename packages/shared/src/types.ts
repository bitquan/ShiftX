import {
  RideStatus,
  OfferStatus,
  ServiceClass,
  CancelReason,
  PaymentStatus,
  UserRole,
  DriverApprovalStatus,
  AdminAction,
} from './enums';

/**
 * Location coordinates
 */
export interface Location {
  latitude: number;
  longitude: number;
}

/**
 * Saved place (home, work, etc.)
 */
export interface SavedPlace {
  address: string;
  location: Location;
  label?: string;
}

/**
 * User base interface
 */
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
  role: UserRole;
  createdAtMs: number;
  updatedAtMs?: number;
}

/**
 * Customer interface
 */
export interface Customer {
  uid: string;
  savedPlaces?: {
    home?: SavedPlace;
    work?: SavedPlace;
  };
  paymentMethods?: string[];
  defaultPaymentMethod?: string;
  totalRides?: number;
  rating?: number;
  createdAtMs: number;
  updatedAtMs?: number;
}

/**
 * Vehicle information
 */
export interface Vehicle {
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
}

/**
 * Driver interface
 */
export interface Driver {
  uid: string;
  approved: boolean;
  approvalStatus?: DriverApprovalStatus;
  isOnline: boolean;
  isBusy: boolean;
  location?: Location;
  vehicle?: Vehicle;
  vehicleClass: ServiceClass;
  vehicleInfo?: string; // Formatted string like "Black Toyota Camry"
  rates?: DriverRates;
  rating?: number;
  totalRides?: number;
  totalEarnings?: number;
  currentRideId?: string;
  currentRideStatus?: RideStatus;
  lastHeartbeatMs?: number;
  lastSeenAtMs?: number;
  createdAtMs: number;
  updatedAtMs?: number;
}

/**
 * Driver rates by service class
 */
export interface DriverRates {
  [ServiceClass.SHIFTX]: number;
  [ServiceClass.SHIFT_LX]: number;
  [ServiceClass.SHIFT_BLACK]: number;
}

/**
 * Ride pricing breakdown
 */
export interface RidePricing {
  baseFare: number; // in cents
  distanceFare: number; // in cents
  timeFare: number; // in cents
  surgeFare?: number; // in cents
  serviceFee?: number; // in cents
  tax?: number; // in cents
  total: number; // in cents
  currency: string; // e.g., 'USD'
}

/**
 * Ride interface
 */
export interface Ride {
  id: string;
  riderId: string;
  driverId?: string;
  status: RideStatus;
  serviceClass: ServiceClass;
  
  // Locations
  pickupLocation: Location;
  pickupAddress: string;
  dropoffLocation: Location;
  dropoffAddress: string;
  
  // Timing
  requestedAtMs: number;
  acceptedAtMs?: number;
  startedAtMs?: number;
  completedAtMs?: number;
  cancelledAtMs?: number;
  
  // Pricing
  estimatedPrice?: number; // in cents
  finalPrice?: number; // in cents
  pricing?: RidePricing;
  
  // Cancellation
  cancelReason?: CancelReason;
  cancelledBy?: string; // uid of who cancelled
  
  // Payment
  paymentStatus?: PaymentStatus;
  paymentIntentId?: string;
  
  // Metadata
  distance?: number; // in meters
  duration?: number; // in seconds
  rating?: number;
  tip?: number; // in cents
  notes?: string;
  
  createdAtMs: number;
  updatedAtMs?: number;
}

/**
 * Offer interface (driver offers to customer)
 */
export interface Offer {
  id: string;
  rideId: string;
  driverId: string;
  riderId: string;
  status: OfferStatus;
  price: number; // in cents
  estimatedArrival?: number; // in seconds
  expiresAtMs: number;
  createdAtMs: number;
  updatedAtMs?: number;
}

/**
 * Admin log entry for audit trail
 */
export interface AdminLog {
  id: string;
  adminUid: string;
  action: AdminAction;
  targetUid?: string; // User affected by action
  targetId?: string; // Document ID (ride, payment, etc.)
  details?: Record<string, any>;
  timestamp: number;
  ipAddress?: string;
}

/**
 * Onboarding state for drivers
 */
export interface DriverOnboarding {
  uid: string;
  step: OnboardingStep;
  completedSteps: OnboardingStep[];
  
  // Document uploads
  licensePhotoURL?: string;
  insurancePhotoURL?: string;
  vehiclePhotoURL?: string;
  
  // Background check
  backgroundCheckStatus?: 'pending' | 'approved' | 'rejected';
  backgroundCheckDate?: number;
  
  // Vehicle info
  vehicleVerified?: boolean;
  
  createdAtMs: number;
  updatedAtMs?: number;
}

/**
 * Onboarding steps
 */
export enum OnboardingStep {
  PROFILE = 'profile',
  VEHICLE = 'vehicle',
  DOCUMENTS = 'documents',
  BACKGROUND_CHECK = 'background_check',
  PAYMENT_SETUP = 'payment_setup',
  COMPLETE = 'complete',
}

/**
 * Config for admins
 */
export interface AdminConfig {
  uids: string[];
  updatedAtMs: number;
}

/**
 * Real-time presence for drivers
 */
export interface DriverPresence {
  uid: string;
  isOnline: boolean;
  location?: Location;
  lastHeartbeatMs: number;
}
