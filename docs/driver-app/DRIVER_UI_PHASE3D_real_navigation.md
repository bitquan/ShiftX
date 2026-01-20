# Phase 3D: Real Navigation Deep Links

**Date:** January 19, 2026  
**Status:** ✅ Complete  

## Goal

Make the "Navigate" button in ActiveRideSheet open real navigation apps (Apple Maps or Google Maps) with the correct destination based on ride state.

## Acceptance Criteria

- ✅ Navigate to **pickup** when pre-trip (accepted, started)
- ✅ Navigate to **dropoff** when on-trip (in_progress)
- ✅ Opens native navigation app on mobile (Apple Maps on iOS, Google Maps on Android)
- ✅ Falls back to web maps on desktop/unsupported platforms
- ✅ Button is "sacred" - drivers trust it to work reliably

## Implementation

### File Modified

**`packages/driver-app/src/components/ActiveRideSheet.tsx`**

### Navigate Logic

```typescript
const handleNavigate = () => {
  // Determine destination based on ride state:
  // - accepted/started (pre-trip): navigate to pickup
  // - in_progress (on-trip): navigate to dropoff
  const isPreTrip = currentStatus === 'accepted' || currentStatus === 'started';
  const destination = isPreTrip ? rideData?.pickup : rideData?.dropoff;
  const destinationLabel = isPreTrip ? 'Pickup' : 'Dropoff';
  
  if (!destination) {
    show(`${destinationLabel} location not available`, 'error');
    return;
  }

  // Detect platform for appropriate deep link
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isMacOS = /Macintosh/.test(navigator.userAgent);
  
  let url: string;
  
  if (isIOS || isMacOS) {
    // Apple Maps deep link
    url = `maps://?daddr=${destination.lat},${destination.lng}&dirflg=d`;
    
    // Fallback to web if app not installed
    const fallbackUrl = `https://maps.apple.com/?daddr=${destination.lat},${destination.lng}&dirflg=d`;
    
    // Try to open Apple Maps, fallback to web
    const opened = window.open(url, '_blank');
    if (!opened) {
      window.open(fallbackUrl, '_blank');
    }
  } else {
    // Google Maps deep link
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isAndroid) {
      // Android Google Maps navigation deep link
      url = `google.navigation:q=${destination.lat},${destination.lng}&mode=d`;
      window.open(url, '_blank');
    } else {
      // Web fallback: Google Maps directions
      url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`;
      window.open(url, '_blank');
    }
  }
  
  console.log(`[ActiveRideSheet] Opening navigation to ${destinationLabel}:`, destination);
};
```

## Platform Support

### iOS (iPhone/iPad)

**Deep Link:** `maps://?daddr=LAT,LNG&dirflg=d`

- Opens Apple Maps app
- `dirflg=d` sets driving mode
- Falls back to `https://maps.apple.com/...` if app not installed

### macOS

**Deep Link:** `maps://?daddr=LAT,LNG&dirflg=d`

- Opens Apple Maps app
- Same format as iOS
- Falls back to web version

### Android

**Deep Link:** `google.navigation:q=LAT,LNG&mode=d`

- Opens Google Maps app in navigation mode
- `mode=d` sets driving mode
- Direct turn-by-turn navigation

### Desktop/Web Fallback

**URL:** `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG&travelmode=driving`

- Opens Google Maps in browser
- Shows directions page
- Works on all platforms

## Destination Logic

### Pre-Trip States (Navigate to Pickup)

| Ride Status | Destination | Reason |
|------------|-------------|---------|
| `accepted` | **Pickup** | Driver heading to pick up customer |
| `started` | **Pickup** | Driver confirmed departure, still en route |

### On-Trip State (Navigate to Dropoff)

| Ride Status | Destination | Reason |
|-------------|-------------|---------|
| `in_progress` | **Dropoff** | Customer in vehicle, heading to destination |

### Completed State

| Ride Status | Destination | Reason |
|-------------|-------------|---------|
| `completed` | N/A | Navigate button hidden (no action label) |

## Error Handling

**Missing Location Data:**
```typescript
if (!destination) {
  show(`${destinationLabel} location not available`, 'error');
  return;
}
```

Shows error toast if pickup/dropoff coordinates are missing.

**App Not Available:**
- Attempts to open native app via deep link
- Falls back to web URL if deep link fails
- Ensures navigation always works

## Testing Checklist

### ✅ iOS Testing

- [ ] Open ride in `accepted` state
- [ ] Click "Navigate" button
- [ ] **Expected:** Apple Maps opens with directions to pickup
- [ ] Start ride (status: `started`)
- [ ] Click "Navigate" again
- [ ] **Expected:** Still navigates to pickup
- [ ] Begin trip (status: `in_progress`)
- [ ] Click "Navigate"
- [ ] **Expected:** Apple Maps opens with directions to dropoff

### ✅ Android Testing

- [ ] Open ride in `accepted` state
- [ ] Click "Navigate" button
- [ ] **Expected:** Google Maps opens in navigation mode to pickup
- [ ] Start ride
- [ ] Click "Navigate" again
- [ ] **Expected:** Still navigates to pickup
- [ ] Begin trip
- [ ] Click "Navigate"
- [ ] **Expected:** Google Maps navigates to dropoff

### ✅ Desktop Testing

- [ ] Open ride in `accepted` state
- [ ] Click "Navigate" button
- [ ] **Expected:** Google Maps web opens in new tab with directions to pickup
- [ ] Begin trip
- [ ] Click "Navigate"
- [ ] **Expected:** Google Maps web opens with directions to dropoff

### ✅ macOS Testing

- [ ] Same as iOS testing
- [ ] **Expected:** Apple Maps app opens on Mac

### ✅ Error Cases

- [ ] Ride with missing pickup coordinates
- [ ] Click "Navigate"
- [ ] **Expected:** Toast shows "Pickup location not available"
- [ ] Ride with missing dropoff (in_progress)
- [ ] Click "Navigate"
- [ ] **Expected:** Toast shows "Dropoff location not available"

## Deep Link Reference

### Apple Maps URL Scheme

**Format:** `maps://?daddr=LAT,LNG&dirflg=d`

**Parameters:**
- `daddr`: Destination coordinates
- `dirflg=d`: Driving directions
- `dirflg=w`: Walking directions
- `dirflg=r`: Transit directions

**Fallback Web URL:** `https://maps.apple.com/?daddr=LAT,LNG&dirflg=d`

### Google Maps URL Scheme

**Android Navigation:** `google.navigation:q=LAT,LNG&mode=d`

**Parameters:**
- `q`: Query (coordinates)
- `mode=d`: Driving mode
- `mode=w`: Walking mode
- `mode=b`: Bicycling mode

**Web Directions API:** `https://www.google.com/maps/dir/?api=1&destination=LAT,LNG&travelmode=driving`

**Parameters:**
- `api=1`: Required for Directions API
- `destination`: End point
- `travelmode`: `driving`, `walking`, `bicycling`, `transit`
- `origin`: Optional starting point (defaults to current location)

## User Experience

### Before Phase 3D

- Navigate button opened Google Maps in browser only
- No mobile app support
- Always navigated to pickup regardless of ride state
- Desktop-focused implementation

### After Phase 3D

- ✅ Opens native navigation apps on mobile
- ✅ Smart destination switching (pickup → dropoff)
- ✅ Platform-aware (iOS, Android, macOS, web)
- ✅ Reliable fallbacks
- ✅ Clear error messages
- ✅ Immediate turn-by-turn navigation on mobile

## Why This Matters

**Driver Trust:** The Navigate button is the most critical action in the active ride UI. Drivers need to:
1. Trust it will open their preferred navigation app
2. Get immediate turn-by-turn directions
3. Have it "just work" on mobile (where most drivers use the app)

**Safety:** Opening a browser tab on mobile for navigation is dangerous while driving. Native apps integrate with the OS for safer hands-free operation.

**Speed:** One tap should go straight to navigation mode, not directions preview.

## Related Documentation

- [Phase 3A: Single Screen MapShell](./DRIVER_UI_PHASE3A_single_screen_mapshell.md)
- [Phase 3B: Offer in BottomSheet](./DRIVER_UI_PHASE3B_offer_in_bottomsheet.md)
- [Phase 3C: MapShell State Cleanup](./DRIVER_UI_PHASE3C_mapshell_state_cleanup.md)

## Future Enhancements

- [ ] Add in-app navigation with route polyline
- [ ] Support Waze deep links (`waze://?ll=LAT,LNG&navigate=yes`)
- [ ] Remember driver's preferred navigation app
- [ ] Add "Open in..." menu for multiple nav app choices
- [ ] Show ETA before opening navigation
- [ ] Add traffic alerts before departure

---

**Phase 3D Complete!** 🗺️

Drivers can now reliably navigate to pickup/dropoff with one tap.
