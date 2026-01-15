# PR2: Profiles + Required Photos + Saved Places - IMPLEMENTATION PLAN

**Status:** 🚧 In Progress  
**Last Updated:** January 13, 2026

---

## Overview

PR2 adds essential profile features before launch:
- Required profile pictures with Firebase Storage
- Customer saved places (Home/Work) with quick actions  
- Driver vehicle information in profiles
- Identity display during rides (driver info to customer, customer info to driver in offers)

---

## Implementation Checklist

### Phase 1: Firebase Storage & Schema ✅ READY
- [x] Firebase Storage already configured (`storageBucket` in config)
- [x] Need to add `getStorage` export to firebase.ts files
- [ ] Update Firestore schema:
  - [ ] `users/{uid}`: Add `displayName`, `photoURL`
  - [ ] `customers/{uid}`: Add `homePlace`, `workPlace`, `ratingAvg`, `ratingCount`
  - [ ] `drivers/{uid}`: Add `vehicleInfo` (make, model, color, plate), `photoURL`, `ratingAvg`, `ratingCount`

### Phase 2: Photo Upload Component
- [ ] Create `ProfilePhotoUpload.tsx` component (shared between apps)
- [ ] Implement Firebase Storage upload to `profile-photos/{uid}/{filename}`
- [ ] Handle image compression/resizing (max 500KB, 512x512px)
- [ ] Update `users/{uid}/photoURL` after successful upload
- [ ] Display current photo if exists
- [ ] Handle upload errors gracefully

### Phase 3: Profile Photo Requirements
- [ ] Customer app: Block ride request if no `photoURL`
  - [ ] Show banner in RequestRide component
  - [ ] Add "Upload Photo" button that navigates to profile
  - [ ] Check `user.photoURL` before allowing tripRequest
- [ ] Driver app: Block going online if no `photoURL`
  - [ ] Show banner in DriverHome component
  - [ ] Disable "Go Online" button with explanation
  - [ ] Check `driverProfile.photoURL` before allowing driverSetOnline

### Phase 4: Customer Saved Places
- [ ] Add `homePlace`, `workPlace` fields to `customers/{uid}`:
  ```typescript
  {
    address: string;
    lat: number;
    lng: number;
  }
  ```
- [ ] Create `SavedPlaces.tsx` component (customer-app)
- [ ] Allow setting via:
  - [ ] Address autocomplete
  - [ ] Map tap
- [ ] Add quick action buttons in RequestRide:
  - [ ] "From Home" → fills pickup
  - [ ] "To Home" → fills dropoff
  - [ ] "From Work" → fills pickup
  - [ ] "To Work" → fills dropoff
- [ ] Show quick actions only if saved places exist

### Phase 5: Driver Vehicle Info Form
- [ ] Update Profile.tsx (driver-app) to add vehicle fields:
  - [ ] Make (text input)
  - [ ] Model (text input)
  - [ ] Color (text input or dropdown)
  - [ ] Plate (text input)
  - [ ] Vehicle class (already exists: ShiftX / Shift LX / Shift Black)
- [ ] Save to `drivers/{uid}/vehicleInfo`:
  ```typescript
  {
    make: string;
    model: string;
    color: string;
    plate: string;
  }
  ```
- [ ] Validate required fields before save

### Phase 6: Show Driver Identity to Customer (After Accept)
- [ ] Update RideStatus.tsx to fetch and display driver info when `status === 'accepted'`
- [ ] Fetch from `users/{driverId}` and `drivers/{driverId}`
- [ ] Display:
  - [ ] Driver photo (circular avatar)
  - [ ] Display name
  - [ ] Vehicle info (e.g., "Gray Toyota Camry - ABC123")
  - [ ] Vehicle class (ShiftX/Shift LX/Shift Black with icon)
  - [ ] Rating (placeholder if exists: "⭐ 4.8 (120 trips)")
- [ ] Position above map or in TripCard

### Phase 7: Show Customer Identity in Offer Modal
- [ ] Update OfferModal.tsx (driver-app) to fetch customer info
- [ ] Fetch from `users/{riderId}`
- [ ] Display:
  - [ ] Customer photo (circular avatar)
  - [ ] Display name
  - [ ] Rating (placeholder if exists: "⭐ 4.9 (85 trips)")
- [ ] Position at top of modal (before pickup/dropoff)

### Phase 8: Backend Updates
- [ ] Update user creation functions to support `displayName`
- [ ] Add Cloud Function for profile photo upload validation (optional)
- [ ] Update Firestore rules to allow:
  - [ ] `users/{uid}/photoURL` writable by owner
  - [ ] `users/{uid}/displayName` writable by owner
  - [ ] `customers/{uid}/homePlace` writable by owner
  - [ ] `customers/{uid}/workPlace` writable by owner
  - [ ] `drivers/{uid}/vehicleInfo` writable by owner
  - [ ] Profile fields readable by authenticated users (for identity display)

