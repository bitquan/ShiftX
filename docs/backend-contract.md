<!--
  Backend contract for ShiftX (Driver-first).
  Keep this in sync with the Firestore schema, functions, and rules.
-->
# Backend Contract (Driver-First)

## 1. Data Model
| Collection | Document ID | Key Fields | Notes |
| --- | --- | --- | --- |
| `users/{uid}` | Firebase Auth UID | `role: "driver" | "customer" | "admin"`, `displayName`, `createdAtMs` | Centralized Auth profile; clients read/write only their own doc. |
| `drivers/{uid}` | UID | `isOnline`, `isBusy`, `currentRideId`, `vehicle`, `onboardingStatus: "pending"|"active"|"suspended"`, `updatedAtMs`, `lastSeenAtMs`, `location` (optional) | Writable only by backend functions (online/offline toggles, status transitions). |
| `customers/{uid}` | UID | `primaryPhone`, `defaultPayment`, `loyaltyTier` | Simple read/write for the customer. |
| `rides/{rideId}` | UUID | `customerId`, `driverId`, `status`, `pickup`, `dropoff`, `priceCents`, `createdAtMs`, `acceptedAtMs`, `startedAtMs`, `completedAtMs`, `cancelledAtMs`, `cancelReason`, `metadata` | Authoritative state machine lives here; clients only call functions to mutate status. |
| `rides/{rideId}/events/{eventId}` | Auto ID | `status`, `actorId`, `timestamp`, `notes` | Append-only audit log written by functions (for history + debugging). |
| `rides/{rideId}/offers/{driverId}` | Driver UID | `status: "pending"|"accepted"|"expired"|"cancelled"`, `quotedAtMs`, `expiresAtMs`, `matchMetadata`, `attempts` | Created by matching logic after `tripRequest`; predicates driver/ride visibility and is cleaned up by timeouts or acceptance. |
| `driverLocations/{driverId}` | UID | `lat`, `lng`, `heading`, `updatedAtMs` | Rate-limited writes; optional snapshot for nearest-driver queries.

## 2. State Machine (rides/{rideId})
| Status | Allowed Origin | Allowed Destinations | Trigger |
| --- | --- | --- | --- |
| `requested` | creation via `tripRequest` | `dispatching`, `cancelled` | Customer requests ride |
| `dispatching` | `requested` | `offered`, `cancelled`, `requested` (retry) | Matcher evaluating driver availability and writing `offers/{driverId}` docs |
| `offered` | `dispatching` | `accepted`, `cancelled`, `expired`, `requested` (requeue) | Offer delivered to driver(s); will expire if unmatched |
| `accepted` | `offered` | `started`, `cancelled` | Driver accepts |
| `started` | `accepted` | `in_progress`, `cancelled` | Driver arrives/start trip |
| `in_progress` | `started` | `completed`, `cancelled` | Trip underway |
| `completed` | `in_progress` | _(terminal)_ | Customer dropped off |
| `cancelled` | multiple | _(terminal)_ | Driver/customer cancels |

State transitions occur only inside callable Functions (e.g., `tripAccept`, `tripUpdateStatus`, `tripCancel`).

## 3. API Surface
| Function | Trigger | Input | Output / Errors | Access Notes |
| --- | --- | --- | --- | --- |
| `driverSetOnline({ online: boolean })` | Callable | `online` flag | `{ ok: true }` / errors: `unauthenticated`, `failed-precondition (busy driver)` | Updates `drivers/{uid}` `isOnline`. Guards: can't go offline while busy. |
| `driverHeartbeat()` | Callable | none | `{ ok: true }` | Touches `drivers/{uid}.lastSeenAtMs`. Run at least every 30s when online. |
| `tripRequest({ pickup, dropoff, priceCents, metadata })` | Callable | request payload | `rideId` / validation errors | Creates `rides/{rideId}` with status `requested` and immediately runs matching to write offers. Emits audit event. |
| `offerTimeoutJob()` | Scheduled (Pub/Sub) | none | `{ ok: true }` | Periodically expires stale `offers` docs, requeueing the ride or cancelling when retries exhaust. |
| `tripAccept({ rideId })` | Callable | `rideId` | `{ ok: true }` / `failed-precondition` if ride busy or driver busy | Transitions ride to `accepted`, sets `drivers/{uid}.currentRideId`. |
| `tripUpdateStatus({ rideId, status })` | Callable | limited statuses (`started`, `in_progress`, `completed`) | `{ ok: true }` / `failed-precondition` | Enforces only allowed transitions and driver ownership; writes timestamps. |
| `tripCancel({ rideId, reason })` | Callable | `rideId`, `reason` | `{ ok: true }` / `failed-precondition`, `permission-denied` | Allows rider cancel before `in_progress`, driver cancel while `accepted`/`started`. Releases driver lock. |
| `createTestRide` | Callable (emulator-only) | helpers for tests | `{ ok: true }` | Guards with `FIRESTORE_EMULATOR_HOST` so production never exposes test helper.

