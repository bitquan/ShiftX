/**
 * EXAMPLE MIGRATION
 * 
 * This file shows concrete before/after examples of migrating from
 * raw strings to the shared package enums and utilities.
 */

// ============================================================================
// EXAMPLE 1: Basic Status Checks
// ============================================================================

// ❌ BEFORE (using raw strings)
function handleRideOld(ride: any) {
  if (ride.status === 'accepted') {
    console.log('Ride accepted');
  } else if (ride.status === 'started') {
    console.log('Ride started');
  } else if (ride.status === 'completed') {
    console.log('Ride completed');
  }
}

// ✅ AFTER (using enums from shared package)
import { RideStatus, Ride } from '@shiftx/shared';

function handleRideNew(ride: Ride) {
  if (ride.status === RideStatus.ACCEPTED) {
    console.log('Ride accepted');
  } else if (ride.status === RideStatus.STARTED) {
    console.log('Ride started');
  } else if (ride.status === RideStatus.COMPLETED) {
    console.log('Ride completed');
  }
}

// ============================================================================
// EXAMPLE 2: Switch Statements with assertNever
// ============================================================================

// ❌ BEFORE (no exhaustive checking)
function getRideStatusColorOld(status: string): string {
  switch (status) {
    case 'requested':
      return 'yellow';
    case 'accepted':
      return 'blue';
    case 'completed':
      return 'green';
    case 'cancelled':
      return 'red';
    default:
      return 'gray'; // Silently fails if new status is added
  }
}

// ✅ AFTER (exhaustive checking with assertNever)
import { RideStatus, assertNever } from '@shiftx/shared';

function getRideStatusColorNew(status: RideStatus): string {
  switch (status) {
    case RideStatus.REQUESTED:
      return 'yellow';
    case RideStatus.OFFERED:
      return 'orange';
    case RideStatus.ACCEPTED:
      return 'blue';
    case RideStatus.STARTED:
      return 'lightblue';
    case RideStatus.IN_PROGRESS:
      return 'darkblue';
    case RideStatus.COMPLETED:
      return 'green';
    case RideStatus.CANCELLED:
      return 'red';
    default:
      // TypeScript will error if we forget a case!
      return assertNever(status);
  }
}

// ============================================================================
// EXAMPLE 3: Firestore Queries
// ============================================================================

// ❌ BEFORE (raw strings in queries)
async function getActiveRidesOld(db: any) {
  const snapshot = await db
    .collection('rides')
    .where('status', 'in', ['requested', 'offered', 'accepted', 'started', 'in_progress'])
    .get();
  return snapshot.docs;
}

// ✅ AFTER (using enum values)
import { RideStatus } from '@shiftx/shared';

async function getActiveRidesNew(db: any) {
  const activeStatuses = [
    RideStatus.REQUESTED,
    RideStatus.OFFERED,
    RideStatus.ACCEPTED,
    RideStatus.STARTED,
    RideStatus.IN_PROGRESS,
  ];
  
  const snapshot = await db
    .collection('rides')
    .where('status', 'in', activeStatuses)
    .get();
  return snapshot.docs;
}

// ============================================================================
// EXAMPLE 4: Pricing Utilities
// ============================================================================

