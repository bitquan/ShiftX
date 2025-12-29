# Development: Local Setup & Debugging

This guide helps you run the project locally, test Cloud Functions, and debug both Flutter and tests.

## Prerequisites

- Flutter SDK installed and on your PATH
- Firebase CLI installed and logged in (`firebase login`)
- Node 18 (recommended for Cloud Functions)
- Optional: nvm to manage Node versions (`nvm use 18`)

## Functions (server)

1. Initialize / install (first time):

```bash
cd functions
npm install
```

**Note on emulators:** The Firestore emulator requires Java to run. On macOS you can install the Temurin JDK via Homebrew:

```bash
brew install --cask temurin
```

On Ubuntu-based CI runners the `actions/setup-java` step in our GitHub Actions workflow installs Java for you.

2. Build TypeScript functions:

```bash
cd functions
npm run build
```

3. Run locally with the emulator (recommended for testing):

```bash
firebase emulators:start --only functions
```

4. Deploy to production when ready:

```bash
firebase deploy --only functions
```

Notes:
- If you hit TypeScript `@types` conflicts, `npm install` + `npm run build` should work; we added `skipLibCheck` to `tsconfig.json` and pinned problematic `@types` in `package.json` to reduce friction.

## Flutter (client)

1. Install Dart/Flutter dependencies:

```bash
flutter pub get
```

2. Run the app in dev mode (hot reload):

```bash
flutter run
```

3. Passing environment flags (example):

```bash
flutter run --dart-define=ENV=dev
```

## Pointing to the Functions emulator

When running the Firebase emulator, configure your client to use it. We use an injectable `FunctionsClient`, so you can:

- Provide a Firebase-backed implementation that calls `FirebaseFunctions.instance.useFunctionsEmulator('localhost', 5001)` (create `lib/services/functions_client_firebase.dart`), or
- Inject a delegate for test/emulator calls using `FunctionsClientImpl(delegate: (name, data) => /* call emulator */)`.

## Tests

### VS Code: Dev (With Emulators)

We added a VS Code task and launch config to make running the app with emulators seamless.

- Start from VS Code: select **ShiftX: Dev (With Emulators)** in the Run view — it runs the `Start Firebase emulators` task and launches the app with `--dart-define=USE_EMULATORS=true`.
- The app reads the `USE_EMULATORS` dart-define and automatically configures Firestore to use `localhost:8080`.


- Unit tests (fast, don't need emulators):

```bash
flutter test
```

- Integration tests (Functions emulator):

1. Build the functions TypeScript if you changed code:

```bash
cd functions
npm run build
```

2. Start the functions emulator:

```bash
firebase emulators:start --only functions
```

3. In your test setup, configure the Functions client to point at the emulator (we provide `FunctionsClientFirebase.useEmulator('localhost', 5001)` for convenience).

4. Run the integration tests:

```bash
flutter test test/integration/ride_integration_test.dart
```

Notes:
- The integration test expects either seeded test data in the emulator or functions that can handle test inputs. You can extend the test to set up Firestore state via the emulator REST APIs or the Admin SDK in a helper script.
- If you prefer fully isolated tests, keep using mock-based unit tests located in `test/`.

## Debugging in VS Code

- Use the **ShiftX: Dev (Debug)** config for development (hot reload and debugger attached).
- Use **Test: RideService** to run/debug the ride service unit tests directly from the editor.
- Set breakpoints in code or tests and use **Debug Test** in the Test Explorer.

## CI suggestions

- Run `flutter test --coverage` on each pull request.
- Build TypeScript functions (`npm ci && npm run build`) and fail the job if `tsc` reports errors.
- Optionally run the Firebase emulators in CI to run integration tests.

## When to update this doc

- Update this file if there are changes to the dev flow, new emulators, additional environment flags, or changes to the functions scaffolding.

