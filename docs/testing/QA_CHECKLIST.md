# ShiftX QA Checklist

## Pre-QA Setup

### Test Data Reset

Before each QA run, reset Firestore data to ensure clean state:

```bash
# Option 1: Using Firebase Console
1. Go to Firebase Console > Firestore Database
2. Select all documents in these collections:
   - rides
   - drivers (except your test driver)
   - offers
   - eventLogs (optional)
3. Delete selected documents

# Option 2: Using Emulator (Development)
1. Stop emulator: Ctrl+C
2. Clear emulator data: firebase emulators:start --clear
3. Restart: firebase emulators:start --only auth,functions,firestore

# Option 3: Manual cleanup script (see below)
```

### Test Accounts

**Customer Account:**
- Email: `customer@test.com`
- Password: `test1234`

**Driver Account:**
- Email: `driver@test.com`
- Password: `test1234`

**Create accounts if they don't exist via auth screens.**

### Stripe Test Cards

Use these test cards for payments:

**Success:**
- `4242 4242 4242 4242` - Visa (always succeeds)
- Any future expiry (e.g., 12/26)
- Any 3-digit CVC (e.g., 123)
- Any ZIP code (e.g., 12345)

**Failure (optional testing):**
- `4000 0000 0000 0002` - Card declined
- `4000 0000 0000 9995` - Insufficient funds

## Customer App QA

### Happy Path: Complete Trip

**Objective:** Full ride lifecycle from request to completion with payment capture.

**Steps:**

1. **Sign In**
   - [ ] Open customer app
   - [ ] Sign in with test account
   - [ ] Verify homepage loads

2. **Request Ride**
   - [ ] Enter pickup address (use autocomplete)
   - [ ] Enter dropoff address (use autocomplete)
   - [ ] Select service class (Economy/Premium/Luxury)
   - [ ] Verify fare estimate displays
   - [ ] Click "Request Ride"
   - [ ] Verify UI shows "Searching for driver..."

3. **Driver Accepts**
   - [ ] Switch to driver app
   - [ ] Verify driver sees offer notification
   - [ ] Driver accepts offer
   - [ ] Switch back to customer app
   - [ ] Verify status changes to "Driver Accepted"
   - [ ] Verify driver info displays (name, car, rating)
   - [ ] Verify driver ETA displays

4. **Payment Authorization**
   - [ ] Verify payment UI appears
   - [ ] Enter Stripe test card: `4242 4242 4242 4242`
   - [ ] Enter expiry: `12/26`, CVC: `123`, ZIP: `12345`
   - [ ] Click "Authorize Payment"
   - [ ] Verify payment authorized successfully
   - [ ] Verify "Save for future trips" option available
   - [ ] (Optional) Test saving payment method

5. **Driver Starts Ride**
   - [ ] Switch to driver app
   - [ ] Verify "Start Ride" button enabled (payment authorized)
   - [ ] Driver clicks "Start Ride"
   - [ ] Switch back to customer app
   - [ ] Verify status changes to "In Progress"
   - [ ] Verify map shows route

6. **Driver Completes Ride**
   - [ ] Switch to driver app
   - [ ] Driver clicks "Complete Ride"
   - [ ] Switch back to customer app
   - [ ] Verify status changes to "Completed"
   - [ ] Verify receipt displays:
     - [ ] Trip details (pickup, dropoff, distance, duration)
     - [ ] Fare breakdown (base + distance + time)
     - [ ] Payment captured confirmation
   - [ ] Verify receipt shows payment method
   - [ ] Click "Done" to return to home

7. **Ride History**
   - [ ] Open ride history
   - [ ] Verify completed trip appears
   - [ ] Verify trip details are correct
   - [ ] Verify receipt can be viewed again

**Expected Results:**
- ✅ Payment authorized (not charged) when accepted
- ✅ Payment captured on completion
- ✅ Receipt displays correctly
- ✅ Driver earns fare amount

---

### Cancel Before Payment

