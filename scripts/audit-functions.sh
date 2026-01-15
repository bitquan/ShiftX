#!/bin/bash
# Production Function Audit Script
# Verifies all required Cloud Functions are deployed with CORS

echo "🔍 ShiftX Production Functions Audit"
echo "====================================="
echo ""

PROJECT="shiftx-95c4b"

# Required functions for driver app
DRIVER_FUNCTIONS=(
  "driverSetOnline"
  "driverHeartbeat"
  "acceptRide"
  "startRide"
  "progressRide"
  "completeRide"
  "cancelRide"
  "getRideEvents"
)

# Required functions for customer app
CUSTOMER_FUNCTIONS=(
  "tripRequest"
  "cancelRide"
  "getRideEvents"
  "customerConfirmPayment"
  "setPaymentAuthorized"
  "addPaymentMethod"
)

echo "📋 Checking deployed functions..."
DEPLOYED=$(firebase functions:list --project $PROJECT 2>&1 | grep -oE "│ [a-zA-Z]+ " | tr -d '│ ')

echo ""
echo "🚗 Driver App Functions:"
for func in "${DRIVER_FUNCTIONS[@]}"; do
  if echo "$DEPLOYED" | grep -q "^$func$"; then
    echo "  ✅ $func"
  else
    echo "  ❌ $func - MISSING!"
  fi
done

echo ""
echo "👤 Customer App Functions:"
for func in "${CUSTOMER_FUNCTIONS[@]}"; do
  if echo "$DEPLOYED" | grep -q "^$func$"; then
    echo "  ✅ $func"
  else
    echo "  ❌ $func - MISSING!"
  fi
done

echo ""
echo "📊 Function Count:"
TOTAL_DEPLOYED=$(echo "$DEPLOYED" | wc -l | tr -d ' ')
echo "  Total deployed: $TOTAL_DEPLOYED"

echo ""
echo "🌐 CORS Configuration Check:"
echo "  All callable functions should have CORS configured for:"
echo "    - https://shiftx-95c4b-customer.web.app"
echo "    - https://shiftx-95c4b-driver.web.app"
echo ""
echo "  ⚠️  Manually verify in functions/src/*.ts files"

echo ""
echo "🧪 Test Commands:"
echo "  # Test customer flow"
echo "  curl -X POST https://us-central1-$PROJECT.cloudfunctions.net/tripRequest \\"
echo "    -H 'Origin: https://shiftx-95c4b-customer.web.app' \\"
echo "    -H 'Access-Control-Request-Method: POST' \\"
echo "    -X OPTIONS"
echo ""
echo "  # Test driver flow"
echo "  curl -X POST https://us-central1-$PROJECT.cloudfunctions.net/startRide \\"
echo "    -H 'Origin: https://shiftx-95c4b-driver.web.app' \\"
echo "    -H 'Access-Control-Request-Method: POST' \\"
echo "    -X OPTIONS"

echo ""
echo "✅ Audit complete!"
