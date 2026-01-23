#!/bin/bash

# ============================================================================
# PHASE 6 VERIFICATION SCRIPT: Financial Flows
# ============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 6: Financial Flows Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check backend endpoints
echo -e "${YELLOW}Checking backend endpoints...${NC}"
if grep -q "promotions/apply" backend/lambda/src/endpoints/promotions.ts; then
    echo -e "  ${GREEN}✓${NC} POST /promotions/apply endpoint exists"
else
    echo -e "  ${RED}✗${NC} POST /promotions/apply endpoint missing"
fi

if grep -q "bookings/:bookingId/accept-policy" backend/lambda/src/endpoints/promotions.ts; then
    echo -e "  ${GREEN}✓${NC} POST /bookings/:bookingId/accept-policy endpoint exists"
else
    echo -e "  ${RED}✗${NC} POST /bookings/:bookingId/accept-policy endpoint missing"
fi

if grep -q "payments/create-subscription" backend/lambda/src/endpoints/promotions.ts; then
    echo -e "  ${GREEN}✓${NC} POST /payments/create-subscription endpoint exists"
else
    echo -e "  ${RED}✗${NC} POST /payments/create-subscription endpoint missing"
fi

# Check migration
echo -e "${YELLOW}Checking database migration...${NC}"
if [ -f "db/migrations/306_add_financial_policy_fields.sql" ]; then
    echo -e "  ${GREEN}✓${NC} Migration 306_add_financial_policy_fields.sql exists"
else
    echo -e "  ${RED}✗${NC} Migration 306_add_financial_policy_fields.sql missing"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Phase 6 Verification Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
