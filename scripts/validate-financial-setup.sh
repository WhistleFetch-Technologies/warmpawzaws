#!/bin/bash

# ============================================================================
# Financial Setup Validation Script
# ============================================================================
# Validates that all financial fixes are properly set up
# ============================================================================

set -e

echo "🔍 Validating Financial Setup..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if migrations exist
echo "📋 Checking migration files..."
if [ -f "db/migrations/008_financial_flows_complete.sql" ]; then
    echo -e "${GREEN}✅ Migration 008 found${NC}"
else
    echo -e "${RED}❌ Migration 008 not found${NC}"
    exit 1
fi

if [ -f "db/migrations/009_financial_rpc_functions.sql" ]; then
    echo -e "${GREEN}✅ Migration 009 found${NC}"
else
    echo -e "${RED}❌ Migration 009 not found${NC}"
    exit 1
fi

# Check if service files exist
echo ""
echo "🔧 Checking service files..."
SERVICES=(
    "supabase/lib/services/commission-calculator.ts"
    "supabase/lib/services/gst-calculator.ts"
    "supabase/lib/services/wallet-service.ts"
    "supabase/lib/services/settlement-service.ts"
)

for service in "${SERVICES[@]}"; do
    if [ -f "$service" ]; then
        echo -e "${GREEN}✅ $(basename $service) found${NC}"
    else
        echo -e "${RED}❌ $(basename $service) not found${NC}"
        exit 1
    fi
done

# Check if endpoint files exist
echo ""
echo "🌐 Checking endpoint files..."
ENDPOINTS=(
    "src/supabase/functions/server/payment-endpoints-fixed.tsx"
    "src/supabase/functions/server/tier-upgrade-endpoints.tsx"
    "supabase/functions/make-server-3dd53475/settlement-automation-sql.tsx"
)

for endpoint in "${ENDPOINTS[@]}"; do
    if [ -f "$endpoint" ]; then
        echo -e "${GREEN}✅ $(basename $endpoint) found${NC}"
    else
        echo -e "${RED}❌ $(basename $endpoint) not found${NC}"
        exit 1
    fi
done

# Check if UI components exist
echo ""
echo "🎨 Checking UI components..."
UI_COMPONENTS=(
    "src/components/admin/finance/TierManagement.tsx"
    "src/components/vendor/TierUpgradeModalEnhanced.tsx"
)

for component in "${UI_COMPONENTS[@]}"; do
    if [ -f "$component" ]; then
        echo -e "${GREEN}✅ $(basename $component) found${NC}"
    else
        echo -e "${YELLOW}⚠️  $(basename $component) not found (optional)${NC}"
    fi
done

# Check if test file exists
echo ""
echo "🧪 Checking test files..."
if [ -f "tests/financial-flows-complete.test.ts" ]; then
    echo -e "${GREEN}✅ Test file found${NC}"
else
    echo -e "${YELLOW}⚠️  Test file not found${NC}"
fi

# Check if index.tsx imports new endpoints
echo ""
echo "📦 Checking index.tsx integration..."
if grep -q "payment-endpoints-fixed" "supabase/functions/make-server-3dd53475/index.tsx"; then
    echo -e "${GREEN}✅ Payment endpoints integrated${NC}"
else
    echo -e "${YELLOW}⚠️  Payment endpoints not found in index.tsx${NC}"
fi

if grep -q "tier-upgrade-endpoints" "supabase/functions/make-server-3dd53475/index.tsx"; then
    echo -e "${GREEN}✅ Tier upgrade endpoints integrated${NC}"
else
    echo -e "${YELLOW}⚠️  Tier upgrade endpoints not found in index.tsx${NC}"
fi

if grep -q "settlement-automation-sql" "supabase/functions/make-server-3dd53475/index.tsx"; then
    echo -e "${GREEN}✅ Settlement automation integrated${NC}"
else
    echo -e "${YELLOW}⚠️  Settlement automation not found in index.tsx${NC}"
fi

echo ""
echo -e "${GREEN}✅ Validation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Apply migrations: See NEXT_STEPS.md"
echo "2. Deploy functions: supabase functions deploy make-server-3dd53475"
echo "3. Run tests: deno test tests/financial-flows-complete.test.ts"
echo ""

