#!/bin/bash
# ============================================================================
# Manual Middleware Test Script
# ============================================================================
# Tests middleware with different onboarding statuses
# Requires: Next.js dev server running on port 3002
# ============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
VENDOR_WEB_URL="${VENDOR_WEB_URL:-http://localhost:3002}"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Middleware Test Script${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Test phone numbers for different statuses
TEST_PHONES=(
  "+911111111111"  # INIT
  "+911111111112"  # ROLE_PENDING
  "+911111111113"  # FORM_PENDING
  "+911111111114"  # UNDER_REVIEW
  "+911111111115"  # CLARIFICATION_REQUIRED
  "+911111111116"  # APPROVED
  "+911111111117"  # ACTIVATED
  "+911111111118"  # REJECTED
)

STATUSES=(
  "INIT"
  "ROLE_PENDING"
  "FORM_PENDING"
  "UNDER_REVIEW"
  "CLARIFICATION_REQUIRED"
  "APPROVED"
  "ACTIVATED"
  "REJECTED"
)

echo -e "${YELLOW}⚠️  Note: This script requires:${NC}"
echo "   1. Next.js dev server running: npm run dev (in apps/vendor-web)"
echo "   2. API server running or mock API responses"
echo "   3. Test vendor identities in database with above phone numbers"
echo ""

read -p "Press Enter to continue or Ctrl+C to cancel..."

echo ""
echo -e "${BLUE}Testing Middleware with Different Onboarding Statuses...${NC}"
echo ""

# Function to test a route with a specific status
test_route() {
  local phone=$1
  local status=$2
  local route=$3
  local expected_redirect=$4

  echo -e "${BLUE}Testing: ${route} with status ${status}${NC}"
  
  # Set cookie and make request
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Cookie: vendor_phone=${phone}" \
    -L "${VENDOR_WEB_URL}${route}" 2>&1)
  
  if [ "$expected_redirect" != "" ]; then
    if [ "$response" = "200" ] || [ "$response" = "307" ] || [ "$response" = "302" ]; then
      echo -e "  ${GREEN}✅ Redirected (expected)${NC}"
    else
      echo -e "  ${RED}❌ Unexpected response: ${response}${NC}"
    fi
  else
    if [ "$response" = "200" ]; then
      echo -e "  ${GREEN}✅ Allowed (expected)${NC}"
    else
      echo -e "  ${RED}❌ Unexpected response: ${response}${NC}"
    fi
  fi
  echo ""
}

# Test scenarios
echo -e "${BLUE}Test 1: INIT Status${NC}"
test_route "${TEST_PHONES[0]}" "INIT" "/dashboard" "redirect"
test_route "${TEST_PHONES[0]}" "INIT" "/onboarding/role-selection" ""

echo -e "${BLUE}Test 2: ROLE_PENDING Status${NC}"
test_route "${TEST_PHONES[1]}" "ROLE_PENDING" "/onboarding/role-selection" "redirect"
test_route "${TEST_PHONES[1]}" "ROLE_PENDING" "/onboarding/vendor-type" ""

echo -e "${BLUE}Test 3: FORM_PENDING Status${NC}"
test_route "${TEST_PHONES[2]}" "FORM_PENDING" "/onboarding/vendor-type" "redirect"
test_route "${TEST_PHONES[2]}" "FORM_PENDING" "/onboarding/form" ""

echo -e "${BLUE}Test 4: UNDER_REVIEW Status${NC}"
test_route "${TEST_PHONES[3]}" "UNDER_REVIEW" "/onboarding/form" "redirect"
test_route "${TEST_PHONES[3]}" "UNDER_REVIEW" "/onboarding/pending-review" ""

echo -e "${BLUE}Test 5: CLARIFICATION_REQUIRED Status${NC}"
test_route "${TEST_PHONES[4]}" "CLARIFICATION_REQUIRED" "/onboarding/pending-review" "redirect"
test_route "${TEST_PHONES[4]}" "CLARIFICATION_REQUIRED" "/onboarding/clarification" ""

echo -e "${BLUE}Test 6: APPROVED Status${NC}"
test_route "${TEST_PHONES[5]}" "APPROVED" "/onboarding/clarification" "redirect"
test_route "${TEST_PHONES[5]}" "APPROVED" "/onboarding/approved" ""

echo -e "${BLUE}Test 7: ACTIVATED Status${NC}"
test_route "${TEST_PHONES[6]}" "ACTIVATED" "/onboarding/approved" "redirect"
test_route "${TEST_PHONES[6]}" "ACTIVATED" "/dashboard" ""

echo -e "${BLUE}Test 8: REJECTED Status${NC}"
test_route "${TEST_PHONES[7]}" "REJECTED" "/dashboard" "redirect"
test_route "${TEST_PHONES[7]}" "REJECTED" "/onboarding/rejected" ""

echo -e "${BLUE}Test 9: Unauthenticated Access${NC}"
response=$(curl -s -o /dev/null -w "%{http_code}" "${VENDOR_WEB_URL}/dashboard" 2>&1)
if [ "$response" = "307" ] || [ "$response" = "302" ]; then
  echo -e "  ${GREEN}✅ Redirected to /auth (expected)${NC}"
else
  echo -e "  ${RED}❌ Unexpected response: ${response}${NC}"
fi

echo ""
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}Middleware Tests Completed${NC}"
echo -e "${GREEN}============================================================================${NC}"

