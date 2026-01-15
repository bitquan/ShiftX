# Driver App Firebase Initialization Fix

## Problem
Driver app crashed in production with error:
```
FirebaseError: No Firebase App '[DEFAULT]' has been created - call initializeApp() first (app/no-app)
```

**Root Cause**: 
- `@shiftx/driver-client` creates a **named** Firebase app: `'shiftx-driver-client'`
- Components calling `getAuth()`, `getFirestore()` without app parameter search for `[DEFAULT]` app
- `[DEFAULT]` app doesn't exist in driver app → crash

## Solution
Created centralized Firebase singleton pattern to ensure all components use the same named app instance.

## Implementation

### 1. Created `/packages/driver-app/src/firebase.ts`
Centralized Firebase initialization and exports:

```typescript
import { getAuth } from 'firebase/auth';
import { initDriverClient, DEFAULT_EMULATOR_CONFIG } from '@shiftx/driver-client';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const emulatorConfig = import.meta.env.DEV ? DEFAULT_EMULATOR_CONFIG : undefined;

const driverClient = initDriverClient({
  firebaseConfig,
  emulator: emulatorConfig,
});

// Export singleton instances
export const app = driverClient.app;
export const auth = getAuth(app);
export const db = driverClient.firestore;
export const functions = driverClient.functions;
export const storage = driverClient.storage;
```

### 2. Updated Entry Point
`/packages/driver-app/src/main.tsx`:
```typescript
import './firebase'; // ← Ensures Firebase initializes BEFORE React
import { App } from './App';
```

### 3. Updated Components
Changed from calling `getAuth()`, `getFirestore()` to importing singletons:

**Before:**
```typescript
import { getAuth } from 'firebase/auth';
const auth = getAuth(); // ← Searches for [DEFAULT] app
```

**After:**
```typescript
import { auth } from '../firebase';
// Use auth directly - already initialized with correct app
```

**Files Updated:**
- ✅ `/packages/driver-app/src/App.tsx`
- ✅ `/packages/driver-app/src/components/AuthGate.tsx`
- ✅ `/packages/driver-app/src/components/ProdDiagnostics.tsx`
- ✅ `/packages/driver-app/src/components/AvailableRides.tsx`

## Emulator Guards
Firebase singleton includes production-safe emulator guards:

```typescript
const emulatorConfig = import.meta.env.DEV ? DEFAULT_EMULATOR_CONFIG : undefined;
```

Only connects to emulators when:
1. `import.meta.env.DEV === true` (dev mode)
2. Running on localhost

Production builds have `import.meta.env.DEV === false`, so emulator config is always `undefined`.

## Deployment
```bash
cd packages/driver-app
npm run build
cd ../..
firebase deploy --only hosting:driver
```

## Testing
1. Visit: https://shiftx-95c4b-driver.web.app
2. Sign in as driver
3. Create test ride or wait for offer
4. Click on offer
5. **Expected**: No app/no-app error, offer opens successfully
6. **Verify**: Console shows no Firebase initialization errors

## Debug Mode
Production diagnostics available at: https://shiftx-95c4b-driver.web.app?debug=1

Shows:
- Project ID
- Auth domain
- Emulator mode (should be "No" in production)
- Current user
- Build marker: `SHIFTX_DEBUG_PANEL_v1`

## Future Component Updates
If new components need Firebase access:

```typescript
// ✅ CORRECT: Import from centralized firebase
import { auth, db, functions, storage } from '../firebase';

// ❌ WRONG: Direct Firebase calls without app parameter
import { getAuth } from 'firebase/auth';
const auth = getAuth(); // Crashes - searches for [DEFAULT]
```

## Architecture Notes
- **Customer app**: Uses `[DEFAULT]` app (standard `initializeApp()`)
- **Driver app**: Uses named app `'shiftx-driver-client'` (via `initDriverClient()`)
- **Admin app**: Uses named app (standard initialization)

Each app must import Firebase instances from a centralized singleton to avoid app/no-app errors.

---

**Status**: ✅ Fixed and deployed  
**Date**: 2025-01-24  
**Deployment**: https://shiftx-95c4b-driver.web.app