**Background triggers (planned):**
* `onRideRequested(triggers matching)` – run matcher that writes `rides/{rideId}/offers/{driverId}` per candidate driver and notifies them with FCM.
* `onRideStatusChanged` – send customer notifications, append `events/{}` documents, update analytics.
* `offerTimeoutJob` – scheduled (Pub/Sub) worker that checks `offers` expiry, re-queues dispatch or cancels the ride when retries exhaust.

## 4. Security Rules Guidance
* `users/{uid}` – `allow read, write: if request.auth.uid == uid`. Stores basic profile/role.
* `drivers/{uid}` – `allow read: request.auth.uid == uid`. `allow write` limited to callable functions via Service Account (clients never write; enforce via `request.auth.token.firebase.sign_in_provider`?).
* `customers/{uid}` – `allow read, write` to authenticated owner.
* `rides/{rideId}` – `allow read` if `request.auth.uid == resource.data.customerId || resource.data.driverId == request.auth.uid || offer targeting driver`. `allow write` should be false; all mutations happen via callable Functions (enforce with `allow write: if false`).
* `rides/{rideId}/offers/{driverId}` – `allow read` only to the targeted driver or rider tied to the ride; `allow write` false for clients (status updates happen via callable functions and scheduled job). Use the `offers` collection to determine matching visibility when dispatching.
* `rides/{rideId}/events/{eventId}` – `allow read` to customer/driver, `allow write` only to backend service account.
* Additional rules: `driverLocations/{driverId}` writes limited to authenticated driver with rate rounding (Firestore TTL?).

## 5. Test Coverage Status
* Existing `packages/rules-tests` covers Firestore rule assertions for rides (pass/fail patterns already verifying `describe/it` macros). Extend to assert drivers can only read rides for which they either drive or have an offer and riders still can’t mutate statuses directly.
* `functions/test/*.unit.test.ts` already cover driver lifecycle handlers (accept → start → complete, unauthenticated errors). Add tests for `offer` lifecycle (matching, expiration, requeue), `tripCancel`, `tripUpdateStatus`, and mismatch transitions (e.g., start before accept).

## 6. Notifications & Payments (stubbed)
* Notification placeholders: `sendOfferNotification(driverId, rideId)`, `sendStatusNotification(customerId, rideId, newStatus)` invoked inside `onRideStatusChanged`. For now log-only; later integrate FCM topic per driver/customer.
* Payments: include `priceCents`, `paymentStatus` fields on `rides/{rideId}`; implement `onRideCompleted` hook to invoke payment gateway via another function (even if stubbed). Document webhook endpoints in this contract when ready.

## 7. Next Deliverables (Driver-first)
1. Expand Firestore rules to cover roles + ride visibility (see above) and ensure tests exercise them.
2. Implement callable functions for `tripUpdateStatus` + `tripCancel` + matching trigger + notifications.
3. Audit the `offers/` lifecycle (creation, expiry, requeue) in this contract so UI knows when drivers see menus and how riders observe statuses.
4. Driver app can now build screens for login → go-online → offer modal → active trip workflow once backend contract is stabilized.

Keep this document adjacent to actual schema/rules so new backend work always references a single source of truth.