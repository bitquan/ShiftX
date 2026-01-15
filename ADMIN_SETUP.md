# Admin Setup Instructions

## Adding Admin Users

To grant admin privileges to a user, add their UID to the Firestore `config/admins` document.

### Steps:

1. Open Firebase Console or use the emulator UI (http://localhost:4000)
2. Navigate to Firestore
3. Create or update the document: `config/admins`
4. Add the user's UID to the `uids` array field

Example document structure:
```json
{
  "uids": [
    "your-admin-uid-here",
    "another-admin-uid"
  ]
}
```

### For Development (Emulator):

You can seed admin UIDs by creating the document manually in the Firebase Emulator UI, or the app will automatically check and assign admin role on login if the UID matches the allowlist.

### Current Admin UIDs:

Add your test user UIDs here for reference during development.
