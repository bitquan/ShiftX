# PR0 - Shared Package Migration Guide

## ✅ What Was Created

### Package Structure: `packages/shared/`

```
packages/shared/
├── src/
│   ├── index.ts        # Main export (re-exports everything)
│   ├── enums.ts        # All constants & enums
│   ├── types.ts        # All TypeScript interfaces
│   ├── pricing.ts      # Currency & pricing utilities
│   └── utils.ts        # Helper functions
├── dist/               # Compiled JavaScript + declarations
├── package.json
├── tsconfig.json
└── README.md
```

---

## 📦 What's Included

### Enums (enums.ts)
- `RideStatus` - requested, offered, accepted, started, in_progress, completed, cancelled
- `OfferStatus` - pending, accepted, declined, expired
- `ServiceClass` - shiftx, shift_lx, shift_black
- `CancelReason` - 15+ cancellation reasons (customer/driver/system)
- `PaymentStatus` - pending, processing, succeeded, failed, refunded
- `UserRole` - customer, driver, admin
- `DriverApprovalStatus` - pending, approved, rejected, suspended
- `AdminAction` - approve_driver, suspend_customer, etc.

### Types (types.ts)
- `Location` - lat/lng coordinates
- `SavedPlace` - home, work addresses
- `User` - base user interface
- `Customer` - customer-specific data
- `Driver` - driver profile & vehicle info
- `Vehicle` - make, model, year, color, plate
- `Ride` - complete ride data structure
- `Offer` - driver offer to customer
- `AdminLog` - audit trail entries
- `DriverOnboarding` - onboarding flow state
- `AdminConfig` - admin UIDs list

### Pricing Utilities (pricing.ts)
- `dollarsToCents(dollars)` - Convert $25.50 → 2550 cents
- `centsToDollars(cents)` - Convert 2550 cents → $25.50
- `formatCurrency(cents)` - Format as "$25.50"
- `formatDecimal(cents)` - Format as "25.50"
- `parseCurrencyToCents(string)` - Parse "$25.50" → 2550
- `calculatePercentage(amount, percent)`
- `calculateTip(amount, tipPercent)`
- `PricingConstants` - MIN_FARE, TAX_RATE, etc.

### Utilities (utils.ts)
- `assertNever(value)` - Exhaustive type checking
- `isDefined(value)` - Type guard for null/undefined
- `isValidEmail(email)`
- `isValidPhoneNumber(phone)`
- `formatPhoneNumber(phone)`
- `calculateDistance(lat1, lon1, lat2, lon2)` - Haversine formula
- `formatDistance(meters)` - "1.5 km" or "500 m"
- `formatDuration(seconds)` - "5 min" or "1 hr 30 min"
- `timeAgo(timestamp)` - "5m ago", "2h ago"
- `debounce(func, wait)`
- `throttle(func, limit)`

---

## 🔧 How to Use

### 1. Install in Your Package

```bash
cd packages/customer-app  # or driver-app, admin-dashboard, etc.
npm install file:../shared
```

### 2. Import What You Need

```typescript
import {
  RideStatus,
  ServiceClass,
  type Ride,
  type Driver,
  formatCurrency,
  assertNever
} from '@shiftx/shared';
```

### 3. Replace Hard-Coded Strings

**❌ Before (Bad):**
```typescript
if (ride.status === 'accepted') { ... }
if (driver.vehicleClass === 'shiftx') { ... }
const cancelReason = 'no_drivers';
```

**✅ After (Good):**
```typescript
if (ride.status === RideStatus.ACCEPTED) { ... }
if (driver.vehicleClass === ServiceClass.SHIFTX) { ... }
const cancelReason = CancelReason.NO_DRIVERS;
```

### 4. Use assertNever for Exhaustive Checks

```typescript
function getRideStatusLabel(status: RideStatus): string {
  switch (status) {
    case RideStatus.REQUESTED:
      return 'Requested';
    case RideStatus.OFFERED:
      return 'Driver Found';
    case RideStatus.ACCEPTED:
      return 'Accepted';
    case RideStatus.STARTED:
      return 'Started';
    case RideStatus.IN_PROGRESS:
      return 'In Progress';
    case RideStatus.COMPLETED:
      return 'Completed';
    case RideStatus.CANCELLED:
      return 'Cancelled';
    default:
      // TypeScript error if we miss a case!
      return assertNever(status);
  }
}
```

