#!/usr/bin/env bash
set -euo pipefail

# Deploy specific Cloud Functions with impact awareness
# Usage: ./scripts/deploy-functions.sh approveDriver
#        ./scripts/deploy-functions.sh acceptRide,startRide,cancelRide

if [ $# -lt 1 ]; then
  echo "❌ Usage: ./scripts/deploy-functions.sh <function1,function2,...>"
  echo ""
  echo "Examples:"
  echo "  ./scripts/deploy-functions.sh approveDriver"
  echo "  ./scripts/deploy-functions.sh acceptRide,startRide,completeRide"
  echo ""
  echo "To deploy ALL functions (only when shared code changes):"
  echo "  firebase deploy --only functions"
  exit 1
fi

FUNCS="$1"
FUNC_COUNT=$(echo "$FUNCS" | tr ',' '\n' | wc -l | xargs)

echo "🚀 Deploying $FUNC_COUNT function(s): $FUNCS"
echo ""

# Convert comma-separated list to firebase format
# acceptRide,startRide -> functions:acceptRide,functions:startRide
FIREBASE_TARGET=$(echo "$FUNCS" | sed 's/,/,functions:/g' | sed 's/^/functions:/')

echo "📦 Firebase target: --only $FIREBASE_TARGET"
echo ""

# Build first
echo "🔨 Building functions..."
cd functions && npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi
cd ..

# Deploy
echo ""
echo "🚢 Deploying..."
firebase deploy --only "$FIREBASE_TARGET"

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Deployment complete!"
else
  echo ""
  echo "❌ Deployment failed"
  exit 1
fi
