# Firebase Structure & Configuration

## Overview

ShiftX uses Firebase as its primary backend infrastructure:
- **Firestore:** Real-time database for rides, users, drivers
- **Authentication:** User identity management
- **Cloud Functions:** Server-side business logic
- **Hosting:** Web app deployment
- **Cloud Scheduler:** Periodic cleanup tasks

---

## Firestore Collections

### Root Collections

| Collection | Purpose | Security | Key Fields |
|------------|---------|----------|------------|
| **users** | User profiles | Owner read/write | email, role, displayName, photoURL |
| **drivers** | Driver profiles | Public read, owner write | isOnline, location, vehicle, approved |
| **customers** | Customer profiles | Owner read/write | savedPlaces, paymentMethods |
| **rides** | Ride requests | Participants read | status, pickup, dropoff, pricing |
| **config** | System config | Public read, admin write | admins, runtimeFlags |
| **reports** | User reports | Admin read | reporterUid, targetUid, reason |
| **adminLogs** | Admin actions | Public read, admin write | action, adminUid, timestamp |
| **stripeEvents** | Webhook events | Backend only | eventId, type, processed |

### Document Structures

#### users/{uid}
```typescript
{
  email: string;
  role: 'customer' | 'driver';
  displayName?: string;
  photoURL?: string;
  createdAtMs: number;
  updatedAtMs?: number;
}
```

#### drivers/{uid}
```typescript
{
  isOnline: boolean;
  isBusy: boolean;
  approved: boolean;
  onboardingStatus: 'pending' | 'submitted' | 'approved' | 'rejected';
  location?: { latitude: number; longitude: number };
  vehicle?: {
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
  };
  vehicleClass: 'shiftx' | 'shift_lx' | 'shift_black';
  rating?: number;
  totalRides?: number;
  totalEarnings?: number;
  lastHeartbeatMs?: number;
  currentRideId?: string;
  currentRideStatus?: string;
  stripeConnectAccountId_test?: string;
  stripeConnectAccountId_live?: string;
  createdAtMs: number;
  updatedAtMs?: number;
}
```

#### customers/{uid}
```typescript
{
  savedPlaces?: {
    home?: { address: string; location: { lat: number; lng: number } };
    work?: { address: string; location: { lat: number; lng: number } };
  };
  paymentMethods?: string[]; // Stripe payment method IDs
  defaultPaymentMethod?: string;
  totalRides?: number;
  rating?: number;
  stripeCustomerId_test?: string;
  stripeCustomerId_live?: string;
  createdAtMs: number;
  updatedAtMs?: number;
}
```

#### rides/{rideId}
```typescript
{
  rideId: string;
  customerId: string;
  driverId?: string;
  status: 'requested' | 'offered' | 'accepted' | 'started' | 'in_progress' | 'completed' | 'cancelled';
  paymentStatus: 'none' | 'requires_authorization' | 'authorized' | 'captured' | 'cancelled' | 'refunded';
  pickup: { lat: number; lng: number; address?: string };
  dropoff: { lat: number; lng: number; address?: string };
  serviceClass: 'shiftx' | 'shift_lx' | 'shift_black';
  estimatedFareCents: number;
  priceCents: number;
  fareCents: number;
  riderFeeCents: number; // $1.50
  driverFeeCents: number; // $1.50
  driverPayoutCents: number;
  platformFeeCents: number; // $3.00
  stripePaymentIntentId?: string;
  stripeConnectAccountId?: string;
  connectTransferId?: string;
  refundId?: string;
  distanceMeters?: number;
  durationSeconds?: number;
  createdAtMs: number;
  acceptedAtMs?: number;
  startedAtMs?: number;
  completedAtMs?: number;
  cancelledAtMs?: number;
}
```

### Subcollections

#### drivers/{uid}/ledger/{entryId}
Driver earnings ledger
```typescript
{
  rideId: string;
  amountCents: number;
  type: 'fare' | 'tip' | 'bonus' | 'adjustment';
  createdAtMs: number;
}
```

#### drivers/{uid}/blockedCustomers/{customerId}
Blocked customer records
```typescript
{
  customerId: string;
  reason?: string;
  blockedAtMs: number;
}
```

#### rides/{rideId}/offers/{driverId}
Ride offer to driver
```typescript
{
  offerId: string;
  rideId: string;
  driverId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAtMs: number;
  createdAtMs: number;
}
```

#### rides/{rideId}/events/{eventId}
Ride timeline events
```typescript
{
  type: 'requested' | 'offered' | 'accepted' | 'started' | 'in_progress' | 'completed' | 'cancelled';
  atMs: number;
  driverId?: string;
  details?: Record<string, any>;
}
```

---

## Security Rules

### Overview

Firestore security rules are defined in `/firestore.rules` at the repository root.

**Core Principles:**
1. Most writes happen via Cloud Functions (backend-controlled)
2. Users can read/write their own profile data
3. Drivers can update their availability and location
4. Rides are read-only from frontend (all transitions via functions)
5. Admin access controlled via `config/admins` document

### Key Rules

#### User Profiles
```javascript
// Users can read/write their own profile
match /users/{uid} {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == uid;
}
```

#### Driver Profiles
```javascript
// Anyone can read driver profiles (for matching)
// Drivers can update their own profile
match /drivers/{uid} {
  allow read: if request.auth != null;
  allow write: if request.auth.uid == uid;
}
```

