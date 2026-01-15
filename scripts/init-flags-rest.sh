#!/bin/bash

echo "🚀 Initializing runtime flags via Firebase REST API..."
echo ""

# Get Firebase CLI access token
TOKEN=$(firebase login:token 2>&1 | grep -o '[0-9a-zA-Z_\-\.]*' | head -1)

if [ -z "$TOKEN" ]; then
  echo "❌ Could not get Firebase token"
  echo "Run: firebase login --reauth"
  exit 1
fi

# Prepare JSON payload
JSON_DATA='{
  "fields": {
    "disablePayments": {"booleanValue": false},
    "disableNewRequests": {"booleanValue": false},
    "disableDriverOnline": {"booleanValue": false},
    "disableAcceptRide": {"booleanValue": false},
    "maintenanceMessage": {"stringValue": ""},
    "createdAtMs": {"integerValue": "'$(date +%s000)'"},
    "updatedAtMs": {"integerValue": "'$(date +%s000)'"},
    "updatedBy": {"stringValue": "init-script"},
    "version": {"stringValue": "1.0.0"}
  }
}'

# Create the document
curl -X PATCH \
  "https://firestore.googleapis.com/v1/projects/shiftx-95c4b/databases/(default)/documents/config/runtimeFlags?updateMask.fieldPaths=disablePayments&updateMask.fieldPaths=disableNewRequests&updateMask.fieldPaths=disableDriverOnline&updateMask.fieldPaths=disableAcceptRide&updateMask.fieldPaths=maintenanceMessage&updateMask.fieldPaths=createdAtMs&updateMask.fieldPaths=updatedAtMs&updateMask.fieldPaths=updatedBy&updateMask.fieldPaths=version" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$JSON_DATA"

echo ""
echo ""
echo "✅ Runtime flags initialized!"
echo ""
echo "View in Firebase Console:"
echo "https://console.firebase.google.com/project/shiftx-95c4b/firestore/data/~2Fconfig~2FruntimeFlags"
