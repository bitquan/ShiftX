# Admin Approval Bypass Feature

## Overview

The approval bypass feature allows administrators to grant temporary or emergency access to drivers without requiring full document verification. This is an **admin-only** feature with comprehensive audit logging.

## Use Cases

### Legitimate Use Cases
1. **Development & Testing**: Allow test drivers to work during development
2. **Document Renewal**: Trusted drivers with expired documents pending renewal
3. **Emergency Situations**: Critical shortage of drivers, temporary access needed
4. **Onboarding Exceptions**: Special cases requiring immediate activation
5. **Technical Issues**: Document upload system temporarily unavailable

### ❌ Invalid Use Cases
- Bypassing safety requirements
- Avoiding background checks
- Circumventing legal compliance
- Permanent driver activation without documents

## Security Architecture

### Multi-Layer Protection

#### 1. Authentication
- Admin must be authenticated
- Admin UID must be in `config/admins.uids` array
- No bypass for non-admin users

#### 2. Authorization
```typescript
// Cloud Function checks admin status
const userIsAdmin = await isAdmin(adminUid);
if (!userIsAdmin) {
  throw new HttpsError('permission-denied', 'Only admins can toggle approval bypass');
}
```

#### 3. Audit Logging
Every bypass action creates a log entry:
```typescript
{
  adminUid: string;
  adminEmail: string;
  action: 'enable_approval_bypass' | 'disable_approval_bypass';
  details: {
    driverId: string;
    driverEmail: string;
    bypass: boolean;
    warning: 'Bypass allows driver to work without document verification';
  };
  timestamp: Timestamp;
  timestampMs: number;
}
```

#### 4. UI Warnings
- ⚠️ Warning dialog before enabling bypass
- Yellow/red color coding for bypass controls
- Prominent "Bypass Active" badge on driver cards
- Warning text about skipping verification

## Implementation Details

### Database Field
```typescript
// drivers/{driverId}
{
  approvalBypassByAdmin: boolean;  // true = bypass enabled
}
```

### Cloud Function
```typescript
// functions/src/driver.ts
export const toggleApprovalBypass = onCall<{ driverId: string; bypass: boolean }>(
  callableOptions,
  async (request) => {
    // 1. Verify admin authentication
    // 2. Validate parameters
    // 3. Update driver document
    // 4. Log action with full context
    // 5. Return success
  }
);
```

### Admin UI Integration
```tsx
// packages/admin-dashboard/src/components/Drivers.tsx

// Bypass button
<button onClick={() => handleToggleBypass(driver.uid, driver.approvalBypassByAdmin)}>
  {driver.approvalBypassByAdmin ? '🔒 Remove Bypass' : '🔓 Enable Bypass'}
</button>

// Bypass badge
{driver.approvalBypassByAdmin && (
  <div className="bypass-badge">🔓 Approval Bypass Active</div>
)}
```

### Driver App Integration
```tsx
// packages/driver-app/src/components/DriverOnboarding.tsx

// Green banner when bypass active
{data.approvalBypassByAdmin && (
  <div className="bypass-banner">
    ✅ Admin Bypass Active
    <p>You can work without documents. An admin has granted you temporary approval.</p>
  </div>
)}
```

### Online Status Check
```typescript
// functions/src/driver.ts - driverSetOnline

// Allow going online if:
// 1. User is admin, OR
// 2. Driver is approved, OR
// 3. Driver has approval bypass
if (!userIsAdmin && !driverApproved && !hasAdminBypass) {
  throw new HttpsError('permission-denied', 'Driver must be approved before going online');
}
```

## Admin Dashboard UI

### Driver Card Layout
```
┌─────────────────────────────────────┐
│ 🔓 Approval Bypass Active           │ <- Yellow banner (if bypass enabled)
├─────────────────────────────────────┤
│ Driver Name                 🟢 Online│
│ email@example.com                   │
│ Sedan • Toyota Camry • White        │
│                                     │
│ [📄 View Documents]                 │ <- Document viewer button
│                                     │
│ ✓ Approved         [Disable]       │ <- Approval status
│ [🔓 Enable Bypass]                  │ <- Bypass toggle (yellow)
└─────────────────────────────────────┘
```

### Filter Tabs
- **All**: Show all drivers
- **Approved**: Only approved drivers
- **Pending**: Not approved AND no bypass
- **🔓 Bypass**: Only drivers with bypass enabled
- **Online**: Currently online drivers

### Document Viewer
When "View Documents" is clicked, expands to show:
- Driver's License thumbnail
- Insurance Card thumbnail
- Vehicle Photo thumbnail  
- Registration thumbnail
- Click any image to open full size in new tab

## Confirmation Dialog

### Warning Message
```
⚠️ WARNING: Enable approval bypass for this driver?

Bypass allows drivers to work WITHOUT document verification.
Only enable for trusted drivers in exceptional circumstances.

[Cancel] [Enable Bypass]
```

### Remove Bypass
```
Remove approval bypass for this driver?

They will only be able to work if they are approved.

[Cancel] [Remove Bypass]
```

## Admin Logs Collection

### Purpose
- Audit trail of all admin actions
- Forensic analysis if issues arise
- Compliance and reporting
- Accountability

### Query Examples
```typescript
// Get all bypass actions
const bypassLogs = await db.collection('adminLogs')
  .where('action', 'in', ['enable_approval_bypass', 'disable_approval_bypass'])
  .orderBy('timestampMs', 'desc')
  .limit(100)
  .get();

// Get actions by specific admin
const adminActions = await db.collection('adminLogs')
  .where('adminUid', '==', adminUid)
  .orderBy('timestampMs', 'desc')
  .get();

// Get actions for specific driver
const driverActions = await db.collection('adminLogs')
  .where('details.driverId', '==', driverId)
  .orderBy('timestampMs', 'desc')
  .get();
```

