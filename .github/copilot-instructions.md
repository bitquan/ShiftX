# Copilot Instructions for ShiftX

## Overview
ShiftX is a Flutter-based ride-sharing application with Firebase backend integration. The project uses Cloud Functions for server-side ride state management and follows Flutter best practices.

## Tech Stack
- **Frontend:** Flutter SDK ^3.10.4 with Dart
- **Backend:** Firebase Cloud Functions (TypeScript/Node.js)
- **Database:** Cloud Firestore
- **Authentication:** Firebase Auth
- **State Management:** Provider
- **Testing:** flutter_test, mocktail

## Development Workflow

### Building and Testing
- Build Flutter app: `flutter run`
- Run all tests: `flutter test`
- Run specific tests: `flutter test test/ride_service_test.dart`
- Run with expanded output: `flutter test -r expanded`
- Lint Dart code: `flutter analyze`
- Build Cloud Functions: `cd functions && npm run build`
- Start Firebase emulators: `firebase emulators:start --only functions,firestore`

### Environment Flags
- Use `--dart-define=ENV=dev` for development environment
- Use `--dart-define=ENV=prod` for production builds
- Use `--dart-define=USE_EMULATORS=true` to point to local Firebase emulators

## Code Conventions

### Flutter/Dart Style
- Follow the Flutter lints configuration in `analysis_options.yaml`
- Use `package:flutter_lints/flutter.yaml` for linting
- Prefer descriptive variable and function names
- Use meaningful comments only when necessary to explain complex logic
- Organize imports: Dart SDK, Flutter, external packages, then relative imports

### File Organization
- **models/**: Data models (Ride, DriverState, AppUser)
- **services/**: Business logic and external integrations (RideService, AuthService, UserService, DriverService)
- **screens/**: UI screens organized by feature (driver/, rider/, auth/)
- **state/**: State management classes
- **core/**: Shared utilities (Constants, Result types)

### Architecture Patterns
- Use Provider for state management
- Implement services with dependency injection in mind
- Use `FunctionsClient` abstraction for Firebase Functions to enable testing
- Keep server-side logic authoritative for ride state transitions
- Use transactional updates for critical operations

### Error Handling
- Define domain-specific exceptions (e.g., `RideException`, `UnauthorizedException`, `PreconditionException`, `NotFoundException`)
- Map Firebase errors to domain exceptions
- Always handle errors gracefully in the UI

### Firebase Integration
- Never perform direct Firestore writes for ride state changes - use Cloud Functions callables instead
- Callable functions: `acceptRide`, `startRide`, `completeRide`, `cancelRide`
- Configure Functions emulator for local development: `FirebaseFunctions.instance.useFunctionsEmulator('localhost', 5001)`
- Configure Firestore emulator for local development

### Cloud Functions (TypeScript)
- Located in `functions/` directory
- Use TypeScript with strict type checking
- Implement callable functions for all ride state transitions
- Perform transactional updates to `rides` and `drivers` collections
- Validate permissions server-side
- Build before deploying: `npm run build`

## Testing Practices

### Unit Tests
- Write unit tests for all services
- Use `mocktail` for mocking dependencies
- Mock `FunctionsClient` for testing ride operations without Firebase
- Tests should be fast and not require emulators
- Follow the pattern in `test/ride_service_test.dart`

### Integration Tests
- Located in `test/integration/`
- Require Firebase emulators to be running
- Use `FunctionsClientFirebase.useEmulator('localhost', 5001)` in test setup
- Test full workflows (e.g., accept -> start -> complete)

### Debugging Tests in VS Code
- Use "Test: RideService" or "Test: All" launch configurations
- Set breakpoints in test or implementation code
- Use Test Explorer to run individual tests
- For CLI debugging: `flutter test --name "test name"`

## Best Practices

### Security
- Keep server-side logic authoritative to prevent race conditions and spoofing
- Validate all inputs server-side in Cloud Functions
- Use Firebase security rules for Firestore access control
- Never commit secrets or API keys

### Performance
- Use `const` constructors where possible for widgets
- Minimize rebuilds with proper Provider usage
- Use release mode for performance testing: `flutter run --release --dart-define=ENV=prod`

### Documentation
- Update `docs/FUNCTIONS.md` when callable functions change
- Update `docs/DEVELOPMENT.md` when dev workflow changes
- Keep README.md updated with major changes
- Add comments to services explaining their purpose and when to update them

### Dependencies
- Minimize addition of new dependencies
- Pin critical dependencies to specific versions
- Document why dependencies are added
- Run `flutter pub get` after updating pubspec.yaml
- For Functions: use `npm install` and commit package-lock.json

## Common Commands Reference

```bash
# Flutter
flutter pub get                  # Install dependencies
flutter run                      # Run app in debug mode
flutter test                     # Run all unit tests
flutter analyze                  # Run static analysis
flutter clean                    # Clean build artifacts

# Firebase
firebase login                   # Login to Firebase
firebase emulators:start        # Start all emulators
firebase deploy --only functions # Deploy Cloud Functions

# Functions development
cd functions
npm install                      # Install dependencies
npm run build                    # Build TypeScript
npm run lint                     # Lint code
```

## Important Notes
- Avoid breaking changes to existing functionality
- Test thoroughly before committing changes
- Use VS Code launch configurations for efficient development
- The project uses injectable dependencies to facilitate testing
- Always run tests after making changes to services or models