**Objective:** Customer cancels after driver accepts but before payment authorization.

**Steps:**

1. **Request Ride**
   - [ ] Request a new ride
   - [ ] Wait for driver to accept

2. **Cancel Ride**
   - [ ] Click "Cancel Ride"
   - [ ] Confirm cancellation
   - [ ] Verify cancellation receipt displays
   - [ ] Verify no payment was charged

3. **Driver State**
   - [ ] Switch to driver app
   - [ ] Verify driver is back online
   - [ ] Verify driver is no longer locked to ride

**Expected Results:**
- ✅ No payment authorized or charged
- ✅ Ride cancelled successfully
- ✅ Driver released from ride

---

### Cancel After Payment Timeout

**Objective:** System auto-cancels ride when customer doesn't authorize payment in time (5 minutes).

**Steps:**

1. **Request Ride**
   - [ ] Request a new ride
   - [ ] Wait for driver to accept

2. **Wait for Timeout**
   - [ ] DO NOT authorize payment
   - [ ] Wait 5+ minutes
   - [ ] Verify ride auto-cancels
   - [ ] Verify cancellation notice appears
   - [ ] Verify reason: "Payment timeout"

3. **Driver State**
   - [ ] Switch to driver app
   - [ ] Verify driver is released from ride
   - [ ] Verify driver is back online

**Expected Results:**
- ✅ Ride auto-cancelled after 5 minutes
- ✅ No payment charged
- ✅ Driver released

---

### Request Trip Again

**Objective:** Test prefill functionality from ride history.

**Steps:**

1. **View History**
   - [ ] Open ride history
   - [ ] Find a completed trip
   - [ ] Click "Request This Trip Again"

2. **Verify Prefill**
   - [ ] Verify pickup address prefilled
   - [ ] Verify dropoff address prefilled
   - [ ] Verify service class prefilled
   - [ ] Verify fare estimate matches
   - [ ] Click "Request Ride"

3. **Complete New Trip**
   - [ ] Follow happy path steps
   - [ ] Verify new trip completes successfully

**Expected Results:**
- ✅ All fields prefilled correctly
- ✅ New trip creates successfully

---

### Saved Payment Method

**Objective:** Test one-tap payment with saved card.

**Steps:**

1. **First Trip (Save Card)**
   - [ ] Request ride
   - [ ] Driver accepts
   - [ ] Authorize payment with "Save for future trips" checked
   - [ ] Complete trip

2. **Second Trip (Use Saved Card)**
   - [ ] Request another ride
   - [ ] Driver accepts
   - [ ] Verify payment UI shows saved card option
   - [ ] Click "Use Saved Card"
   - [ ] Verify payment authorizes instantly (no card entry)

3. **Complete Trip**
   - [ ] Driver starts and completes ride
   - [ ] Verify payment captured successfully

**Expected Results:**
- ✅ Card saved after first trip
- ✅ One-tap payment works on second trip
- ✅ Payment captures correctly

---

## Driver App QA

### Happy Path: Accept and Complete Ride

**Objective:** Driver accepts, starts, and completes a ride.

**Steps:**

1. **Sign In**
   - [ ] Open driver app
   - [ ] Sign in with driver account
   - [ ] Verify profile loads

2. **Go Online**
   - [ ] Toggle "Online" switch
   - [ ] Verify status changes to "Online"
   - [ ] Verify "Waiting for rides..." displays

3. **Receive Offer**
   - [ ] (Customer requests ride)
   - [ ] Verify offer notification appears
   - [ ] Verify offer displays:
     - [ ] Pickup location
     - [ ] Dropoff location
     - [ ] Fare amount
     - [ ] Distance/ETA
   - [ ] Verify countdown timer shows

4. **Accept Offer**
   - [ ] Click "Accept"
   - [ ] Verify UI changes to "Active Ride"
   - [ ] Verify customer name displays
   - [ ] Verify trip details correct

