# Driver UI Phase 2: BottomSheet with 2-Snap States

**Date:** January 19, 2026  
**Status:** ✅ Complete  
**Branch:** ios/customer-driver-sync-fix

## Overview

Phase 2 introduces a draggable bottom sheet with **2-snap states only** (collapsed/expanded) and state-driven UI rendering. This builds on Phase 1's MapShell full-screen layout while keeping all existing backend logic intact.

## Key Changes

### 1. BottomSheet Component (`src/components/BottomSheet.tsx`)

A reusable 2-snap bottom sheet with:
- **Pixel-based snap heights** (not percentage)
  - `collapsed: 160px` - Compact summary row (increased to show Go Offline button)
  - `expanded: min(62% of viewport, viewport - safeTop - 16)` - Full details
- **visualViewport API** integration for keyboard handling
- **Snap decision logic:** Released above midpoint → expand, below → collapse
- **Map interaction handling:** Disables map pointer events during drag (via `html.dragging-sheet` class)

**No 3-snap, no mid-point, no stuck states.**

### 2. State Mapping (`src/utils/mapDriverUiState.ts`)

Pure function `mapDriverUiState()` that maps existing driver state to UI content:

```typescript
interface DriverUiState {
  profile, hasActiveRide, activeRideId, pendingOffers,
  onlineState, isTransitioning, gpsStatus, currentLocation, gpsError
}

interface MappedUiContent {
  mode: 'offline' | 'idle' | 'offer' | 'assigned' | ...
  title: string
  subtitle: string
  primaryActions: UiAction[]
  secondaryInfo?: string
}
```

**State mappings (UI only, no backend changes):**
- `offline` → "You're Offline" + "Go Online" button
- `going_online` → "Going Online" + "Connecting..."
- `online` + no offers → "Online" + "Waiting for ride requests..."
- `online` + GPS error → "GPS Issue" + error message
- `offer` → "New Ride Request" + Accept/Decline buttons (TODO: wire to handlers)
- `assigned` (hasActiveRide) → "Active Ride" + View details (TODO: Phase 3 ride state listener)

### 3. Collapsed View (`src/components/DriverSheetCollapsed.tsx`)

Compact one-line summary:
- Status icon (⚫️ offline, 🟡 transitioning, 🟢 online, ⚠️ GPS error, 🔔 offer, 🚗 active ride)
- Title + subtitle from mapped state
- Primary action button (Go Online/Go Offline)
- Offer badge (animated) if pending offers exist

### 4. Expanded View (`src/components/DriverSheetExpanded.tsx`)

Full details:
- **DriverStatusCard** (GPS status, location, online toggle)
- **Current Work card** (dynamically shows mapped UI state)
  - Renders `title`, `subtitle`, `secondaryInfo`, `primaryActions`
  - Displays TODO badges for unimplemented handlers
- **Quick Actions card** (when idle: Ride History, Profile)
- **Dev Tools card** (only in development: Create Test Ride, Spawn Drivers, etc.)

### 5. Camera Mode Toggle (`src/components/CameraToggle.tsx`)

Floating toggle pill (top-right):
- **Follow mode** (📍): Center on driver, stable zoom
- **Overview mode** (🗺️): Fit bounds for route (only shown when `hasActiveRoute = true`)

**Phase 2 implementation:** UI only, camera logic placeholder for Phase 3.

### 6. Integration (`src/components/DriverHome.tsx`)

Updated to use:
```tsx
<BottomSheet
  defaultSnap="collapsed"
  collapsedContent={<DriverSheetCollapsed ... />}
  expandedContent={<DriverSheetExpanded ... />}
/>
```

Removed `DriverBottomPanel` (old fixed panel from Phase 1).

## Snap Height Calculations

```typescript
const vvh = window.visualViewport?.height ?? window.innerHeight;
const safeTop = 44; // iOS status bar estimate

collapsed: 160px fixed
expanded: Math.min(0.62 * vvh, vvh - safeTop - 16)
translateY: vvh - panelHeight
```

### 7. iOS-Safe Scroll Implementation

**Critical fix for bottom sheet scrolling (Jan 19, 2026):**

The bottom sheet content area is fully scrollable on both desktop and iOS devices. This required careful CSS flex layout and touch-action configuration:

