# Driver App Emulator Workflow

This document captures the repeatable commands and context needed to exercise the driver-facing React/Vite app against the local Firebase emulators.

## 1. Prerequisites
- Install the Firebase CLI (if needed) so you can run `firebase emulators:start`.
- Install npm dependencies inside `packages/driver-app` once: `npm install` (needed whenever you update `package.json` or the linked `@shiftx/driver-client`).
- Keep the Firebase emulators running while you use the driver app, because it reads/writes Firestore, hits callable functions, and talks to the Auth emulator.

## 2. Start the Firebase emulators
The emulator ports are declared in the root [firebase.json](firebase.json#L1-L34) (firestore: 8081, functions: 5002, auth: 9099) and mirrored by `DEFAULT_EMULATOR_CONFIG` in the driver-client library ([packages/driver-client/src/index.ts#L203-L219]).

```bash
cd /Users/papadev/dev/apps/shiftx
firebase emulators:start --only firestore,functions,auth
```

- Leave this terminal open; the driver UI needs those hosts when you click *Go online*, accept rides, or watch offers (see how `packages/driver-app/src/App.tsx` connects to the auth emulator and driver-client listeners at [packages/driver-app/src/App.tsx#L1-L85]).
- When the emulators are running, the default auth emulator user pool syncs with `seedDriver.ts` to give the UI a driver identity.

## 3. Seed a driver record
The `seedDriver.ts` script creates the driver profile, a user document, and an auth account (`demo-driver` by default), mirroring the fields that `App.tsx` expects ([packages/driver-app/src/seedDriver.ts#L1-L45]).

```bash
cd /Users/papadev/dev/apps/shiftx/packages/driver-app
npm run seed-driver           # uses ts-node + firebase-admin
# optionally supply a driver id: npm run seed-driver -- my-driver-123
```

- Point `GCLOUD_PROJECT` at the emulator project if you are overriding the demo value (the script falls back to `demo-no-project`).
- The driver document and user entry must exist before you sign into the UI so the listener streams fire immediately.

## 4. Launch the driver UI

```bash
cd /Users/papadev/dev/apps/shiftx/packages/driver-app
npm run dev
```

- Vite listens on port 4173 by default (`vite.config.ts` sets the server port; [packages/driver-app/vite.config.ts#L1-L9]).
- Open http://localhost:4173, sign in anonymously, toggle online, send heartbeats, and accept any offers that arrive through `watchDriverOffers`.
- Use the UI buttons to invoke `driverSetOnline`, `driverHeartbeat`, `tripRequest`, and `tripUpdateStatus`, all of which hit the callable functions wired through `@shiftx/driver-client` ([packages/driver-client/src/index.ts#L1-L204]).

## 5. Build or preview a production bundle
- `npm run build` runs `tsc` + `vite build`; it is useful when you want to confirm TypeScript errors or bundle size warnings before releasing.
- `npm run preview` spins up `vite preview` to serve the `dist/` output from the last build (`vite` still needs the emulators for data). Extra warnings (chunk size, etc.) are expected but do not block development.

## 6. Notes
- If you ever change the driver-client types or callable signatures, re-run `npm run build` inside `packages/driver-client` so the typings inside `dist` stay up to date.
- The UI uses `DEFAULT_EMULATOR_CONFIG` to point Firestore/functions at 127.0.0.1: use that value when invoking other CLI tools or scripts from the same machine.
- When the Firebase Auth emulator loses the seeded user, rerun `npm run seed-driver` and refresh the app; you can also delete and recreate the emulator data via `firebase emulators:export`/`--import` flags if needed.