5. **Wait for Payment**
   - [ ] Verify "Start Ride" button disabled
   - [ ] Verify message: "Waiting for payment authorization"
   - [ ] (Customer authorizes payment)
   - [ ] Verify "Start Ride" button enables

6. **Start Ride**
   - [ ] Click "Start Ride"
   - [ ] Verify status changes to "In Progress"
   - [ ] Verify route displays on map
   - [ ] Verify "Complete Ride" button visible

7. **Complete Ride**
   - [ ] Click "Complete Ride"
   - [ ] Verify completion confirmation
   - [ ] Verify driver returns to online state
   - [ ] Verify earnings updated

8. **Check Wallet**
   - [ ] Open Wallet/Earnings tab
   - [ ] Verify ride appears in recent trips
   - [ ] Verify earnings total increased
   - [ ] Verify today's earnings updated

**Expected Results:**
- ✅ Offer received and accepted
- ✅ Start blocked until payment authorized
- ✅ Ride completed successfully
- ✅ Earnings updated correctly

---

### Cancel Active Ride

**Objective:** Driver cancels ride after accepting.

**Steps:**

1. **Accept Ride**
   - [ ] Go online
   - [ ] Accept incoming offer

2. **Cancel Ride**
   - [ ] Click "Cancel" button
   - [ ] Confirm cancellation
   - [ ] Verify ride cancelled
   - [ ] Verify driver returns to online state

3. **Customer State**
   - [ ] Switch to customer app
   - [ ] Verify cancellation notice appears
   - [ ] Verify no payment charged

**Expected Results:**
- ✅ Ride cancelled successfully
- ✅ Driver back online
- ✅ Customer notified

---

### Go Online/Offline Repeatedly

**Objective:** Test driver availability toggle stability.

**Steps:**

1. **Toggle Online**
   - [ ] Toggle online ON
   - [ ] Verify status updates
   - [ ] Toggle online OFF
   - [ ] Verify status updates
   - [ ] Repeat 5 times

2. **Check Auth State**
   - [ ] Verify no auth errors
   - [ ] Verify driver UID consistent
   - [ ] Sign out and sign in
   - [ ] Verify profile loads correctly

**Expected Results:**
- ✅ Toggle works reliably
- ✅ No UID weirdness
- ✅ Profile persists correctly

---

### Offers Appear Reliably

**Objective:** Verify offer notifications are reliable.

**Steps:**

1. **Go Online**
   - [ ] Driver goes online
   - [ ] (Customer requests ride)
   - [ ] Verify offer appears within 3 seconds
   - [ ] Verify offer modal displays

2. **Multiple Offers**
   - [ ] Decline offer
   - [ ] Verify offer modal closes
   - [ ] (Customer requests another ride)
   - [ ] Verify new offer appears

3. **Offer Expiry**
   - [ ] Receive offer
   - [ ] DO NOT accept or decline
   - [ ] Wait for countdown to reach 0
   - [ ] Verify offer auto-expires
   - [ ] Verify modal closes

**Expected Results:**
- ✅ Offers appear consistently
- ✅ Modal shows correct data
- ✅ Expiry works correctly

---

### Start Blocked Until Payment Authorized

**Objective:** Verify payment authorization requirement.

**Steps:**

1. **Accept Ride**
   - [ ] Accept incoming offer
   - [ ] Verify "Start Ride" button disabled
   - [ ] Verify message displays

2. **Customer Authorizes**
   - [ ] (Customer authorizes payment)
   - [ ] Verify "Start Ride" button enables
   - [ ] Click "Start Ride"
   - [ ] Verify ride starts successfully

**Expected Results:**
- ✅ Start blocked until payment authorized (server-side enforced)
- ✅ UI reflects payment state correctly

---

### In Progress UI Stable

**Objective:** Verify ride progress UI is stable.

**Steps:**

1. **Start Ride**
   - [ ] Accept and start ride
   - [ ] Verify map displays route
   - [ ] Verify customer info displays
   - [ ] Verify "Complete Ride" button visible

