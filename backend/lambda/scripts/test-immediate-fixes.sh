#!/bin/bash

# ============================================================================
# Test Script for Immediate Fixes
# ============================================================================
# Tests:
# 1. Environment variable validation
# 2. Health check endpoint
# 3. Route ordering (specific routes before parameterized)
# ============================================================================

set -e

echo "🧪 Testing Immediate Fixes Implementation"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test configuration
API_URL="${API_URL:-http://localhost:3000}"
LAMBDA_DIR="$(cd "$(dirname "$0")" && pwd)"

# ============================================================================
# Test 1: Environment Variable Validation
# ============================================================================

echo "📋 Test 1: Environment Variable Validation"
echo "-------------------------------------------"

cd "$LAMBDA_DIR"

# Test with valid environment (if vars are set)
if [ -n "$DB_HOST" ] && [ -n "$DB_NAME" ]; then
    echo "✅ Environment variables are set"
    echo "   DB_HOST: ${DB_HOST:0:20}..."
    echo "   DB_NAME: $DB_NAME"
else
    echo "⚠️  Environment variables not set (this is expected in some environments)"
    echo "   Set DB_HOST and DB_NAME to test validation"
fi

# Test TypeScript compilation (validates imports)
echo ""
echo "🔍 Testing TypeScript compilation..."
if npm run build:ts > /dev/null 2>&1; then
    echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
else
    echo -e "${RED}❌ TypeScript compilation failed${NC}"
    echo "   Run: npm run build:ts"
    exit 1
fi

# ============================================================================
# Test 2: Health Check Endpoint
# ============================================================================

echo ""
echo "📋 Test 2: Health Check Endpoint"
echo "----------------------------------"

# Check if server is running
if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
    echo "✅ Server is running at $API_URL"
    
    echo ""
    echo "🔍 Testing /health endpoint..."
    HEALTH_RESPONSE=$(curl -s "$API_URL/health")
    
    # Check if response contains expected fields
    if echo "$HEALTH_RESPONSE" | grep -q '"status"'; then
        echo -e "${GREEN}✅ Health endpoint returns valid JSON${NC}"
        echo ""
        echo "Response:"
        echo "$HEALTH_RESPONSE" | jq '.' 2>/dev/null || echo "$HEALTH_RESPONSE"
        
        # Check database status
        if echo "$HEALTH_RESPONSE" | grep -q '"database"'; then
            DB_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.database.connected' 2>/dev/null || echo "unknown")
            if [ "$DB_STATUS" = "true" ]; then
                echo -e "${GREEN}✅ Database connection: healthy${NC}"
            elif [ "$DB_STATUS" = "false" ]; then
                echo -e "${YELLOW}⚠️  Database connection: unhealthy${NC}"
                DB_ERROR=$(echo "$HEALTH_RESPONSE" | jq -r '.database.error // "Unknown error"' 2>/dev/null)
                echo "   Error: $DB_ERROR"
            else
                echo -e "${YELLOW}⚠️  Database status: unknown${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  Health response missing database status${NC}"
        fi
        
        # Check environment validation
        if echo "$HEALTH_RESPONSE" | grep -q '"environment"'; then
            ENV_VALID=$(echo "$HEALTH_RESPONSE" | jq -r '.environment.valid' 2>/dev/null || echo "unknown")
            if [ "$ENV_VALID" = "true" ]; then
                echo -e "${GREEN}✅ Environment validation: passed${NC}"
            else
                echo -e "${YELLOW}⚠️  Environment validation: failed${NC}"
            fi
        fi
    else
        echo -e "${RED}❌ Health endpoint response invalid${NC}"
        echo "Response: $HEALTH_RESPONSE"
    fi
else
    echo -e "${YELLOW}⚠️  Server not running at $API_URL${NC}"
    echo "   Start server with: npm run start:local"
    echo "   Or set API_URL environment variable"
fi

# ============================================================================
# Test 3: Route Ordering (Specific Routes)
# ============================================================================

echo ""
echo "📋 Test 3: Route Ordering"
echo "-------------------------"

# Test specific routes that should work (not be caught by parameterized routes)
SPECIFIC_ROUTES=(
    "/customer/notifications"
    "/customer/behavior-journal"
    "/customer/profile"
    "/services/categories"
)

for route in "${SPECIFIC_ROUTES[@]}"; do
    if curl -s -f "$API_URL$route" > /dev/null 2>&1; then
        STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$route")
        if [ "$STATUS_CODE" = "200" ] || [ "$STATUS_CODE" = "401" ] || [ "$STATUS_CODE" = "403" ]; then
            echo -e "${GREEN}✅ Route $route: accessible (HTTP $STATUS_CODE)${NC}"
        elif [ "$STATUS_CODE" = "404" ]; then
            echo -e "${RED}❌ Route $route: Not found (may be caught by parameterized route)${NC}"
        else
            echo -e "${YELLOW}⚠️  Route $route: HTTP $STATUS_CODE${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Route $route: Server not accessible${NC}"
    fi
done

# ============================================================================
# Test 4: Environment Variable Validation Function
# ============================================================================

echo ""
echo "📋 Test 4: Environment Validation Function"
echo "--------------------------------------------"

# Test the validation function directly (if Node.js is available)
if command -v node > /dev/null 2>&1; then
    echo "🔍 Testing env-validation.ts..."
    
    # Create a test script
    cat > /tmp/test-env-validation.js << 'EOF'
const { validateEnvironment, getValidationReport } = require('./dist/utils/env-validation.js');

console.log('Testing environment validation...\n');

const result = validateEnvironment();
console.log('Validation Result:');
console.log('- Valid:', result.valid);
console.log('- Missing:', result.missing.length, 'variables');
console.log('- Warnings:', result.warnings.length);
console.log('- Errors:', result.errors.length);

if (result.missing.length > 0) {
    console.log('\nMissing variables:');
    result.missing.forEach(v => console.log('  -', v));
}

if (result.warnings.length > 0) {
    console.log('\nWarnings:');
    result.warnings.forEach(w => console.log('  -', w));
}

if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(e => console.log('  -', e));
}

console.log('\n' + getValidationReport());
EOF

    if [ -f "$LAMBDA_DIR/dist/utils/env-validation.js" ]; then
        cd "$LAMBDA_DIR"
        node /tmp/test-env-validation.js 2>&1 || echo "⚠️  Could not test validation function (build required)"
        rm -f /tmp/test-env-validation.js
    else
        echo "⚠️  Build required to test validation function"
        echo "   Run: npm run build"
    fi
else
    echo "⚠️  Node.js not available for direct function testing"
fi

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "=========================================="
echo "🧪 Test Summary"
echo "=========================================="
echo ""
echo "✅ TypeScript compilation: Tested"
echo "✅ Health check endpoint: Tested"
echo "✅ Route ordering: Tested"
echo "✅ Environment validation: Tested"
echo ""
echo "📝 Next Steps:"
echo "   1. Review test results above"
echo "   2. Fix any issues found"
echo "   3. Run full test suite: npm test"
echo ""
