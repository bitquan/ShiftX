#!/bin/bash
set -e  # Exit on any error

echo "🚀 ShiftX Production Deployment Script"
echo "========================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
  echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

# Validate required environment variables
print_status "Validating environment..."

if [ ! -f "packages/customer-app/.env" ]; then
  print_error "packages/customer-app/.env not found"
  exit 1
fi

if [ ! -f "packages/driver-app/.env" ]; then
  print_error "packages/driver-app/.env not found"
  exit 1
fi

# Check for required env vars in customer app
if ! grep -q "VITE_FIREBASE_API_KEY=" packages/customer-app/.env; then
  print_error "VITE_FIREBASE_API_KEY not set in customer-app/.env"
  exit 1
fi

if ! grep -q "VITE_STRIPE_PUBLISHABLE_KEY=" packages/customer-app/.env; then
  print_error "VITE_STRIPE_PUBLISHABLE_KEY not set in customer-app/.env"
  exit 1
fi

# Check Stripe key mode
STRIPE_KEY=$(grep "VITE_STRIPE_PUBLISHABLE_KEY=" packages/customer-app/.env | cut -d '=' -f2)
if [[ $STRIPE_KEY == pk_live_* ]]; then
  print_warning "WARNING: Using LIVE Stripe key!"
  read -p "Continue with LIVE key? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    print_error "Deployment cancelled"
    exit 1
  fi
elif [[ $STRIPE_KEY == pk_test_* ]]; then
  print_success "Using TEST Stripe key (safe for testing)"
else
  print_error "Invalid Stripe key format"
  exit 1
fi

# Check Firebase project
FIREBASE_PROJECT=$(firebase use 2>&1 | grep "Now using project" | awk '{print $NF}' || echo "")
if [ -z "$FIREBASE_PROJECT" ]; then
  FIREBASE_PROJECT=$(grep "VITE_FIREBASE_PROJECT_ID=" packages/customer-app/.env | cut -d '=' -f2)
fi

print_success "Target project: $FIREBASE_PROJECT"
echo ""

# Confirm deployment
read -p "Deploy to production? (yes/no): " deploy_confirm
if [ "$deploy_confirm" != "yes" ]; then
  print_error "Deployment cancelled"
  exit 1
fi

echo ""
print_status "Starting deployment..."
echo ""

# Step 1: Build and deploy Functions
print_status "1/5 Building Cloud Functions..."
cd functions
npm run build
if [ $? -ne 0 ]; then
  print_error "Functions build failed"
  exit 1
fi
print_success "Functions built successfully"
cd ..

print_status "1/5 Deploying Cloud Functions..."
firebase deploy --only functions
if [ $? -ne 0 ]; then
  print_error "Functions deployment failed"
  exit 1
fi
print_success "Functions deployed successfully"
echo ""

# Step 2: Deploy Firestore rules and indexes
print_status "2/5 Deploying Firestore rules and indexes..."
firebase deploy --only firestore
if [ $? -ne 0 ]; then
  print_error "Firestore deployment failed"
  exit 1
fi
print_success "Firestore rules and indexes deployed successfully"
echo ""

# Step 3: Build Customer App
print_status "3/5 Building Customer App..."
cd packages/customer-app
npm run build
if [ $? -ne 0 ]; then
  cd ../..
  print_error "Customer app build failed"
  exit 1
fi
print_success "Customer app built successfully"
cd ../..

# Step 4: Build Driver App
print_status "4/5 Building Driver App..."
cd packages/driver-app
npm run build
if [ $? -ne 0 ]; then
  cd ../..
  print_error "Driver app build failed"
  exit 1
fi
print_success "Driver app built successfully"
cd ../..

# Step 5: Deploy Hosting
print_status "5/5 Deploying Hosting (Customer & Driver apps)..."
firebase deploy --only hosting
if [ $? -ne 0 ]; then
  print_error "Hosting deployment failed"
  exit 1
fi
print_success "Hosting deployed successfully"
echo ""

# Deployment summary
echo ""
echo "========================================"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "========================================"
echo ""
echo "Customer App: https://$FIREBASE_PROJECT-customer.web.app"
echo "Driver App: https://$FIREBASE_PROJECT-driver.web.app"
echo ""
echo "Next steps:"
echo "1. Open customer app and check debug panel (🔧 icon)"
echo "2. Verify Stripe key mode shows TEST"
echo "3. Verify Functions are reachable"
echo "4. Test payment authorization with card 4242 4242 4242 4242"
echo ""
print_warning "Remember to clear browser cache (Cmd+Shift+R / Ctrl+Shift+R)"
