# Automated Testing Guide

**Last Updated:** January 14, 2026

---

## 🧪 Smoke Test (End-to-End)

### Overview

Comprehensive automated test that validates the complete ride flow from request to completion, including payment authorization.

**Location:** `/scripts/smokeTest.js`

**Test Duration:** ~1.2 seconds (emulator mode)

**Exit Code:** 0 on success, 1 on failure

### Test Flow

The smoke test validates these 8 steps:

1. **Create Test Users** - Creates customer and driver test accounts
2. **Driver Goes Online** - Driver sets online status and location
3. **Customer Requests Ride** - Customer creates ride request ($15.00)
4. **Driver Accepts Offer** - Driver accepts ride offer
5. **Customer Authorizes Payment** - Customer confirms payment
6. **Driver Starts Ride** - Driver arrives and starts ride
7. **Driver Progresses Ride** - Ride marked as in progress
8. **Driver Completes Ride** - Ride completed and payment captured
9. **Verify Final State** - Confirms ride status and payment

### Running the Smoke Test

#### Emulator Mode (Recommended for Development)

```bash
# Ensure emulators are running first
firebase emulators:start --only auth,functions,firestore

# In another terminal, run the test
node scripts/smokeTest.js --mode emulator
```

**What it tests:**
- Full ride lifecycle (request → complete)
- Payment state machine (none → authorized → captured)
- Event logging (timeline events)
- Driver location sync
- Offer acceptance
- Payment gating (can't start without authorization)

**Expected output:**
```
🧪 ShiftX Smoke Test (Emulator Mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Step 1: Create test users (26ms)
✓ Step 2: Driver goes online (23ms)
✓ Step 3: Customer requests ride (19ms)
✓ Step 4: Driver accepts offer (25ms)
✓ Step 5: Customer authorizes payment (730ms)
✓ Step 6: Driver starts ride (31ms)
✓ Step 7: Driver progresses ride (278ms)
✓ Step 8: Driver completes ride (4ms)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ All checks passed!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Duration: 1192ms
```

#### Production Mode (Payment Gate Verification Only)

```bash
node scripts/smokeTest.js --mode prod --api-key YOUR_FIREBASE_API_KEY
```

**What it tests:**
- Payment authorization requirement
- Start ride blocked without payment
- Production CORS configuration
- Real Stripe test mode integration

**Note:** Production mode does NOT create real rides or charge real payments. It only verifies the payment gate is in place.

### Test Configuration

#### Test Data

The smoke test uses deterministic test data:

```javascript
{
  customer: {
    email: 'smoketest-customer@test.com',
    password: 'test123'
  },
  driver: {
    email: 'smoketest-driver@test.com', 
    password: 'test123',
    location: {
      lat: 37.7749,
      lng: -122.4194
    }
  },
  ride: {
    pickup: {
      lat: 37.7749,
      lng: -122.4194
    },
    dropoff: {
      lat: 37.7849,
      lng: -122.4294
    },
    estimatedFareCents: 1500  // $15.00
  }
}
```

#### Cleanup

The smoke test automatically cleans up after itself:

- Cancels test ride (if not completed)
- Sets driver offline
- Deletes test documents from Firestore
- Preserves test run logs for debugging

### Troubleshooting

#### Test Timeout

**Symptom:** Test hangs on "Waiting for offer..."

**Causes:**
- Emulators not running
- Another driver is online (stealing the offer)
- Driver location not set correctly

**Solution:**
```bash
# 1. Stop all emulators
# 2. Clear emulator data
rm -rf ~/.config/firebase/emulator-data

# 3. Restart emulators
firebase emulators:start --only auth,functions,firestore

# 4. Run test again
node scripts/smokeTest.js --mode emulator
```

#### Payment Authorization Fails

**Symptom:** "Payment authorization failed" error

**Causes:**
- Stripe test key not set
- PaymentIntent creation failed
- CORS error (production mode)

**Solution:**
```bash
# Check functions .env
cat functions/.env | grep STRIPE_SECRET_KEY

# Should show: STRIPE_SECRET_KEY=sk_test_...
```

#### Ride Not Completing

**Symptom:** Test fails at "Complete ride" step

**Causes:**
- Payment not captured
- Ride state incorrect
- Driver not assigned

**Solution:**
```bash
# Check Firebase Console logs
firebase functions:log --only completeRide

# Look for error messages
```

### Integration with CI/CD

#### GitHub Actions Example

```yaml
name: Smoke Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          npm install
          cd functions && npm install
      
      - name: Install Firebase CLI
        run: npm install -g firebase-tools
      
      - name: Start emulators
        run: firebase emulators:start --only auth,functions,firestore &
        
      - name: Wait for emulators
        run: sleep 10
        
      - name: Run smoke test
        run: node scripts/smokeTest.js --mode emulator
```

---

## 🧩 Unit Tests

### Firestore Rules Tests

**Location:** `/packages/rules-tests/`

**Run tests:**
```bash
cd packages/rules-tests
npm test
```

**What it tests:**
- Read/write permissions for rides collection
- Driver-only access to driver documents
- Customer-only access to customer documents
- Admin access to config documents

---

## 📊 Test Coverage

| Test Type | Coverage | Status |
|-----------|----------|--------|
| E2E Smoke Test | Full ride flow | ✅ Passing |
| Firestore Rules | Security rules | ✅ Passing |
| Unit Tests | N/A | ⏳ TODO |
| Integration Tests | N/A | ⏳ TODO |

---

## 🎯 Testing Best Practices

### Before Deploying

1. ✅ Run smoke test in emulator mode
2. ✅ Run Firestore rules tests
3. ✅ Manual test key user flows
4. ✅ Check Firebase Console for errors
5. ✅ Verify environment variables

### After Deploying

1. ✅ Run smoke test in production mode (if available)
2. ✅ Manual test customer app (request ride)
3. ✅ Manual test driver app (accept offer)
4. ✅ Manual test admin dashboard (view drivers)
5. ✅ Monitor function logs for errors

### Continuous Monitoring

- Set up alerts for function failures
- Monitor error rates in Firebase Console
- Check payment success rates in Stripe Dashboard
- Review user feedback and bug reports

---

## 📝 Adding New Tests

### Creating a New Smoke Test Step

```javascript
// In scripts/smokeTest.js

async function testNewFeature(rideId, driverId) {
  console.log('\n5️⃣ Testing new feature...');
  
  try {
    // 1. Set up test data
    const testData = { /* ... */ };
    
    // 2. Call function or update Firestore
    await updateDoc(doc(db, 'rides', rideId), testData);
    
    // 3. Wait for result with retry
    await retryUntil(async () => {
      const snapshot = await getDoc(doc(db, 'rides', rideId));
      return snapshot.data().status === 'expected_status';
    }, 'Feature not working', 5000);
    
    console.log('✓ New feature works!');
    return true;
  } catch (error) {
    console.error('✗ New feature failed:', error.message);
    throw error;
  }
}
```

---

## 🔍 Debugging Failed Tests

### Enable Verbose Logging

```bash
# Set DEBUG environment variable
DEBUG=* node scripts/smokeTest.js --mode emulator
```

### Check Emulator Logs

```bash
# In emulator terminal, look for errors
# Functions logs show up in real-time
```

### Inspect Firestore Data

```bash
# Open Firestore Emulator UI
open http://localhost:4000/firestore
```

### Check Function Execution

```bash
# View function logs
firebase functions:log --only functionName
```

---

## 📚 Related Documentation

- [README.md](../../README.md) - Project overview
- [docs/deployment/PRODUCTION_DEPLOYMENT.md](../deployment/PRODUCTION_DEPLOYMENT.md) - Deployment guide
- [docs/PROJECT_STATUS.md](../PROJECT_STATUS.md) - Current status

---

**For questions about testing, refer to the [docs/INDEX.md](../INDEX.md) for full documentation.**
