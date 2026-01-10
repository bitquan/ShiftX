# Firestore Security Rules - Quick Reference

## Collections & Access Control

### 1. `/users/{uid}`
Stores user profile information (email, role, etc)

| Operation | Rule | Conditions |
|-----------|------|-----------|
| **Read** | ✓ Allowed | User reads own doc: `isOwner(uid)` |
| **Create** | ✓ Allowed | User creates own doc: `isOwner(uid)` |
| **Update** | ✓ Allowed | User updates own doc + role cannot change: `isOwner(uid) && request.resource.data.role == resource.data.role` |
| **Delete** | ✗ Denied | Not permitted (prevents data loss) |

**Example Flow:**
```javascript
// Customer app creates user on signup
await setDoc(doc(firestore, 'users', uid), {
  email: 'user@example.com',
  role: 'customer',
  createdAtMs: Date.now()
});
// ✓ ALLOWED - create rule matches
```

### 2. `/customers/{uid}`
Stores customer-specific data (onboarding status, preferences, etc)

| Operation | Rule | Conditions |
|-----------|------|-----------|
| **Read** | ✓ Allowed | User reads own doc: `isOwner(uid)` |
| **Create** | ✓ Allowed | User creates own doc: `isOwner(uid)` |
| **Update** | ✓ Allowed | User updates own doc: `isOwner(uid)` |
| **Delete** | ✗ Denied | Not permitted |

**Example Flow:**
```javascript
// Customer app creates onboarding doc
await setDoc(doc(firestore, 'customers', uid), {
  onboardingStatus: 'active',
  createdAtMs: Date.now(),
  updatedAtMs: Date.now()
});
// ✓ ALLOWED - create rule matches
```

### 3. `/drivers/{driverId}`
Stores driver profile and status

| Operation | Rule | Conditions |
|-----------|------|-----------|
| **Read** | ✓ Allowed | Any signed-in user can read |
| **Create** | ✓ Allowed | Driver creates own doc: `isOwner(driverId)` |
| **Update** | ✓ Allowed | Driver updates own doc + only specific fields: `isBusy`, `currentRideId`, `currentRideStatus`, `updatedAtMs` |
| **Delete** | ✗ Denied | Not permitted |

### 4. `/rides/{rideId}`
Stores ride information and state

| Operation | Rule | Conditions |
|-----------|------|-----------|
| **Read** | ✓ Allowed | Signed-in user is: ride creator OR driver OR has offer |
| **Write** | ✗ Denied | Only backend Cloud Functions can write |

**Sub-collections:**
- `/rides/{rideId}/events/{eventId}` - Read allowed if ride readable
- `/rides/{rideId}/offers/{driverId}` - Offer owner can read

## Helper Functions

### `signedIn()`
```firestore
function signedIn() {
  return request.auth != null;
}
```
Returns true if user is authenticated.

### `isOwner(uid)`
```firestore
function isOwner(uid) {
  return signedIn() && request.auth.uid == uid;
}
```
Returns true if signed-in user's UID matches the given UID.

### `hasOfferForDriver(rideId)`
```firestore
function hasOfferForDriver(rideId) {
  return request.auth.uid != null
    && exists(
      /databases/{database}/documents/rides/{rideId}/offers/{request.auth.uid}
    );
}
```
Returns true if signed-in driver has an offer for the ride.

### `rideReadGuard(rideId)`
```firestore
function rideReadGuard(rideId) {
  return signedIn()
    && get(/databases/{database}/documents/rides/{rideId}).data != null
    && (
      request.auth.uid == get(...).data.riderId
      || request.auth.uid == get(...).data.driverId
      || hasOfferForDriver(rideId)
    );
}
```
Checks if signed-in user can read the ride (creator, driver, or has offer).

## Security Principles

### ✓ Authentication Required
All operations require `request.auth != null` (signed-in user)

### ✓ Ownership Enforced
Users can only read/write their own documents via `isOwner(uid)` checks

### ✓ Role Protection
The `users` collection's update rule prevents role changes:
```firestore
allow update: if isOwner(uid)
  && request.resource.data.role == resource.data.role;
```
This prevents users from promoting themselves to admin.

### ✓ No Unauthorized Writes
Critical collections like `rides` only allow writes from Cloud Functions (backend):
```firestore
allow write: if false;
```

### ✓ No Data Deletion
Users cannot delete documents:
```firestore
allow delete: if false;
```

## Error Messages & Troubleshooting

### "PERMISSION_DENIED: Missing or insufficient permissions"

**Cause**: User tried an operation they don't have permission for.

**Check**:
1. Is user signed in? (Yes, if error is thrown)
2. For `users/{uid}`: Is uid the signed-in user's UID?
3. For `customers/{uid}`: Is uid the signed-in user's UID?
4. For `drivers/{driverId}`: Is user trying to create/update their own driver doc?

**Example Fix**:
```javascript
// ✗ WRONG - trying to read another user's profile
const otherUser = await getDoc(doc(firestore, 'users', 'different-uid'));

// ✓ CORRECT - read own profile
const myUser = await getDoc(doc(firestore, 'users', currentUser.uid));
```

### "ALREADY_EXISTS: Document already exists and does not support merge"

**Cause**: Using `setDoc()` with existing document in update mode.

**Fix**: Use `updateDoc()` for existing docs:
```javascript
// Creating new doc ✓
await setDoc(doc(firestore, 'users', uid), { email, role, ... });

// Updating existing doc ✓
await updateDoc(doc(firestore, 'users', uid), { someField: newValue });
```

### "FAILED_PRECONDITION: The request failed a precondition check"

**Cause**: For driver updates, tried to modify protected fields.

**Check**: Only these fields can be updated on driver docs:
- `isBusy`
- `currentRideId`
- `currentRideStatus`
- `updatedAtMs`

Attempting to update other fields will be denied.

## Deployment

### Deploy Rules
```bash
firebase deploy --only firestore:rules --project shiftx-95c4b
```

### Verify Compilation
```bash
firebase deploy --only firestore:rules --project shiftx-95c4b 2>&1 | grep compiled
```

**Expected Output:**
```
✔  cloud.firestore: rules file firestore.rules compiled successfully
```

## Testing in Emulator

The Firestore emulator respects security rules. To test:

1. Start emulator:
   ```bash
   firebase emulators:start --only firestore,auth
   ```

2. Sign in:
   ```javascript
   await signInWithEmailAndPassword(auth, 'test@example.com', 'password');
   ```

3. Try operation:
   ```javascript
   // This will succeed (own doc)
   await setDoc(doc(firestore, 'users', currentUser.uid), { ... });
   
   // This will fail (permission denied)
   await setDoc(doc(firestore, 'users', 'other-uid'), { ... });
   ```

---

**Version**: 2.0 (December 31, 2025)
**Status**: ✅ Deployed & Verified
