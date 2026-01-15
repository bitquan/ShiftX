#!/usr/bin/env bash
set -euo pipefail

# Analyze which functions are impacted by code changes
# Usage: ./scripts/analyze-function-impact.sh

echo "🔍 Analyzing function impact from git changes..."
echo ""

# Get changed files
CHANGED_FILES=$(git diff --name-only HEAD~1 2>/dev/null || echo "")

if [ -z "$CHANGED_FILES" ]; then
  echo "ℹ️  No uncommitted changes detected. Checking staged files..."
  CHANGED_FILES=$(git diff --name-only --cached 2>/dev/null || echo "")
fi

if [ -z "$CHANGED_FILES" ]; then
  echo "❌ No changes detected. Commit changes first or check git status."
  exit 1
fi

echo "📝 Changed files:"
echo "$CHANGED_FILES" | sed 's/^/  - /'
echo ""

# Check if shared/core files changed
SHARED_CHANGED=false
SHARED_FILES="functions/src/shared|functions/src/config|functions/src/types|functions/src/utils"

if echo "$CHANGED_FILES" | grep -qE "$SHARED_FILES"; then
  SHARED_CHANGED=true
fi

# Determine deployment strategy
if [ "$SHARED_CHANGED" = true ]; then
  echo "⚠️  SHARED/CORE FILES CHANGED"
  echo ""
  echo "Affected files in shared directories:"
  echo "$CHANGED_FILES" | grep -E "$SHARED_FILES" | sed 's/^/  - /'
  echo ""
  echo "🚨 Recommendation: Deploy ALL functions"
  echo "   firebase deploy --only functions"
  exit 0
fi

# Extract specific function files
FUNC_FILES=$(echo "$CHANGED_FILES" | grep "^functions/src/" | grep -v "test\|spec" || echo "")

if [ -z "$FUNC_FILES" ]; then
  echo "ℹ️  No function files changed. No deployment needed."
  exit 0
fi

# Extract function names from changed files
# Example: functions/src/driver.ts -> driver
AFFECTED_FUNCS=""
for file in $FUNC_FILES; do
  if [[ "$file" =~ functions/src/([a-zA-Z0-9_-]+)\.ts$ ]]; then
    MODULE="${BASH_REMATCH[1]}"
    
    # Get exported function names from the file
    FUNCS=$(grep -E "^export const \w+ = " "functions/src/$MODULE.ts" | sed 's/export const //' | sed 's/ =.*//' || echo "")
    
    if [ -n "$FUNCS" ]; then
      echo "📦 Module: $MODULE"
      echo "   Functions:"
      echo "$FUNCS" | sed 's/^/     - /'
      
      # Add to list
      if [ -z "$AFFECTED_FUNCS" ]; then
        AFFECTED_FUNCS="$FUNCS"
      else
        AFFECTED_FUNCS="$AFFECTED_FUNCS,$FUNCS"
      fi
    fi
  fi
done

echo ""
if [ -n "$AFFECTED_FUNCS" ]; then
  # Remove duplicates and format
  DEPLOY_LIST=$(echo "$AFFECTED_FUNCS" | tr ',' '\n' | sort -u | paste -sd ',' -)
  
  echo "✅ Recommendation: Deploy specific functions"
  echo "   ./scripts/deploy-functions.sh $DEPLOY_LIST"
else
  echo "ℹ️  No specific functions identified. Review changes manually."
fi
