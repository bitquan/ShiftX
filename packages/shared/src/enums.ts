/**
 * Ride status enum - single source of truth for all ride states
 */
export enum RideStatus {
  REQUESTED = 'requested',
  OFFERED = 'offered',
  ACCEPTED = 'accepted',
  STARTED = 'started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * Offer status enum
 */
export enum OfferStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

/**
 * Service class enum - vehicle/service types
 */
export enum ServiceClass {
  SHIFTX = 'shiftx',
  SHIFT_LX = 'shift_lx',
  SHIFT_BLACK = 'shift_black',
}

/**
 * Cancel reason enum - why a ride was cancelled
 */
export enum CancelReason {
  // Customer cancellations
  CUSTOMER_CHANGED_MIND = 'customer_changed_mind',
  CUSTOMER_WRONG_LOCATION = 'customer_wrong_location',
  CUSTOMER_FOUND_ALTERNATIVE = 'customer_found_alternative',
  CUSTOMER_OTHER = 'customer_other',
  
  // Driver cancellations
  DRIVER_UNAVAILABLE = 'driver_unavailable',
  DRIVER_EMERGENCY = 'driver_emergency',
  DRIVER_OTHER = 'driver_other',
  
  // System cancellations
  NO_DRIVERS = 'no_drivers',
  SEARCH_TIMEOUT = 'search_timeout',
  PAYMENT_TIMEOUT = 'payment_timeout',
  PAYMENT_FAILED = 'payment_failed',
  SYSTEM_ERROR = 'system_error',
}

/**
 * Payment status enum - tracks payment lifecycle
 */
export enum PaymentStatus {
  NONE = 'none', // No payment required/started
  REQUIRES_AUTHORIZATION = 'requires_authorization', // Needs customer to authorize payment
  AUTHORIZED = 'authorized', // Payment authorized (pre-auth), ready to capture
  CAPTURED = 'captured', // Payment captured (funds collected)
  CANCELLED = 'cancelled', // Payment cancelled/voided
  FAILED = 'failed', // Payment failed
  REFUNDED = 'refunded', // Payment refunded
}

/**
 * User role enum
 */
export enum UserRole {
  CUSTOMER = 'customer',
  DRIVER = 'driver',
  ADMIN = 'admin',
}

/**
 * Driver approval status
 */
export enum DriverApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

/**
 * Admin action types for audit logs
 */
export enum AdminAction {
  APPROVE_DRIVER = 'approve_driver',
  REJECT_DRIVER = 'reject_driver',
  SUSPEND_DRIVER = 'suspend_driver',
  SUSPEND_CUSTOMER = 'suspend_customer',
  REFUND_RIDE = 'refund_ride',
  ADJUST_PRICING = 'adjust_pricing',
  VIEW_USER_DATA = 'view_user_data',
}
