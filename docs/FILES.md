# Files added by shiftX core scaffold

This file lists the files that were added as part of the core scaffold and a short description for each.

lib/
  app.dart                  — MaterialApp wrapper that selects home screen based on user role
  main.dart                 — App entry; initializes Firebase and providers
  firebase_options.dart     — FlutterFire generated config (already present)

lib/core/
  constants.dart            — App constants (roles, ride statuses)
  result.dart               — Generic Result<T> helper

lib/models/
  app_user.dart             — AppUser model
  driver_state.dart         — DriverState model
  ride.dart                 — Ride model

lib/services/
  auth_service.dart         — Firebase Auth helpers (anon sign-in)
  user_service.dart         — Firestore user document helpers
  driver_service.dart       — Firestore driver document helpers
  ride_service.dart         — Firestore rides handling (create, accept, start, complete, cancel)

lib/state/
  session_provider.dart     — Combines auth + user + driver state and exposes session functions

lib/screens/
  auth/login_screen.dart    — Login screen (anonymous sign-in / driver switch)
  rider/rider_home_screen.dart
  rider/rider_request_screen.dart
  rider/rider_waiting_screen.dart
  driver/driver_home_screen.dart
  driver/driver_incoming_ride_screen.dart
  driver/driver_active_ride_screen.dart

docs/
  SETUP.md                  — Setup steps and Firestore rules (with copy/paste rules)
  firestore.rules           — Firestore rules file copy
  FILES.md                  — This file

---

If you'd like, I can also:
- Add basic unit or widget tests for a couple of components
- Add CI steps to run `flutter analyze` and `flutter test`
- Harden the Firestore rules (lock ride updates behind Cloud Functions) and scaffold a Functions project
