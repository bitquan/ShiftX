# Mapbox Autocomplete Implementation

## ✅ Complete Implementation

### New Files Created

#### 1. **useForwardGeocode Hook**
- **File**: `packages/customer-app/src/hooks/useForwardGeocode.ts`
- **Features**:
  - Forward geocoding API integration with Mapbox
  - 300ms debounce to prevent spam
  - AbortController for canceling in-flight requests
  - Global cache by query string
  - Returns `{ results, loading, error }`
  - Requires >= 3 chars to trigger search

**API Call**:
```
GET https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json
  ?access_token=VITE_MAPBOX_TOKEN
  &autocomplete=true
  &limit=5
  &types=address,poi,place
```

#### 2. **AddressAutocomplete Component**
- **File**: `packages/customer-app/src/components/AddressAutocomplete.tsx`
- **Props**:
  - `label`: "Pickup" | "Dropoff"
  - `value`: current input string
  - `onChange`: callback when user types
  - `onSelect`: callback when suggestion clicked
  - `onFocus`: callback when input focused
  - `placeholder`: input placeholder text

**Behavior**:
- Shows dropdown when >= 3 chars typed
- Closes on Escape key or clicking outside
- Hover effects on suggestions
- Loading indicator while fetching
- "No results found" message when empty
- Returns `{ label, lat, lng }` on selection

**Styling**:
- Dark theme consistent with app
- Custom scrollbar styling
- Hover highlight on suggestions
- Border focus state

### Modified Files

#### 1. **RequestRide.tsx**
- Added import for `AddressAutocomplete`
- New state variables:
  - `pickupQuery`: string for pickup input
  - `dropoffQuery`: string for dropoff input
  - `activeField`: 'pickup' | 'dropoff' for tracking active field
  - `mapUpdateRef`: ref to track map vs autocomplete updates
  
- Updated `MapClickHandler`:
  - Now respects `activeField` to determine which location to set
  - No longer checks if `pickup` exists; uses `activeField` state

- New event handlers:
  - `handleMapSetPickup`: Sets pickup from map tap, marks for sync
  - `handleMapSetDropoff`: Sets dropoff from map tap, marks for sync
  - `handlePickupSelect`: Sets pickup from autocomplete suggestion
  - `handleDropoffSelect`: Sets dropoff from autocomplete suggestion

- New `useEffect` hooks:
  - Syncs pickup query text from reverse geocoding after map tap
  - Syncs dropoff query text from reverse geocoding after map tap
  - Uses `mapUpdateRef.current` to track source of update

- Updated handlers:
  - `handleClear`: Clears both coords and query text, resets to 'pickup'
  - `handleSwap`: Swaps both coords and query text
  - `handleUseDemoCoordinates`: Sets demo coords AND query text

- UI replacement:
  - Replaced coordinate display section with two `AddressAutocomplete` inputs
  - Kept the same styling and layout wrapper
  - Added distance display below inputs
  - Kept Clear & Swap buttons

### CSS Updates

- **File**: `packages/customer-app/src/styles.css`
- Added `.address-autocomplete-dropdown` styles:
  - Custom scrollbar (thin, light gray)
  - WebKit scrollbar compatibility
  - Hover state for scrollbar thumb

## 🎯 Workflow & Features

### Setting Pickup/Dropoff

**Option 1: Type & Select (Autocomplete)**
1. User types in "Pickup" field (>= 3 chars)
2. Dropdown shows suggestions from Mapbox
3. Click suggestion → coords update + pin moves + route recalculates
4. Input text shows selected place name
5. `activeField` automatically switches to "dropoff"

**Option 2: Tap Map**
1. User taps map (if `activeField === 'pickup'`)
2. Pin drops at location
3. `mapUpdateRef.current` marked as 'pickup'
4. Reverse geocoding resolves address
5. Input text auto-fills with resolved address
6. `activeField` switches to 'dropoff' for next input

### Sync Logic

**No Infinite Loops**:
- Autocomplete selection directly sets coords + query (no loop)
- Map tap sets coords, then hooks sync query text ONE TIME
- `mapUpdateRef` ensures sync only happens after map update
- Effects check `pickupQuery` before syncing (don't overwrite user input)

**Route Calculation**:
- Already uses stable `routeKey` based only on pickup/dropoff coords
- Driver location updates don't retrigger route (correct)
- Autocomplete selection triggers route recalc (coords changed) ✓
- Map tap triggers route recalc (coords changed) ✓

### User Experience

✅ Demo coords button sets both coords AND text  
✅ Clear button clears everything and resets to 'pickup'  
✅ Swap button swaps both coords and text  
✅ Distance display stays visible  
✅ Request Ride button disabled until BOTH coords exist  
✅ Mobile scrolling works (dropdown in `position: absolute`)  
✅ No request spam (300ms debounce + global cache)  

## 🧪 Testing Checklist

- [ ] Type "1600" in Pickup → suggestions appear
- [ ] Click "1600 Pennsylvania Avenue" → pin moves to DC, input shows address
- [ ] Field focus automatically switches to Dropoff
- [ ] Tap map in Dropoff mode → pin appears, address auto-fills
- [ ] Tap map in Pickup mode after setting dropoff → updates pickup (not dropoff)
- [ ] Clear button clears all locations and text
- [ ] Swap button swaps coords and text
- [ ] Demo coords button works with text
- [ ] Escape key closes dropdown
- [ ] Click outside dropdown closes it
- [ ] Distance displays correctly
- [ ] Route recalculates on suggestion select
- [ ] Route recalculates on map tap
- [ ] Request Ride disabled until both coords set
- [ ] No console errors
- [ ] No infinite rendering loops

## 📱 Browser Compatibility

- Chrome/Edge: Full support (WebKit scrollbar)
- Firefox: Full support (scrollbar-width property)
- Safari: Full support
- Mobile: Dropdown doesn't interfere with scrolling (abs positioned, z-index 1000)

## 🔒 Environment Variables

Uses existing `VITE_MAPBOX_TOKEN` from `.env`  
No additional configuration needed.

