# Task 1 - Driver Blocking & Reporting - COMPLETE ✅

## What Was Built

### 1. Cloud Functions (5 new functions)
- `driverBlockCustomer` - Driver blocks a customer, future rides from that customer won't reach this driver
- `driverUnblockCustomer` - Driver unblocks a previously blocked customer
- `createReport` - Any user can report another user (driver or customer) with reason
- `getBlockedCustomers` - Driver can view their blocked customers list
- `tripRequest` (updated) - Now checks if driver has blocked the customer before creating offer

### 2. Firestore Schema
- `drivers/{driverId}/blockedCustomers/{customerId}` subcollection
  - Stores: customerId, customerEmail, reason, blockedAtMs, blockedAt
- `reports/{reportId}` collection
  - Stores: reporterUid, reporterEmail, targetUid, targetEmail, targetRole, rideId, reason, category, status, createdAtMs

### 3. Firestore Rules
- Drivers can read/create/delete in their own blockedCustomers subcollection
- Any authenticated user can create reports
- Only admins can read reports
- Reports are immutable (can't be updated or deleted)

### 4. Driver App UI
- **Offer Modal**: Added "🚫 Block Rider" and "⚠️ Report" buttons
  - Block prompts for optional reason, then declines offer and closes modal
  - Report prompts for required reason, submits to admin, keeps modal open
- Uses Firebase Functions httpsCallable for backend communication

### 5. Admin Dashboard
- **New "⚠️ Reports" tab** with read-only report list
- Filters: All, Pending, Reviewed
- Shows: Reporter info, target user info, reason, category, ride ID, timestamp
- Real-time loading from Firestore

## How It Works

### Driver Blocks Customer Flow:
1. Driver sees ride offer in OfferModal
2. Clicks "🚫 Block Rider" button
3. Prompted for optional reason
4. Function writes to `drivers/{driverId}/blockedCustomers/{customerId}`
5. Offer automatically declined and modal closes
6. Future rides from that customer: dispatcher skips this driver in matching

### Report Flow:
1. User (driver or customer) clicks "⚠️ Report" button
2. Prompted for required reason
3. Function writes to `reports/` collection with full context
4. Toast confirmation: "Report submitted to admin"
5. Admin sees report in dashboard Reports tab

### Dispatcher Exclusion:
In `tripRequest` function, for each online driver:
```javascript
const blockedDoc = await driverDoc.ref
  .collection('blockedCustomers')
  .doc(customerId)
  .get();

if (blockedDoc.exists) {
  console.log(`Driver ${driverId} has blocked customer ${customerId}, skipping`);
  continue; // Skip this driver
}
```

## Deployments

### Rules & Functions:
```bash
firebase deploy --only firestore:rules
./scripts/deploy-functions.sh driverBlockCustomer,driverUnblockCustomer,createReport,getBlockedCustomers,tripRequest
```

### Apps:
```bash
firebase deploy --only hosting:driver  # Block/Report UI
firebase deploy --only hosting:admin   # Reports view
```

## Testing

### Test Blocking:
1. Driver app: https://shiftx-95c4b-driver.web.app
2. Wait for ride offer
3. Click "🚫 Block Rider"
4. Enter reason (optional)
5. Verify: Offer closes, customer blocked
6. Have that customer request another ride
7. Verify: This driver doesn't get the offer

### Test Reporting:
1. Driver app: Click "⚠️ Report" on offer
2. Enter reason
3. Check admin dashboard Reports tab
4. Verify: Report appears with full details

### Admin View:
1. Admin dashboard: https://shiftx-95c4b-admin.web.app
2. Click "⚠️ Reports" tab
3. See all submitted reports
4. Filter by Pending/Reviewed

## Acceptance Criteria

✅ Driver blocks a customer → future requests from that customer never reach that driver  
✅ Reporting creates a visible record for admin review  
✅ Block UI in offer modal with reason prompt  
✅ Report UI in offer modal with category  
✅ Admin dashboard shows reports (read-only list)  
✅ Proper authentication (only drivers can block, authenticated users can report)  
✅ Firestore rules enforce security  

## Next Steps (Not Implemented Yet)

- Active ride "Report Issue" button
- History/receipt "Block Rider" button
- Admin actions on reports (mark as reviewed, take action)
- Driver can view/manage their blocked customers list in app
- Customer notification when driver reports them (optional)

## Files Changed

**Functions:**
- `functions/src/blocking.ts` (NEW - 200+ lines)
- `functions/src/rides.ts` (updated tripRequest with blocking check)
- `functions/src/index.ts` (export blocking functions)

**Driver App:**
- `packages/driver-app/src/components/OfferModal.tsx` (added Block/Report buttons + handlers)

**Admin Dashboard:**
- `packages/admin-dashboard/src/components/Reports.tsx` (NEW - 150+ lines)
- `packages/admin-dashboard/src/components/Dashboard.tsx` (added Reports tab)

**Rules:**
- `firestore.rules` (blockedCustomers subcollection + reports collection)

**Total**: 3 new files, 4 modified files, 5 new cloud functions
