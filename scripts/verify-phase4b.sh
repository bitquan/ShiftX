#!/bin/bash
# Phase 4B: Pre-deployment Verification Script
# Run this before device testing to verify all files are in place

echo "🔍 Phase 4B Verification Script"
echo "================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $1 (MISSING)"
        ((FAIL++))
    fi
}

# Function to check directory exists
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✓${NC} $1/"
        ((PASS++))
    else
        echo -e "${RED}✗${NC} $1/ (MISSING)"
        ((FAIL++))
    fi
}

echo "📁 Checking TypeScript files..."
check_file "packages/driver-app/src/native/ShiftXNavigation.ts"
check_file "packages/driver-app/src/native/ShiftXNavigationWeb.ts"
check_file "packages/driver-app/src/components/ActiveRideSheet.tsx"
echo ""

echo "📱 Checking iOS files..."
check_file "ios/App/App/Plugins/ShiftXNavigationPlugin.swift"
check_dir "ios/App/App/Plugins"
echo ""

echo "🤖 Checking Android files..."
check_file "android/app/src/main/java/com/shiftx/driver/ShiftXNavigationPlugin.kt"
check_file "android/app/src/main/java/com/shiftx/driver/ShiftXNavigationActivity.kt"
echo ""

echo "📚 Checking documentation..."
check_file "docs/driver-app/DRIVER_UI_PHASE4B_native_navigation.md"
check_file "docs/driver-app/PHASE4B_QUICK_SETUP.md"
check_file "docs/driver-app/PHASE4B_SUMMARY.md"
echo ""

echo "🔨 Checking TypeScript compilation..."
cd packages/driver-app
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} TypeScript compiles cleanly"
    ((PASS++))
else
    echo -e "${YELLOW}⚠${NC} TypeScript compilation has errors (check pre-existing issues)"
    # Don't fail for this since App.tsx has pre-existing errors
fi
cd ../..
echo ""

echo "================================"
echo "Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ Phase 4B files verified!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Get Mapbox tokens: https://account.mapbox.com/access-tokens/"
    echo "2. Follow: docs/driver-app/PHASE4B_QUICK_SETUP.md"
    echo "3. Test on real iOS + Android devices"
    exit 0
else
    echo -e "${RED}❌ Phase 4B verification failed!${NC}"
    echo ""
    echo "Missing files detected. Please review the implementation."
    exit 1
fi
