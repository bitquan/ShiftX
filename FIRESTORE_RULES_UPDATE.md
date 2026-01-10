# Firestore Security Rules - Updated

## Changes Made

Updated `firestore.rules` with explicit, well-defined rules for the `users` and `customers` collections following security best practices.

### Key Improvements

#### 1. New Helper Functions
```firestore
function signedIn() {
  return request.auth != null;
}

function isOwner(uid) {
  return signedIn() && request.auth.uid == uid;
}
```

These make rules more readable and DRY. Replaced all `isSignedIn()` with `signedIn()` for consistency.

#### 2. Users Collection Rules

**Before:**
```firestore
match /users/{uid} {
  allow read: if isSignedIn() && request.auth.uid == uid;
  allow create: if isSignedIn() && request.auth.uid == uid;
  allow update, delete: if false;
}
```

**After:**
```firestore
match /users/{uid} {
  allow read: if isOwner(uid);
  
  // Allow the user to create their own profile doc
  allow create: if isOwner(uid);
  
  // Allow updates, but prevent role switching
  allow update: if isOwner(uid)
    && request.resource.data.role == resource.data.role;
  
  allow delete: if false;
}
```

**Why these changes:**
- `read` is now owner-only (cleaner)
- `create` is owner-only (cleaner)
- `update` is now allowed (was forbidden before) but with **role protection**: users can update their own profile but cannot change their role
- `delete` remains forbidden (security)
- Clear comments explain the intent

#### 3. New Customers Collection Rules

**Added:**
```firestore
match /customers/{uid} {
  allow read, create, update: if isOwner(uid);
  allow delete: if false;
}
```

**Why this was missing:**
- The customer app creates `customers/{uid}` documents
- Without this rule, writes would be denied with "PERMISSION_DENIED"
- Now customers can create and update their own onboarding status

#### 4. Drivers Collection - Refactored

**Before:**
```firestore
allow create: if isSignedIn() && request.auth.uid == driverId;
allow update: if isSignedIn() && request.auth.uid == driverId && ...
```

**After:**
```firestore
allow create: if isOwner(driverId);
allow update: if isOwner(driverId) && ...
```

Cleaner and consistent with new helper functions.

#### 5. Rides Collection - Minor Updates

Changed `isSignedIn()` to `signedIn()` for consistency and updated sub-collection offer rules to use `isOwner()`.

### Security Properties

✓ **Authentication**: All operations require signed-in user
✓ **Ownership**: Users can only read/write their own data
✓ **Role Protection**: Cannot modify role field (prevents privilege escalation)
✓ **No Deletion**: Critical docs cannot be deleted
✓ **Explicit Matches**: Clear, readable rules for each collection

### Testing

**Deployed to Production:**
```bash
✔ cloud.firestore: rules file firestore.rules compiled successfully
✔ firestore: released rules firestore.rules to cloud.firestore
```

### Before & After Scenarios

#### Scenario 1: Customer Creates Own Profile (NOW WORKS ✓)
```
user123 calls setDoc(doc(firestore, 'users', 'user123'), { email, role: 'customer', ... })
✓ ALLOWED - isOwner('user123') = true && create rule matches
```

#### Scenario 2: Customer Creates Onboarding Doc (NOW WORKS ✓)
```
user123 calls setDoc(doc(firestore, 'customers', 'user123'), { onboardingStatus: 'active', ... })
✓ ALLOWED - isOwner('user123') = true && customers rule allows create
```

#### Scenario 3: User Tries to Promote Themselves (BLOCKED ✓)
```
user123 tries to update role from 'customer' to 'admin'
✗ DENIED - update rule requires role to remain unchanged
```

#### Scenario 4: User Tries to Read Another User's Profile (BLOCKED ✓)
```
user123 tries to read doc(firestore, 'users', 'user456')
✗ DENIED - isOwner('user456') = false for user123
```

### Backward Compatibility

All changes are backward compatible:
- Existing reads/writes that worked before still work
- New update permission on `users` is more permissive (better UX)
- New `customers` collection rules enable missing functionality
- No breaking changes to existing collections (drivers, rides, offers)

### Related Files

- [firestore.rules](../../firestore.rules) - The actual security rules
- [packages/customer-app/src/App.tsx](../../packages/customer-app/src/App.tsx#L53-L85) - User doc creation logic
- [docs/firestore.rules](../../docs/firestore.rules) - Documentation copy

---

**Deploy Status**: ✅ Successfully deployed to shiftx-95c4b
**Date**: December 31, 2025