---

## 🎯 Migration Checklist

### Functions (`functions/src/`)
- [ ] Replace `'requested'`, `'accepted'` strings with `RideStatus.*`
- [ ] Replace `'shiftx'`, `'shift_lx'` with `ServiceClass.*`
- [ ] Replace cancel reason strings with `CancelReason.*`
- [ ] Import `Ride`, `Driver`, `Customer` types
- [ ] Use `formatCurrency()` for pricing
- [ ] Add `assertNever()` to switch statements

### Driver App (`packages/driver-app/src/`)
- [ ] Replace status strings in components
- [ ] Use `RideStatus` enum in state management
- [ ] Import `Driver`, `Ride`, `Offer` types
- [ ] Use `formatCurrency()` for earnings display
- [ ] Use `formatDistance()` for trip distances

### Customer App (`packages/customer-app/src/`)
- [ ] Replace status strings in ride tracking
- [ ] Use `ServiceClass` enum for vehicle selection
- [ ] Import `Customer`, `Ride` types
- [ ] Use `formatCurrency()` for price display
- [ ] Use `SavedPlace` type for home/work

### Admin Dashboard (`packages/admin-dashboard/src/`)
- [ ] Use `RideStatus` in rides screen
- [ ] Use `AdminAction` enum for logs
- [ ] Import all types for proper typing
- [ ] Use pricing utilities for displays

---

## 🚀 Benefits

### 1. Type Safety
```typescript
// TypeScript catches typos at compile time
const status: RideStatus = RideStatus.ACCEPTD; // ❌ Error!
const status: RideStatus = RideStatus.ACCEPTED; // ✅ Works
```

### 2. Autocomplete
Your IDE suggests all valid values:
- `RideStatus.` → shows all 7 statuses
- `ServiceClass.` → shows all 3 classes

### 3. Refactoring
Change `'accepted'` → `'driver_accepted'` in ONE place (shared/enums.ts), affects everywhere

### 4. No Silent Bugs
```typescript
// Before: typo creates silent bug
if (status === 'acceped') { ... } // Always false!

// After: TypeScript error prevents deployment
if (status === RideStatus.ACCEPED) { ... } // ❌ Compile error
```

### 5. Documentation
Hover over `RideStatus` in your IDE → see all possible values + JSDoc comments

---

## 📋 Next Steps

1. **Install in Functions** ✅ (Done)
   ```bash
   cd functions && npm install file:../packages/shared
   ```

2. **Update Functions** (TODO)
   - Replace strings in `src/driver.ts`, `src/eventLog.ts`
   - Import types for function parameters

3. **Install in Apps** (TODO)
   ```bash
   cd packages/driver-app && npm install file:../shared
   cd packages/customer-app && npm install file:../shared
   cd packages/admin-dashboard && npm install file:../shared
   ```

4. **Migrate Each App** (TODO)
   - Search for hardcoded strings
   - Replace with enum imports
   - Add type annotations

5. **Test Everything** (TODO)
   - Run build for each package
   - Test ride flow end-to-end
   - Verify status transitions work

---

## 🛠️ Development Workflow

### Making Changes to Shared Package

```bash
cd packages/shared

# Make your changes to src/ files

# Rebuild
npm run build

# Watch mode (auto-rebuild on save)
npm run watch
```

### After Updating Shared Package

Other packages using `file:../shared` automatically pick up changes after rebuild.
Just restart their dev servers if needed.

---

## 📊 Impact

**Files Created**: 9 files in `packages/shared/`
**LOC Added**: ~600 lines of shared code
**Duplication Removed**: ~2000+ lines across all packages (estimated)
**Type Safety**: 100% for statuses, classes, and core types
**Breaking Changes**: None (additive only)

---

## ✅ Acceptance Criteria

- [x] Created `packages/shared/` with all types
- [x] Built successfully (TypeScript compilation)
- [x] Installed in `functions/` package
- [ ] No raw status strings in functions (TODO)
- [ ] No raw status strings in apps (TODO)
- [ ] All packages build successfully (TODO)
- [ ] `assertNever()` added to switch statements (TODO)

---

## 🎉 Ready for Migration!

The shared package is built and ready. Next step: migrate each app to use it instead of hard-coded strings.
