#!/bin/bash

# ShiftX Stripe Configuration Script
# This script helps you configure Stripe API keys for production

set -e

echo "========================================="
echo "ShiftX Stripe Configuration"
echo "========================================="
echo ""
echo "This script will help you set up Stripe API keys."
echo "You'll need both:"
echo "  1. Publishable key (pk_test_...) for the client-side"
echo "  2. Secret key (sk_test_...) for server-side (Functions)"
echo ""
echo "Get your keys from: https://dashboard.stripe.com/test/apikeys"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install it with:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

# Prompt for publishable key
read -p "Enter your Stripe PUBLISHABLE key (pk_test_...): " PUBLISHABLE_KEY

if [[ ! $PUBLISHABLE_KEY =~ ^pk_test_ ]]; then
    echo "⚠️  Warning: Publishable key should start with 'pk_test_' for test mode"
    read -p "Continue anyway? (y/n): " CONTINUE
    if [[ $CONTINUE != "y" ]]; then
        exit 0
    fi
fi

# Update .env files
echo ""
echo "Updating .env files..."

# Customer app
if [ -f "packages/customer-app/.env" ]; then
    if grep -q "VITE_STRIPE_PUBLISHABLE_KEY=" packages/customer-app/.env; then
        # Update existing key
        sed -i.bak "s|VITE_STRIPE_PUBLISHABLE_KEY=.*|VITE_STRIPE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY|" packages/customer-app/.env
        rm packages/customer-app/.env.bak
    else
        # Append key
        echo "VITE_STRIPE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY" >> packages/customer-app/.env
    fi
    echo "✅ Updated packages/customer-app/.env"
else
    echo "⚠️  packages/customer-app/.env not found"
fi

# Prompt for secret key
echo ""
read -sp "Enter your Stripe SECRET key (sk_test_...): " SECRET_KEY
echo ""

if [[ ! $SECRET_KEY =~ ^sk_test_ ]]; then
    echo "⚠️  Warning: Secret key should start with 'sk_test_' for test mode"
    read -p "Continue anyway? (y/n): " CONTINUE
    if [[ $CONTINUE != "y" ]]; then
        exit 0
    fi
fi

# Set secret in Firebase Functions
echo ""
echo "Setting secret in Firebase Functions..."
echo ""
echo "Choose method:"
echo "  1) Firebase Secrets (recommended for production)"
echo "  2) Environment config (legacy, simpler for development)"
read -p "Enter choice (1 or 2): " METHOD

if [ "$METHOD" == "1" ]; then
    echo ""
    echo "Setting Firebase secret..."
    echo "$SECRET_KEY" | firebase functions:secrets:set STRIPE_SECRET_KEY
    echo "✅ Secret set successfully"
    echo ""
    echo "Note: You may need to redeploy functions:"
    echo "   firebase deploy --only functions"
elif [ "$METHOD" == "2" ]; then
    echo ""
    echo "Setting environment config..."
    firebase functions:config:set stripe.secret_key="$SECRET_KEY"
    echo "✅ Config set successfully"
    echo ""
    echo "Note: You need to redeploy functions:"
    echo "   firebase deploy --only functions"
else
    echo "Invalid choice. Exiting."
    exit 1
fi

echo ""
echo "========================================="
echo "✅ Stripe configuration complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Test in development mode (emulator)"
echo "  2. Deploy functions: firebase deploy --only functions"
echo "  3. Deploy customer app: firebase deploy --only hosting:customer"
echo ""
echo "⚠️  Remember: You're using TEST MODE keys."
echo "   Switch to LIVE MODE keys only when ready for production."
echo ""
