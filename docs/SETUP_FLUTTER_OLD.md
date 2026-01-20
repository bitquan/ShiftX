# shiftX — Setup & Firestore rules

This document outlines the minimal steps to get the project running with Firebase for local MVP testing, and contains the Firestore rules suggested for the MVP.

## 1) Install FlutterFire CLI (if not already)

```bash
dart pub global activate flutterfire_cli
# ensure ~/.pub-cache/bin is on your PATH
# (e.g. add to ~/.zshrc: export PATH="$PATH":"$HOME/.pub-cache/bin")
```

## 2) Configure Firebase project for this app (recommended using FlutterFire)

From the project root:

```bash
# interactive configuration (select platforms and projects)
flutterfire configure
```

This will generate `lib/firebase_options.dart` (already present) and wire up platform settings.

## 3) Add platform config files (if you prefer manual setup)

- iOS: place `GoogleService-Info.plist` into `ios/Runner/` and add it to Xcode.
- Android: place `google-services.json` into `android/app/`.

## 4) Initialize Firebase in code

`lib/main.dart` already calls:

```dart
await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
```

## 5) Firestore rules (MVP — safer than fully open)

Paste the following into the Firestore Rules editor in the Firebase Console:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    // USERS
    match /users/{uid} {
      allow read, write: if isSignedIn() && request.auth.uid == uid;
    }

    // DRIVERS
    match /drivers/{driverId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && request.auth.uid == driverId;
    }

    // RIDES
    match /rides/{rideId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn()
        && request.resource.data.riderId == request.auth.uid;

      allow update: if isSignedIn();
    }
  }
}
```

> Note: This is intentionally permissive for MVP testing (signed-in users can update rides). When you move to production, secure updates with Cloud Functions that enforce transactional rules (e.g., driver acceptance, cancellations, transitions).

## 6) Run the app

```bash
flutter run -d <device>
```

## 7) Extra notes

- If `flutter pub get` reports newer compatible versions, consider running `flutter pub outdated` and `flutter pub upgrade --major-versions` carefully.
- Database migration and securing ride transitions with Cloud Functions is the recommended next step.

---

If you want, I can also:
- Run `flutterfire configure` for you interactively (you’ll need to authorize and pick a Firebase project).
- Add Cloud Functions skeleton for securing ride state transitions.
