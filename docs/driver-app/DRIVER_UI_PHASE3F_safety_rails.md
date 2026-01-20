# Phase 3F — Safety Rails: Dev/Prod Guards + Event Logging

**Status**: ✅ Complete  
**Date**: January 2025  
**PR**: Phase 3F

## Overview

Phase 3F adds critical safety rails to prevent production misconfigurations and enhanced debugging capabilities through event logging. This phase implements hard blocks for emulator usage in production, warnings for environment mismatches, and a comprehensive event log system visible in the DiagnosticsPanel.

---

## 🎯 Goals

1. **HARD BLOCK**: Prevent emulator connection in production builds
2. **WARN**: Alert when dev environment connects to production Firebase
3. **DEBUG**: Add event log breadcrumbs for debugging ride flows
4. **VISIBILITY**: Display all events in DiagnosticsPanel for dev debugging

---

## 📋 Implementation

### 1. Environment Guard System

**File**: `packages/driver-app/src/utils/environmentGuard.ts` (NEW)

Validates environment configuration and prevents dangerous misconfigurations:

```typescript
export function validateEnvironment(): EnvironmentCheck {
  const isProduction = isProductionEnvironment();
  const isEmulator = isUsingEmulator();
  const warnings: string[] = [];
  const errors: string[] = [];

  // CRITICAL: Emulators in production is BLOCKED
  if (isProduction && isEmulator) {
    errors.push('🚨 CRITICAL: Emulators detected in production build!');
    errors.push('This should NEVER happen. Check your build configuration.');
    errors.push('Refusing to connect to emulators in production.');
  }

  // WARNING: Production backend in dev mode
  if (!isProduction && !isEmulator) {
    warnings.push('⚠️ WARNING: Development mode but NOT using emulators');
    warnings.push('You may be connected to PRODUCTION Firebase!');
    warnings.push('All changes will affect LIVE data.');
  }

  return { isProduction, isEmulator, isValid: errors.length === 0, warnings, errors };
}
```

**Key Functions**:
- `isUsingEmulator()`: Checks for emulator env vars or localhost
- `isProductionEnvironment()`: Checks `import.meta.env.PROD`
- `validateEnvironment()`: Returns validation result with errors/warnings
- `logEnvironmentStatus()`: Logs validation to console on startup
- `blockEmulatorInProduction()`: Shows full-screen error and throws

**Checks**:
- ✅ Emulator env variables (`VITE_FIREBASE_*_EMULATOR_HOST`)
- ✅ Localhost hostname (`localhost`, `127.0.0.1`)
- ✅ Vite build mode (`import.meta.env.DEV` vs `PROD`)

**Behavior**:
- **Production + Emulator**: BLOCKED with full-screen error, app refuses to start
- **Dev + No Emulator**: WARNING banner shown, app continues (might be intentional prod testing)
- **Dev + Emulator**: ✅ Normal dev mode
- **Production + No Emulator**: ✅ Normal prod mode

---

### 2. Hard Block Implementation

**File**: `packages/driver-app/src/firebase.ts`

Added safety checks before Firebase initialization:

```typescript
import { 
  blockEmulatorInProduction, 
  logEnvironmentStatus 
} from './utils/environmentGuard';
import { logEvent } from './utils/eventLog';

// Phase 3F: Safety Rails - Block emulator usage in production
blockEmulatorInProduction();

// Phase 3F: Log environment status on startup
const envCheck = logEnvironmentStatus();

// ... Firebase initialization ...

// Log Firebase initialization
logEvent('system', 'Firebase initialized', {
  projectId: app.options.projectId,
  isProduction: envCheck.isProduction,
  isEmulator: envCheck.isEmulator,
});
```

**Result**:
- If emulator detected in production, shows full-screen error modal
- Error cannot be dismissed - app is completely blocked
- Includes clear error messages for debugging
- Throws exception to stop further execution

**Error Screen**:
```
🚨
Critical Configuration Error

• 🚨 CRITICAL: Emulators detected in production build!
• This should NEVER happen. Check your build configuration.
• Refusing to connect to emulators in production.

This app has been blocked for safety. Contact your development team.
```

---

### 3. Environment Warning Banner

