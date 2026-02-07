#!/bin/bash

# Complete check script - runs all verification steps
# This provides a summary of what needs to be checked

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Complete Solo Vendor Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${CYAN}This script provides SQL queries to check solo vendor status.${NC}"
echo -e "${CYAN}Run these queries in your database to get detailed information.${NC}"
echo ""

echo -e "${YELLOW}STEP 1: Find All Solo Vendors${NC}"
echo "────────────────────────────────────────────────────────────"
echo "Run query #1 from: ./scripts/query-solo-vendors-services.sh"
echo ""

echo -e "${YELLOW}STEP 2: Check Their Services${NC}"
echo "────────────────────────────────────────────────────────────"
echo "Run query #2 from: ./scripts/query-solo-vendors-services.sh"
echo ""

echo -e "${YELLOW}STEP 3: Check Schedule Configuration${NC}"
echo "────────────────────────────────────────────────────────────"
echo "Run query #4 from: ./scripts/query-solo-vendors-services.sh"
echo ""

echo -e "${YELLOW}STEP 4: Get Complete Readiness Report${NC}"
echo "────────────────────────────────────────────────────────────"
echo "Run query #5 from: ./scripts/query-solo-vendors-services.sh"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${CYAN}Quick Status Check (via API)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

echo -e "${YELLOW}Checking at_home services:${NC}"
RESPONSE=$(curl -s "${API_BASE_URL}/customer/discover-services?category=vet&roleId=veterinarian&serviceStyle=at_home" 2>&1)
if echo "$RESPONSE" | grep -q '"success":true'; then
  TOTAL=$(echo "$RESPONSE" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "0")
  if [ "$TOTAL" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Found $TOTAL providers${NC}"
  else
    echo -e "   ${YELLOW}⚠️  No providers found (0)${NC}"
    echo -e "   ${CYAN}   → Check database queries to see what's missing${NC}"
  fi
else
  echo -e "   ${RED}❌ API error${NC}"
fi

echo ""
echo -e "${YELLOW}Checking tele services:${NC}"
RESPONSE=$(curl -s "${API_BASE_URL}/customer/discover-services?category=vet&roleId=veterinarian&serviceStyle=tele" 2>&1)
if echo "$RESPONSE" | grep -q '"success":true'; then
  TOTAL=$(echo "$RESPONSE" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "0")
  if [ "$TOTAL" -gt 0 ]; then
    echo -e "   ${GREEN}✅ Found $TOTAL providers${NC}"
  else
    echo -e "   ${YELLOW}⚠️  No providers found (0)${NC}"
    echo -e "   ${CYAN}   → Check database queries to see what's missing${NC}"
  fi
else
  echo -e "   ${RED}❌ API error${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Next Steps${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "1. Run SQL queries from: ./scripts/query-solo-vendors-services.sh"
echo "2. Check ACTION_PLAN_SOLO_VENDORS.md for detailed steps"
echo "3. Apply fixes based on query results"
echo "4. Test again with: ./scripts/test-solo-vendor-fix.sh"
echo ""
echo -e "${GREEN}✅ Code fix is complete - now need to verify/configure vendors${NC}"
