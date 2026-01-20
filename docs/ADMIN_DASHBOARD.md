# ShiftX Admin Dashboard

Comprehensive documentation for the ShiftX standalone admin dashboard - a React-based web application for managing the ride-sharing platform.

---

## Table of Contents

1. [Overview](#overview)
2. [Package Structure](#package-structure)
3. [Features](#features)
4. [Authentication](#authentication)
5. [Key Components](#key-components)
6. [Role-based Permissions](#role-based-permissions)
7. [Analytics & Real-time KPIs](#analytics--real-time-kpis)
8. [Stripe Dashboard Integration](#stripe-dashboard-integration)
9. [Environment Variables](#environment-variables)
10. [Build & Run](#build--run)
11. [Admin User Management](#admin-user-management)
12. [Security Considerations](#security-considerations)

---

## Overview

The ShiftX Admin Dashboard is a standalone React web application providing comprehensive administrative control over the ride-sharing platform. It replaces the previous admin functionality that was embedded in the driver app, offering better security separation and a dedicated admin experience.

### Purpose

- **Centralized Management**: Single interface for all administrative operations
- **Security Isolation**: Completely separate from driver and customer apps
- **Real-time Monitoring**: Live updates on drivers, rides, and system status
- **Audit Trail**: Complete logging of all admin actions
- **Operational Control**: Runtime flags for emergency system control

### Key Benefits

- ✅ **Better Security**: Admin functions isolated from driver app
- ✅ **Cleaner UX**: Purpose-built interface for administrative tasks
- ✅ **Real-time Updates**: Live data streams from Firestore
- ✅ **Mobile Responsive**: Works on desktop and mobile devices
- ✅ **Audit Compliance**: Complete action logging and transparency

---

## Package Structure

```
packages/admin-dashboard/
├── src/
│   ├── components/          # React components
│   │   ├── AdminLogs.tsx    # Admin action audit trail
│   │   ├── AuthGate.tsx     # Login screen
│   │   ├── Customers.tsx    # Customer management
│   │   ├── Dashboard.tsx    # Main navigation container
│   │   ├── Drivers.tsx      # Driver management & approval
│   │   ├── Overview.tsx     # Real-time KPIs dashboard
│   │   ├── PaymentsAudit.tsx # Stripe payment tracking
│   │   ├── ProdDiagnostics.tsx # Environment diagnostics
│   │   ├── Reports.tsx      # User reports & moderation
│   │   ├── Rides.tsx        # Ride search & details
│   │   └── RuntimeFlags.tsx # Kill switches & feature flags
│   ├── App.tsx              # Root component with auth flow
│   ├── firebase.ts          # Firebase initialization & config
│   ├── main.tsx             # Application entry point
│   ├── styles.css           # Global styles (602 lines)
│   ├── App.css              # Component-specific styles
│   └── index.css            # Base CSS reset
├── public/                  # Static assets
├── .env.production          # Production Firebase config
├── package.json             # Dependencies & scripts
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite bundler config
├── eslint.config.js         # Linting rules
└── README.md                # Quick start guide
```

### Technology Stack

- **Framework**: React 19.2.0 with TypeScript
- **Build Tool**: Vite 7.2.4 (fast HMR, optimized builds)
- **Backend**: Firebase (Auth, Firestore, Functions)
- **Language**: TypeScript 5.9.3
- **Styling**: CSS (dark theme, emoji icons)
- **Port**: 5175 (configurable in vite.config.ts)

---

## Features

### 1. Overview Screen

**Real-time Dashboard KPIs:**

- 🟢 **Online Drivers**: Live count of drivers currently online (real-time listener)
- 🚗 **Active Rides**: Count of rides in progress (statuses: accepted, started, in_progress)
- ⏳ **Pending Approvals**: Number of drivers awaiting approval
- 📊 **Total Drivers**: All-time driver registrations
- 👥 **Total Customers**: All-time customer accounts
- 🚀 **Total Rides**: All-time ride count

**Implementation:**
- Real-time Firestore snapshots for dynamic stats (online drivers, active rides)
- Initial batch query for static totals (total drivers, customers, rides)
- Auto-refreshing without page reload

### 2. Drivers Management

**Features:**
- **List View**: All drivers with photos, vehicle details, ratings
- **Filters**: All | Approved | Pending | Online
- **Driver Details**:
  - Email, phone number, display name
  - Vehicle info (make, model, color, license plate, class)
  - Stripe Connect status (account ID, onboarding status)
  - Online/offline status
  - Approval status
- **Actions**:
  - ✅ **Approve Driver**: Calls `approveDriver` Cloud Function
  - 🚫 **Disable Driver**: Revoke driver approval
  - ⚡ **Toggle Stripe Connect Pilot**: Enable/disable direct payouts per driver

**Cloud Functions Used:**
- `listDrivers()`: Fetches all driver profiles
- `approveDriver({ driverId, approved })`: Approve/disable driver
- `toggleConnectPilot({ driverId, enabled })`: Control Stripe Connect access

### 3. Customers View

**Features:**
- **Search**: Filter by name or email (client-side)
- **Customer Profiles**:
  - Email, phone, display name, photo
  - Saved places (home and work addresses)
  - Ride count (placeholder for future implementation)
- **Data Sources**: Combines `customers` and `users` collections

### 4. Rides View

**Features:**
- **Search by Ride ID**: Direct lookup of specific rides
- **Ride Details**:
  - Customer and driver information (with email lookup)
  - Status (pending, accepted, started, completed, cancelled)
  - Pickup and dropoff addresses
  - Vehicle class requested
  - Fare information (estimated vs. actual)
  - Timeline (created, accepted, completed, cancelled timestamps)
- **Use Case**: Customer support, dispute resolution, ride auditing

### 5. Admin Logs

**Features:**
- **Audit Trail**: Last 50 admin actions (sorted by timestamp DESC)
- **Log Details**:
  - Admin who performed action (ID, email)
  - Action type (approve, disable, toggle, etc.)
  - Target user/resource (ID, type)
  - Additional details (JSON)
  - Timestamp
- **Color Coding**:
  - Green: Approval actions
  - Red: Disable/reject actions
  - Blue: Other actions
- **Transparency**: All authenticated users can read logs (per Firestore rules)

### 6. Payments Audit

**Features:**
- **Recent Rides**: Last 50 rides sorted by creation date
- **Payment Tracking**:
  - Ride ID
  - Payment status
  - Stripe PaymentIntent ID
  - Connect Transfer ID and status
  - Payout ID and destination
  - Transfer destination (Stripe account)
  - Flags (e.g., "Missing transfer")
- **Purpose**: Verify Stripe payment flow, debug payment issues

### 7. Runtime Flags (Kill Switches)

**Critical Operational Controls:**

- 🚫 **disablePayments**: Block all payment processing
- 🚫 **disableNewRequests**: Prevent new ride requests
- 🚫 **disableDriverOnline**: Block drivers from going online
- 🚫 **disableAcceptRide**: Prevent ride acceptance
- ⚡ **enableStripeConnect**: Global Stripe Connect toggle
- 📢 **maintenanceMessage**: Message shown to users

**Features:**
- Real-time sync (Firestore snapshot listener)
- Instant toggle with optimistic updates
- Admin action logging for all flag changes
- Rollback on error
- Updated by/timestamp tracking
- Firebase Console URL for manual override

**Use Cases:**
- Emergency system shutdown
- Maintenance mode
- Feature rollout control
- Production incident response

### 8. Reports (User Moderation)

**Features:**
- **User Reports**: Last 100 reports sorted by date
- **Filters**: All | Pending | Reviewed
- **Report Details**:
  - Reporter (UID, email)
  - Target user (UID, email, role: customer/driver)
  - Associated ride ID
  - Report category and reason
  - Status (pending/reviewed)
  - Timestamp
- **Purpose**: Content moderation, user safety, dispute resolution

---

## Authentication

### Admin Access Control

**Authentication Flow:**

1. User signs in with email/password (Firebase Auth)
2. `App.tsx` listens for auth state changes
3. On sign-in, checks `config/admins` Firestore document
4. Verifies user's UID is in the `uids` array
5. If not admin, signs user out with access denied message
6. If admin, grants access to dashboard

**Admin Config Document:**

```typescript
// Firestore: config/admins
{
  uids: string[],        // Array of admin Firebase Auth UIDs
  updatedAtMs: number    // Last update timestamp
}
```

**Security Enforcement:**

- ✅ **Client-side**: App.tsx checks admin status on auth state change
- ✅ **Firestore Rules**: `isAdmin()` helper validates against `config/admins`
- ✅ **Cloud Functions**: Server-side admin checks in all admin functions
- ✅ **Auto Sign-out**: Non-admins are immediately signed out

**AuthGate Component:**

- Clean email/password login form
- Error handling for common auth failures
- Loading states
- Mobile-responsive design

---

## Key Components

### Screen Components

#### 1. **Dashboard.tsx** (Main Container)
- **Purpose**: Navigation and screen routing
- **State**: Active screen selection
- **Screens**: Overview, Drivers, Customers, Rides, Payments Audit, Logs, Runtime Flags, Reports
- **Features**: Tab navigation, sign-out button
- **Navigation**: Emoji-based icons for visual clarity

#### 2. **Overview.tsx** (KPIs)
- **State**: Real-time stats object
- **Firestore Queries**:
  - Real-time: `drivers` where `isOnline == true`
  - Real-time: `rides` where `status in ['accepted', 'started', 'in_progress']`
  - Batch: Count all drivers, customers, rides
- **Re-renders**: Automatic on Firestore updates

#### 3. **Drivers.tsx** (Driver Management)
- **State**: Drivers array, filter, processing UID
- **Functions Called**:
  - `listDrivers()`: Load all drivers
  - `approveDriver()`: Approve/disable driver
  - `toggleConnectPilot()`: Control Stripe Connect
- **UI**: Grid of driver cards with photos, vehicle info, action buttons
- **Loading States**: Per-driver spinners during actions

#### 4. **Customers.tsx** (Customer Profiles)
- **State**: Customers array, search query
- **Queries**: Combines `customers` + `users` collections
- **Search**: Client-side filtering by name or email
- **Display**: Saved places (home/work), profile info

#### 5. **Rides.tsx** (Ride Search)
- **State**: Search query, selected ride, loading, error
- **Lookup**: Direct Firestore document get by ride ID
- **Enrichment**: Fetches customer and driver emails from `users` collection
- **Timeline**: Displays all ride lifecycle timestamps

#### 6. **AdminLogs.tsx** (Audit Trail)
- **Query**: `adminLogs` ordered by `timestamp DESC`, limit 50
- **Display**: Chronological list with color-coded actions
- **Refresh**: Manual reload button
- **Transparency**: Visible to all authenticated users

#### 7. **RuntimeFlags.tsx** (Kill Switches)
- **State**: Flags object, loading, saving, message
- **Listener**: Real-time Firestore snapshot on `config/runtimeFlags`
- **Actions**: Toggle with optimistic updates, rollback on error
- **Logging**: All flag changes logged to `adminLogs`
- **UI**: Toggle switches with descriptions and warnings

#### 8. **PaymentsAudit.tsx** (Payment Tracking)
- **Query**: `rides` ordered by `createdAtMs DESC`, limit 50
- **Display**: Table of payment-related fields from ride documents
- **Flags**: Visual indicators for missing transfers
- **Purpose**: Debug Stripe payment flow

#### 9. **Reports.tsx** (User Moderation)
- **Query**: `reports` ordered by `createdAtMs DESC`, limit 100
- **Filters**: All, Pending, Reviewed
- **Display**: Report cards with reporter, target, reason, status
- **Action**: View details for moderation decisions

### Shared Components

#### **AuthGate.tsx** (Login)
- Email/password form
- Error handling and display
- Loading states
- Firebase Auth integration
- Mobile-responsive

#### **ProdDiagnostics.tsx** (Environment Debug)
- Displays current environment (dev vs. prod)
- Firebase emulator connection status
- Helpful for debugging configuration issues

---

## Role-based Permissions

### Admin Capabilities

Admins can:
- ✅ View all drivers, customers, rides
- ✅ Approve or disable driver accounts
- ✅ Toggle Stripe Connect for individual drivers
- ✅ Control runtime flags (kill switches)
- ✅ View all admin logs (audit trail)
- ✅ Search rides by ID
- ✅ View payment audit data
- ✅ View user reports

### Admin Restrictions

Admins cannot:
- ❌ Delete users or data (all deletes disabled in Firestore rules)
- ❌ Modify admin logs (immutable audit trail)
- ❌ Change user roles (enforced in Firestore rules)
- ❌ Edit ride data directly (must use Cloud Functions)
- ❌ Access user passwords (Firebase Auth handles)

### Firestore Security Rules

```javascript
// Admin helper function
function isAdmin() {
  return signedIn() 
    && request.auth.uid in get(/databases/$(database)/documents/config/admins).data.uids;
}

// Admin logs: transparent but immutable
match /adminLogs/{logId} {
  allow read: if signedIn();        // All users can read
  allow create: if isAdmin();       // Only admins can create
  allow update, delete: if false;   // Immutable
}

// Runtime flags: public read, admin write
match /config/runtimeFlags {
  allow read: if true;              // Unauthenticated reads for pre-login checks
  allow write: if isAdmin();        // Only admins toggle
}

// Driver/customer management
match /drivers/{uid} {
  allow list: if isAdmin();         // Admins can list all
}

match /customers/{uid} {
  allow list: if isAdmin();         // Admins can list all
}
```

### Cloud Function Authorization

All admin Cloud Functions verify admin status:

```typescript
async function isAdmin(uid: string): Promise<boolean> {
  const adminConfigSnap = await db.collection('config').doc('admins').get();
  if (adminConfigSnap.exists) {
    const adminUids = adminConfigSnap.data()?.uids || [];
    return adminUids.includes(uid);
  }
  return false;
}

// Used in functions like approveDriver, listDrivers, toggleConnectPilot
```

---

## Analytics & Real-time KPIs

### Real-time Metrics

**Implementation: Firestore Snapshot Listeners**

```typescript
// Online Drivers (real-time)
const driversQuery = query(
  collection(db, 'drivers'), 
  where('isOnline', '==', true)
);
onSnapshot(driversQuery, (snapshot) => {
  setStats(prev => ({ ...prev, onlineDrivers: snapshot.size }));
});

// Active Rides (real-time)
const ridesQuery = query(
  collection(db, 'rides'), 
  where('status', 'in', ['accepted', 'started', 'in_progress'])
);
onSnapshot(ridesQuery, (snapshot) => {
  setStats(prev => ({ ...prev, activeRides: snapshot.size }));
});
```

### Static Totals

**Implementation: Batch Queries on Mount**

```typescript
// Total Drivers
const driversSnap = await getDocs(collection(db, 'drivers'));
const totalDrivers = driversSnap.size;
const pendingApprovals = driversSnap.docs.filter(doc => !doc.data().approved).length;

// Total Customers
const customersSnap = await getDocs(collection(db, 'customers'));
const totalCustomers = customersSnap.size;

// Total Rides
const ridesSnap = await getDocs(collection(db, 'rides'));
const totalRides = ridesSnap.size;
```

### Performance Considerations

- **Real-time listeners**: Only for frequently changing data (online drivers, active rides)
- **Batch queries**: For static totals that change slowly
- **Client-side filtering**: Search and filters use local state (no server queries)
- **Pagination**: Not implemented yet (use limit queries for large datasets)

### Future Enhancements

- 📊 **Time-series charts**: Daily/weekly ride trends
- 💰 **Revenue analytics**: Earnings, payouts, commissions
- 🗺️ **Geographic heatmaps**: Ride density by location
- ⏱️ **Performance metrics**: Average pickup time, ride duration
- 📈 **Growth metrics**: User acquisition, retention, churn

---

## Stripe Dashboard Integration

### Current Implementation

**Payments Audit Screen:**
- Displays Stripe PaymentIntent IDs
- Shows Connect Transfer IDs and statuses
- Links to destination Stripe accounts
- Flags missing transfers

**Driver Management:**
- Shows `stripeConnectAccountId` for each driver
- Displays onboarding status (none, pending, active, disabled)
- Toggle `connectEnabledOverride` per driver

### Stripe Connect Flow

1. **Driver Onboarding**: Driver completes Stripe Connect onboarding in driver app
2. **Account Creation**: Stripe account ID stored in driver profile
3. **Pilot Toggle**: Admin enables Connect for driver via `toggleConnectPilot()`
4. **Ride Completion**: Payment processed, transfer created to driver's Stripe account
5. **Audit**: Admin verifies transfer in Payments Audit screen

### External Links

**To access full Stripe Dashboard:**

- **Production**: https://dashboard.stripe.com/
- **Test Mode**: https://dashboard.stripe.com/test
- **Connected Accounts**: https://dashboard.stripe.com/connect/accounts/overview

**Useful Stripe Pages:**
- Payments: `/payments`
- Transfers: `/connect/transfers`
- Payouts: `/payouts`
- Connected Accounts: `/connect/accounts/overview`

### Stripe Environment Modes

**Mode Detection:**
```typescript
// In Cloud Functions
function getStripeMode(): 'test' | 'live' {
  if (isEmulator()) return 'test';
  return process.env.STRIPE_MODE === 'test' ? 'test' : 'live';
}
```

**Environment Variable:**
- `STRIPE_MODE=test` → Use Stripe test keys
- `STRIPE_MODE=live` → Use Stripe live keys
- Emulator always uses test mode

---

## Environment Variables

### Production Configuration

**File: `.env.production`**

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyCi9fz_lpRJh1dEnmRekGVh3Jc9JAyYHnU
VITE_FIREBASE_AUTH_DOMAIN=shiftx-95c4b.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=shiftx-95c4b
VITE_FIREBASE_STORAGE_BUCKET=shiftx-95c4b.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=928827778230
VITE_FIREBASE_APP_ID=1:928827778230:web:ac7b78dcf4d7b93d22f217
```

### Development (Emulator Mode)

**Automatic Detection:**
- If `import.meta.env.DEV` is true AND hostname is `localhost`/`127.0.0.1`
- Connects to Firebase emulators automatically

**Emulator Ports:**
```typescript
// firebase.ts
connectAuthEmulator(auth, 'http://127.0.0.1:9099');
connectFirestoreEmulator(db, '127.0.0.1', 8081);
connectFunctionsEmulator(functions, '127.0.0.1', 5002);
```

### Required Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | `shiftx-95c4b.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | `shiftx-95c4b` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | `shiftx-95c4b.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM Sender ID | `928827778230` |
| `VITE_FIREBASE_APP_ID` | Firebase App ID | `1:928...` |

### Configuration Fallbacks

**firebase.ts includes hardcoded fallbacks for production:**

```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSy...',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'shiftx-95c4b.firebaseapp.com',
  // ... etc
};
```

**Why?** Ensures production builds work even if `.env.production` is missing.

---

## Build & Run

### Development

**Start Development Server:**

```bash
cd packages/admin-dashboard
npm install
npm run dev
```

**Access Dashboard:**
- URL: http://localhost:5175
- Auto-reloads on file changes (Vite HMR)
- Connects to Firebase emulators if running on localhost

**Run Firebase Emulators:**

```bash
# From project root
firebase emulators:start
```

**Emulator Ports:**
- Auth: 9099
- Firestore: 8081
- Functions: 5002
- Hosting: 5000

### Production Build

**Build for Production:**

```bash
cd packages/admin-dashboard
npm run build
```

**Output:**
- Directory: `packages/admin-dashboard/dist/`
- Optimized bundle with tree-shaking and minification
- Uses `.env.production` variables
- Ready for deployment to Firebase Hosting, Vercel, Netlify, etc.

**Preview Production Build Locally:**

```bash
npm run preview
```

### Deployment

**Firebase Hosting (Recommended):**

1. Configure `firebase.json`:
```json
{
  "hosting": {
    "public": "packages/admin-dashboard/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{
      "source": "**",
      "destination": "/index.html"
    }]
  }
}
```

2. Deploy:
```bash
npm run build
firebase deploy --only hosting
```

**Other Hosting Options:**
- **Vercel**: Connect GitHub repo, auto-deploy on push
- **Netlify**: Drag-drop `dist/` folder or connect repo
- **AWS S3 + CloudFront**: Upload `dist/` to S3 bucket

### Linting

**Run ESLint:**

```bash
npm run lint
```

**Configuration:**
- File: `eslint.config.js`
- TypeScript strict type checking enabled
- React hooks rules
- React refresh plugin

---

## Admin User Management

### How to Add Admins

**Method 1: Using `addAdmin.js` Script (Recommended)**

```bash
# From project root
cd /path/to/shiftx

# Production
node scripts/addAdmin.js add <firebase-auth-uid>

# Emulator (development)
FIRESTORE_EMULATOR_HOST=localhost:8081 node scripts/addAdmin.js add <uid>
```

**Method 2: Using `addAdminClient.js` Script (Emulator Only)**

```bash
# For emulator with client SDK
node scripts/addAdminClient.js add <firebase-auth-uid>
```

**Method 3: Firebase Console (Manual)**

1. Go to: https://console.firebase.google.com/project/shiftx-95c4b/firestore
2. Navigate to `config/admins` document
3. Add UID to `uids` array field
4. Set `updatedAtMs` to current timestamp

### How to Remove Admins

**Using Script:**

```bash
node scripts/addAdmin.js remove <firebase-auth-uid>
```

**Manual (Firebase Console):**
1. Open `config/admins` document
2. Remove UID from `uids` array
3. Update `updatedAtMs` timestamp

### List Current Admins

```bash
node scripts/addAdmin.js list
```

**Output:**
```
Current admins (2):
  1. abc123xyz
  2. def456uvw
```

### Getting Your Firebase Auth UID

**Option 1: Firebase Console**
1. Go to Authentication → Users
2. Find your email
3. Copy UID from table

**Option 2: In Driver/Customer App**
```typescript
// In app console
console.log(auth.currentUser?.uid);
```

**Option 3: Using Firebase CLI**
```bash
firebase auth:export users.json --project shiftx-95c4b
cat users.json | grep email
```

### Admin Config Document Structure

```typescript
// Firestore: config/admins
{
  uids: [
    "abc123xyz",         // First admin UID
    "def456uvw",         // Second admin UID
    // ... more admin UIDs
  ],
  updatedAtMs: 1706123456789
}
```

### Bootstrap: First Admin Setup

**Problem:** You need to be an admin to add admins!

**Solution: Use Firebase Admin SDK script**

```bash
# Install dependencies (one-time)
cd functions
npm install

# Add first admin (requires gcloud auth or service account)
cd ..
node scripts/addAdmin.js add <your-uid>
```

**Authentication Options:**

1. **gcloud CLI** (recommended):
```bash
gcloud auth application-default login
node scripts/addAdmin.js add <uid>
```

2. **Service Account**:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
node scripts/addAdmin.js add <uid>
```

3. **Manual** (if scripts fail):
- Use Firebase Console to create `config/admins` document manually

---

## Security Considerations

### Authentication Security

✅ **Firebase Auth**: Industry-standard OAuth 2.0
✅ **HTTPS Only**: All traffic encrypted (enforced by Firebase Hosting)
✅ **Session Management**: Firebase handles token refresh and expiry
✅ **Multi-factor Auth**: Can be enabled per admin user in Firebase Console

### Authorization Security

✅ **Triple-layer Verification**:
1. **Client-side**: App.tsx checks admin status on auth state change
2. **Firestore Rules**: `isAdmin()` validates on every database read/write
3. **Cloud Functions**: Server-side admin checks in sensitive operations

✅ **Firestore Rules Enforcement**:
```javascript
function isAdmin() {
  return signedIn() 
    && request.auth.uid in get(/databases/$(database)/documents/config/admins).data.uids;
}
```

✅ **Automatic Sign-out**: Non-admin users immediately signed out with alert

### Data Security

✅ **Read-only by Default**: Most screens only read data
✅ **Immutable Audit Logs**: Cannot update or delete admin logs
✅ **No Direct Writes**: All mutations go through Cloud Functions with validation
✅ **Password Security**: Firebase Auth handles password hashing (never exposed)

### Network Security

✅ **CORS**: Cloud Functions use proper CORS configuration
✅ **Emulator Safety**: Only connects to emulators on localhost
✅ **Environment Detection**: Automatic prod vs. dev switching

### Operational Security

✅ **Kill Switches**: Runtime flags for emergency system control
✅ **Audit Trail**: All admin actions logged with timestamp and user
✅ **Transparent Logging**: All authenticated users can view logs (accountability)
✅ **No Cascading Errors**: Failed admin checks don't expose system internals

### Common Security Pitfalls (Avoided)

❌ **Storing Admin List in Code**: Uses Firestore document (updatable without redeploy)
❌ **Client-only Checks**: Server-side validation in Cloud Functions and Firestore Rules
❌ **Hardcoded Credentials**: Environment variables only
❌ **Exposing Stripe Keys**: Never sent to client (server-side only)
❌ **Unlogged Admin Actions**: Every mutation logged to `adminLogs`

### Security Best Practices

1. **Least Privilege**: Grant admin access only to trusted users
2. **Regular Audits**: Review admin logs for suspicious activity
3. **Strong Passwords**: Enforce password requirements in Firebase Console
4. **Monitor Failed Logins**: Check Firebase Auth logs for brute force attempts
5. **Rotate Service Accounts**: If using service account keys, rotate periodically
6. **Review Firestore Rules**: Periodically audit rules for unintended access
7. **Enable Alerts**: Set up Firebase monitoring alerts for admin actions

### Security Incident Response

**If Admin Account Compromised:**

1. **Immediate**: Remove UID from `config/admins` document
2. **Reset Password**: Force password reset in Firebase Console
3. **Review Logs**: Check `adminLogs` for unauthorized actions
4. **Revoke Tokens**: Disable user in Firebase Auth (revokes all sessions)
5. **Notify Team**: Alert other admins of potential breach
6. **Audit Impact**: Review affected users/rides/payments

**Emergency System Lockdown:**

1. **Runtime Flags**: Toggle kill switches to disable features
2. **Firebase Console**: Disable authentication providers temporarily
3. **Cloud Functions**: Deploy stub functions that reject all requests
4. **Firestore Rules**: Deploy restrictive rules that block all writes

---

## Appendix

### Cloud Functions Reference

**Admin Functions:**
- `listDrivers()` - Fetch all driver profiles
- `approveDriver({ driverId, approved })` - Approve/disable driver
- `toggleConnectPilot({ driverId, enabled })` - Control Stripe Connect per driver

### Firestore Collections Reference

**Admin-related Collections:**
- `config/admins` - Admin UID whitelist
- `config/runtimeFlags` - Kill switches and feature flags
- `adminLogs` - Audit trail of admin actions
- `drivers` - Driver profiles
- `customers` - Customer profiles
- `users` - Shared user data (email, displayName, role)
- `rides` - Ride records
- `reports` - User reports for moderation

### Key Files Reference

**Configuration:**
- `packages/admin-dashboard/.env.production` - Production Firebase config
- `packages/admin-dashboard/vite.config.ts` - Vite bundler settings
- `firestore.rules` - Database security rules

**Scripts:**
- `scripts/addAdmin.js` - Add/remove/list admin users
- `scripts/addAdminClient.js` - Client SDK version for emulator
- `scripts/init-flags-admin.js` - Initialize runtime flags document

**Components:**
- `src/App.tsx` - Root component with auth flow
- `src/firebase.ts` - Firebase initialization
- `src/components/Dashboard.tsx` - Main navigation
- `src/components/*.tsx` - Feature screens

### Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run preview          # Preview production build
npm run lint             # Run linter

# Admin Management
node scripts/addAdmin.js list          # List admins
node scripts/addAdmin.js add <uid>     # Add admin
node scripts/addAdmin.js remove <uid>  # Remove admin

# Firebase
firebase emulators:start              # Start emulators
firebase deploy --only hosting        # Deploy dashboard
firebase deploy --only functions      # Deploy admin functions
```

### Support & Troubleshooting

**Common Issues:**

1. **"Access denied: Admin privileges required"**
   - Solution: Add your UID to `config/admins` document

2. **"Admin config document not found"**
   - Solution: Create `config/admins` with `uids` array field

3. **Emulators not connecting**
   - Check emulator is running on correct ports
   - Verify hostname is localhost or 127.0.0.1
   - Check browser console for connection errors

4. **Cloud Functions failing**
   - Verify functions are deployed: `firebase deploy --only functions`
   - Check Functions logs: `firebase functions:log`
   - Ensure CORS is configured correctly

5. **Real-time updates not working**
   - Check Firestore Rules allow read access
   - Verify network connection
   - Check browser console for Firestore errors

**For Further Help:**
- Firebase Console: https://console.firebase.google.com/project/shiftx-95c4b
- Firebase Docs: https://firebase.google.com/docs
- Stripe Dashboard: https://dashboard.stripe.com/

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Maintained By**: ShiftX Platform Team