## Monitoring & Alerts

### Recommended Alerts
1. **High Bypass Usage**: Alert if >10% of drivers have bypass enabled
2. **Long-Duration Bypass**: Alert if bypass enabled for >30 days
3. **Frequent Toggling**: Alert if same driver bypass toggled >3 times/day
4. **Unauthorized Access**: Alert on any permission-denied errors

### Dashboard Metrics
- Total drivers with bypass active
- Average bypass duration
- Most common bypass reasons (if added to UI)
- Bypass actions per admin

## Best Practices

### For Admins

#### DO:
✅ Document why bypass is needed (external notes)
✅ Set reminders to review bypass drivers
✅ Remove bypass as soon as possible
✅ Verify driver identity before enabling
✅ Check admin logs regularly

#### DON'T:
❌ Enable bypass without good reason
❌ Leave bypass enabled indefinitely
❌ Share admin credentials
❌ Bypass for new/unknown drivers
❌ Use as permanent solution

### For Development Team

#### DO:
✅ Monitor admin logs collection
✅ Review bypass usage monthly
✅ Add fields for bypass reason/expiration
✅ Create alerts for abuse patterns
✅ Test bypass functionality regularly

#### DON'T:
❌ Remove audit logging
❌ Allow non-admins to toggle bypass
❌ Skip security checks
❌ Remove UI warnings

## Compliance Considerations

### Legal Requirements
- **Background Checks**: Bypass does NOT waive background check requirements
- **Insurance**: Driver must still have valid insurance (not verified by system)
- **License**: Driver must have valid license (not verified by system)
- **Record Keeping**: Keep audit logs for required retention period

### Risk Management
- Document company policy on bypass usage
- Train admins on proper usage
- Regular audits of bypass activity
- Insurance coverage implications
- Liability considerations

## Testing

### Manual Test Steps
1. **Enable Bypass**:
   ```
   - Login as admin
   - Navigate to Drivers tab
   - Find driver with pending status
   - Click "Enable Bypass"
   - Confirm dialog
   - Verify badge appears
   - Check adminLogs collection for entry
   ```

2. **Driver Goes Online**:
   ```
   - Login as driver (with bypass)
   - Should see "Admin Bypass Active" banner
   - Should be able to go online
   - Should be able to accept rides
   ```

3. **Remove Bypass**:
   ```
   - Login as admin
   - Find driver with bypass
   - Click "Remove Bypass"
   - Verify driver moved to pending (if not approved)
   - Driver should not be able to go online
   ```

4. **Admin Logs**:
   ```
   - Query adminLogs collection
   - Verify entries exist
   - Check fields are populated
   - Verify admin email captured
   ```

### Automated Tests (Future)
```typescript
// Test bypass enables driver to go online
test('bypass allows unapproved driver to go online', async () => {
  const driver = await createTestDriver({ approved: false });
  await toggleBypass(driver.id, true);
  const result = await driver.setOnline(true);
  expect(result.ok).toBe(true);
});

// Test non-admin cannot toggle bypass
test('non-admin cannot toggle bypass', async () => {
  const nonAdmin = await createTestUser({ admin: false });
  await expect(
    toggleBypass(driver.id, true, nonAdmin.uid)
  ).rejects.toThrow('permission-denied');
});

// Test audit log created
test('bypass action creates audit log', async () => {
  await toggleBypass(driver.id, true);
  const logs = await getAdminLogs();
  expect(logs).toContainEqual(
    expect.objectContaining({
      action: 'enable_approval_bypass',
      'details.driverId': driver.id,
    })
  );
});
```

## Troubleshooting

### Bypass Button Not Showing
- Verify you're logged in as admin
- Check `config/admins.uids` contains your UID
- Refresh page to re-check admin status
- Check browser console for errors

### Bypass Not Working
- Verify function deployed: `firebase deploy --only functions:toggleApprovalBypass`
- Check `driverSetOnline` function includes bypass logic
- Verify Firestore field updated: `approvalBypassByAdmin`
- Check Cloud Functions logs for errors

### Driver Still Can't Go Online
- Verify bypass field is `true` in Firestore
- Check for other blocking conditions (suspended, etc.)
- Verify `driverSetOnline` function logic
- Check driver app is reading latest profile data

### Admin Logs Not Created
- Verify admin UID resolves to email
- Check Firestore rules allow writing to adminLogs
- Verify function completes successfully
- Check for async/await issues

## Related Documentation

- [Driver Onboarding System](./DRIVER_ONBOARDING_SYSTEM.md)
- [Admin Dashboard Features](./ADMIN_DASHBOARD.md)
- [Security Best Practices](./SECURITY_BEST_PRACTICES.md)
- [Audit Logging](./backend/AUDIT_LOGGING.md)

## Changelog

### 2025-01-14
- Initial implementation
- Added `toggleApprovalBypass` Cloud Function
- Enhanced admin dashboard with bypass controls
- Added audit logging
- Updated `driverSetOnline` to check bypass status
- Created comprehensive documentation

## Future Enhancements

1. **Expiration Dates**: Auto-remove bypass after X days
2. **Bypass Reasons**: Require admin to enter reason
3. **Approval Workflow**: Require second admin approval
4. **Notification System**: Alert when bypass enabled/removed
5. **Analytics Dashboard**: Visualize bypass usage patterns
6. **Automated Cleanup**: Remove stale bypasses
7. **Email Notifications**: Alert compliance team on bypass usage