**CSS Architecture:**
```css
/* Parent: flex container */
.driver-bottom-sheet {
  display: flex;
  flex-direction: column;
}

/* Drag handle: prevents scrolling */
.sheet-drag-handle {
  touch-action: none; /* Drag only, no scroll */
}

/* Content area: enables scrolling */
.sheet-content {
  flex: 1 1 auto;
  min-height: 0; /* CRITICAL: enables flex child to shrink and scroll */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch; /* iOS momentum scrolling */
  touch-action: pan-y !important; /* Force vertical scroll gestures */
}

/* State-specific overrides */
.collapsed .sheet-content { overflow-y: hidden; }
.expanded .sheet-content { overflow-y: auto !important; }
```

**Touch Event Handling:**
```typescript
// In BottomSheet.tsx
const handleTouchMove = (e: TouchEvent) => {
  if (!isDragging) return; // CRITICAL: Let browser handle scroll when not dragging
  e.preventDefault(); // Only block scroll when actively dragging handle
  // ... drag logic
};
```

**Key Insights:**
- Flex children need `min-height: 0` to become scrollable (counter-intuitive CSS behavior)
- `touch-action` API separates drag gestures (handle) from scroll gestures (content)
- Only call `preventDefault()` when actively dragging to avoid blocking native scroll
- iOS requires `-webkit-overflow-scrolling: touch` for momentum scrolling
- Works consistently in both online and offline states (identical layout structure)

On `visualViewport` resize/scroll (keyboard open/close), positions are recalculated and re-applied.

## What Phase 2 Does NOT Do

**No backend changes:**
- ✅ Kept all existing Firestore listeners
- ✅ Kept `useHeartbeat` hook
- ✅ Kept `driverSetOnline` callable
- ✅ Kept offer/ride state logic

**No new flows:**
- Accept/Decline buttons are rendered as **disabled with TODO tooltips**
- Active ride state shows generic "Active Ride" card (no nav yet)
- Phase 3 will wire these to actual handlers

**No old screen removal yet:**
- Phase 1/2 focused on layout + mapping
- Phase 3 will remove old full-page ride screens if they exist

## Files Created/Modified

### Created:
- `src/components/BottomSheet.tsx` - 2-snap draggable sheet
- `src/components/bottomSheet.css` - Sheet styling
- `src/components/DriverSheetCollapsed.tsx` - Collapsed view
- `src/components/DriverSheetExpanded.tsx` - Expanded view
- `src/components/driverSheetContent.css` - Content styling
- `src/components/CameraToggle.tsx` - Camera mode toggle
- `src/components/cameraToggle.css` - Toggle styling
- `src/utils/mapDriverUiState.ts` - State mapping function

### Modified:
- `src/components/DriverHome.tsx` - Integrated BottomSheet, added camera mode state
- `packages/driver-app/vite.config.ts` - Port 5174 (was conflicting with admin)
- `packages/admin-dashboard/vite.config.ts` - Port 5175
- `packages/customer-app/vite.config.ts` - Port 5173 (documented)

### Deprecated (not deleted):
- `src/components/DriverBottomPanel.tsx` - Old fixed panel from Phase 1

## Testing Checklist

- [x] Build succeeds (`npm run build`)
- [x] Collapsed state shows compact summary (160px height)
- [x] Expanded state shows full details (scrollable)
- [x] Drag up/down snaps correctly (no stuck states)
- [x] Map interaction disabled during drag
- [x] Keyboard open/close adjusts sheet position (visualViewport)
- [x] Camera toggle appears (UI placeholder for Phase 3)
- [x] Dev tools card shows in development mode
- [x] Go Online/Offline buttons accessible in collapsed state
- [x] State transitions update UI (offline → online → idle)
- [x] Bottom sheet content scrolls on iOS (momentum scrolling)
- [x] Scroll works in both online and offline states
- [x] Diagnostics button draggable with position persistence
- [ ] Pending offers show "New Request" badge (not tested with real offers yet)
- [ ] Active ride shows in UI (not tested with real ride yet)

## Phase 3 Preview

