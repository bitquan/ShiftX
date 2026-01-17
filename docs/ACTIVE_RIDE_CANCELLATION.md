# Active Ride Cancellation Feature

## Overview

Added ability for both customers and drivers to cancel rides that are already in progress (status: `started` or `in_progress`).

## Use Cases

1. **Customer Changes Mind**: Rider no longer needs the ride after it has started
2. **Passenger No-Show**: Driver accepted and started the ride, but passenger never appeared
3. **Accidental Start**: Driver or customer accidentally clicked "Start Ride" button

## Implementation

### Backend Function

**File**: `functions/src/rides.ts`

New Cloud Function: `cancelActiveRide`

**Parameters**:
- `rideId`: string - The ride ID to cancel
- `reason`: string - Reason for cancellation (e.g., "passenger_no_show", "accidental_start", "Customer no longer needs ride")

**Logic**:
1. Validates ride exists and user has permission (customer or driver)
2. Only allows cancellation of rides with status `started` or `in_progress`
3. Updates ride status to `cancelled` with reason and timestamp
4. Releases driver from `isBusy` state
5. **Payment Handling**:
   - If payment was **captured**: Creates full Stripe refund, updates ride status to `refunded`
   - If payment was **authorized only**: Cancels the authorization
   - Updates payment status accordingly
6. Logs detailed cancellation event with reason

**Event Type Added**: `payment_refunded` in `functions/src/eventLog.ts`

### Customer App UI

**File**: `packages/customer-app/src/components/RideStatus.tsx`

**Changes**:
- Added `canCancelActive` state for rides in `started` or `in_progress` status
- Added `handleCancelActiveRide` function that calls the new Cloud Function
- Added "Cancel Active Ride" button that appears during active rides
- Shows warning about refund policy in confirmation dialog
- Displays success message indicating refund status

**UI Location**: Between payment authorization UI and receipt section

### Driver App UI

**File**: `packages/driver-app/src/components/ActiveRide.tsx`

**Changes**:
- Modified `handleCancel` to detect active ride status
- Routes to appropriate cancel function (`cancelActiveRide` or `cancelRide`)
- For active rides, prompts driver to select reason:
  1. passenger_no_show
  2. accidental_start  
  3. other
- Shows confirmation dialog with refund notice
- Displays appropriate success message based on refund status

## Payment Refund Policy

- **Active rides**: Full refund issued via Stripe
- **Payment captured**: Creates `stripe.refunds.create()` with `reason: 'requested_by_customer'`
- **Payment authorized only**: Cancels authorization via `stripe.paymentIntents.cancel()`
- **Refund failure**: Ride is still cancelled, but payment status set to `refund_failed` for manual resolution

## Database Updates

When an active ride is cancelled, the following fields are updated:

```typescript
{
  status: 'cancelled',
  cancelReason: string,        // e.g., "passenger_no_show"
  cancelledBy: string,          // UID of user who cancelled
  cancelledAtMs: number,        // Timestamp
  paymentStatus: 'refunding' | 'refunded' | 'cancelled',
  refundId?: string,            // Stripe refund ID (if refund created)
  refundedAtMs?: number,        // Timestamp of refund
  refundAmountCents?: number,   // Amount refunded
  refundError?: string,         // Error message if refund failed
}
```

Driver document is also updated:
```typescript
{
  isBusy: false,
  currentRideId: null,
  currentRideStatus: null,
}
```

## Testing Scenarios

### Customer Cancels Active Ride
1. Customer requests ride
2. Driver accepts and payment is authorized
3. Driver starts ride (status: `started`)
4. Customer clicks "Cancel Active Ride" button
5. Confirms cancellation
6. ✅ Ride cancelled, full refund issued, driver released

### Driver Cancels for No-Show
1. Driver accepts ride
2. Driver arrives at pickup and clicks "Start Ride"
3. Passenger doesn't show up
4. Driver clicks "Cancel Ride" button
5. Selects reason: "passenger_no_show"
6. ✅ Ride cancelled, customer refunded, driver can accept new rides

### Driver Cancels Accidental Start
1. Driver accepts ride
2. Driver accidentally clicks "Start Ride" before arriving
3. Driver clicks "Cancel Ride" button
4. Selects reason: "accidental_start"
5. ✅ Ride cancelled, customer refunded, driver can continue to pickup (or accept new ride)

## Error Handling

Both apps handle these error scenarios:
- `unauthenticated`: User not logged in
- `permission-denied`: User not authorized to cancel this ride
- `not-found`: Ride doesn't exist
- `failed-precondition`: Ride cannot be cancelled in current state
- `internal`: Refund failed (ride still cancelled, but payment may need manual resolution)

## Security

- Only customer or assigned driver can cancel a ride
- Requires active authentication
- Transaction ensures atomic updates (ride status + driver release)
- Separate function from regular cancellation to preserve existing business logic

## Related Files

- `functions/src/rides.ts` - cancelActiveRide function
- `functions/src/eventLog.ts` - RideEventType enum
- `packages/customer-app/src/components/RideStatus.tsx` - Customer UI
- `packages/driver-app/src/components/ActiveRide.tsx` - Driver UI

## Notes

- Original `cancelRide` function still exists and handles pre-start cancellations
- Active cancellation deliberately uses a separate function to avoid modifying existing business logic
- Full refunds issued for all active ride cancellations (no partial charges)
- Consider adding cancellation rate limiting in future to prevent abuse
