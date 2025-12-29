# shiftx

A new Flutter project.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Lab: Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Cookbook: Useful Flutter samples](https://docs.flutter.dev/cookbook)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.

---

## Backend: Cloud Functions 🔧

Ride state transitions (accept / start / complete / cancel) are now managed by server-side Cloud Functions. See `docs/FUNCTIONS.md` for setup and deployment steps.

---

## Development & Debugging 🧭

We've added useful VS Code debug configurations in `.vscode/launch.json` to make development and testing smoother:

- **ShiftX: Dev (Debug)** — standard debug mode with hot reload.
- **ShiftX: Dev (Debug, ENV=dev)** — debug mode with `--dart-define=ENV=dev` (useful for local flags).
- **ShiftX: Prod (Release)** — launch a release-mode build on a connected device with `--dart-define=ENV=prod`.
- **ShiftX: Profile** — profile mode for performance testing.
- **Attach to Flutter (running app)** — attach the debugger to an already-running app.
- **Test: All / Test: RideService** — run and debug tests directly from the editor.

Quick tips:
- Use **Dev (Debug)** for daily development. Release builds are slower and not recommended for iteration.
- To test functions locally, run the Firebase emulator: `firebase emulators:start --only functions,firestore` and configure the client to point to `localhost:5001`.
- Use **ShiftX: Dev (With Emulators)** in VS Code to automatically start emulators before launching the app (it uses the `Start Firebase emulators` task and passes `--dart-define=USE_EMULATORS=true`).
- Tests are in `test/`; `ride_service_test.dart` contains smoke tests for the callables and error mappings.

### How to debug tests in VS Code 🐞

- Open the **Run and Debug** view (Ctrl/Cmd+Shift+D) and select **Test: RideService** (or **Test: All**) then press the green play button to run or the bug icon to debug.
- Use the **Test Explorer** panel to run individual tests; set breakpoints in test or implementation code and choose **Debug Test**.
- For quick CLI runs: `flutter test test/ride_service_test.dart -r expanded` or to run single test: `flutter test --name "acceptRide calls function"`.
- If a test interacts with emulators, start `firebase emulators:start --only functions` and in your test setup call `FunctionsClientImpl(delegate: (name, data) => /* emulator call */)` or inject a Firebase-backed `FunctionsClient` configured for the emulator.

---

## Notes

- Keep server-side logic authoritative for ride state transitions to prevent race conditions and spoofing. See `docs/FUNCTIONS.md` for more detail.


