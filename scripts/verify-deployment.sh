#!/usr/bin/env bash
set -euo pipefail

# Verify PR26-28 deployment status
# Checks that claimed features actually work in production

echo "🔍 Verifying PR26-28 Deployment Status"
echo "========================================"
echo ""

FAILED=0

# Check 1: Firestore Rules Deployed
echo "✓ Check 1: Firestore Rules"
echo "  Checking if rules were deployed..."
RULES_UPDATED=$(firebase firestore:rules:get 2>&1 | grep -c "adminLogs" || echo "0")
if [ "$RULES_UPDATED" -gt 0 ]; then
  echo "  ✅ Rules include adminLogs collection"
else
  echo "  ❌ Rules may not be deployed"
  FAILED=$((FAILED + 1))
fi
echo ""

# Check 2: Runtime Flags Document Exists
echo "✓ Check 2: Runtime Flags Config Document"
echo "  Verifying config/runtimeFlags exists in Firestore..."
echo "  ℹ️  Check manually at: https://console.firebase.google.com/project/shiftx-95c4b/firestore"
echo ""

# Check 3: Hosting Deployments
echo "✓ Check 3: Hosting Deployments"
echo "  Driver App: https://shiftx-95c4b-driver.web.app"
echo "  Customer App: https://shiftx-95c4b-customer.web.app"
echo "  Admin Dashboard: https://shiftx-95c4b-admin.web.app"
echo ""

# Check 4: Cloud Functions
echo "✓ Check 4: Cloud Functions Deployed"
FUNCS_TO_CHECK="approveDriver listDrivers"
for func in $FUNCS_TO_CHECK; do
  echo -n "  Checking $func... "
  STATUS=$(firebase functions:list 2>&1 | grep -c "$func" || echo "0")
  if [ "$STATUS" -gt 0 ]; then
    echo "✅"
  else
    echo "❌"
    FAILED=$((FAILED + 1))
  fi
done
echo ""

# Check 5: Test Accounts for Smoke Test
echo "✓ Check 5: Production Test Accounts"
echo "  Required for: node scripts/smokeTest.js --mode production"
echo "  Accounts:"
echo "    - smoketest-customer@shiftx.test"
echo "    - smoketest-driver@shiftx.test"
echo "  ℹ️  Run: node scripts/create-test-accounts.js to verify"
echo ""

# Summary
echo "========================================"
if [ $FAILED -eq 0 ]; then
  echo "✅ All automated checks passed"
  echo ""
  echo "Manual verification needed:"
  echo "1. Test runtime flags in admin dashboard"
  echo "2. Toggle disableNewRequests and verify customer app blocks requests"
  echo "3. Check adminLogs collection for audit trail"
  echo "4. Test driver approve/disable in admin dashboard"
else
  echo "❌ $FAILED check(s) failed - review deployment"
  exit 1
fi