#### Rides
```javascript
// Ride participants can read
// Only backend can write (via Cloud Functions)
match /rides/{rideId} {
  allow read: if isRideParticipant(rideId) || isAdmin();
  allow write: if false; // Backend only
}
```

#### Admin Access
```javascript
function isAdmin() {
  return request.auth.uid in get(/databases/$(database)/documents/config/admins).data.uids;
}
```

---

## Indexes

Required composite indexes are defined in `/firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "rides",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "customerId", "order": "ASCENDING" },
        { "fieldPath": "createdAtMs", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "drivers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isOnline", "order": "ASCENDING" },
        { "fieldPath": "approved", "order": "ASCENDING" }
      ]
    }
  ]
}
```

Deploy indexes:
```bash
firebase deploy --only firestore:indexes
```

---

## Authentication

### Setup

Firebase Auth is configured for:
- **Email/Password** authentication
- **Anonymous** authentication (optional for testing)

### User Creation Flow

1. User signs up via `firebase/auth` SDK
2. Cloud Function (or client) creates `/users/{uid}` document
3. Role-specific document created (`/drivers/{uid}` or `/customers/{uid}`)

### Admin Management

Admins are managed in `/config/admins`:
```typescript
{
  uids: ["uid1", "uid2", "uid3"],
  updatedAtMs: 1234567890
}
```

Add admin using script:
```bash
node scripts/addAdminClient.js
```

---

## Emulator Setup

### Starting Emulators

```bash
firebase emulators:start --only auth,firestore,functions
```

### Emulator Ports

- **Auth:** 9099
- **Firestore:** 8081
- **Functions:** 5002
- **Firestore UI:** 4000

### Connecting to Emulators

In your app's firebase config:
```typescript
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectFunctionsEmulator } from 'firebase/functions';

// Only in development
if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8081);
  connectFunctionsEmulator(functions, 'localhost', 5002);
}
```

### Emulator Data Persistence

Export data:
```bash
firebase emulators:export ./emulator-export
```

Import data:
```bash
firebase emulators:start --import=./emulator-export
```

---

## Cloud Functions Integration

### Callable Functions

Functions can be called from the frontend:
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const tripRequest = httpsCallable(functions, 'tripRequest');

const result = await tripRequest({
  pickup: { lat: 40.7128, lng: -74.0060 },
  dropoff: { lat: 40.7580, lng: -73.9855 },
  serviceClass: 'shiftx',
  estimatedFareCents: 2500
});
```

### Real-time Listeners

Subscribe to document changes:
```typescript
import { doc, onSnapshot } from 'firebase/firestore';

const rideRef = doc(db, 'rides', rideId);
const unsubscribe = onSnapshot(rideRef, (snapshot) => {
  const ride = snapshot.data();
  console.log('Ride updated:', ride);
});

// Cleanup
unsubscribe();
```

---

## Best Practices

### 1. Use Transactions for Critical Updates

```typescript
import { runTransaction } from 'firebase/firestore';

await runTransaction(db, async (transaction) => {
  const rideDoc = await transaction.get(rideRef);
  if (rideDoc.data().status !== 'requested') {
    throw new Error('Ride already accepted');
  }
  transaction.update(rideRef, { status: 'accepted' });
});
```

### 2. Minimize Real-time Listeners

- Only subscribe to documents you need
- Always unsubscribe when component unmounts
- Use `onSnapshot` over polling for live updates

### 3. Batch Writes

```typescript
import { writeBatch } from 'firebase/firestore';

const batch = writeBatch(db);
batch.set(doc(db, 'rides', rideId), rideData);
batch.set(doc(db, 'drivers', driverId), { isBusy: true }, { merge: true });
await batch.commit();
```

### 4. Query Optimization

- Use composite indexes for multi-field queries
- Limit query results with `.limit()`
- Use cursor-based pagination for large datasets

### 5. Error Handling

```typescript
import { FirebaseError } from 'firebase/app';

try {
  await updateDoc(rideRef, { status: 'completed' });
} catch (error) {
  if (error instanceof FirebaseError) {
    if (error.code === 'permission-denied') {
      console.error('Permission denied');
    } else if (error.code === 'not-found') {
      console.error('Document not found');
    }
  }
}
```

---

## Troubleshooting

### Emulator Connection Issues

**Problem:** App connects to production instead of emulator

**Solution:**
- Check that emulators are running
- Verify emulator config is called before any Firebase operations
- Clear browser cache and reload

### Permission Denied Errors

**Problem:** `permission-denied` on Firestore operations

**Solution:**
- Check security rules in Firebase Console
- Verify user is authenticated
- Check if operation should go through Cloud Function instead

### Stale Data

**Problem:** UI shows outdated data

**Solution:**
- Use `onSnapshot` for real-time updates
- Check if listener is properly subscribed
- Verify query filters are correct

### Index Not Found

**Problem:** `index-not-found` error on queries

**Solution:**
- Deploy indexes: `firebase deploy --only firestore:indexes`
- Check `/firestore.indexes.json` for required indexes
- Follow error message link to create index in console

---

## Additional Resources

- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Security Rules Reference](https://firebase.google.com/docs/firestore/security/get-started)
- [Cloud Functions Guide](https://firebase.google.com/docs/functions)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)

---

**Last Updated:** January 20, 2026
