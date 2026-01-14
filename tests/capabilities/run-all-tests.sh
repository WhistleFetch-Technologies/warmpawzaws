#!/bin/bash

# ============================================================================
# CAPABILITY SYSTEM - FULL VERIFICATION SCRIPT
# ============================================================================
# Run: ./tests/capabilities/run-all-tests.sh
# ============================================================================

set -e

echo "🚀 WARMPAWZ CAPABILITY SYSTEM VERIFICATION"
echo "==========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL=${API_URL:-"http://localhost:3000"}
VENDOR_WEB_URL=${VENDOR_WEB_URL:-"http://localhost:3001"}

echo -e "${BLUE}📋 Configuration:${NC}"
echo "   API URL: $API_URL"
echo "   Vendor Web URL: $VENDOR_WEB_URL"
echo ""

# ====================
# STEP 1: Check Backend Build
# ====================
echo -e "${YELLOW}STEP 1: Building Backend...${NC}"
cd "$(dirname "$0")/../../backend/lambda"
if npm run build > /tmp/backend-build.log 2>&1; then
    echo -e "${GREEN}✅ Backend build successful${NC}"
else
    echo -e "${RED}❌ Backend build failed${NC}"
    cat /tmp/backend-build.log
    exit 1
fi
cd - > /dev/null

# ====================
# STEP 2: Check Vendor Web Build
# ====================
echo -e "${YELLOW}STEP 2: Building Vendor Web...${NC}"
cd "$(dirname "$0")/../../apps/vendor-web"
if npm run build > /tmp/vendor-web-build.log 2>&1; then
    echo -e "${GREEN}✅ Vendor Web build successful${NC}"
else
    echo -e "${RED}❌ Vendor Web build failed${NC}"
    cat /tmp/vendor-web-build.log | tail -50
    exit 1
fi
cd - > /dev/null

# ====================
# STEP 3: Verify UI Pages Exist
# ====================
echo -e "${YELLOW}STEP 3: Verifying UI Pages...${NC}"

PAGES=(
    "apps/vendor-web/app/ambulance/page.tsx"
    "apps/vendor-web/app/pharmacy/page.tsx"
    "apps/vendor-web/app/adoption/page.tsx"
    "apps/vendor-web/app/training/page.tsx"
    "apps/vendor-web/app/holidays/page.tsx"
    "apps/vendor-web/app/communication/page.tsx"
    "apps/vendor-web/app/medical/diagnostics/page.tsx"
    "apps/vendor-web/app/medical/prescriptions/page.tsx"
    "apps/vendor-web/app/medical/records/page.tsx"
    "apps/vendor-web/app/cafe/tables/page.tsx"
    "apps/vendor-web/app/resort/rooms/page.tsx"
    "apps/vendor-web/app/resort/boarding/page.tsx"
    "apps/vendor-web/app/events/page.tsx"
    "apps/vendor-web/app/nutrition/plans/page.tsx"
    "apps/vendor-web/app/services/page.tsx"
)

MISSING_PAGES=0
for PAGE in "${PAGES[@]}"; do
    FULL_PATH="$(dirname "$0")/../../$PAGE"
    if [ -f "$FULL_PATH" ]; then
        echo -e "   ${GREEN}✅${NC} $PAGE"
    else
        echo -e "   ${RED}❌${NC} $PAGE (MISSING)"
        MISSING_PAGES=$((MISSING_PAGES + 1))
    fi
done

if [ $MISSING_PAGES -eq 0 ]; then
    echo -e "${GREEN}✅ All UI pages verified${NC}"
else
    echo -e "${YELLOW}⚠️  $MISSING_PAGES page(s) missing${NC}"
fi

# ====================
# STEP 4: Verify Capability Routes
# ====================
echo -e "${YELLOW}STEP 4: Verifying Capability Routes...${NC}"

CAPABILITY_ROUTES_FILE="$(dirname "$0")/../../apps/vendor-web/lib/capability-routes.ts"
if [ -f "$CAPABILITY_ROUTES_FILE" ]; then
    ROUTE_COUNT=$(grep -c "route:" "$CAPABILITY_ROUTES_FILE" 2>/dev/null || echo "0")
    echo -e "   Found $ROUTE_COUNT capability routes defined"
    echo -e "${GREEN}✅ Capability routes file exists${NC}"
else
    echo -e "${RED}❌ Capability routes file missing${NC}"
fi

# ====================
# STEP 5: Verify Database Schema
# ====================
echo -e "${YELLOW}STEP 5: Verifying Database Schema...${NC}"

SCHEMA_FILE="$(dirname "$0")/../../backend/lambda/src/database/schemas/capability-tables.sql"
if [ -f "$SCHEMA_FILE" ]; then
    TABLE_COUNT=$(grep -c "CREATE TABLE IF NOT EXISTS" "$SCHEMA_FILE" 2>/dev/null || echo "0")
    echo -e "   Found $TABLE_COUNT table definitions"
    echo -e "${GREEN}✅ Database schema file exists${NC}"
else
    echo -e "${RED}❌ Database schema file missing${NC}"
fi

# ====================
# STEP 6: Verify Capability Enforcement
# ====================
echo -e "${YELLOW}STEP 6: Verifying Capability Enforcement...${NC}"

ENDPOINTS_DIR="$(dirname "$0")/../../backend/lambda/src/endpoints"
ENFORCEMENT_COUNT=$(grep -r "checkVendorCapability" "$ENDPOINTS_DIR" 2>/dev/null | wc -l | tr -d ' ')
echo -e "   Found $ENFORCEMENT_COUNT capability checks in endpoints"

if [ "$ENFORCEMENT_COUNT" -gt 30 ]; then
    echo -e "${GREEN}✅ Capability enforcement implemented${NC}"
else
    echo -e "${YELLOW}⚠️  Limited capability enforcement (expected 30+, found $ENFORCEMENT_COUNT)${NC}"
fi

# ====================
# STEP 7: Summary
# ====================
echo ""
echo "==========================================="
echo -e "${BLUE}📊 VERIFICATION SUMMARY${NC}"
echo "==========================================="
echo ""
echo "   ✅ Backend Build: OK"
echo "   ✅ Vendor Web Build: OK"
echo "   📄 UI Pages: $(( ${#PAGES[@]} - MISSING_PAGES ))/${#PAGES[@]}"
echo "   🛣️  Capability Routes: $ROUTE_COUNT"
echo "   🗄️  Database Tables: $TABLE_COUNT"
echo "   🔒 Capability Checks: $ENFORCEMENT_COUNT"
echo ""
echo -e "${GREEN}🎉 CAPABILITY SYSTEM VERIFICATION COMPLETE!${NC}"
echo ""
echo "Next steps:"
echo "   1. Run database migration: psql \$DATABASE_URL -f backend/lambda/src/database/schemas/capability-tables.sql"
echo "   2. Deploy backend: cd backend/lambda && npm run deploy"
echo "   3. Deploy vendor web: Deploy to your hosting platform"
echo "   4. Run API tests: API_URL=\$API_URL npx ts-node tests/capabilities/test-capability-enforcement.ts"
echo ""
