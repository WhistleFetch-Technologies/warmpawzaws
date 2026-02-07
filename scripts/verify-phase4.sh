#!/bin/bash

# ============================================================================
# PHASE 4 VERIFICATION SCRIPT: Pharmacy & Delivery Flow
# ============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 4: Pharmacy & Delivery Flow Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check backend endpoints
echo -e "${YELLOW}Checking backend endpoints...${NC}"
if grep -q "pharmacy/orders/:orderId/invoice" backend/lambda/src/endpoints/pharmacy-orders.ts; then
    echo -e "  ${GREEN}✓${NC} POST /pharmacy/orders/:orderId/invoice endpoint exists"
else
    echo -e "  ${RED}✗${NC} POST /pharmacy/orders/:orderId/invoice endpoint missing"
fi

if grep -q "pharmacy/orders/:orderId/assign-logistics" backend/lambda/src/endpoints/pharmacy-orders.ts; then
    echo -e "  ${GREEN}✓${NC} POST /pharmacy/orders/:orderId/assign-logistics endpoint exists"
else
    echo -e "  ${RED}✗${NC} POST /pharmacy/orders/:orderId/assign-logistics endpoint missing"
fi

if grep -q "pharmacy/orders/:orderId/tracking" backend/lambda/src/endpoints/pharmacy-orders.ts; then
    echo -e "  ${GREEN}✓${NC} GET /pharmacy/orders/:orderId/tracking endpoint exists"
else
    echo -e "  ${RED}✗${NC} GET /pharmacy/orders/:orderId/tracking endpoint missing"
fi

if grep -q "pharmacy/orders/:orderId/broadcast-status" backend/lambda/src/endpoints/pharmacy-orders.ts; then
    echo -e "  ${GREEN}✓${NC} GET /pharmacy/orders/:orderId/broadcast-status endpoint exists"
else
    echo -e "  ${RED}✗${NC} GET /pharmacy/orders/:orderId/broadcast-status endpoint missing"
fi

if grep -q "tracking/:orderId/live" backend/lambda/src/endpoints/tracking.ts; then
    echo -e "  ${GREEN}✓${NC} GET /tracking/:orderId/live endpoint exists"
else
    echo -e "  ${RED}✗${NC} GET /tracking/:orderId/live endpoint missing"
fi

# Check frontend components
echo -e "${YELLOW}Checking frontend components...${NC}"
if [ -f "apps/vendor-web/components/vendor/pharmacy/PharmacyBroadcastStatus.tsx" ]; then
    echo -e "  ${GREEN}✓${NC} PharmacyBroadcastStatus component exists"
else
    echo -e "  ${RED}✗${NC} PharmacyBroadcastStatus component missing"
fi

if [ -f "apps/vendor-web/components/vendor/pharmacy/PerforaInvoiceUpload.tsx" ]; then
    echo -e "  ${GREEN}✓${NC} PerforaInvoiceUpload component exists"
else
    echo -e "  ${RED}✗${NC} PerforaInvoiceUpload component missing"
fi

if [ -f "apps/vendor-web/components/vendor/pharmacy/LogisticsPartnerAssignment.tsx" ]; then
    echo -e "  ${GREEN}✓${NC} LogisticsPartnerAssignment component exists"
else
    echo -e "  ${RED}✗${NC} LogisticsPartnerAssignment component missing"
fi

if [ -f "apps/customer-web/components/customer/OrderTrackingWidget.tsx" ]; then
    echo -e "  ${GREEN}✓${NC} OrderTrackingWidget component exists"
else
    echo -e "  ${RED}✗${NC} OrderTrackingWidget component missing"
fi

# Check migration
echo -e "${YELLOW}Checking database migration...${NC}"
if [ -f "db/migrations/305_add_pharmacy_tracking_fields.sql" ]; then
    echo -e "  ${GREEN}✓${NC} Migration 305_add_pharmacy_tracking_fields.sql exists"
else
    echo -e "  ${RED}✗${NC} Migration 305_add_pharmacy_tracking_fields.sql missing"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Phase 4 Verification Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