**File**: `packages/driver-app/src/components/EnvironmentWarningBanner.tsx` (NEW)

Shows prominent warning when dev environment connects to production:

```typescript
export const EnvironmentWarningBanner: React.FC = () => {
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const check = validateEnvironment();
    if (check.warnings.length > 0) {
      setWarnings(check.warnings);
    }
  }, []);

  if (warnings.length === 0 || isDismissed) {
    return null;
  }

  // Orange banner at top of screen with warnings
  // Dismissible but prominent
};
```

**Appearance**:
- Fixed position at top of screen
- Orange/amber gradient background (`#f59e0b` → `#d97706`)
- ⚠️ icon and "Environment Warning" title
- Lists all warnings from validation
- Dismissible button (user can close if intentional)
- `z-index: 999999` to appear above all content

**Added to**: `packages/driver-app/src/App.tsx` at root level

---

### 4. Event Log System

**File**: `packages/driver-app/src/utils/eventLog.ts` (NEW)

Breadcrumb-style event logging for debugging:

```typescript
export interface EventLogEntry {
  id: string;
  timestamp: number;
  category: EventCategory; // 'auth' | 'offer' | 'ride' | 'location' | 'navigation' | 'error' | 'system'
  message: string;
  details?: Record<string, any>;
}

export function logEvent(
  category: EventCategory,
  message: string,
  details?: Record<string, any>
): void {
  // Add to in-memory log (max 100 events)
  // Notify subscribers (DiagnosticsPanel)
  // Console log in dev mode with colored styling
}
```

**Features**:
- Stores last 100 events in memory (FIFO)
- Reactive - subscribers notified on changes
- Category-based with emojis (🔐 auth, 📋 offer, 🚗 ride, 📍 location, 🧭 navigation, ❌ error, ⚙️ system)
- Colored console logs in dev mode
- Export to JSON for bug reports

**API**:
- `logEvent(category, message, details?)`: Add event
- `getEvents()`: Get all events
- `getEventsByCategory(category)`: Filter by category
- `clearEvents()`: Clear all events
- `subscribeToEvents(callback)`: Listen for changes
- `exportEventsAsJSON()`: Export as JSON string

---

### 5. Enhanced DiagnosticsPanel

**File**: `packages/driver-app/src/components/DiagnosticsPanel.tsx`

Added event log section with filtering and export:

**New Imports**:
```typescript
import { 
  getEvents, 
  clearEvents, 
  exportEventsAsJSON,
  subscribeToEvents,
  EventCategory,
  EventLogEntry 
} from '../utils/eventLog';
```

**New State**:
```typescript
const [events, setEvents] = useState<EventLogEntry[]>([]);
const [filterCategory, setFilterCategory] = useState<EventCategory | 'all'>('all');

// Subscribe to event log changes
React.useEffect(() => {
  const unsubscribe = subscribeToEvents(() => {
    setEvents(getEvents());
  });
  setEvents(getEvents()); // Initial load
  return unsubscribe;
}, []);
```

**UI Features**:
1. **Category Filter Dropdown**:
   - "All Events (N)" with count
   - Individual categories: 🔐 Auth, 📋 Offers, 🚗 Rides, 📍 Location, 🧭 Navigation, ❌ Errors, ⚙️ System

2. **Event List**:
   - Scrollable list (max 300px height)
   - Each event shows:
     - Category emoji + name (colored)
     - Timestamp (relative: "5s ago", "2m ago", or absolute time)
     - Message text
     - Details JSON (if present, in code block)

3. **Action Buttons**:
   - **Export**: Copy all events as JSON to clipboard
   - **Clear**: Clear all events from log

**Appearance**:
- Dark theme matching DiagnosticsPanel
- Events separated by subtle borders
- Color-coded categories
- Monospace font for details JSON
- Empty state: "No events logged yet"

---

### 6. Event Logging Integration

Added `logEvent()` calls throughout the app at key points:

**In `firebase.ts`**:
```typescript
logEvent('system', 'Firebase initialized', {
  projectId: app.options.projectId,
  isProduction: envCheck.isProduction,
  isEmulator: envCheck.isEmulator,
});
```

