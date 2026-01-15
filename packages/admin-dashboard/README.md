# ShiftX Admin Dashboard

Standalone admin dashboard for managing the ShiftX ride-sharing platform.

## Features

- 📊 **Overview**: Real-time KPIs (online drivers, active rides, pending approvals)
- 🚗 **Drivers**: Approve/disable driver accounts, view profiles and vehicle details
- 👤 **Customers**: View customer profiles, saved places, and ride history
- 🚀 **Rides**: Search and view detailed ride information
- 📝 **Admin Logs**: Audit trail of all admin actions

## Development

```bash
cd packages/admin-dashboard
npm install
npm run dev
```

The dashboard runs on http://localhost:5174

## Authentication

Only users with UIDs listed in the `config/admins` Firestore document can access the dashboard. Non-admin users will be automatically signed out.

## Adding Admins

Use the provided script to add admin users:

```bash
cd /path/to/shiftx
node scripts/addAdminClient.js
```

Follow the prompts to enter the admin's UID.

## Security

- Admin authentication is verified on every page load
- Non-admin users are immediately signed out
- All admin actions are logged to the `adminLogs` collection
- Uses Firebase emulators in development mode

## Tech Stack

- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Backend**: Firebase (Auth, Firestore, Functions)
- **Styling**: CSS with dark theme
- **Icons**: Emoji-based for simplicity

## Screens

### Overview
- Online drivers count (real-time)
- Active rides count (real-time)
- Pending approvals count
- Total drivers, customers, and rides

### Drivers
- List all drivers with filters (all, approved, pending, online)
- View driver photos, vehicle info, and ratings
- Approve or disable driver accounts
- Calls `approveDriver` Cloud Function

### Customers
- Search customers by name or email
- View customer profiles and saved places
- Display home and work addresses

### Rides
- Search rides by ID
- View complete ride details (customer, driver, route, timeline)
- See ride status and fare information

### Admin Logs
- View recent admin actions (last 50)
- Filter by action type
- See admin, target, and timestamp

## Notes

- The admin tab has been removed from the driver app
- All admin functionality is now centralized here
- Better security separation between driver and admin roles
- Cleaner UX with dedicated admin interface


```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
