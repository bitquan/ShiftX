# Admin Dashboard Production Setup

**Last Updated:** January 14, 2026  
**Project:** ShiftX Production Admin Dashboard  
**URL:** https://shiftx-95c4b-admin.web.app

---

## Overview

The Admin Dashboard is an internal tool for managing drivers, monitoring rides, and controlling system runtime flags. It should be treated as a privileged production service with restricted access.

---

## 1. Adding/Removing Admins

### Prerequisites
- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project access: `firebase login`
- Project ID: `shiftx-95c4b`

### Adding an Admin

1. **Get the User's UID**
   - User must sign in to any ShiftX app (customer/driver/admin) at least once
   - Find their UID in Firebase Console → Authentication → Users
   - Or have them provide their Firebase UID from their profile

2. **Add UID to Admin Allowlist**

```bash
# Navigate to project root
cd /path/to/shiftx

# Add admin UID (replace with actual UID)
firebase firestore:write config/admins '{
  "uids": admin.firestore.FieldValue.arrayUnion("USER_UID_HERE")
}'
```

**Using Firebase Console (Recommended):**
1. Open https://console.firebase.google.com/project/shiftx-95c4b/firestore/data
2. Navigate to: `config` → `admins`
3. Edit the `uids` array field
4. Add the new UID to the array
5. Click "Update"

**Using Cloud Functions (Programmatic):**
```typescript
import * as admin from 'firebase-admin';

async function addAdmin(uid: string) {
  await admin.firestore()
    .collection('config')
    .doc('admins')
    .update({
      uids: admin.firestore.FieldValue.arrayUnion(uid)
    });
  
  console.log(`Added admin: ${uid}`);
}
```

### Removing an Admin

```bash
# Remove admin UID
firebase firestore:write config/admins '{
  "uids": admin.firestore.FieldValue.arrayRemove("USER_UID_HERE")
}'
```

**Using Firebase Console:**
1. Open `config/admins` document
2. Edit the `uids` array
3. Remove the UID from the array
4. Click "Update"

### Verifying Admin Access

After adding/removing:
1. Have the user sign out and sign back in
2. They should see "Admin Dashboard" in navigation
3. Check browser console for: `[Admin] User is admin`
4. Verify they can access `/drivers` and `/rides` routes

---

## 2. What Admins Can Do

### Driver Management
- ✅ View all pending driver applications
- ✅ Approve/reject driver accounts
- ✅ Disable/enable existing drivers
- ✅ View driver details (vehicle, rates, location)
- ✅ See driver online/offline status
- ✅ View driver ride history

### Ride Monitoring
- ✅ View all active rides
- ✅ View ride details (pickup, dropoff, status, timeline)
- ✅ See real-time ride status updates
- ✅ View ride events timeline
- ✅ Access ride history

### System Control (Kill Switches)
- ✅ Disable new ride requests (`disableNewRequests`)
- ✅ Disable payment processing (`disablePayments`)
- ✅ Prevent drivers from going online (`disableDriverOnline`)
- ✅ Prevent drivers from accepting rides (`disableAcceptRide`)
- ✅ Set maintenance messages for users

### Audit Logs
- ✅ View all admin actions (who, what, when)
- ✅ See before/after snapshots of changes
- ✅ Track driver approvals/disables

### What Admins CANNOT Do
- ❌ Create/delete users
- ❌ Modify ride documents directly (functions only)
- ❌ Access Stripe dashboard (requires separate login)
- ❌ Delete rides or drivers (soft-delete only via disable)
- ❌ Impersonate users
- ❌ Modify payment status directly

---

## 3. Production Best Practices

### Security
- ✅ **Use production credentials:** Never share Firebase credentials
- ✅ **Limit admin count:** Only add trusted team members
- ✅ **Review access quarterly:** Remove old/inactive admins
- ✅ **Check audit logs:** Monitor `adminLogs` collection weekly
- ✅ **Use strong auth:** Require MFA on admin Google accounts

### Monitoring
- ✅ **Check Firebase Console daily:**
  - Functions execution count & errors
  - Firestore read/write usage
  - Authentication anomalies
  
- ✅ **Watch for spikes:**
  - Unusually high ride request volume
  - Payment authorization failures
  - Driver offline spikes
  