**In `App.tsx` (Auth)**:
```typescript
// Sign in
if (driver) {
  logEvent('auth', 'User signed in', { uid: driver.uid, email: driver.email });
} else {
  logEvent('auth', 'User signed out');
}

// New user created
logEvent('system', 'Created new user document', { uid: driver.uid });
```

**In `App.tsx` (Offers)**:
```typescript
// Offer received
logEvent('offer', `Received ${driverOffers.length} offer(s)`, { count: driverOffers.length });

// Processing individual offer
logEvent('offer', `Processing offer ${rideId}`, { 
  status: offer.status, 
  expiresAtMs: offer.expiresAtMs 
});
```

**Future Integration Points** (add as needed):
- Ride acceptance: `logEvent('ride', 'Accepted ride', { rideId })`
- Ride status changes: `logEvent('ride', 'Status changed', { rideId, oldStatus, newStatus })`
- Navigation: `logEvent('navigation', 'Opened navigation', { destination })`
- Location updates: `logEvent('location', 'GPS fix acquired', { lat, lng })`
- Errors: `logEvent('error', 'Failed to accept ride', { rideId, error })`

---

## 🧪 Testing Checklist

### Environment Guard Tests

- [ ] **Dev + Emulator (Normal)**:
  ```bash
  npm run dev
  # Open http://localhost:5173
  # ✅ No warnings, normal operation
  # ✅ Console shows "EMULATOR MODE ACTIVE"
  # ✅ Event log shows "Firebase initialized" with isEmulator: true
  ```

- [ ] **Production + No Emulator (Normal)**:
  ```bash
  npm run build
  npm run preview
  # ✅ No warnings, normal operation
  # ✅ Console shows "PRODUCTION MODE"
  # ✅ DiagnosticsPanel hidden (PROD)
  ```

- [ ] **Production + Emulator (BLOCKED)**:
  ```bash
  # In .env:
  # VITE_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
  
  npm run build
  npm run preview
  
  # ❌ Should show full-screen error
  # ❌ App completely blocked
  # ❌ Error: "Emulators detected in production build!"
  # ❌ Cannot proceed
  ```

- [ ] **Dev + No Emulator (WARNING)**:
  ```bash
  # Comment out emulator env vars in .env
  npm run dev
  
  # ⚠️ Orange warning banner at top
  # ⚠️ "Development mode but NOT using emulators"
  # ⚠️ "You may be connected to PRODUCTION Firebase!"
  # ✅ App still works (dismissible warning)
  # ✅ Console shows red warnings
  ```

### Event Log Tests

- [ ] **Log Visibility**:
  - Open DiagnosticsPanel (dev only)
  - See "📝 Event Log (Phase 3F)" section
  - Events appear in real-time as actions occur

- [ ] **Category Filter**:
  - Change filter dropdown to "🔐 Auth"
  - Only auth events visible
  - Change to "📋 Offers"
  - Only offer events visible
  - Change to "All Events"
  - All events visible

- [ ] **Event Details**:
  - Each event shows category, message, timestamp
  - Events with `details` show JSON code block
  - Timestamps show relative time ("5s ago")
  - After 1 hour, shows absolute time

- [ ] **Export Events**:
  - Click "Export" button
  - Toast shows "Copied Event Log JSON"
  - Paste clipboard - should be valid JSON array
  - Contains all events with full details

- [ ] **Clear Events**:
  - Click "Clear" button
  - Toast shows "Event log cleared"
  - Event list shows "No events logged yet"
  - Log clears in console too

- [ ] **Real-time Updates**:
  - Sign out
  - See "User signed out" event appear immediately
  - Sign in
  - See "User signed in" event appear
  - Go online
  - See offer events appear as they're received

### Integration Tests

- [ ] **Full Flow with Event Log**:
  1. Open DiagnosticsPanel
  2. Sign in → see auth event
  3. Go online → see system event
  4. Receive offer → see offer event
  5. Accept offer → (future: see ride event)
  6. Export log → verify all events captured
  7. Clear log → verify cleared
  8. Close DiagnosticsPanel

- [ ] **Environment Warning Dismissal**:
  1. Start dev mode without emulators
  2. See orange warning banner
  3. Click "Dismiss" button
  4. Banner disappears
  5. Refresh page
  6. Banner reappears (not persisted across sessions)

