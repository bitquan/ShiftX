# Customer App MVP - Implementation Guide

## Overview

The Customer App MVP is a React + Vite application for end-users to request rides, track ride status in real-time, and cancel rides when appropriate.

### Key Features Implemented

✅ **Email/Password Authentication**
- Sign up with new email/password
- Sign in with existing credentials
- Auth state persists across page refreshes via localStorage

✅ **User Document Initialization**
- On first login, `users/{uid}` document created with:
  - `email`: user email
  - `role`: "customer"
  - `createdAtMs`: timestamp
- On first login, `customers/{uid}` document created with:
  - `onboardingStatus`: "active"
  - `createdAtMs` and `updatedAtMs`: timestamps

✅ **Request Ride Flow**
- Form to enter pickup/dropoff coordinates and optional price/metadata
- Calls `tripRequest()` callable from driver-client
- Returns `rideId` and stores in localStorage
- Automatically navigates to Ride Status screen
- Full validation with user-friendly error messages

✅ **Real-time Ride Status Display**
- Firestore listener on `rides/{rideId}` provides real-time updates
- Visual timeline showing all ride states:
  - requested → dispatching → offered → accepted → started → in_progress → completed
- Current state highlighted with color-coded badge
- All ride details displayed: driver ID, price, coordinates, timestamps

✅ **Cancel Ride Functionality**
- "Cancel Ride" button visible only in cancellable states (requested, dispatching, offered)
- Calls `tripCancel()` callable
- Handles Firebase errors gracefully (PERMISSION_DENIED, NOT_FOUND, FAILED_PRECONDITION)
- Updates UI immediately upon success

✅ **Firebase Setup**
- Single firebase instance (no duplicate installs)
- Modular imports only (firebase/auth, firebase/firestore, etc.)
- No compat APIs mixed
- Proper emulator configuration via DEFAULT_EMULATOR_CONFIG

## Project Structure

```
packages/customer-app/
├── src/
│   ├── App.tsx                 # Main app component, auth & state management
│   ├── main.tsx                # React entry point
│   ├── styles.css              # Dark theme, responsive design
│   └── components/
│       ├── AuthGate.tsx         # Sign in/up form & auth guard
│       ├── RequestRide.tsx      # Ride request form
│       ├── RideStatus.tsx       # Real-time status display & timeline
│       └── Toast.tsx            # Toast notification system
├── package.json                # Dependencies
├── vite.config.ts              # Vite build config
├── tsconfig.json               # TypeScript config
├── MANUAL_TEST_CHECKLIST.md   # Comprehensive test guide
└── INTEGRATION_TESTS.md         # Integration test scenarios
```

## Dependencies

### Core
- `react` ^18.3.0 - UI library
- `react-dom` ^18.3.0 - DOM rendering
- `firebase` ^11.10.0 - Firebase SDK (hoisted to root)
- `@shiftx/driver-client` - Local package for driver business logic

### Dev
- `vite` ^5.0.0 - Build tool & dev server
- `typescript` ^5.3.3 - Type safety
- `@vitejs/plugin-react` ^4.0.0 - JSX support
- `@types/react` & `@types/react-dom` - Type definitions

## API Integration

### Callables from @shiftx/driver-client

#### `tripRequest(payload: TripRequestData)`
```typescript
// Input
interface TripRequestData {
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  priceCents?: number;          // optional
  metadata?: Record<string, any>; // optional
}

// Output
interface TripRequestResult {
  rideId: string;
}
```

#### `tripCancel(payload: TripCancelPayload)`
```typescript
// Input
interface TripCancelPayload {
  rideId: string;
  reason?: string;
}

// Output
{ ok: true }
```

### Firestore Collections

#### users/{uid}
```json
{
  "email": "user@example.com",
  "role": "customer",
  "createdAtMs": 1234567890
}
```

#### customers/{uid}
```json
{
  "onboardingStatus": "active" | "pending" | "suspended",
  "createdAtMs": 1234567890,
  "updatedAtMs": 1234567890
}
```

#### rides/{rideId}
```json
{
  "status": "requested" | "dispatching" | "offered" | "accepted" | "started" | "in_progress" | "completed" | "cancelled",
  "riderId": "uid",
  "driverId": "uid (optional)",
  "pickup": { "lat": 40.7128, "lng": -74.0060 },
  "dropoff": { "lat": 40.7580, "lng": -73.9855 },
  "priceCents": 2500,
  "createdAtMs": 1234567890,
  "acceptedAtMs": 1234567891 (optional),
  "startedAtMs": 1234567892 (optional),
  "completedAtMs": 1234567893 (optional),
  "cancelledAtMs": 1234567894 (optional)
}
```

## Component Details

### App.tsx
- Initializes Firebase and driver-client
- Manages global auth state
- Handles user doc creation on first login
- Routes between AuthGate, RequestRide, and RideStatus based on auth state
- Persists rideId in localStorage for recovery

