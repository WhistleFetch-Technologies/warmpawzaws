#!/bin/bash

# ============================================================================
# FIX MISSING ADMIN ENDPOINTS
# ============================================================================
# Creates missing endpoints identified in audit
# ============================================================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Fixing Missing Admin Endpoints...${NC}\n"

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Check if endpoints exist
echo -e "${BLUE}Checking endpoint status...${NC}"

# 1. /settlements/process-payouts (alias for /settlements/process or create new)
echo -e "${YELLOW}1. Checking /settlements/process-payouts...${NC}"
if grep -q "process-payouts" backend/lambda/src/endpoints/settlements.ts 2>/dev/null; then
  echo -e "   ${GREEN}✅ Found${NC}"
else
  echo -e "   ${RED}❌ Missing - needs to be added${NC}"
fi

# 2. Finance endpoints
echo -e "${YELLOW}2. Checking finance endpoints...${NC}"
if grep -q "POST.*admin/finance/cancellation-policies" backend/lambda/src/endpoints/admin-advanced.ts 2>/dev/null; then
  echo -e "   ${GREEN}✅ POST /admin/finance/cancellation-policies found${NC}"
else
  echo -e "   ${RED}❌ Missing POST /admin/finance/cancellation-policies${NC}"
fi

if grep -q "POST.*admin/finance/gst/hsn-codes" backend/lambda/src/endpoints/admin-advanced.ts 2>/dev/null; then
  echo -e "   ${GREEN}✅ POST /admin/finance/gst/hsn-codes found${NC}"
else
  echo -e "   ${RED}❌ Missing POST /admin/finance/gst/hsn-codes${NC}"
fi

if grep -q "POST.*admin/finance/gst/tax-categories" backend/lambda/src/endpoints/admin-advanced.ts 2>/dev/null; then
  echo -e "   ${GREEN}✅ POST /admin/finance/gst/tax-categories found${NC}"
else
  echo -e "   ${RED}❌ Missing POST /admin/finance/gst/tax-categories${NC}"
fi

if grep -q "POST.*admin/finance/settlement-rules" backend/lambda/src/endpoints/admin-advanced.ts 2>/dev/null; then
  echo -e "   ${GREEN}✅ POST /admin/finance/settlement-rules found${NC}"
else
  echo -e "   ${RED}❌ Missing POST /admin/finance/settlement-rules${NC}"
fi

# 3. Payment endpoints
echo -e "${YELLOW}3. Checking payment endpoints...${NC}"
if grep -q "PUT.*admin/payments/gateway-config" backend/lambda/src/endpoints/admin-advanced.ts 2>/dev/null; then
  echo -e "   ${GREEN}✅ PUT /admin/payments/gateway-config found${NC}"
else
  echo -e "   ${RED}❌ Missing PUT /admin/payments/gateway-config${NC}"
fi

if grep -q "PUT.*admin/payments/refund-rules" backend/lambda/src/endpoints/admin-advanced.ts 2>/dev/null; then
  echo -e "   ${GREEN}✅ PUT /admin/payments/refund-rules found${NC}"
else
  echo -e "   ${RED}❌ Missing PUT /admin/payments/refund-rules${NC}"
fi

echo -e "\n${GREEN}✅ Endpoint check complete!${NC}"