### Phase 9: Types & Interfaces
- [ ] Update `driver-client/src/types.ts`:
  ```typescript
  export interface UserProfile {
    role: 'driver' | 'customer' | 'admin';
    displayName?: string;
    photoURL?: string;
    createdAtMs: number;
  }
  
  export interface CustomerProfile {
    onboardingStatus: string;
    homePlace?: SavedPlace;
    workPlace?: SavedPlace;
    ratingAvg?: number;
    ratingCount?: number;
  }
  
  export interface SavedPlace {
    address: string;
    lat: number;
    lng: number;
  }
  
  export interface VehicleInfo {
    make: string;
    model: string;
    color: string;
    plate: string;
  }
  
  export interface DriverProfile {
    // existing fields...
    photoURL?: string;
    vehicleInfo?: VehicleInfo;
    ratingAvg?: number;
    ratingCount?: number;
  }
  ```

### Phase 10: Testing & Validation
- [ ] E2E test: Customer cannot request ride without photo
- [ ] E2E test: Driver cannot go online without photo
- [ ] E2E test: Saved places quick actions work correctly
- [ ] E2E test: Driver identity shows after accept
- [ ] E2E test: Customer identity shows in offer modal
- [ ] Manual test: Photo upload & compression
- [ ] Manual test: All UI components render correctly

---

## Technical Details

### Firebase Storage Paths
```
profile-photos/
├── {customerId}/
│   └── profile.jpg
└── {driverId}/
    └── profile.jpg
```

### Storage Rules (storage.rules)
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /profile-photos/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Image Upload Flow
1. User selects image file (input type="file" accept="image/*")
2. Client-side compression to max 500KB, 512x512px
3. Upload to Storage: `profile-photos/{uid}/profile.jpg`
4. Get download URL
5. Update Firestore `users/{uid}/photoURL`
6. Update local UI state

### Blocking UI Pattern
```tsx
// Customer App (RequestRide.tsx)
if (!user?.photoURL) {
  return (
    <div className="blocking-banner">
      <h3>⚠️ Profile Photo Required</h3>
      <p>Upload a profile photo to start requesting rides</p>
      <button onClick={() => navigate('/profile')}>
        📸 Upload Photo
      </button>
    </div>
  );
}

// Driver App (DriverHome.tsx)
if (!driverProfile?.photoURL) {
  return (
    <div className="blocking-banner">
      <h3>⚠️ Profile Photo Required</h3>
      <p>Upload a profile photo before going online</p>
      <button onClick={() => setActiveTab('profile')}>
        📸 Upload Photo
      </button>
    </div>
  );
}
```

---

## Files to Create

1. **Shared Components:**
   - `packages/customer-app/src/components/ProfilePhotoUpload.tsx`
   - `packages/driver-app/src/components/ProfilePhotoUpload.tsx`

2. **Customer-Specific:**
   - `packages/customer-app/src/components/SavedPlaces.tsx`

3. **Backend:**
   - `storage.rules` (if not exists)
   - Update `firestore.rules`

4. **Types:**
   - Update `packages/driver-client/src/types.ts`

---

## Files to Modify

1. **Customer App:**
   - `packages/customer-app/src/firebase.ts` - Add Storage
   - `packages/customer-app/src/App.tsx` - Check for photoURL
   - `packages/customer-app/src/components/RequestRide.tsx` - Blocking banner + quick actions
   - `packages/customer-app/src/components/RideStatus.tsx` - Show driver identity
   - `packages/customer-app/vite.config.ts` - Add firebase/storage to optimizeDeps

2. **Driver App:**
   - `packages/driver-app/src/App.tsx` - Add Storage, check photoURL
   - `packages/driver-app/src/components/DriverHome.tsx` - Blocking banner
   - `packages/driver-app/src/components/Profile.tsx` - Vehicle info form
   - `packages/driver-app/src/components/OfferModal.tsx` - Show customer identity
   - `packages/driver-app/vite.config.ts` - Add firebase/storage

3. **Backend:**
   - `firestore.rules` - Profile field permissions
   - `functions/src/driver.ts` - Validate photoURL on driverSetOnline
   - `functions/src/rides.ts` - Validate photoURL on tripRequest

4. **Types:**
   - `packages/driver-client/src/types.ts` - Add new interfaces

---

## Deployment Checklist

- [ ] Deploy Firestore rules
- [ ] Deploy Storage rules (if created)
- [ ] Deploy Cloud Functions
- [ ] Deploy customer-app
- [ ] Deploy driver-app
- [ ] Test in production environment
- [ ] Monitor for errors in first 24h

---

## Next Steps

1. Add Storage exports to firebase.ts files
2. Create ProfilePhotoUpload component
3. Implement blocking UI in both apps
4. Add saved places functionality
5. Update offer modal and ride status
6. Test end-to-end flow

---

**Questions or Issues?**  
Refer to [docs/deployment/PR1_COMPLETION_STATUS.md](./PR1_COMPLETION_STATUS.md) for production deployment patterns.
