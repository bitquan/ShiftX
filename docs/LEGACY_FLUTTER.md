# Legacy Flutter Codebase

## ⚠️ DEPRECATION NOTICE

The code in the `/lib` directory is **LEGACY** and is no longer actively maintained. This codebase has been migrated to a modern TypeScript/React stack.

## Current Active Stack

ShiftX is now built with:
- **Frontend:** React 18 + TypeScript + Vite
- **Mobile:** Capacitor (iOS wrapper for React apps)
- **Backend:** Firebase Cloud Functions (TypeScript)
- **Database:** Firestore
- **Payments:** Stripe + Stripe Connect

### Active Packages

All active development happens in the `packages/` directory:
- `packages/customer-app/` - Customer web app
- `packages/driver-app/` - Driver web/iOS app
- `packages/admin-dashboard/` - Admin dashboard
- `functions/` - Cloud Functions backend

## Flutter Code Structure (Reference Only)

The legacy Flutter code structure:
```
lib/
├── app.dart                # Main app configuration
├── main.dart              # Entry point
├── firebase_options.dart  # Firebase configuration
├── core/                  # Core utilities
├── models/                # Data models
├── screens/               # UI screens
├── services/              # Business logic
└── state/                 # State management
```

## Why We Migrated

### Reasons for Migration

1. **Unified Codebase:** Single React codebase for web and iOS (via Capacitor)
2. **Developer Experience:** Better tooling, faster iteration with Vite HMR
3. **Type Safety:** Full TypeScript coverage with strict mode
4. **Modern Ecosystem:** Access to npm packages and React ecosystem
5. **Deployment:** Simpler web deployment via Firebase Hosting
6. **Real-time:** Better Firestore SDK integration in TypeScript
7. **Maps:** More mature web mapping libraries (Leaflet, Mapbox)

### What Was Preserved

✅ **Firebase Backend:** All Firestore collections and structure preserved
✅ **Authentication:** Same Firebase Auth setup
✅ **Business Logic:** Ride state machine and rules maintained
✅ **Stripe Integration:** Payment processing preserved
✅ **Security Rules:** Firestore rules unchanged

## Migration Path (If Needed)

If you need to understand the old Flutter implementation:

### 1. Authentication
- **Flutter:** `firebase_auth` package
- **React:** `firebase/auth` SDK
- Both use same Firebase Auth backend

### 2. Firestore
- **Flutter:** `cloud_firestore` package
- **React:** `firebase/firestore` SDK
- Same collections, documents, and queries

### 3. Cloud Functions
- **Flutter:** `cloud_functions` package
- **React:** `firebase/functions` SDK
- Same callable functions

### 4. State Management
- **Flutter:** Provider pattern in `lib/state/`
- **React:** React Context + hooks

### 5. Navigation
- **Flutter:** `Navigator` with routes
- **React:** React Router or built-in state routing

## Using Flutter Code as Reference

The Flutter code can serve as reference documentation for:

1. **Business Logic:** Understanding ride workflows
2. **UI Patterns:** Screen layouts and user flows
3. **Data Models:** Firestore document structures
4. **Error Handling:** Edge cases that were handled

## Do NOT Use For

❌ **New Feature Development** - Use React apps
❌ **Bug Fixes** - Fix in React apps
❌ **Production Deployment** - Deploy React apps only
❌ **Customer/Driver Apps** - Use `packages/customer-app` and `packages/driver-app`

## Documentation

For current platform documentation, see:
- [Main README](../README.md) - Current architecture
- [docs/SETUP.md](SETUP.md) - Development setup (TypeScript/React)
- [docs/ARCHITECTURE.md](architecture/ARCHITECTURE.md) - System architecture
- [docs/customer-app/](customer-app/) - Customer app docs
- [docs/driver-app/](driver-app/) - Driver app docs

## Timeline

- **Pre-December 2025:** Flutter-based MVP
- **December 2025:** Migration to TypeScript/React began
- **January 2026:** Full production deployment on React stack
- **Current:** Flutter code maintained for reference only

## Cleanup Plan

The Flutter code will be archived in a future cleanup PR. For now, it remains in the repository for reference purposes only.

---

**Last Updated:** January 20, 2026
**Status:** Deprecated - Reference Only
**Active Stack:** React + TypeScript + Capacitor
