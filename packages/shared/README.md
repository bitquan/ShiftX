# @shiftx/shared

Shared types, constants, and utilities for the ShiftX platform.

## Purpose

This package serves as the **single source of truth** for:
- Type definitions used across all apps and services
- Enum constants (ride statuses, service classes, etc.)
- Pricing utilities (currency conversion, formatting)
- Common utility functions

## Installation

This is a local workspace package. To use it in other packages:

```json
{
  "dependencies": {
    "@shiftx/shared": "workspace:*"
  }
}
```

## Usage

```typescript
import {
  RideStatus,
  ServiceClass,
  Ride,
  Driver,
  formatCurrency,
  assertNever
} from '@shiftx/shared';

// Use enums for type safety
const status: RideStatus = RideStatus.ACCEPTED;

// Format pricing
const priceStr = formatCurrency(2500); // "$25.00"

// Exhaustive switch with assertNever
switch (status) {
  case RideStatus.REQUESTED:
    return 'Requested';
  case RideStatus.ACCEPTED:
    return 'Accepted';
  // ... handle all cases
  default:
    return assertNever(status); // TypeScript error if cases missing
}
```

## Building

```bash
npm run build    # Compile TypeScript to dist/
npm run watch    # Watch mode for development
npm run clean    # Remove dist/ folder
```

## Structure

```
src/
├── index.ts       # Main export file
├── enums.ts       # All enum constants
├── types.ts       # All type definitions
├── pricing.ts     # Pricing utilities
└── utils.ts       # Common utility functions
```

## Benefits

1. **No Duplication**: Types and constants defined once, used everywhere
2. **Type Safety**: TypeScript catches errors at compile time
3. **Consistency**: All apps use the same status strings, formats, etc.
4. **Maintainability**: Update in one place, affects all consumers
5. **Exhaustiveness**: `assertNever` ensures all enum cases are handled
