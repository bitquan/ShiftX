#!/bin/bash
# Check for missing .env files

set -e

echo "🔍 Checking environment files..."

# Required env files
REQUIRED_ENV_FILES=(
  "packages/customer-app/.env"
  "packages/driver-app/.env"
  "functions/.env.local"
)

# Optional env files
OPTIONAL_ENV_FILES=(
  "packages/admin-dashboard/.env"
  "packages/customer-app/.env.production"
  "packages/driver-app/.env.production"
)

MISSING_CRITICAL=0
MISSING_OPTIONAL=0

# Check required files
for file in "${REQUIRED_ENV_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ CRITICAL: Missing $file"
    echo "   Copy from $file.example and fill in values"
    MISSING_CRITICAL=1
  else
    echo "✅ Found $file"
  fi
done

# Check optional files
for file in "${OPTIONAL_ENV_FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "⚠️  Optional: Missing $file"
    MISSING_OPTIONAL=1
  else
    echo "✅ Found $file"
  fi
done

# Check for secrets in git
echo ""
echo "🔒 Checking for secrets in git..."
if git ls-files | grep -E "\.env$|\.env\.local$|serviceAccountKey\.json$" > /dev/null; then
  echo "❌ WARNING: Secret files are tracked by git!"
  echo "   Run: git rm --cached <file> to untrack them"
  exit 1
else
  echo "✅ No secret files tracked by git"
fi

# Exit with error if critical files missing
if [ $MISSING_CRITICAL -eq 1 ]; then
  echo ""
  echo "❌ Critical environment files missing. Please create them before continuing."
  exit 1
fi

if [ $MISSING_OPTIONAL -eq 1 ]; then
  echo ""
  echo "⚠️  Some optional environment files are missing, but development can continue."
fi

echo ""
echo "✅ Environment files check complete!"
exit 0
