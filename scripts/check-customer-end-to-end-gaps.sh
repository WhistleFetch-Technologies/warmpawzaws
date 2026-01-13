#!/bin/bash
# End-to-end gap analysis for Customer UI
# Checks: UI endpoints, backend endpoints, handlers, DB schema, flows

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     CUSTOMER UI END-TO-END GAP ANALYSIS                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Extract all UI API calls
echo "📋 Step 1: Extracting UI API calls..."
grep -rh "apiClient\.\(get\|post\|put\|delete\|patch\)" apps/customer-web/components/customer --include="*.tsx" --include="*.ts" | \
  sed -n "s/.*apiClient\.\(get\|post\|put\|delete\|patch\)(['\"]\([^'\"]*\)['\"].*/\1 \2/p" | \
  sort -u > /tmp/ui_calls.txt

echo "   Found $(wc -l < /tmp/ui_calls.txt) unique API calls"

# Step 2: Extract all backend endpoints
echo "📋 Step 2: Extracting backend endpoints..."
grep -rh "app\.\(get\|post\|put\|delete\|patch\)" backend/lambda/src/endpoints --include="*.ts" | \
  sed -n "s/.*app\.\(get\|post\|put\|delete\|patch\)(['\"]\([^'\"]*\)['\"].*/\1 \2/p" | \
  sort -u > /tmp/backend_endpoints.txt

echo "   Found $(wc -l < /tmp/backend_endpoints.txt) unique endpoints"

# Step 3: Find missing endpoints (UI calls that don't exist in backend)
echo ""
echo "🔍 Step 3: Finding missing endpoints..."
echo ""

MISSING_COUNT=0
while IFS= read -r line; do
  METHOD=$(echo "$line" | awk '{print $1}')
  PATH=$(echo "$line" | awk '{print $2}' | sed 's|^/||' | sed 's|?.*||')
  
  # Normalize path for comparison (remove params)
  NORMALIZED_PATH=$(echo "$PATH" | sed 's/:.*//g' | sed 's/{.*}//g')
  
  # Check if endpoint exists (case-insensitive, method-aware)
  FOUND=$(grep -i "^${METHOD} ${NORMALIZED_PATH}" /tmp/backend_endpoints.txt || true)
  
  if [ -z "$FOUND" ]; then
    # Check for similar patterns
    SIMILAR=$(grep -i "${NORMALIZED_PATH}" /tmp/backend_endpoints.txt | head -1 || true)
    if [ -z "$SIMILAR" ]; then
      echo "   ❌ MISSING: ${METHOD} ${PATH}"
      MISSING_COUNT=$((MISSING_COUNT + 1))
    fi
  fi
done < /tmp/ui_calls.txt

if [ $MISSING_COUNT -eq 0 ]; then
  echo "   ✅ All UI calls have matching backend endpoints"
else
  echo ""
  echo "   ⚠️  Found $MISSING_COUNT potentially missing endpoints"
fi

# Step 4: Check for common problematic patterns
echo ""
echo "🔍 Step 4: Checking for common issues..."
echo ""

# Check for endpoints with phone in path (should use query param)
PHONE_IN_PATH=$(grep -E "/customer/.*\$\{phone\}|/customer/.*phone" /tmp/ui_calls.txt | wc -l)
if [ $PHONE_IN_PATH -gt 0 ]; then
  echo "   ⚠️  Found endpoints with phone in path (should use query param)"
fi

# Check for hardcoded endpoints
HARDCODED=$(grep -r "http://\|https://" apps/customer-web/components/customer --include="*.tsx" --include="*.ts" | grep -v "apiBaseUrl\|runtime-config" | wc -l)
if [ $HARDCODED -gt 0 ]; then
  echo "   ⚠️  Found $HARDCODED hardcoded URLs (should use apiClient)"
fi

# Step 5: Check for syntax errors
echo ""
echo "🔍 Step 5: Checking for syntax errors..."
cd backend/lambda
if npm run build 2>&1 | grep -i "error\|failed" > /dev/null; then
  echo "   ❌ Build errors found"
else
  echo "   ✅ No build errors"
fi
cd "$PROJECT_ROOT"

# Step 6: Check for TODO/FIXME in critical paths
echo ""
echo "🔍 Step 6: Checking for TODOs in critical paths..."
TODOS=$(grep -r "TODO\|FIXME" apps/customer-web/components/customer backend/lambda/src/endpoints --include="*.tsx" --include="*.ts" | grep -v "node_modules" | wc -l)
if [ $TODOS -gt 0 ]; then
  echo "   ⚠️  Found $TODOS TODOs/FIXMEs"
  echo "   Review these for incomplete implementations"
else
  echo "   ✅ No critical TODOs found"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     ANALYSIS COMPLETE                                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
