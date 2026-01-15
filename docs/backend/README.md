# Backend Documentation

This folder contains all backend-related documentation including Cloud Functions, API contracts, and Firestore security rules.

## 📚 Files in This Folder

- **[backend-contract.md](backend-contract.md)** - Complete API contracts and data models for all Cloud Functions
- **[FUNCTIONS.md](FUNCTIONS.md)** - Cloud Functions implementation details and architecture
- **[FIRESTORE_RULES_REFERENCE.md](FIRESTORE_RULES_REFERENCE.md)** - Comprehensive security rules documentation
- **[FIRESTORE_RULES_UPDATE.md](FIRESTORE_RULES_UPDATE.md)** - Recent updates to security rules
- **[firestore.rules](firestore.rules)** - Actual Firestore security rules file

## 🔧 Cloud Functions Overview

### Ride Management
- `tripRequest` - Create new ride
- `acceptRide` - Driver accepts ride
- `startRide` - Begin ride
- `progressRide` - Mark in progress
- `completeRide` - Complete ride + create ledger entry
- `cancelRide` - Cancel ride

### Driver Functions
- `driverSetOnline` - Set driver online/offline
- `driverHeartbeat` - Update GPS location
- `setDriverAvailability` - Set weekly schedule
- `getDriverLedgerSummary` - Get earnings summary

### Payment Functions
- `customerConfirmPayment` - Confirm payment method
- `setPaymentAuthorized` - Mark payment authorized
- `addPaymentMethod` - Add new payment method

### Data Functions
- `getRideEvents` - Fetch ride timeline events
- `getRideHistory` - Get customer ride history
- `declineOffer` - Decline ride offer

## 🔒 Security

All Firestore security is enforced through:
1. **Security Rules** (`firestore.rules`) - Database-level access control
2. **Cloud Functions Auth** - Authentication checks in each function
3. **Transaction Safety** - All updates use Firestore transactions

## 🚀 Deployment

Functions are deployed to Firebase Cloud Functions Gen 2:
- Region: `us-central1`
- Runtime: Node.js 20
- Max Instances: 3 (cost control)

See [/deployment/](../deployment/) for deployment procedures.