// ❌ BEFORE (manual formatting)
function displayPriceOld(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toFixed(2)}`;
}

function parsePriceOld(input: string): number {
  const cleaned = input.replace(/[$,]/g, '');
  const dollars = parseFloat(cleaned);
  return Math.round(dollars * 100);
}

// ✅ AFTER (using shared utilities)
import { formatCurrency, parseCurrencyToCents } from '@shiftx/shared';

function displayPriceNew(cents: number): string {
  return formatCurrency(cents); // Handles locale, symbols, etc.
}

function parsePriceNew(input: string): number {
  return parseCurrencyToCents(input); // Handles $, commas, decimals
}

// ============================================================================
// EXAMPLE 5: Creating New Rides
// ============================================================================

// ❌ BEFORE (untyped object)
async function createRideOld(db: any, data: any) {
  const rideRef = db.collection('rides').doc();
  await rideRef.set({
    customerId: data.customerId,
    status: 'requested', // Easy to typo
    serviceClass: 'shiftx',
    pickup: data.pickup,
    dropoff: data.dropoff,
    createdAt: new Date(),
  });
  return rideRef.id;
}

// ✅ AFTER (typed with shared types)
import { Ride, RideStatus, ServiceClass, Location } from '@shiftx/shared';

interface CreateRideInput {
  customerId: string;
  serviceClass: ServiceClass;
  pickup: Location;
  dropoff: Location;
}

async function createRideNew(db: any, data: CreateRideInput) {
  const rideRef = db.collection('rides').doc();
  
  const ride: Partial<Ride> = {
    customerId: data.customerId,
    status: RideStatus.REQUESTED, // Autocomplete + type-safe
    serviceClass: data.serviceClass,
    pickup: data.pickup,
    dropoff: data.dropoff,
    createdAt: new Date(),
  };
  
  await rideRef.set(ride);
  return rideRef.id;
}

// ============================================================================
// EXAMPLE 6: Driver Approval
// ============================================================================

// ❌ BEFORE (magic strings)
async function approveDriverOld(db: any, driverId: string) {
  await db.collection('drivers').doc(driverId).update({
    approvalStatus: 'approved', // Could typo as 'approve' or 'Approved'
  });
}

// ✅ AFTER (using enum)
import { DriverApprovalStatus } from '@shiftx/shared';

async function approveDriverNew(db: any, driverId: string) {
  await db.collection('drivers').doc(driverId).update({
    approvalStatus: DriverApprovalStatus.APPROVED, // Autocomplete + validation
  });
}

// ============================================================================
// EXAMPLE 7: Cancel Reasons
// ============================================================================

// ❌ BEFORE (inconsistent strings across codebase)
function cancelRideOld(rideId: string, reason: string) {
  // Might use 'no_drivers', 'no-drivers', 'noDrivers', etc.
  // No central definition = inconsistency
}

// ✅ AFTER (using CancelReason enum)
import { CancelReason } from '@shiftx/shared';

function cancelRideNew(rideId: string, reason: CancelReason) {
  // Only valid CancelReason values allowed
  // Examples: CancelReason.NO_DRIVERS_AVAILABLE
  //           CancelReason.CUSTOMER_CHANGED_MIND
  //           CancelReason.SYSTEM_ERROR
}

// ============================================================================
// EXAMPLE 8: Distance Calculation
// ============================================================================

// ❌ BEFORE (duplicated Haversine formula in multiple files)
function calculateDistanceOld(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 0.621371; // Convert to miles
}

// ✅ AFTER (using shared utility)
import { calculateDistance, Location } from '@shiftx/shared';

const pickup: Location = { latitude: 40.7128, longitude: -74.0060 };
const dropoff: Location = { latitude: 40.7580, longitude: -73.9855 };

const distanceMiles = calculateDistance(pickup, dropoff);

// ============================================================================
// EXAMPLE 9: Type-Safe Components (React/Flutter)
// ============================================================================

// ❌ BEFORE (any types, no validation)
function RideStatusBadgeOld({ status }: { status: any }) {
  let color = 'gray';
  let text = status;
  
  if (status === 'requested') {
    color = 'yellow';
    text = 'Requested';
  } else if (status === 'accepted') {
    color = 'blue';
    text = 'Accepted';
  }
  // ... etc
  
  return <Badge color={color}>{text}</Badge>;
}

// ✅ AFTER (typed with enum)
import { RideStatus } from '@shiftx/shared';

function RideStatusBadgeNew({ status }: { status: RideStatus }) {
  const config = getRideStatusConfig(status);
  return <Badge color={config.color}>{config.label}</Badge>;
}

function getRideStatusConfig(status: RideStatus) {
  switch (status) {
    case RideStatus.REQUESTED:
      return { color: 'yellow', label: 'Requested' };
    case RideStatus.OFFERED:
      return { color: 'orange', label: 'Offered' };
    case RideStatus.ACCEPTED:
      return { color: 'blue', label: 'Accepted' };
    case RideStatus.STARTED:
      return { color: 'lightblue', label: 'Started' };
    case RideStatus.IN_PROGRESS:
      return { color: 'darkblue', label: 'In Progress' };
    case RideStatus.COMPLETED:
      return { color: 'green', label: 'Completed' };
    case RideStatus.CANCELLED:
      return { color: 'red', label: 'Cancelled' };
    default:
      return assertNever(status);
  }
}

// ============================================================================
// KEY BENEFITS DEMONSTRATED
// ============================================================================

/**
 * 1. AUTOCOMPLETE: IDE suggests all valid enum values
 * 2. TYPE SAFETY: Can't pass invalid strings
 * 3. REFACTORING: Rename enum value = updates everywhere
 * 4. EXHAUSTIVENESS: assertNever catches missing cases
 * 5. CONSISTENCY: One source of truth for all packages
 * 6. DOCUMENTATION: Enums are self-documenting
 * 7. NO TYPOS: 'accepted' vs 'ACCEPTED' vs 'Accepted' all prevented
 * 8. COMPILE-TIME ERRORS: Catch bugs before runtime
 */
