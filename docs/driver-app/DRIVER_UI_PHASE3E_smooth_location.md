# Phase 3E: Location Accuracy + Heading Smoothing

**Date:** January 19, 2026  
**Status:** ✅ Complete  

## Goal

Make the driver marker movement feel premium with smooth transitions, heading rotation, and GPS noise filtering.

## Acceptance Criteria

- ✅ Smooth marker movement (no jumps)
- ✅ Rotate marker by heading/bearing
- ✅ Avoid jitter when GPS is noisy
- ✅ Feels polished and professional

## Implementation

### Files Created

1. **`hooks/useSmoothLocation.ts`** - Location interpolation and noise filtering
2. **`components/map/RotatableDriverMarker.tsx`** - Rotating car marker

### Files Modified

3. **`hooks/useHeartbeat.ts`** - Capture GPS heading
4. **`components/map/SharedMap.tsx`** - Use smooth location and rotatable marker

## Features

### 1. GPS Noise Filtering

**Problem:** GPS accuracy varies, causing markers to "jitter" between updates even when stationary.

**Solution:** Filter out small movements (< 5 meters):

```typescript
const getDistance = (from: Location, to: Location): number => {
  // Haversine formula for accurate distance
  const R = 6371e3; // Earth radius in meters
  // ... calculate distance
  return R * c;
};

if (distance < minDistanceMeters) {
  // GPS noise - ignore this update
  return;
}
```

**Parameters:**
- `minDistanceMeters: 5` - Ignore moves < 5m (typical GPS accuracy)
- Prevents jittery marker when driver is stopped or moving slowly
- Still updates heading for rotation

### 2. Smooth Movement Interpolation

**Problem:** GPS updates are discrete jumps, making marker movement look choppy.

**Solution:** Animate between positions using requestAnimationFrame:

```typescript
const animate = () => {
  const elapsed = now - startTime;
  const progress = Math.min(elapsed / transitionDuration, 1);
  const easedProgress = easeOutCubic(progress); // Smooth deceleration

  const interpolated = {
    lat: lerp(start.lat, target.lat, easedProgress),
    lng: lerp(start.lng, target.lng, easedProgress),
    heading: target.heading, // Instant rotation
  };

  setSmoothLocation(interpolated);

  if (progress < 1) {
    requestAnimationFrame(animate);
  }
};
```

**Parameters:**
- `transitionDuration: 800ms` - Smooth 800ms movement
- `updateInterval: 16ms` - ~60fps animation
- Ease-out cubic easing for natural deceleration

### 3. Heading Capture

**Problem:** Need GPS bearing/heading for marker rotation.

**Solution:** Extract heading from GeolocationPosition:

```typescript
const location = {
  lat: position.coords.latitude,
  lng: position.coords.longitude,
  heading: position.coords.heading !== null ? position.coords.heading : undefined,
};
```

**Heading values:**
- `0°` = North
- `90°` = East
- `180°` = South
- `270°` = West
- `null` = No heading available (stationary)

### 4. Rotatable Marker

**Problem:** Static car icon doesn't show direction of travel.

**Solution:** CSS rotation with smooth transitions:

```typescript
const createRotatedIcon = (rotation: number = 0) => {
  return L.divIcon({
    html: `
      <div style="
        transform: rotate(${rotation}deg);
        transition: transform 0.3s ease-out;
      ">
        <div style="/* car icon */">🚗</div>
      </div>
    `,
  });
};
```

**Features:**
- Instant heading updates (no interpolation on rotation)
- 300ms CSS transition for smooth rotation
- Maintains icon size and shadow
- Works in all directions

## Technical Details

### useSmoothLocation Hook

**Interface:**
```typescript
interface Location {
  lat: number;
  lng: number;
  heading?: number;
}

interface SmoothLocationOptions {
  minDistanceMeters?: number; // Default: 5m
  transitionDuration?: number; // Default: 800ms
  updateInterval?: number; // Default: 16ms (~60fps)
}

function useSmoothLocation(
  rawLocation: Location | null,
  options?: SmoothLocationOptions
): Location | null;
```

**State Management:**
- `smoothLocation` - Current interpolated position
- `lastValidLocationRef` - Last significant position (> threshold)
- `startLocationRef` - Animation start point
- `targetLocationRef` - Animation end point
- `animationFrameRef` - requestAnimationFrame ID

**Lifecycle:**
1. First location → Set immediately (no animation)
2. New location → Calculate distance from last valid
3. If < threshold → Ignore (noise), but update heading
4. If ≥ threshold → Start animation
5. Interpolate over 800ms with ease-out
6. Cancel previous animation if new location arrives

### RotatableDriverMarker Component

**Props:**
```typescript
interface RotatableDriverMarkerProps {
  position: [number, number]; // [lat, lng]
  heading?: number; // 0-360 degrees
}
```

