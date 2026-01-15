# Customer App Documentation

This folder contains documentation specific to the customer web application.

## 📚 Files in This Folder

- **[BUILD_COMPLETE.md](BUILD_COMPLETE.md)** - Customer app build summary and feature list
- **[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)** - Detailed implementation guide
- **[INTEGRATION_TESTS.md](INTEGRATION_TESTS.md)** - Integration testing procedures
- **[MANUAL_TEST_CHECKLIST.md](MANUAL_TEST_CHECKLIST.md)** - Manual QA testing checklist
- **[QUICKSTART.md](QUICKSTART.md)** - Quick start guide for developers

## 📱 Customer App Overview

The customer app is a React web application for riders to:
- Request rides with map or address autocomplete
- Track driver location in real-time
- View ride history and receipts
- Rebook previous trips
- Manage payment methods

### Key Features

- **Ride Requests** - Tap map or search address for pickup/dropoff
- **Real-Time Tracking** - Live driver location with car icon
- **Ride Timeline** - Event-based timeline (accepted, started, in progress, completed)
- **Ride History** - Past rides with receipts
- **Request Again** - One-click rebooking
- **Stripe Payments** - Secure payment processing

### Technology Stack

- React 18 + TypeScript
- Vite for bundling
- Firebase SDK (Auth, Firestore, Functions)
- React Leaflet for maps
- Stripe Elements for payments
- Address Autocomplete (Mapbox/Google)

### Development

```bash
cd packages/customer-app
npm install
npm run dev        # Local development
npm run build      # Production build
```

Deployed to: https://shiftx-95c4b-customer.web.app

See [BUILD_COMPLETE.md](BUILD_COMPLETE.md) for complete feature documentation.
