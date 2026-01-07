#!/bin/bash
# Verify Vendor Onboarding Setup
# Checks if migrations are ready and provides next steps

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "================================================================="
echo "🔍 Vendor Onboarding Setup Verification"
echo "================================================================="
echo ""

# Check migration files
echo "📋 Checking migration files..."
MIGRATION_049="db/migrations/049_vendor_onboarding_state_machine.sql"
MIGRATION_050="db/migrations/050_seed_onboarding_role_configs.sql"

if [ -f "$MIGRATION_049" ]; then
    echo -e "${GREEN}✅ Migration 049 exists${NC}"
    LINES_049=$(wc -l < "$MIGRATION_049")
    echo "   Lines: $LINES_049"
else
    echo -e "${RED}❌ Migration 049 not found${NC}"
    exit 1
fi

if [ -f "$MIGRATION_050" ]; then
    echo -e "${GREEN}✅ Migration 050 exists${NC}"
    LINES_050=$(wc -l < "$MIGRATION_050")
    echo "   Lines: $LINES_050"
else
    echo -e "${YELLOW}⚠️  Migration 050 not found (optional - role configs)${NC}"
fi

# Check API endpoints file
echo ""
echo "📡 Checking API endpoints..."
if [ -f "backend/lambda/src/endpoints/vendor-onboarding.ts" ]; then
    echo -e "${GREEN}✅ API endpoints file exists${NC}"
    ENDPOINT_COUNT=$(grep -c "app\." backend/lambda/src/endpoints/vendor-onboarding.ts || echo "0")
    echo "   Endpoints defined: $ENDPOINT_COUNT"
else
    echo -e "${RED}❌ API endpoints file not found${NC}"
    exit 1
fi

# Check if endpoints are registered
echo ""
echo "🔗 Checking endpoint registration..."
if grep -q "registerVendorOnboardingEndpoints" backend/lambda/src/handler/index.ts 2>/dev/null; then
    echo -e "${GREEN}✅ Endpoints are registered in handler${NC}"
else
    echo -e "${YELLOW}⚠️  Endpoints may not be registered${NC}"
fi

# Check frontend route map
echo ""
echo "🗺️  Checking frontend route map..."
if [ -f "apps/vendor-web/app/onboarding/route-map.ts" ]; then
    echo -e "${GREEN}✅ Route map exists${NC}"
else
    echo -e "${YELLOW}⚠️  Route map not found${NC}"
fi

# Check database connection
echo ""
echo "🗄️  Checking database connection..."
if [ -n "$DATABASE_URL" ]; then
    echo -e "${GREEN}✅ DATABASE_URL is set${NC}"
    echo "   Ready to run migrations with: cd db && npm run migrate:up"
else
    echo -e "${YELLOW}⚠️  DATABASE_URL not set${NC}"
    echo "   Options:"
    echo "   1. Set DATABASE_URL and run: cd db && npm run migrate:up"
    echo "   2. Use manual script: ./scripts/manual-migrate.sh dev"
fi

# Check if AWS CLI is available (for manual migration)
if command -v aws &> /dev/null; then
    echo -e "${GREEN}✅ AWS CLI available${NC}"
    echo "   Can use: ./scripts/manual-migrate.sh dev"
else
    echo -e "${YELLOW}⚠️  AWS CLI not found${NC}"
    echo "   Install for manual migration script"
fi

echo ""
echo "================================================================="
echo "📝 Next Steps:"
echo "================================================================="
echo ""
echo "1. Run Database Migrations:"
echo "   ${BLUE}cd db && npm run migrate:up${NC}"
echo "   OR"
echo "   ${BLUE}./scripts/manual-migrate.sh dev${NC}"
echo ""
echo "2. Verify Tables Created:"
echo "   ${BLUE}cd db && npm run migrate:status${NC}"
echo ""
echo "3. Test API Endpoints:"
echo "   ${BLUE}See docs/VENDOR_ONBOARDING_NEXT_STEPS.md for curl commands${NC}"
echo ""
echo "4. Implement Frontend:"
echo "   ${BLUE}See docs/VENDOR_ONBOARDING_NEXT_STEPS.md for component code${NC}"
echo ""
echo "================================================================="

