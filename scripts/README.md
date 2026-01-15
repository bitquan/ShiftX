# Admin Management Scripts

## Add Admin User

To add yourself or another user as an admin:

### For Emulator (Development)
```bash
# First, sign in to the driver app and copy your UID from the Debug panel
# Then run:
FIRESTORE_EMULATOR_HOST=localhost:8081 node scripts/addAdmin.js add YOUR_UID_HERE
```

### For Production
```bash
node scripts/addAdmin.js add YOUR_UID_HERE
```

## List Admins
```bash
# Emulator
FIRESTORE_EMULATOR_HOST=localhost:8081 node scripts/addAdmin.js list

# Production
node scripts/addAdmin.js list
```

## Remove Admin
```bash
# Emulator
FIRESTORE_EMULATOR_HOST=localhost:8081 node scripts/addAdmin.js remove UID_HERE

# Production
node scripts/addAdmin.js remove UID_HERE
```

## How to get your UID

1. Sign in to the driver app
2. Click the "Debug" button in the top right
3. Look for your UID in the debug panel
4. Copy it and use it in the commands above

## Initial Setup for Testing

1. Start emulators: `firebase emulators:start`
2. Sign in to driver app
3. Copy your UID from debug panel
4. Run: `FIRESTORE_EMULATOR_HOST=localhost:8081 node scripts/addAdmin.js add YOUR_UID`
5. Refresh the driver app - you should now see the Admin tab