- ✅ **Set up alerts (recommended):**
  ```bash
  # Firebase Performance Monitoring
  # Set alerts for:
  # - Function error rate > 5%
  # - Ride cancellation rate > 20%
  # - Payment failure rate > 10%
  ```

### Emergency Procedures

#### Kill Switch: Disable New Ride Requests
**Use when:** System overload, Stripe issues, critical bug detected

```bash
# Open Firebase Console → Firestore
# Navigate to: config/runtimeFlags
# Set: disableNewRequests = true
```

Or via Firebase CLI:
```bash
firebase firestore:write config/runtimeFlags '{
  "disableNewRequests": true,
  "maintenanceMessage": "We are experiencing technical difficulties. Please try again in a few minutes."
}'
```

**What happens:**
- Customer app shows maintenance banner
- "Request Ride" button is disabled
- Existing rides continue normally
- Drivers can complete ongoing rides

#### Kill Switch: Disable Driver Online
**Use when:** Need to pause all new dispatching

```bash
firebase firestore:write config/runtimeFlags '{
  "disableDriverOnline": true,
  "maintenanceMessage": "Driver app is temporarily unavailable for maintenance."
}'
```

**What happens:**
- Drivers cannot go online
- Online drivers remain online (can complete rides)
- No new offers sent to drivers
- Customer app shows "No drivers available"

#### Kill Switch: Disable Payments
**Use when:** Stripe integration issues

```bash
firebase firestore:write config/runtimeFlags '{
  "disablePayments": true,
  "maintenanceMessage": "Payment processing is temporarily unavailable."
}'
```

