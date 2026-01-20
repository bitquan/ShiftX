# Phase 3A: Single Screen MapShell

**Goal**: Remove the separate "ActiveRide" screen and consolidate all driver UI states into MapShell with bottom sheet.

## What Changed

### Routes Removed

**Before**: App had 3 states via `appState` enum:
- `'auth'` - Auth gate
- `'home'` - Main MapShell with navigation
- `'active-ride'` - Full-screen active ride component (REMOVED)

**After**: App has 2 states:
- `'auth'` - Auth gate  
- `'home'` - MapShell handles all ride states internally

No explicit routes existed (state-based navigation only), but the `'active-ride'` state transition has been eliminated.

### Components Modified

1. **App.tsx**
   - Removed `AppState = 'auth' | 'home' | 'active-ride'` → now `'auth' | 'home'`
   - Removed `<ActiveRide>` component rendering
   - Updated navigation state machine to never transition to `'active-ride'`
   - Removed `ActiveRide` import
   - `handleViewActiveRide()` now a no-op (bottom sheet handles display)

2. **DriverHome.tsx**
   - Added `ActiveRideSheet` import
   - Updated `BottomSheet` content to conditionally render:
     - **With active ride**: `<ActiveRideSheet>` for both collapsed/expanded
     - **Without active ride**: `<DriverSheetCollapsed>` / `<DriverSheetExpanded>` (existing behavior)
   - Bottom sheet now defaults to `"expanded"` snap when active ride exists

3. **ActiveRideSheet.tsx** (NEW)
   - Extracted UI from `ActiveRide.tsx` into compact sheet-friendly component
   - Shows: ride status, customer info, pickup/dropoff addresses, action buttons
   - Actions: Navigate, Start/Begin/Complete ride, Cancel
   - Same logic as `ActiveRide` but optimized for bottom sheet layout
   - Receives `driverLocation` from parent (no separate heartbeat)

### Where Ride UI Now Lives

**Location**: `MapShell` → `BottomSheet` → `<ActiveRideSheet>`

**UI State Mapping**:

| Driver State | Bottom Sheet Content |
|-------------|---------------------|
| Offline idle | `DriverSheetCollapsed` / `DriverSheetExpanded` |
| Online idle | `DriverSheetCollapsed` / `DriverSheetExpanded` |
| Pending offer | `DriverSheetCollapsed` / `DriverSheetExpanded` (shows offer in card) |
| **Active ride** | `ActiveRideSheet` (both collapsed & expanded) |
| En-route pickup | `ActiveRideSheet` |
| On-trip | `ActiveRideSheet` |
| Completed | Returns to idle state |

**Map Behavior**:
- Map remains visible and interactive always
- Camera continues following driver (Phase 2C-1)
- Bottom sheet slides up/down but doesn't cover entire screen

## Testing

### Quick Test Flow

1. **Start app → MapShell idle**
   ```
   ✓ Map visible
   ✓ Bottom sheet collapsed shows driver status
   ✓ Can go online/offline
   ```

2. **Receive ride request → Request UI in bottom sheet**
   ```
   ✓ Map still visible
   ✓ Bottom sheet shows offer card with Accept/Decline
   ✓ No screen change
   ```

3. **Accept ride → Active ride UI in bottom sheet**
   ```
   ✓ Map still visible
   ✓ Bottom sheet expands automatically
   ✓ Shows customer info, addresses, "Start Ride" button
   ✓ No screen change
   ```

4. **Navigate through ride states**
   ```
   ✓ Start Ride → sheet updates to "Begin Trip"
   ✓ Begin Trip → sheet updates to "Complete Ride"
   ✓ Complete Ride → sheet returns to idle
   ✓ Map visible throughout all transitions
   ✓ Camera follows driver position continuously
   ```

5. **Cancel ride**
   ```
   ✓ Cancel button works from bottom sheet
   ✓ Returns to idle state
   ✓ No navigation issues
   ```

### iOS Simulator Steps

```bash
# From packages/driver-app
npm run dev

# In browser (Chrome/Safari):
# 1. Go to http://localhost:5174
# 2. Sign in as driver
# 3. Go online
# 4. Create test ride (Dev Tools)
# 5. Accept offer
# 6. Verify map stays visible
# 7. Verify bottom sheet shows active ride
# 8. Test Start → Begin → Complete flow
```

## Implementation Details

### Design Decisions

**Why keep map always visible?**
- Drivers need continuous spatial awareness
- GPS tracking continues throughout ride (Phase 2C-1)
- Reduces cognitive load (no context switching)

**Why reuse ActiveRide logic?**
- Avoid duplicating state management
- Preserve existing ride flow/actions
- Minimal risk of bugs in critical path

**Why expand sheet by default for active rides?**
- More space for ride details and actions
- Critical information (customer, addresses) always visible
- User can still collapse if needed

### Future Enhancements

- [ ] Add route polyline to map during active ride
- [ ] Auto-collapse sheet when driver completes ride
- [ ] Swipe gestures for quick actions
- [ ] Live ETA updates in collapsed view
- [ ] Customer photo in collapsed sheet

## Migration Notes

### Breaking Changes
- `handleViewActiveRide()` no longer navigates to separate screen (safe to call, does nothing)
- `appState === 'active-ride'` condition removed from App.tsx

### Backwards Compatibility
- All existing actions still work (Accept, Start, Cancel, etc.)
- Ride state machine unchanged
- Backend/Firestore schema unchanged
- Deep links not affected (no explicit routes existed)

### Dead Code
- `ActiveRide.tsx` - Still exists but no longer imported/rendered
- Can be safely deleted after Phase 3A is stable
- Consider archiving for reference before deletion

## Related Documentation

- [Phase 2C-1: GPS Always-Follow Camera](../DRIVER_GPS_PHASE2C1.md)
- [Bottom Sheet Architecture](./BOTTOM_SHEET.md)
- [MapShell Layout System](./MAPSHELL_LAYOUT.md)
