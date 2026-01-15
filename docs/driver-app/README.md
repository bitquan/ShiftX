# Driver App Documentation

This folder contains documentation specific to the driver web application.

## 📚 Files in This Folder

- **[DRIVER-APP-WORKFLOW.md](DRIVER-APP-WORKFLOW.md)** - Complete user flow and interaction design
- **[ROUTING.md](ROUTING.md)** - Map routing implementation details

## 🚗 Driver App Overview

The driver app is a React web application for drivers to:
- View and accept ride offers
- Navigate to pickup and dropoff locations
- Manage active rides (Accept → Start → In Progress → Complete)
- View earnings and trip history
- Track real-time GPS location

### Key Features

- **Bottom Navigation** - Home, Rides, Wallet, Profile
- **Ride Offers** - Accept/decline with countdown timer
- **GPS Tracking** - Real-time location updates (5s/20m throttle)
- **Earnings Dashboard** - Today/week totals with ledger
- **Navigation** - One-tap Apple Maps integration
- **Payment Status** - Visual indicator when payment authorized

### Technology Stack

- React 18 + TypeScript
- Vite for bundling
- Firebase SDK (Auth, Firestore, Functions)
- React Leaflet for maps
- Geolocation API for GPS

### Development

```bash
cd packages/driver-app
npm install
npm run dev        # Local development
npm run build      # Production build
```

Deployed to: https://shiftx-95c4b-driver.web.app

See [DRIVER-APP-WORKFLOW.md](DRIVER-APP-WORKFLOW.md) for complete user flow documentation.
