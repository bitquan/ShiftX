/**
 * Platform Fee Configuration
 * 
 * ShiftX business model:
 * - Customer pays: base fare + rider platform fee
 * - Driver receives: base fare - driver platform fee
 * - Platform keeps: rider fee + driver fee
 */

// Platform fees (in cents)
export const RIDER_PLATFORM_FEE_CENTS = 150; // $1.50
export const DRIVER_PLATFORM_FEE_CENTS = 150; // $1.50

/**
 * Calculate total charge to customer
 * @param fareCents - Base ride fare in cents
 * @returns Total amount to charge customer (fare + rider fee)
 */
export function calculateTotalCharge(fareCents: number): number {
  return fareCents + RIDER_PLATFORM_FEE_CENTS;
}

/**
 * Calculate driver payout
 * @param fareCents - Base ride fare in cents
 * @returns Net amount driver receives (fare - driver fee)
 */
export function calculateDriverPayout(fareCents: number): number {
  return fareCents - DRIVER_PLATFORM_FEE_CENTS;
}

/**
 * Calculate total platform fee (for Stripe application_fee_amount)
 * @returns Total platform fee (rider fee + driver fee)
 */
export function calculatePlatformFee(): number {
  return RIDER_PLATFORM_FEE_CENTS + DRIVER_PLATFORM_FEE_CENTS;
}

/**
 * Get fee breakdown for receipts/UI
 * @param fareCents - Base ride fare in cents
 */
export function getFeeBreakdown(fareCents: number) {
  return {
    fareCents,
    riderFeeCents: RIDER_PLATFORM_FEE_CENTS,
    driverFeeCents: DRIVER_PLATFORM_FEE_CENTS,
    totalChargeCents: calculateTotalCharge(fareCents),
    driverPayoutCents: calculateDriverPayout(fareCents),
    platformFeeCents: calculatePlatformFee(),
  };
}
