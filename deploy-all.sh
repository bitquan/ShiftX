#!/bin/bash
# deploy-all.sh - Build and deploy all ShiftX apps to production

set -e  # Exit on error

echo "🚀 ShiftX Production Deployment"
echo "================================"
echo ""

# Build customer app
echo "📦 Building customer-app..."
cd packages/customer-app
npm run build
cd ../..
echo "✅ Customer app built"
echo ""

# Build driver app
echo "📦 Building driver-app..."
cd packages/driver-app
npm run build
cd ../..
echo "✅ Driver app built"
echo ""

# Build admin dashboard
echo "📦 Building admin-dashboard..."
cd packages/admin-dashboard
npm run build
cd ../..
echo "✅ Admin dashboard built"
echo ""

# Verify BUILD_MARKER in all builds
echo "🔍 Verifying build markers..."
if ! grep -q "SHIFTX_DEBUG_PANEL_v1" packages/customer-app/dist/assets/*.js; then
  echo "❌ ERROR: BUILD_MARKER not found in customer-app"
  exit 1
fi
if ! grep -q "SHIFTX_DEBUG_PANEL_v1" packages/driver-app/dist/assets/*.js; then
  echo "❌ ERROR: BUILD_MARKER not found in driver-app"
  exit 1
fi
if ! grep -q "SHIFTX_DEBUG_PANEL_v1" packages/admin-dashboard/dist/assets/*.js; then
  echo "❌ ERROR: BUILD_MARKER not found in admin-dashboard"
  exit 1
fi
echo "✅ Build markers verified in all apps"
echo ""

# Deploy to Firebase
echo "☁️  Deploying to Firebase..."
firebase deploy --only hosting
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📍 Production URLs:"
echo "   Customer:  https://shiftx-95c4b-customer.web.app"
echo "   Driver:    https://shiftx-95c4b-driver.web.app"
echo "   Admin:     https://shiftx-95c4b-admin.web.app"
echo ""
echo "🐛 Debug with: ?debug=1"