**What Phase 3 will add:**
1. **Wire offer handlers:** Accept/Decline buttons call existing functions
2. **Ride state listener:** Real-time ride status (en_route_to_pickup, arrived, etc.)
3. **Navigation UI:** Show pickup/dropoff markers, route polyline
4. **Camera mode logic:** 
   - Follow: `map.setView(driverLatLng, zoom)`
   - Overview: `map.fitBounds(routeBounds, { paddingBottomRight: [0, panelHeight] })`
5. **Remove old screens:** Delete any legacy full-page ride status screens
6. **Polish:** Animations, haptics, error states

**Phase 2 → Phase 3 transition:**
- Replace `hasActiveRoute = false` with actual ride state check
- Replace TODO buttons with real handlers
- Add `useEffect` to listen to active ride document
- Map ride state → UI mode (assigned, en_route_pickup, arrived, etc.)

## Known Limitations (Acceptable for Phase 2)

- Offer buttons are disabled (TODO tooltips)
- Active ride shows generic card (no nav details)
- Camera toggle is hidden (no active route yet)
- Ride addresses hardcoded as "Pickup/Dropoff location"
- No estimated fare display (RideOffer type doesn't have it yet)

These are **intentional** - Phase 2 is UI-only. Backend wiring comes in Phase 3.

## Architecture Notes

### Why 2-snap only?
- Simpler UX: User knows exactly where sheet will land
- No "stuck in the middle" bugs
- Clear intent: Collapsed = glance, Expanded = interact
- Follows iOS design patterns (Maps, Shortcuts, etc.)

### Why pixel heights instead of percentages?
- More predictable on different screen sizes
- Easier to account for safe areas
- Avoids vh/vvh percentage rounding issues
- Better for visualViewport integration

### Why separate Collapsed/Expanded components?
- Clear separation of concerns
- Avoids conditional rendering complexity in one mega-component
- Easier to optimize (React.memo, etc.)
- Better for testing each view independently

## Commit Message

```
feat(driver): Phase 2 - BottomSheet with 2-snap states + state-driven UI

- Add 2-snap BottomSheet (collapsed/expanded, no mid-point)
- Add state mapping function (mapDriverUiState)
- Add collapsed/expanded view components
- Add camera mode toggle (UI only, logic in Phase 3)
- Update DriverHome to use BottomSheet
- Fix port conflicts (driver 5174, admin 5175, customer 5173)
- Keep all existing backend logic intact (UI changes only)

Phase 3 will wire offer handlers, ride state listeners, and navigation.
```

## Deployment & Testing

### Development
1. Start Firebase Emulators: `firebase emulators:start --only auth,functions,firestore,storage`
2. Start Driver App: `cd packages/driver-app && npm run dev`
3. Visit: `http://localhost:5174`
4. Test drag up/down, scroll content, drag diagnostics button

### Production
- Build: `cd packages/driver-app && npm run build`
- Deploy: `firebase deploy --only hosting:driver`
- URL: `https://shiftx-95c4b-driver.web.app`

### Ports
- Customer App: 5173
- Driver App: 5174
- Admin Dashboard: 5175

## Troubleshooting

### Bottom Sheet Won't Scroll
- **Symptom:** Content doesn't scroll when expanded
- **Cause:** Missing `min-height: 0` on `.sheet-content`
- **Fix:** Ensure `bottomSheet.css` has flex layout with `min-height: 0`

### Scroll Interferes with Drag
- **Symptom:** Can't drag handle on touch devices
- **Cause:** `touch-action` not properly separated
- **Fix:** Handle has `touch-action: none`, content has `touch-action: pan-y`

### Diagnostics Button Overlaps Sheet
- **Symptom:** Button covers collapsed view buttons
- **Cause:** Z-index conflict
- **Fix:** Diagnostics z-index 50, bottom sheet z-index 100, positioned bottom-right

### Port Conflicts
- **Symptom:** Dev server won't start
- **Cause:** Port already in use
- **Fix:** Check `vite.config.ts` ports (customer 5173, driver 5174, admin 5175)

---

**Phase 2 Status:** ✅ Complete (Jan 19, 2026)  
**Deployed:** Localhost only (production deployment pending)  
**Next:** Phase 3 - Wire handlers, ride state listener, navigation UI