**What happens:**
- `authorizePayment` function rejects with error
- Customers see payment error message
- Rides stay in `accepted` status (can't start without payment)
- Drivers wait for payment authorization

---

## 4. Common Admin Tasks

### Approve a New Driver

1. Sign in to Admin Dashboard
2. Navigate to "Drivers" tab
3. Filter by "Pending Approval"
4. Click on driver name to view details
5. Review:
   - Vehicle information
   - License/insurance (if uploaded)
   - Profile completeness
6. Click "Approve Driver"
7. Confirmation modal appears
8. Click "Confirm"
9. Driver receives notification (if implemented)
10. Driver can now go online

**What happens behind the scenes:**
```typescript
// drivers/{driverId}.approved = true
// adminLogs/{logId} = { action: 'approve_driver', ... }
```

### Disable a Problematic Driver

1. Navigate to "Drivers" tab
2. Search or filter for the driver
3. Click driver name → "Disable Driver"
4. **Danger Zone modal appears**
5. Enter reason (required): "Multiple customer complaints"
6. Click "Confirm Disable"
7. Driver goes offline immediately
8. Driver cannot go online until re-enabled

**What happens:**
```typescript
// drivers/{driverId}.approved = false
// If driver has currentRideId → allow completion, then lock
// adminLogs/{logId} = { action: 'disable_driver', reason: '...', ... }
```

### Monitor Active Rides

1. Navigate to "Rides" tab
2. Filter by "Active" (status: requested, offered, accepted, started, in_progress)
3. Click ride ID to view details
4. See:
   - Customer name
   - Driver name
   - Pickup/dropoff locations
   - Current status
   - Payment status
   - Timeline of events
5. Use for debugging customer/driver issues

### Set Maintenance Message

1. Open Firebase Console → Firestore
2. Navigate to: `config/runtimeFlags`
3. Set:
   ```json
   {
     "disableNewRequests": false,
     "maintenanceMessage": "🚀 System is running normally"
   }
   ```
4. Message appears as banner in all apps

---

## 5. Firestore Rules Enforcement

Admin actions are enforced via Firestore rules:

```plaintext
// Only admins can write to config/*
match /config/{docId} {
  allow read: if signedIn();
  allow write: if isAdmin();
}

// Only admins can list drivers
match /drivers/{driverId} {
  allow list: if isAdmin();
}

// Only admins can list all rides
match /rides/{rideId} {
  allow list: if isAdmin();
}
```

**If admin access is denied:**
- Check UID is in `config/admins.uids` array
- User must sign out and sign back in
- Clear browser cache: `Cmd+Shift+R` (Mac) / `Ctrl+Shift+R` (Windows)
- Check Firestore rules are deployed: `firebase deploy --only firestore:rules`

---

## 6. Audit Trail

All admin actions are logged to `adminLogs` collection:

```typescript
{
  action: 'approve_driver',
  adminUid: 'abc123',
  adminEmail: 'admin@shiftx.com',
  targetUid: 'driver-xyz',
  targetType: 'driver',
  before: { approved: false },
  after: { approved: true },
  reason: 'Verified credentials',
  timestamp: 1705234567890,
  metadata: {
    userAgent: 'Mozilla/5.0...',
    ip: '192.168.1.1'
  }
}
```

**Review audit logs:**
1. Firebase Console → Firestore → `adminLogs` collection
2. Sort by `timestamp` descending
3. Filter by `action` or `adminUid`
4. Export for compliance: `firebase firestore:export gs://backup-bucket`

---

## 7. Troubleshooting

### Admin Can't Sign In
- ✅ Verify UID in `config/admins.uids`
- ✅ Check Firestore rules deployed
- ✅ Sign out and sign back in
- ✅ Clear browser cache
- ✅ Check browser console for errors

### Kill Switch Not Working
- ✅ Verify `config/runtimeFlags` document exists
- ✅ Check flag spelling (case-sensitive)
- ✅ Apps must re-read flags (refresh or wait 30s)
- ✅ Check browser console for `[RuntimeFlags] Updated:`

### Driver Approval Not Working
- ✅ Check `drivers/{uid}.approved` is `true`
- ✅ Verify driver signed out and back in
- ✅ Check `drivers/{uid}.onboardingStatus` is `'active'`
- ✅ Review adminLogs for error messages

### Can't Access Rides List
- ✅ Firestore rules must allow `allow list: if isAdmin()`
- ✅ Check `/rides` route is accessible
- ✅ Browser console should not show permission-denied errors
- ✅ Try refreshing the page

---

## 8. Production URLs & Credentials

### Admin Dashboard
- **Production:** https://shiftx-95c4b-admin.web.app
- **Firebase Console:** https://console.firebase.google.com/project/shiftx-95c4b

### Firebase Project
- **Project ID:** `shiftx-95c4b`
- **Region:** `us-central1`
- **Storage Bucket:** `shiftx-95c4b.firebasestorage.app`

### Related Apps
- **Customer App:** https://shiftx-95c4b-customer.web.app
- **Driver App:** https://shiftx-95c4b-driver.web.app

---

## 9. Adding New Admins (Step-by-Step)

### Example: Adding john@company.com as Admin

1. **User creates account:**
   ```
   John signs in to https://shiftx-95c4b-admin.web.app
   Uses Google Sign-In or email/password
   ```

2. **Get John's UID:**
   ```
   Firebase Console → Authentication → Users
   Find john@company.com
   Copy UID: e.g., "a1b2c3d4e5f6g7h8"
   ```

3. **Add to admins collection:**
   ```bash
   firebase login
   firebase use shiftx-95c4b
   
   # Add UID to array
   firebase firestore:set config/admins '{
     "uids": ["existing-admin-uid", "a1b2c3d4e5f6g7h8"]
   }' --merge
   ```

4. **Verify access:**
   ```
   John signs out and signs back in
   John should see "Admin" tab in navigation
   John can access https://shiftx-95c4b-admin.web.app/drivers
   ```

5. **Document in team wiki:**
   ```
   Date: 2026-01-14
   Admin Added: john@company.com (a1b2c3d4e5f6g7h8)
   Added By: alice@company.com
   Reason: Driver operations manager
   ```

---

## 10. Emergency Contacts

- **Firebase Support:** https://firebase.google.com/support
- **Stripe Support:** https://support.stripe.com
- **On-Call Engineer:** [Set up PagerDuty/Opsgenie]
- **Project Lead:** [Contact info]
- **DevOps Team:** [Contact info]

---

## Next Steps

1. ✅ Add initial admin UIDs to production
2. ✅ Test admin approval workflow
3. ✅ Set up Firebase monitoring alerts
4. ✅ Document kill switch procedures in runbook
5. ✅ Schedule weekly admin log reviews
6. ✅ Create Stripe dashboard access guide
7. ✅ Set up backup admin account

---

## Changelog

| Date | Change | By |
|------|--------|-----|
| 2026-01-14 | Initial production setup | System |
| 2026-01-14 | Added runtime flags documentation | System |
| 2026-01-14 | Added kill switch procedures | System |
