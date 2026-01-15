# Wallet & Receipt Feature Testing Guide

## Overview
This guide covers testing the driver wallet/ledger system and customer receipt feature.

## Features Implemented

### Backend
- ✅ Ledger entry creation in `completeRideHandler` after payment capture
- ✅ `getDriverLedgerSummary` callable returning today/week earnings + last 10 trips
- ✅ Firestore rules allowing drivers to read their own ledger subcollection
- ✅ `finalAmountCents` stored on ride documents for receipt display

### Customer App
- ✅ `Receipt.tsx` component displaying completed ride details
- ✅ Shows final amount charged, pickup/dropoff addresses, payment status
- ✅ Integrated into `RideStatus.tsx` when ride status is 'completed'
- ✅ Format: Green success card with trip details and payment confirmation

### Driver App
- ✅ `Wallet.tsx` component with earnings dashboard
- ✅ Shows today's earnings, week's earnings, and last 10 trips
- ✅ New 'Wallet' tab (💰) in bottom navigation
- ✅ Refresh button to reload earnings data
- ✅ Real-time earnings display with proper money formatting

## Testing Steps

### 1. Complete Ride Flow (Full Payment Cycle)

**Prerequisites:**
- Firebase emulators running (`firebase emulators:start --only auth,functions,firestore`)
- Driver app dev server running (`cd packages/driver-app && npm run dev`)
- Customer app dev server running (`cd packages/customer-app && npm run dev`)
- At least one driver online with payment test card configured

**Steps:**
1. **Customer Side:**
   - Open customer app (http://localhost:5174)
   - Sign in as customer
   - Request a ride with valid pickup/dropoff
   - Wait for driver to accept

2. **Driver Side:**
   - Open driver app (http://localhost:5173)
   - Sign in as driver
   - Go online
   - Accept the ride offer
   
3. **Customer Payment:**
   - In customer app, click "Authorize Payment"
   - Enter test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/25)
   - CVC: Any 3 digits (e.g., 123)
   - Click "Authorize Payment"
   - Verify "Payment authorized" message appears

4. **Complete Ride:**
   - In driver app, click "Start Ride"
   - Click "Complete Ride"
   - Backend should:
     - Capture payment via Stripe
     - Create ledger entry in `drivers/{driverId}/ledger/{rideId}`
     - Set `finalAmountCents` on ride document

5. **Verify Receipt (Customer):**
   - Customer app should automatically show Receipt component
   - Check for:
     - ✅ Green success card with checkmark
     - ✅ "Trip Complete" heading
     - ✅ Date and time display
     - ✅ Pickup/dropoff locations (with pin icons)
     - ✅ Total charged amount (formatted as $X.XX)
     - ✅ Payment status: "✓ Paid"
     - ✅ Ride ID (truncated)

6. **Verify Wallet (Driver):**
   - In driver app, click Wallet tab (💰)
   - Check for:
     - ✅ "Today" earnings card (green)
     - ✅ "This Week" earnings card (blue)
     - ✅ "Recent Trips" section
     - ✅ Latest trip showing in list with:
       - Amount earned (green, formatted)
       - "Today" label or date
       - Time of completion
     - ✅ Amounts match the ride's finalAmountCents

### 2. Multiple Rides Test

**Goal:** Verify earnings accumulate correctly

**Steps:**
1. Complete 3-5 rides following the flow above
2. After each ride:
   - Check customer sees receipt
   - Check driver wallet updates
   - Verify "Today" total increases by each ride amount
3. Check "Recent Trips" list shows all completed rides
4. Verify list is sorted by most recent first (newest at top)

### 3. Edge Cases

#### No Completed Rides
- Open driver app with new driver account
- Navigate to Wallet tab
- Expected: "No completed trips yet" message

#### Refresh Test
- Complete a ride
- Click "🔄 Refresh" button in Wallet
- Verify earnings reload correctly

#### Day Boundary Test
- Complete ride on Day 1
- Wait until Day 2
- Check Wallet:
  - "Today" should be $0.00
  - "This Week" should include Day 1 earnings
  - Day 1 trip should show date label instead of "Today"

#### Payment Failure
- Start ride flow
- Decline card authorization
- Complete ride normally (without payment)
- Verify:
  - No ledger entry created (payment not captured)
  - No receipt shown to customer (no finalAmountCents)
  - Driver wallet unchanged

## Firestore Data Verification

Use Firebase Emulator UI (http://localhost:4000) to inspect:

### Ride Document (After Completion)
```
rides/{rideId}
{
  status: 'completed',
  priceCents: 1500,
  finalAmountCents: 1500,  // ← New field
  paymentStatus: 'captured',
  paymentIntentId: 'pi_...',
  completedAtMs: 1234567890,
  ...
}
```

### Ledger Entry
```
drivers/{driverId}/ledger/{rideId}
{
  rideId: '...',
  amountCents: 1500,
  createdAtMs: 1234567890,
  type: 'trip_earning',
  status: 'earned'
}
```

## Money Formatting

Both Receipt and Wallet use `formatCents()` utility:
- Input: `1500` (cents)
- Output: `"$15.00"`
- Always shows 2 decimal places
- No rounding issues (uses integer cents)

## Known Behaviors

1. **Ledger entries are write-once:** Once created, they cannot be modified (backend only)
2. **Driver can only read their own ledger:** Security rules enforce ownership
3. **Receipt only shows after completion:** Not available during active ride
4. **Wallet shows last 10 trips:** Backend limits query to prevent large payloads
5. **Today/Week calculations:** Based on server time (createdAtMs)

## Troubleshooting

### Receipt not showing
- Check `ride.status === 'completed'`
- Verify `ride.finalAmountCents` exists
- Check console for React errors
- Inspect Firestore: `rides/{rideId}` should have `finalAmountCents`

### Wallet not loading
- Check driver is authenticated
- Verify `getDriverLedgerSummary` callable exists in Firebase Functions
- Check Functions logs in emulator UI
- Inspect Firestore: `drivers/{driverId}/ledger` subcollection should exist

### Earnings not updating
- Complete a new ride
- Click Refresh button in Wallet
- Check ledger entry was created in Firestore
- Verify createdAtMs is recent (Unix timestamp in milliseconds)

### Amount mismatch
- Compare `ride.finalAmountCents` with `ledger.amountCents`
- Both should match
- Check payment was captured (not just authorized)
- Verify no manual Firestore edits were made

## Success Criteria

✅ Customer sees receipt immediately after ride completion  
✅ Receipt shows correct amount, locations, and payment status  
✅ Driver wallet shows today's earnings accurately  
✅ Driver wallet shows week's earnings accurately  
✅ Recent trips list displays correctly with proper formatting  
✅ Multiple rides accumulate earnings properly  
✅ Refresh button reloads latest data  
✅ No console errors in either app  
✅ Firestore data structure matches specification  
✅ Security rules prevent unauthorized access  

## Next Steps (Future Enhancements)

- [ ] Export earnings to CSV/PDF
- [ ] Earnings history by date range
- [ ] Payment breakdown (tips, fees, net)
- [ ] Monthly/yearly summaries
- [ ] Tax estimation
- [ ] Receipt email delivery
- [ ] Print receipt functionality
