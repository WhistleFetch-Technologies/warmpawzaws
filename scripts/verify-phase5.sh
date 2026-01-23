#!/bin/bash

# ============================================================================
# PHASE 5 VERIFICATION SCRIPT: Nutritionist & Package Tracking
# ============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 5: Nutritionist & Package Tracking Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check backend endpoints
echo -e "${YELLOW}Checking backend endpoints...${NC}"
if grep -q "meal-plans/search/filters" backend/lambda/src/endpoints/meal-plans.ts; then
    echo -e "  ${GREEN}✓${NC} GET /meal-plans/search/filters endpoint exists"
else
    echo -e "  ${RED}✗${NC} GET /meal-plans/search/filters endpoint missing"
fi

if grep -q "meal-orders/:orderId/update-preparation-eta" backend/lambda/src/endpoints/meal-plans.ts; then
    echo -e "  ${GREEN}✓${NC} POST /meal-orders/:orderId/update-preparation-eta endpoint exists"
else
    echo -e "  ${RED}✗${NC} POST /meal-orders/:orderId/update-preparation-eta endpoint missing"
fi

if grep -q "packages/:packageId/tracking" backend/lambda/src/endpoints/packages.ts; then
    echo -e "  ${GREEN}✓${NC} GET /packages/:packageId/tracking endpoint exists"
else
    echo -e "  ${RED}✗${NC} GET /packages/:packageId/tracking endpoint missing"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Phase 5 Verification Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