---

## 📖 Usage Guide

### For Developers

**Viewing Event Logs**:
1. Run app in dev mode: `npm run dev`
2. Click "🔧 Diagnostics" button (bottom right)
3. Scroll to "📝 Event Log (Phase 3F)" section
4. Use dropdown to filter by category
5. Click "Export" to copy JSON for bug reports

**Adding New Events**:
```typescript
import { logEvent } from './utils/eventLog';

// Simple event
logEvent('ride', 'Ride accepted');

// With details
logEvent('ride', 'Ride accepted', { 
  rideId: '12345', 
  driverId: 'abc', 
  fareAmount: 15.50 
});

// Error logging
logEvent('error', 'Failed to accept ride', { 
  rideId, 
  error: error.message 
});
```

**Categories**:
- `'auth'`: Authentication events (sign in/out)
- `'offer'`: Ride offer events (received, processed, expired)
- `'ride'`: Active ride events (accept, start, complete, cancel)
- `'location'`: GPS/location events (fix acquired, lost, updated)
- `'navigation'`: Navigation events (opened maps, routing)
- `'error'`: Error events (API failures, validation errors)
- `'system'`: System events (Firebase init, config changes)

### For QA/Testing

**Checking Environment Safety**:
1. Open browser console
2. Look for "━━━ Environment Validation ━━━" banner
3. Verify:
   - Production: true/false
   - Emulators: true/false
   - Valid: ✅/❌

**Reporting Bugs with Event Log**:
1. Reproduce the bug
2. Open DiagnosticsPanel
3. Click "Export" in Event Log section
4. Paste exported JSON in bug report
5. Include timestamp of bug occurrence

**Testing Production Safety**:
- Try to deploy with emulator env vars → should fail build
- Try to run preview build with emulator → should show error screen
- Verify production builds never connect to localhost

---

## 🏗️ Architecture

### Flow Diagram

```
App Start
    ↓
firebase.ts imports environmentGuard
    ↓
blockEmulatorInProduction()
    ↓
    ├─ Production + Emulator? → BLOCK (full-screen error)
    └─ Valid? → Continue
    ↓
logEnvironmentStatus()
    ↓
    ├─ Dev + No Emulator? → Add warning
    └─ Log to console
    ↓
Initialize Firebase
    ↓
logEvent('system', 'Firebase initialized')
    ↓
App.tsx renders
    ↓
    ├─ <EnvironmentWarningBanner /> (shows warnings)
    ├─ <DiagnosticsPanel /> (dev only, shows event log)
    └─ Rest of app
    ↓
User actions trigger logEvent() calls
    ↓
Events stored in eventLog (max 100)
    ↓
DiagnosticsPanel subscribes and updates
```

### Data Flow

```
User Action (e.g., sign in)
    ↓
logEvent('auth', 'User signed in', { uid, email })
    ↓
eventLog.ts
    ├─ Create EventLogEntry with unique ID, timestamp
    ├─ Add to eventLog array (FIFO, max 100)
    ├─ Notify all subscribers
    └─ Console log (dev only, colored)
    ↓
DiagnosticsPanel subscription fires
    ↓
setEvents(getEvents())
    ↓
UI re-renders with new event
    ↓
Event appears in list immediately
```

---

## 🔒 Security Considerations

1. **Event Log Data**:
   - Stored in memory only (not persisted)
   - Cleared on page refresh
   - DiagnosticsPanel only visible in DEV
   - Don't log sensitive data (tokens, passwords, PII)

2. **Environment Checks**:
   - Hard blocks cannot be bypassed (full app stop)
   - Warnings are client-side hints (not security)
   - Always verify production config in Firebase Console

3. **Export Caution**:
   - Exported logs may contain user IDs, ride IDs
   - Sanitize before sharing publicly
   - Use for internal debugging only

---

## 📊 Console Output Examples

### Dev Mode + Emulator (Normal)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 [Safety Check] Environment Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Production: false
   Emulators: true
   Valid: ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 [Firebase] EMULATOR MODE ACTIVE
   Environment: DEV + LOCALHOST
   Auth Emulator: 127.0.0.1:9099
   Firestore Emulator: 127.0.0.1:8081
   Functions Emulator: 127.0.0.1:5002
   Storage Emulator: 127.0.0.1:9199
   ⚠️  All data is LOCAL - not touching production!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️ [SYSTEM] Firebase initialized { projectId: "shiftx-95c4b", isProduction: false, isEmulator: true }