### AuthGate.tsx
- Sign up / Sign in form
- Email/password validation
- Handles auth errors (user not found, wrong password, etc.)
- Shows logged-in user header with sign-out button
- Protected app content only shown when signed in

### RequestRide.tsx
- Form with fields for:
  - Pickup latitude/longitude
  - Dropoff latitude/longitude
  - Price (cents, optional)
  - Metadata (JSON, optional)
- Full input validation
- Calls `tripRequest()` and stores rideId
- Auto-navigates to RideStatus on success

### RideStatus.tsx
- Real-time Firestore listener on ride document
- Visual timeline component showing ride progression
- Status badge with dynamic color coding
- Details grid showing all ride information
- Cancel button with state validation
- Error handling with user-friendly messages
- Auto-completes to RequestRide after 2 seconds when ride finishes

### Toast.tsx
- Context-based notification system
- Auto-dismiss after 4 seconds
- Manual dismiss on click
- Color-coded by type (info, success, error, warning)

## Styling & Theme

- **Dark theme**: Background #05060a, cards with glass-morphism effect
- **Accent colors**: Orange (#ffb703) for primary, Red (#ff6b6f) for danger
- **Responsive**: Mobile-first, adapts to tablet and desktop
- **Accessibility**: High contrast, clear visual hierarchy, adequate touch targets

### CSS Classes
- `.screen-container` - Center content on screen
- `.card` - Main content card with backdrop blur
- `.button-primary` - Orange gradient button
- `.button-danger` - Red gradient button
- `.status-badge` - Status indicator with dynamic color
- `.timeline-*` - Timeline visualization components
- `.toast-*` - Notification styles by type

## Emulator Configuration

The app uses `DEFAULT_EMULATOR_CONFIG` from @shiftx/driver-client:

```typescript
const DEFAULT_EMULATOR_CONFIG = {
  firestoreHost: 'localhost',
  firestorePort: 8081,
  functionsHost: 'localhost',
  functionsPort: 5002,
};
```

**Auth Emulator**: Configured at `http://localhost:9099` in App.tsx

### Startup

```bash
# Start Firebase Emulators
firebase emulators:start --only auth,functions,firestore

# In another terminal, start customer app dev server
cd packages/customer-app
npm run dev

# App will be available at http://localhost:5173
```

## Error Handling

### Auth Errors
- Email already in use → "Email already in use"
- User not found → "Invalid email or password"
- Wrong password → "Invalid email or password"
- Network errors → Toast notification with error message

### Request Ride Errors
- Invalid coordinates → "Please enter valid coordinates"
- Missing fields → "Please enter pickup and dropoff coordinates"
- Function call failure → Toast with error message

### Cancel Ride Errors
- PERMISSION_DENIED → "No permission to cancel this ride"
- NOT_FOUND → "Ride not found"
- FAILED_PRECONDITION → "Ride cannot be cancelled in its current state"
- Generic errors → Display raw error message
- State validation → "Cannot cancel ride in current state"

All errors are displayed via toast notifications and/or inline error messages.

## localStorage Keys

- `rideId` - Currently active ride ID for persistence across refreshes

## Testing

See `MANUAL_TEST_CHECKLIST.md` for comprehensive testing guide covering:
- Authentication flows
- Ride request and status updates
- Cancel functionality
- Real-time Firestore listeners
- Firebase package deduplication
- Responsive design
- Error handling
- Performance baselines

See `INTEGRATION_TESTS.md` for key integration points to verify.

## Known Limitations

- Emulator data is reset on Firebase restart (unless persistence enabled)
- Driver actions (accept/decline) must be simulated manually via Firestore UI or driver app
- No real payment processing in emulator mode
- Auth emulator doesn't require real email verification

## Future Enhancements

- Push notifications for ride status updates
- Map integration for pickup/dropoff visualization
- Estimated time of arrival (ETA) display
- Driver rating & review functionality
- Ride history page
- Favorite locations / address book
- Payment integration (Stripe)
- In-app chat with driver
- Accessibility improvements (a11y)

## Troubleshooting

### "Service firestore is not available" Error
- Ensure firebase is hoisted (single instance)
- Run `npm ls firebase` in customer-app to verify
- Remove `packages/driver-client/node_modules` if it has local firebase copy
- Ensure all imports use modular format (firebase/firestore, not firebase.firestore())

### Firestore listener not updating
- Check Firestore emulator is running on port 8081
- Verify rides/{rideId} document exists
- Check browser console for errors
- Refresh page if stuck

### Auth not persisting
- Clear localStorage and try signing in again
- Check browser allows localStorage
- Verify auth emulator is running on port 9099

### Functions not working
- Check functions emulator is running on port 5002
- Verify `tripRequest` and `tripCancel` are deployed to emulator
- Check functions logs in emulator UI for errors
- Restart emulators if needed

## Support

For issues or questions, refer to:
- [Firebase Emulator Suite Docs](https://firebase.google.com/docs/emulator-suite)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [ShiftX Project Docs](../../../docs/)
