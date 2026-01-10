# Customer App MVP - Manual Test Checklist

This document covers manual testing for the Customer App MVP. All tests should be run with Firebase Emulators and all dev servers running.

## Prerequisites
- ✓ Firebase Emulators running (`firebase emulators:start --only auth,functions,firestore`)
- ✓ Driver App Dev Server running (`cd packages/driver-app && npm run dev`)
- ✓ Customer App Dev Server running (`cd packages/customer-app && npm run dev`)
- ✓ All three using the same `firebase` package instance (verified: `npm ls firebase` shows single copy)

## Test Groups

### 1. Authentication (Email/Password)

#### 1.1 Sign Up - New User
- [ ] Navigate to customer app in browser (http://localhost:5173)
- [ ] See "ShiftX Customer" title and sign-in form
- [ ] Toggle to "Sign up" mode
- [ ] Enter new email and password
- [ ] Click "Sign Up"
- [ ] Verify success toast appears
- [ ] Verify `users/{uid}` document created with `role: "customer"` in Firestore
- [ ] Verify `customers/{uid}` document created with `onboardingStatus: "active"` in Firestore
- [ ] Verify app transitions to "Request Ride" screen

#### 1.2 Sign In - Existing User
- [ ] Go back to auth screen (sign out button in header)
- [ ] Enter previous email/password
- [ ] Click "Sign In"
- [ ] Verify success toast appears
- [ ] Verify app loads customer docs from Firestore
- [ ] Verify correct `onboardingStatus` is shown

#### 1.3 Auth Error Handling
- [ ] Try signing up with email that already exists
- [ ] Verify "Email already in use" error appears
- [ ] Try signing in with wrong password
- [ ] Verify "Invalid email or password" error appears
- [ ] Try signing in with non-existent email
- [ ] Verify "Invalid email or password" error appears

#### 1.4 Auth State Persistence
- [ ] Sign in successfully
- [ ] Refresh the page (Cmd+R)
- [ ] Verify you're still signed in (no redirect to auth screen)
- [ ] Check localStorage for rideId if one was created

### 2. Request Ride Screen

#### 2.1 Valid Ride Request
- [ ] From "Request Ride" screen, see form with fields:
  - [ ] Pickup Latitude
  - [ ] Pickup Longitude
  - [ ] Dropoff Latitude
  - [ ] Dropoff Longitude
  - [ ] Price (cents) - Optional
  - [ ] Metadata (JSON) - Optional
- [ ] Enter valid coordinates (e.g., NYC):
  - Pickup: lat=40.7128, lng=-74.0060
  - Dropoff: lat=40.7580, lng=-73.9855
- [ ] Leave price empty (optional)
- [ ] Click "Request Ride"
- [ ] Verify success toast shows: "Ride requested! ID: {rideId}"
- [ ] Verify `rides/{rideId}` document exists in Firestore
- [ ] Verify document has `status: "requested"` and other fields populated
- [ ] Verify app automatically transitions to "Ride Status" screen

#### 2.2 Ride Request with Optional Fields
- [ ] From auth screen, sign out and sign back in
- [ ] On "Request Ride", enter:
  - Coordinates as above
  - Price: 2500 (cents = $25.00)
  - Metadata: `{"notes": "Handle with care", "paymentMethod": "card"}`
- [ ] Click "Request Ride"
- [ ] Verify ride created with `priceCents: 2500` and metadata in Firestore
- [ ] Verify toast and screen transition

#### 2.3 Form Validation
- [ ] Try submitting with empty coordinates
- [ ] Verify "Please enter pickup and dropoff coordinates" error
- [ ] Try with invalid coordinate (non-numeric)
- [ ] Verify "Please enter valid coordinates" error
- [ ] Try with just pickup, no dropoff
- [ ] Verify validation error

#### 2.4 localStorage Persistence
- [ ] Request a ride successfully
- [ ] Verify rideId is stored in localStorage
- [ ] Refresh page
- [ ] Verify you're taken directly to "Ride Status" screen for that rideId
- [ ] Sign out
- [ ] localStorage should still have rideId
- [ ] Sign back in
- [ ] Verify you're taken to "Ride Status" screen

### 3. Ride Status Screen - Timeline & Real-time Updates

#### 3.1 Initial Status Display
- [ ] After requesting ride, see "Ride Status" screen
- [ ] Verify **Timeline visualization** shows all states:
  - requested (active/glowing)
  - dispatching
  - offered
  - accepted
  - started
  - in_progress
  - completed
- [ ] Current state should be glowing/highlighted
- [ ] Previous states should be dimmed (opacity 0.3)
- [ ] Current status badge displays correct state with color

#### 3.2 Real-time Status Updates
- [ ] Manually update ride status in Firestore emulator:
  - Change `status` field to "dispatching"
- [ ] Verify timeline updates in real-time (no page refresh needed)
- [ ] Verify glowing highlight moves to "dispatching" step
- [ ] Repeat for "offered" → "accepted" → "started" → "in_progress"
- [ ] Each time, verify timeline and badge update instantly

#### 3.3 Ride Completion
- [ ] Update ride status to "completed"
- [ ] Update `completedAtMs` to current timestamp (Date.now())
- [ ] Verify:
  - Timeline shows completed as last state
  - Status badge shows "completed"
  - Toast says "Ride completed"
  - After 2 seconds, app transitions back to "Request Ride" screen
- [ ] Verify localStorage rideId is cleared

#### 3.4 Timeline Details Panel
- [ ] Verify ride details grid shows all available fields:
  - [ ] Current Status (with color badge)
  - [ ] Driver ID (once assigned)
  - [ ] Price (if set)
  - [ ] Created At (timestamp)
  - [ ] Accepted At (appears after accepted)
  - [ ] Started At (appears after started)
  - [ ] Completed At (appears after completed)
  - [ ] Cancelled At (if applicable)
  - [ ] Pickup coordinates
  - [ ] Dropoff coordinates
- [ ] All timestamps display in readable format

### 4. Cancel Ride Functionality

#### 4.1 Cancel from "Requested" State
- [ ] Request a new ride (get rideId)
- [ ] On "Ride Status" screen, verify "Cancel Ride" button is visible
- [ ] Click "Cancel Ride"
- [ ] Verify loading spinner: "Cancelling..."
- [ ] Verify success toast: "Ride cancellation requested"
- [ ] Verify ride status changes to "cancelled" in Firestore
- [ ] Verify button disappears and "cannot be cancelled" message appears

#### 4.2 Cancel from "Dispatching" State
- [ ] Request a new ride
- [ ] Manually set status to "dispatching" in Firestore
- [ ] Verify "Cancel Ride" button still visible (in cancellable states)
- [ ] Click "Cancel Ride"
- [ ] Verify cancellation succeeds as in 4.1

#### 4.3 Cancel from "Offered" State
- [ ] Request a new ride
- [ ] Manually set status to "offered" in Firestore
- [ ] Verify "Cancel Ride" button still visible
- [ ] Click "Cancel Ride"
- [ ] Verify cancellation succeeds

#### 4.4 Cannot Cancel from "Accepted" State
- [ ] Request a new ride
- [ ] Manually set status to "accepted" in Firestore
- [ ] Verify "Cancel Ride" button is GONE
- [ ] Verify warning message shows: "Ride cannot be cancelled in the accepted state"
- [ ] Verify button does not reappear until status reverts to cancellable state

#### 4.5 Cannot Cancel from "Started" / "In Progress" / "Completed"
- [ ] For each state (started, in_progress, completed):
  - Request a ride
  - Update status in Firestore
  - Verify no "Cancel Ride" button
  - Verify warning message appears

#### 4.6 Cancel Error Handling
- [ ] Request a ride
- [ ] Update ride status to "accepted" (making it non-cancellable)
- [ ] Try clicking "Cancel Ride" if somehow visible
- [ ] If error toast appears, verify it's user-friendly message
- [ ] Verify app doesn't crash

### 5. Emulator Integration

#### 5.1 Firebase Auth Emulator
- [ ] In browser DevTools → Application → Local Storage
- [ ] Verify auth state is stored with emulator flag
- [ ] Sign out and sign back in
- [ ] Verify auth still works without persistence issues
- [ ] Check that auth is pointing to `localhost:9099` (when configured)

#### 5.2 Firestore Emulator
- [ ] Open Firestore Emulator UI (http://localhost:4000 or similar)
- [ ] Verify collections exist: `users`, `customers`, `rides`
- [ ] Verify user document structure:
  ```json
  {
    "email": "user@example.com",
    "role": "customer",
    "createdAtMs": 1234567890
  }
  ```
- [ ] Verify customer document structure:
  ```json
  {
    "onboardingStatus": "active",
    "createdAtMs": 1234567890,
    "updatedAtMs": 1234567890
  }
  ```
- [ ] Verify ride documents have all expected fields

#### 5.3 Functions Emulator
- [ ] Verify tripRequest callable succeeds and returns rideId
- [ ] Verify tripCancel callable succeeds
- [ ] Check Cloud Functions logs for any errors

### 6. UI/UX & Visual Verification

#### 6.1 Responsive Design
- [ ] View app on desktop (1920x1080)
- [ ] Verify forms and cards look good
- [ ] View on tablet (iPad size ~768px)
- [ ] Verify layout is readable
- [ ] View on mobile (iPhone size ~375px)
- [ ] Verify single-column layout and touch targets are adequate

#### 6.2 Toast Notifications
- [ ] After each action (sign up, request ride, cancel), verify:
  - [ ] Toast appears in bottom-right
  - [ ] Color-coded (success=green, error=red, info=blue)
  - [ ] Auto-dismisses after 4 seconds
  - [ ] Can be clicked to dismiss manually

#### 6.3 Loading States
- [ ] When requesting ride, verify button shows "Requesting..."
- [ ] When cancelling, verify button shows "Cancelling..."
- [ ] Button is disabled during these states
- [ ] Disabled state is visually apparent (opacity change)

#### 6.4 Dark Theme
- [ ] Verify app uses dark background (#05060a, #1a1f2e)
- [ ] Verify text is readable (high contrast)
- [ ] Verify accent colors (orange #ffb703, red #ff6b6b) are visible
- [ ] Verify no contrast accessibility issues

### 7. Edge Cases & Error Scenarios

#### 7.1 Ride Already Cancelled
- [ ] Request a ride
- [ ] Cancel it successfully
- [ ] Try cancelling again
- [ ] Verify appropriate error message

#### 7.2 Multiple Concurrent Requests
- [ ] Open app in two browser tabs/windows
- [ ] Sign in with same account in both
- [ ] Request a ride in tab 1
- [ ] Verify status updates in tab 2 in real-time
- [ ] Cancel from tab 2
- [ ] Verify cancellation reflected in tab 1

#### 7.3 Emulator Restart
- [ ] Have an active ride in progress
- [ ] Restart Firebase emulators
- [ ] Refresh browser
- [ ] Verify app gracefully handles emulator reconnection
- [ ] Verify ride data is restored

#### 7.4 Network Offline
- [ ] Open DevTools → Network tab
- [ ] Set throttling to "Offline"
- [ ] Try requesting a ride
- [ ] Verify error message (network error handling)
- [ ] Set back to online
- [ ] Verify app recovers

### 8. Firebase Package Verification

#### 8.1 Single Package Instance
- [ ] In browser DevTools → Console
- [ ] Run: `Object.keys(window).filter(k => k.includes('firebase'))`
- [ ] Verify only ONE instance of firebase is loaded
- [ ] Check that all imports resolve from same package
- [ ] No "firebase/compat" or duplicate firebase instances

#### 8.2 Module Imports
- [ ] Verify all imports are modular (firebase/auth, firebase/firestore, etc.)
- [ ] Not using firebase.auth() or firebase.firestore() (compat API)
- [ ] Confirm by checking source imports in component files

### 9. Performance Baseline

#### 9.1 Page Load
- [ ] Measure initial load time (auth screen)
- [ ] Should be <3 seconds
- [ ] Verify no network waterfall delays

#### 9.2 Ride Status Real-time Updates
- [ ] Update Firestore document manually
- [ ] Measure time to DOM update
- [ ] Should be <500ms (Firestore listener latency)

#### 9.3 Navigation Between Screens
- [ ] Request Ride → Ride Status (should be instant)
- [ ] Ride Status → Request Ride (after completion, should be instant)
- [ ] No janky animations or delays

## Test Execution Notes

### How to Run Tests
1. Start all dev services:
   ```bash
   cd /Users/papadev/dev/apps/shiftx
   npm run start:all-dev  # or run the "Start All Dev Services" task in VS Code
   ```

2. Open customer app: http://localhost:5173

3. Open Firestore Emulator UI: http://localhost:4000 (to verify data)

4. Use browser DevTools to inspect:
   - Network requests
   - Firestore listeners
   - Console errors/logs
   - Local storage

### Expected Outcomes
- All tests should pass without errors
- No console errors or warnings
- Firestore data should match expected schema
- Real-time updates should be instant (<500ms)
- All UI interactions should be responsive

### Known Limitations
- Emulator data is reset on restart (unless persistence is enabled)
- Driver acceptance/offers must be simulated manually via Firestore UI
- No real payment processing in emulator mode

## Test Sign-Off
- [ ] All tests completed
- [ ] No blockers found
- [ ] All errors resolved
- [ ] Ready for driver app integration
- [ ] Date: _______________
- [ ] Tester: _______________