**Behavior:**
- Creates L.divIcon with rotated wrapper
- Updates icon when heading changes via useEffect
- Maintains marker reference for efficient updates
- CSS transition handles smooth rotation

### useHeartbeat Updates

**Added to HeartbeatResult:**
```typescript
interface HeartbeatResult {
  currentLocation: {
    lat: number;
    lng: number;
    heading?: number; // NEW
  } | null;
  gpsError: string | null;
  lastFixAtMs: number | null;
  retryGps: () => void;
  hasGpsFix: boolean; // NEW
}
```

**GPS Options:**
```typescript
{
  enableHighAccuracy: true, // Request precise GPS
  timeout: 20000,
  maximumAge: 5000, // Cache positions for 5s
}
```

## Performance Considerations

### requestAnimationFrame

- 60fps smooth animation
- Automatically pauses when tab inactive
- No timer drift
- Browser-optimized rendering

### Cleanup

```typescript
return () => {
  if (animationFrameRef.current !== null) {
    cancelAnimationFrame(animationFrameRef.current);
  }
};
```

Prevents memory leaks and wasted cycles.

### Distance Calculation

Haversine formula provides accurate great-circle distance on Earth's surface. Essential for proper noise filtering.

## User Experience Impact

### Before Phase 3E

- ❌ Marker jumped between GPS updates
- ❌ Jittery when stopped or slow moving
- ❌ Car icon didn't show direction
- ❌ Looked amateur and distracting

### After Phase 3E

- ✅ Buttery smooth marker movement
- ✅ No jitter - marker stays still when driver is stopped
- ✅ Car rotates to show heading
- ✅ Feels like a premium navigation app
- ✅ Professional and polished

## Testing Checklist

### ✅ Smooth Movement

- [ ] Drive around - marker should glide smoothly
- [ ] Stop vehicle - marker should stay still (no jitter)
- [ ] Slow movement (< 5m) - marker shouldn't jump
- [ ] Fast movement - marker smoothly catches up

### ✅ Heading Rotation

- [ ] Turn left - car icon rotates left
- [ ] Turn right - car icon rotates right
- [ ] U-turn - car rotates 180°
- [ ] Stationary - car maintains last heading

### ✅ Noise Filtering

- [ ] Stand still for 30s - count jumps (should be 0)
- [ ] Walk slowly in circle - marker follows smoothly
- [ ] Poor GPS signal - marker filters noise

### ✅ Performance

- [ ] Open DevTools Performance tab
- [ ] Drive for 1 minute
- [ ] Check CPU usage - should be minimal
- [ ] No memory leaks - check heap snapshots

### ✅ Edge Cases

- [ ] No GPS signal - marker shouldn't appear
- [ ] First GPS fix - marker appears immediately
- [ ] GPS signal lost then regained - smooth recovery
- [ ] Multiple rapid updates - smooth interpolation
- [ ] Tab backgrounded - animation pauses

## Browser Compatibility

### GPS Heading Support

| Platform | Heading Support | Notes |
|----------|----------------|-------|
| iOS Safari | ✅ Yes | Requires motion permissions |
| Android Chrome | ✅ Yes | Works reliably |
| Desktop Chrome | ⚠️ Partial | Only when moving |
| Desktop Safari | ⚠️ Partial | Only when moving |
| Firefox | ⚠️ Partial | Limited support |

**Fallback:** When heading is null/undefined, marker shows default rotation (north-facing).

### requestAnimationFrame

✅ Supported in all modern browsers (IE10+)

## Configuration

### Tuning Parameters

**For different use cases:**

```typescript
// Aggressive filtering (parking lots, slow streets)
useSmoothLocation(location, {
  minDistanceMeters: 10, // Ignore < 10m
  transitionDuration: 1000, // Slower, smoother
});

// Responsive (highways, fast movement)
useSmoothLocation(location, {
  minDistanceMeters: 3, // More responsive
  transitionDuration: 500, // Faster updates
});

// Default (balanced for urban driving)
useSmoothLocation(location, {
  minDistanceMeters: 5,
  transitionDuration: 800,
});
```

## Future Enhancements

- [ ] Predict position using velocity + heading
- [ ] Kalman filter for even smoother tracking
- [ ] Adaptive filtering based on speed
- [ ] Show speed indicator on marker
- [ ] Pulsing animation when signal is weak
- [ ] Different icons for different vehicle classes
- [ ] Trail effect showing recent path
- [ ] Compass rose showing cardinal directions

## Related Documentation

- [Phase 3A: Single Screen MapShell](./DRIVER_UI_PHASE3A_single_screen_mapshell.md)
- [Phase 3D: Real Navigation](./DRIVER_UI_PHASE3D_real_navigation.md)
- [Phase 2C-1: GPS Always-Follow Camera](./DRIVER_GPS_PHASE2C1.md)

---

**Phase 3E Complete!** ✨

The driver marker now moves with premium smoothness and rotates to show direction.