```

### Dev Mode + No Emulator (Warning)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 [Safety Check] Environment Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Production: false
   Emulators: false
   Valid: ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ WARNINGS:
   ⚠️ WARNING: Development mode but NOT using emulators
   You may be connected to PRODUCTION Firebase!
   All changes will affect LIVE data.
   Start emulators or switch to production build.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Production + Emulator (BLOCKED)
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 [Safety Check] Environment Validation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Production: true
   Emulators: true
   Valid: ❌
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ ERRORS:
   🚨 CRITICAL: Emulators detected in production build!
   This should NEVER happen. Check your build configuration.
   Refusing to connect to emulators in production.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Uncaught Error: BLOCKED: 🚨 CRITICAL: Emulators detected in production build! | This should NEVER happen. Check your build configuration. | Refusing to connect to emulators in production.
```

---

## 🐛 Troubleshooting

### "Environment Warning" banner won't go away

**Cause**: Dev mode without emulators (might be connecting to prod)

**Fix**:
1. Check `.env` file has emulator env vars
2. Verify Firebase emulators running: `firebase emulators:start`
3. Check `window.location.hostname` is `localhost` or `127.0.0.1`
4. If intentional prod testing, dismiss banner (will reappear on refresh)

### DiagnosticsPanel not showing

**Cause**: Production build

**Fix**: DiagnosticsPanel only visible in DEV mode (`npm run dev`)

### Events not appearing in log

**Cause**: `logEvent()` not called, or DiagnosticsPanel not subscribed

**Fix**:
1. Check `logEvent()` import and call syntax
2. Verify console shows event (dev only)
3. Open/close DiagnosticsPanel to re-subscribe
4. Check browser console for errors

### Full-screen error on production

**Cause**: Emulator env vars set in production build

**Fix**:
1. Remove emulator env vars from `.env.production`
2. Verify build command doesn't include emulator config
3. Clear browser cache
4. Rebuild: `npm run build && npm run preview`

### Event log not clearing

**Cause**: Multiple DiagnosticsPanel instances or stale subscriptions

**Fix**:
1. Close and reopen DiagnosticsPanel
2. Refresh page
3. Check console for subscription errors

---

## 🚀 Future Enhancements

1. **Event Log Persistence**:
   - Save last 50 events to localStorage
   - Survive page refreshes
   - Configurable retention policy

2. **Advanced Filtering**:
   - Search/filter by message text
   - Date range filtering
   - Severity levels (info, warn, error)

3. **Event Replay**:
   - Click event to see app state at that time
   - "Jump to" feature for debugging

4. **Remote Logging**:
   - Optional: send events to logging service (Sentry, LogRocket)
   - Only for critical errors
   - Opt-in for privacy

5. **Performance Metrics**:
   - Log event timing (e.g., "Firebase initialized in 123ms")
   - Track render times, API call durations

6. **Event Correlation**:
   - Link related events (e.g., offer → accept → start → complete)
   - Show event chains/flows

---

## 📝 Summary

Phase 3F adds three critical safety and debugging features:

1. **Hard Block**: Prevents emulator usage in production (full app stop)
2. **Warning Banner**: Alerts when dev mode connects to production
3. **Event Log**: Breadcrumb-style debugging with real-time updates in DiagnosticsPanel

**Key Files**:
- `utils/environmentGuard.ts`: Environment validation and blocking
- `utils/eventLog.ts`: Event logging system
- `components/EnvironmentWarningBanner.tsx`: Warning UI
- `components/DiagnosticsPanel.tsx`: Enhanced with event log viewer
- `firebase.ts`: Safety checks on initialization
- `App.tsx`: Event logging integration

**Result**: Developers can safely work in dev, QA can debug with event logs, production is protected from misconfiguration.

**Next Steps**: Add more `logEvent()` calls throughout the app as needed, especially for ride lifecycle events (accept, start, arrive, complete, cancel).
