#!/bin/bash

# ============================================================================
# VERIFY MIGRATIONS
# ============================================================================
# This script verifies that migrations 139 and 140 were applied correctly
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🔍 Verifying Role Architecture Migrations${NC}"
echo ""

# Check if DB_CONNECTION_STRING is set
if [ -z "$DB_CONNECTION_STRING" ]; then
    if [ -n "$1" ]; then
        DB_CONNECTION_STRING="$1"
    else
        echo -e "${RED}❌ DB_CONNECTION_STRING not set${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}📋 Verification Checks:${NC}"
echo ""

# Check 1: customer_service column exists
echo -e "1. Checking customer_service column..."
RESULT=$(psql "$DB_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'roles' AND column_name = 'customer_service';")
if [ "$RESULT" -gt 0 ]; then
    echo -e "   ${GREEN}✅ customer_service column exists${NC}"
else
    echo -e "   ${RED}❌ customer_service column missing${NC}"
    exit 1
fi

# Check 2: Indexes exist
echo -e "2. Checking indexes..."
INDEXES=$(psql "$DB_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'roles' AND indexname LIKE 'idx_roles_%';")
if [ "$INDEXES" -ge 3 ]; then
    echo -e "   ${GREEN}✅ Indexes created (found $INDEXES indexes)${NC}"
else
    echo -e "   ${YELLOW}⚠️  Expected at least 3 indexes, found $INDEXES${NC}"
fi

# Check 3: Role count (should be 21)
echo -e "3. Checking role count..."
ROLE_COUNT=$(psql "$DB_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM roles WHERE isActive = true;")
echo -e "   Found $ROLE_COUNT active roles"
if [ "$ROLE_COUNT" -ge 18 ] && [ "$ROLE_COUNT" -le 25 ]; then
    echo -e "   ${GREEN}✅ Role count looks reasonable${NC}"
else
    echo -e "   ${YELLOW}⚠️  Unexpected role count (expected ~21)${NC}"
fi

# Check 4: Roles have customer_service
echo -e "4. Checking customer_service mapping..."
MAPPED_ROLES=$(psql "$DB_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM roles WHERE customer_service IS NOT NULL;")
echo -e "   $MAPPED_ROLES roles have customer_service"
if [ "$MAPPED_ROLES" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Roles have customer_service mapping${NC}"
else
    echo -e "   ${YELLOW}⚠️  No roles have customer_service yet${NC}"
fi

# Check 5: Roles have vendorConfiguration
echo -e "5. Checking vendorConfiguration in config..."
VENDOR_CONFIG=$(psql "$DB_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM roles WHERE config->>'vendorConfiguration' IS NOT NULL;")
echo -e "   $VENDOR_CONFIG roles have vendorConfiguration"
if [ "$VENDOR_CONFIG" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Roles have vendorConfiguration${NC}"
else
    echo -e "   ${YELLOW}⚠️  No roles have vendorConfiguration yet${NC}"
fi

# Check 6: Sample role verification
echo -e "6. Checking sample roles..."
VET_SOLO=$(psql "$DB_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM roles WHERE name = 'vet_solo' OR name LIKE '%vet_solo%';")
GROOMER_SOLO=$(psql "$DB_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM roles WHERE name = 'groomer_solo' OR name LIKE '%groomer_solo%';")
if [ "$VET_SOLO" -gt 0 ] || [ "$GROOMER_SOLO" -gt 0 ]; then
    echo -e "   ${GREEN}✅ New solo roles found${NC}"
else
    echo -e "   ${YELLOW}⚠️  New solo roles not found (may need to run migration 140)${NC}"
fi

echo ""
echo -e "${GREEN}✅ Verification complete!${NC}"
echo ""
