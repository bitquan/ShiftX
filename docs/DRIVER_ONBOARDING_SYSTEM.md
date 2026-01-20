# Driver Onboarding & Document Upload System

## Overview

The driver onboarding system allows drivers to submit required documents for verification before they can start accepting rides. Admins can review documents and approve drivers, or grant approval bypasses in exceptional circumstances.

## User Flow

### Driver Experience

1. **First Login**: New drivers see the onboarding screen immediately after authentication
2. **Document Upload**: Drivers upload 4 required documents:
   - Driver's License
   - Insurance Card
   - Vehicle Photo
   - Vehicle Registration
3. **Pending Status**: After uploading all documents, status changes to "Pending Review"
4. **Approval**: Once admin approves, driver can access the full app
5. **Bypass**: If admin enables bypass, driver can work immediately without waiting for approval

### Admin Experience

1. **Driver Dashboard**: View all drivers with their approval status
2. **Document Review**: Click "View Documents" to see uploaded photos
3. **Approval Actions**:
   - **Approve**: Grant full access after document verification
   - **Disable**: Revoke access if driver is non-compliant
   - **Enable Bypass**: Allow driver to work without documents (emergency only)

## Components

### Driver App Components

#### `DriverOnboarding.tsx`
- Full-screen onboarding flow
- Real-time status updates via Firestore listener
- Shows approval status banners:
  - ✅ **Admin Bypass Active** (green) - Can work without documents
  - ✅ **Approved** (green) - Documents verified
  - ⏳ **Pending Review** (yellow) - All docs uploaded, awaiting admin
  - 📄 **Upload Required** (blue) - Need to upload documents

#### `DocumentUpload.tsx`
- Reusable upload component for each document type
- Features:
  - Image compression (max 1200px width)
  - Preview before upload
  - Progress indication
  - Error handling
- Storage path: `driver-documents/{userId}/{type}.jpg`
- Firestore field: `{type}PhotoURL` (e.g., `licensePhotoURL`)

### Admin Dashboard Components

#### Enhanced `Drivers.tsx`
- New **Bypass Filter**: View all drivers with approval bypass
- **Document Viewer**: Click to expand and view uploaded documents
- **Bypass Toggle**: Enable/disable approval bypass
- **Status Indicators**:
  - 🔓 **Bypass Active** badge
  - ✓ **Approved** badge
  - ⏳ **Pending** badge

## Cloud Functions

### `toggleApprovalBypass`
```typescript
toggleApprovalBypass({ driverId: string; bypass: boolean })
```

**Purpose**: Toggle approval bypass for a driver (admin only)

**Authorization**: Admin only (verified via `config/admins` doc)

**Side Effects**:
- Updates `drivers/{driverId}.approvalBypassByAdmin`
- Logs action to `adminLogs` collection
- Updates driver timestamp

**Logging**: Creates audit trail with admin email, driver email, and bypass status

### `driverSetOnline` (Updated)
Now checks three conditions before allowing driver to go online:
1. User is admin, OR
2. Driver is approved (`approved: true`), OR
3. Driver has admin bypass (`approvalBypassByAdmin: true`)

## Database Schema

### `drivers` Collection
```typescript
{
  uid: string;
  approved: boolean;
  approvalBypassByAdmin?: boolean;  // NEW
  licensePhotoURL?: string;          // NEW
  insurancePhotoURL?: string;        // NEW
  vehiclePhotoURL?: string;          // NEW
  registrationPhotoURL?: string;     // NEW
  // ... existing fields
}
```

### `adminLogs` Collection
```typescript
{
  adminUid: string;
  adminEmail: string;
  action: 'enable_approval_bypass' | 'disable_approval_bypass';
  details: {
    driverId: string;
    driverEmail: string;
    bypass: boolean;
    warning: string;
  };
  timestamp: Timestamp;
  timestampMs: number;
}
```

## Security Rules

### Firestore
- Drivers can read/write their own document in `drivers/{uid}`
- Admins can read/write all driver documents
- Document URL fields are stored in driver profile

### Storage
```plaintext
match /driver-documents/{userId}/{fileName} {
  allow read: if request.auth.uid == userId || isAdmin();
  allow write: if request.auth.uid == userId;
}
```

## Approval Bypass Feature

### Purpose
Emergency mechanism for exceptional circumstances:
- Test drivers during development
- Trusted drivers with pending document renewal
- Special cases requiring admin discretion

