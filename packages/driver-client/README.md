# Driver Client

This tiny helper package exports typed wrappers around the ShiftX driver callables and Firestore listeners so UI clients can stay aligned with the backend contract.

## Features
- `initDriverClient` wires `firebase/functions` + `firebase/firestore` to the driver callable surface (`driverSetOnline`, `driverHeartbeat`, `tripRequest`, `acceptRide`, `startRide`, `progressRide`, `completeRide`, `cancelRide`).
- Typed reader helpers for `/drivers/{uid}`, `/users/{uid}`, and `rides/{rideId}/offers/{driverId}` plus a collection-group listener for all offers targeting the driver.
- Emulator-friendly defaults, including a demo script that seeds a driver record (via `firebase-admin`) and walks through the `setOnline → accept → start → complete` lifecycle.

## Getting started
```bash
cd packages/driver-client
npm install
```

### Run emulators
Start the emulator suite from the repository root (includes auth to keep the demo flow authenticated):
```bash
npm run dev:emulators --prefix packages/driver-client
```
This launches `firebase emulators:start --only functions,firestore,auth` against the root config.

### Run the demo driver flow
With the emulator running, execute:
```bash
npm run demo
```
That script sets up emulator env vars, signs a demo driver in via a custom token, toggles the driver online, delivers an offer, accepts it, and walks through `started → in_progress → completed` while logging Firestore updates.

## Using the client
Import from `./packages/driver-client/src` (or build the package and consume `dist`). Example:
```ts
import { initDriverClient, driverSetOnline, watchDriverProfile } from '@shiftx/driver-client';

const client = initDriverClient({
  firebaseConfig: {
    projectId: 'demo-no-project',
    apiKey: '<your-api-key>',
    authDomain: 'demo-no-project.firebaseapp.com',
  },
  emulator: {
    firestoreHost: '127.0.0.1',
    firestorePort: 8081,
    functionsHost: '127.0.0.1',
    functionsPort: 5002,
  },
});

await driverSetOnline(true);
const unsubscribe = watchDriverProfile('demo-driver', (profile) => console.log(profile));
```

All exported types live under `driver-client/src/types.ts` and map directly to `docs/backend-contract.md` (ride statuses, offer statuses, driver/user shape, etc.).
