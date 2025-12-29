# Cloud Functions (shiftx)

This project uses Firebase Cloud Functions to manage ride state transitions (accept, start, complete, cancel) securely on the server.

Setup (local)
1. Ensure Firebase CLI is installed and you're logged in: `firebase login`
2. Initialize functions (if not already):
   ```bash
   firebase init functions
   # Choose TypeScript, ESLint, install deps
   ```
3. From the `functions/` folder:
   ```bash
   cd functions
   npm install
   npm run build    # compile TypeScript to lib/
   firebase deploy --only functions
   ```

Flutter client
- Add dependency to `pubspec.yaml`:
  ```yaml
  firebase_functions: ^<compatible-version>
  ```
- Use callable functions instead of direct Firestore writes:
  ```dart
  final functions = FirebaseFunctions.instance;
  await functions.httpsCallable('acceptRide')({'rideId': rideId});
  ```

Notes
- The implemented callables are: `acceptRide`, `startRide`, `completeRide`, `cancelRide`.
- The functions perform transactional updates to `rides` and `drivers` collections and validate permissions.

## Testing & smoke tests 🧪

Unit tests are provided to verify that the client calls the right callables and that errors are mapped to domain exceptions. See `test/ride_service_test.dart` for a mock-based smoke test that runs: `accept -> start -> complete`.

To run tests locally:
1. Ensure you have working Flutter tooling: `flutter test` will run unit tests that don't require emulators.
2. If you want to run integration tests against the Functions emulator, start the emulator:
   ```bash
   firebase emulators:start --only functions
   ```
   Then in your test setup, configure the client to point at the emulator:
   ```dart
   FunctionsClientImpl.useFunctionsEmulator('localhost', 5001);
   ```

Note: The test suite uses `mocktail` for mocking. If `flutter pub get` fails due to an incompatible `firebase_functions` package version for your local SDK, run `flutter pub add firebase_functions` to select a compatible version and then `flutter pub get`.