### ⚠️ Security Warnings
1. **Admin Only**: Only admins can toggle bypass
2. **Audit Trail**: All bypass actions are logged
3. **Prominent Warning**: Bypass button has warning color (yellow/red)
4. **Confirmation Dialog**: Requires explicit admin confirmation
5. **Visible Indicator**: Bypass status shown prominently in driver card

### Best Practices
- **Use Sparingly**: Only for exceptional cases
- **Time-Limited**: Review bypass drivers regularly
- **Documentation**: Keep notes on why bypass was granted
- **Remove When Resolved**: Disable bypass once documents are verified

## Integration Points

### App.tsx Logic
```typescript
// Show onboarding if:
// - User is authenticated
// - Onboarding status is 'active'
// - Driver profile exists
// - NOT approved AND NOT bypass
if (user && onboardingStatus === 'active' && driverProfile && 
    !driverProfile.approved && !driverProfile.approvalBypassByAdmin) {
  return <DriverOnboarding userId={user.uid} onComplete={...} />;
}

// Show main app if:
// - All above conditions
// - AND (approved OR bypass)
if (user && onboardingStatus === 'active' && driverProfile && 
    (driverProfile.approved || driverProfile.approvalBypassByAdmin)) {
  return <MainApp />;
}
```

### Real-time Updates
- Driver profile changes trigger immediate UI updates
- Approval status changes reflected instantly
- No page refresh required

## Testing Guide

### Test Driver Onboarding
1. Create new driver account
2. Should see onboarding screen immediately
3. Upload all 4 documents
4. Status should change to "Pending Review"
5. Switch to admin dashboard
6. Find driver, click "View Documents"
7. Verify all images display correctly
8. Click "Approve"
9. Driver app should automatically update and show main interface

### Test Approval Bypass
1. Find pending driver in admin dashboard
2. Click "🔓 Enable Bypass"
3. Confirm the warning dialog
4. Verify:
   - Badge shows "🔓 Approval Bypass Active"
   - Driver moves to "Bypass" filter
   - Driver app shows green bypass banner
   - Driver can go online
5. Click "🔒 Remove Bypass"
6. Verify bypass removed

### Test Storage Rules
1. Try accessing another driver's document URL
2. Should fail if not admin
3. Upload document as driver
4. Should succeed
5. View document as admin
6. Should succeed

## Deployment Checklist

- [x] Cloud Functions built and tested
- [x] Storage rules updated
- [x] Driver app components created
- [x] Admin dashboard enhanced
- [x] TypeScript types updated
- [ ] Deploy storage rules: `firebase deploy --only storage`
- [ ] Deploy functions: `firebase deploy --only functions:toggleApprovalBypass`
- [ ] Deploy driver app: `firebase deploy --only hosting:driver`
- [ ] Deploy admin dashboard: `firebase deploy --only hosting:admin`
- [ ] Test in production
- [ ] Monitor admin logs for bypass usage

## Future Enhancements

1. **Document Expiration**: Track expiration dates for licenses/insurance
2. **Automated Reminders**: Notify drivers when documents expire soon
3. **Background Check Integration**: Connect to third-party verification services
4. **Document Rejection**: Allow admins to reject specific documents with reasons
5. **Re-upload Flow**: Allow drivers to replace rejected documents
6. **Notification System**: Push notifications when approved/rejected
7. **Document History**: Track all document versions for audit trail

## Support & Troubleshooting

### Driver Can't Upload Documents
- Check file size (must be < 10MB before compression)
- Verify file type is image (jpg, png, etc.)
- Check network connection
- Verify Storage rules are deployed
- Check browser console for errors

### Admin Can't See Documents
- Verify admin status in `config/admins`
- Check Storage rules deployment
- Verify document URLs are valid in Firestore
- Try opening document URL directly in browser

### Bypass Not Working
- Verify `toggleApprovalBypass` function is deployed
- Check admin logs for errors
- Verify admin permissions
- Check `driverSetOnline` function includes bypass logic

## Related Documentation

- [Admin Dashboard Features](./ADMIN_DASHBOARD.md)
- [Driver App Features](./DRIVER_APP.md)
- [Security Rules](./SECURITY_RULES.md)
- [Cloud Functions](./backend/FUNCTIONS.md)