2. **Navigate Away and Back**
   - [ ] Switch browser tabs
   - [ ] Wait 10 seconds
   - [ ] Return to driver app
   - [ ] Verify UI state preserved
   - [ ] Verify ride still active

3. **Complete Ride**
   - [ ] Click "Complete Ride"
   - [ ] Verify completion successful

**Expected Results:**
- ✅ UI remains stable
- ✅ No state loss on tab switch
- ✅ Completion works correctly

---

### Wallet Updates Correctly

**Objective:** Verify driver earnings tracking.

**Steps:**

1. **Check Initial Balance**
   - [ ] Open Wallet tab
   - [ ] Note current earnings (today, week, total)

2. **Complete Ride**
   - [ ] Complete a test ride
   - [ ] Return to Wallet tab
   - [ ] Verify earnings increased by fare amount

3. **Verify Ride History**
   - [ ] Scroll to recent trips
   - [ ] Verify completed ride appears
   - [ ] Verify trip details correct
   - [ ] Verify fare amount matches

**Expected Results:**
- ✅ Earnings update immediately
- ✅ Ride appears in history
- ✅ All amounts correct

---

## Edge Cases & Error Handling

### Network Interruption

**Steps:**
1. [ ] Start a ride flow
2. [ ] Disable network mid-flow
3. [ ] Verify error handling
4. [ ] Re-enable network
5. [ ] Verify recovery

**Expected Results:**
- ✅ Graceful error messages
- ✅ Recovery when network restored

---

### Concurrent Requests

**Steps:**
1. [ ] Two customers request rides simultaneously
2. [ ] Verify only one driver gets both offers (serially)
3. [ ] Verify proper locking/unlocking

**Expected Results:**
- ✅ No race conditions
- ✅ Driver sees offers sequentially

---

### Payment Failure

**Steps:**
1. [ ] Request ride
2. [ ] Use declined test card: `4000 0000 0000 0002`
3. [ ] Verify error message displays
4. [ ] Retry with valid card
5. [ ] Verify payment succeeds

**Expected Results:**
- ✅ Clear error message
- ✅ Can retry payment

---

## Performance Checks

- [ ] Customer app loads in < 3 seconds
- [ ] Driver app loads in < 3 seconds
- [ ] Offer appears within 3 seconds of request
- [ ] Payment authorization completes in < 5 seconds
- [ ] No console errors in production build

---

## Security Checks

- [ ] No API keys visible in client code
- [ ] Firestore rules prevent unauthorized access
- [ ] Functions require authentication where needed
- [ ] Stripe keys are server-side only
- [ ] Payment authorization required before ride start (server-side enforced)

---

## Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Safari (latest)
- [ ] Firefox (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Post-QA Checklist

- [ ] All critical paths pass
- [ ] No blocking bugs found
- [ ] Performance acceptable
- [ ] Error handling works
- [ ] Ready for production deployment

---

## Known Issues / Future Work

Document any issues found during QA that are not blocking:

- Issue 1: [Description]
- Issue 2: [Description]
- ...

---

## Test Data Reset Script

```javascript
// Run this in Firebase Console > Firestore > Data (or via Firebase Admin SDK)

// WARNING: This will delete ALL test data!

const collections = ['rides', 'offers', 'eventLogs'];

for (const collectionName of collections) {
  const snapshot = await db.collection(collectionName).get();
  const batch = db.batch();
  
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`Deleted ${snapshot.size} documents from ${collectionName}`);
}

// Reset driver state
const driversSnapshot = await db.collection('drivers').get();
const driverBatch = db.batch();

driversSnapshot.docs.forEach(doc => {
  driverBatch.update(doc.ref, {
    isOnline: false,
    isBusy: false,
    currentRideId: null,
  });
});

await driverBatch.commit();
console.log('Reset driver states');
```

---

**QA Sign-off:**

- Tester: ___________________
- Date: ___________________
- Build Version: ___________________
- Status: [ ] PASS [ ] FAIL
- Notes: ___________________
