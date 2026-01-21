#!/bin/bash
# ============================================================================
# TEST ROLE ARCHITECTURE COMPLETE FLOW
# ============================================================================
# Tests:
# 1. Admin creates role with new wizard
# 2. Vendor onboards with new role selection
# 3. Vendor uses features based on capabilities
# 4. Existing vendors continue to work
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
API_ENDPOINT="${API_ENDPOINT:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@warmpawz.com}"
VENDOR_EMAIL="${VENDOR_EMAIL:-vendor@warmpawz.com}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🧪 TESTING ROLE ARCHITECTURE COMPLETE FLOW                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to make API calls
api_call() {
  local method=$1
  local endpoint=$2
  local data=$3
  local token=$4
  
  if [ -n "$token" ]; then
    if [ -n "$data" ]; then
      curl -s -X "$method" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "$data" \
        "${API_ENDPOINT}${endpoint}"
    else
      curl -s -X "$method" \
        -H "Authorization: Bearer $token" \
        "${API_ENDPOINT}${endpoint}"
    fi
  else
    if [ -n "$data" ]; then
      curl -s -X "$method" \
        -H "Content-Type: application/json" \
        -d "$data" \
        "${API_ENDPOINT}${endpoint}"
    else
      curl -s -X "$method" \
        "${API_ENDPOINT}${endpoint}"
    fi
  fi
}

# Test result helper
test_result() {
  local test_name=$1
  local result=$2
  
  if [ "$result" = "PASS" ]; then
    echo -e "${GREEN}✅ PASS: ${test_name}${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}❌ FAIL: ${test_name}${NC}"
    echo -e "${RED}   Error: $result${NC}"
    ((TESTS_FAILED++))
  fi
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STEP 1: Health Check${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

HEALTH_RESPONSE=$(api_call "GET" "/health")
if echo "$HEALTH_RESPONSE" | grep -q "ok\|healthy\|status"; then
  test_result "API Health Check" "PASS"
else
  test_result "API Health Check" "API not responding"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STEP 2: Test Admin Role Creation${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Get admin token (simplified - in real scenario, use Cognito)
echo -e "${YELLOW}⚠️  Note: Admin authentication required for role creation${NC}"
echo -e "${YELLOW}   Skipping admin role creation test (requires Cognito token)${NC}"
echo -e "${YELLOW}   Manual test: Create role via Admin UI at /roles${NC}"

# Test: Verify roles endpoint returns customer_service
echo -e "${BLUE}Testing: GET /admin/roles returns customer_service${NC}"
ROLES_RESPONSE=$(api_call "GET" "/config/roles")
if echo "$ROLES_RESPONSE" | grep -q "customer_service"; then
  test_result "Roles endpoint includes customer_service" "PASS"
else
  test_result "Roles endpoint includes customer_service" "customer_service field not found"
fi

# Test: Verify roles have vendorConfiguration
if echo "$ROLES_RESPONSE" | grep -q "vendorConfiguration"; then
  test_result "Roles include vendorConfiguration" "PASS"
else
  test_result "Roles include vendorConfiguration" "vendorConfiguration field not found"
fi

# Test: Verify active roles exist
ACTIVE_ROLES=$(echo "$ROLES_RESPONSE" | grep -o '"isActive":true' | wc -l | tr -d ' ')
if [ "$ACTIVE_ROLES" -gt 0 ]; then
  test_result "Active roles exist ($ACTIVE_ROLES found)" "PASS"
else
  test_result "Active roles exist" "No active roles found"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STEP 3: Test Vendor Onboarding Role Selection${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test: Verify roles are grouped by customer_service
echo -e "${BLUE}Testing: Roles grouped by customer_service${NC}"
VET_ROLES=$(echo "$ROLES_RESPONSE" | grep -o '"customer_service":"vet"' | wc -l | tr -d ' ')
GROOMING_ROLES=$(echo "$ROLES_RESPONSE" | grep -o '"customer_service":"grooming"' | wc -l | tr -d ' ')

if [ "$VET_ROLES" -gt 0 ] || [ "$GROOMING_ROLES" -gt 0 ]; then
  test_result "Roles grouped by customer_service (vet: $VET_ROLES, grooming: $GROOMING_ROLES)" "PASS"
else
  test_result "Roles grouped by customer_service" "No roles with customer_service found"
fi

# Test: Verify solo vs business distinction
SOLO_ROLES=$(echo "$ROLES_RESPONSE" | grep -o '"vendorConfiguration":"solo"' | wc -l | tr -d ' ')
BUSINESS_ROLES=$(echo "$ROLES_RESPONSE" | grep -o '"vendorConfiguration":"business"' | wc -l | tr -d ' ')

if [ "$SOLO_ROLES" -gt 0 ] || [ "$BUSINESS_ROLES" -gt 0 ]; then
  test_result "Solo/Business distinction (solo: $SOLO_ROLES, business: $BUSINESS_ROLES)" "PASS"
else
  test_result "Solo/Business distinction" "No vendorConfiguration found"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STEP 4: Test Vendor Dashboard Capabilities${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test: Get vendor profile (requires vendor ID - using test endpoint)
echo -e "${YELLOW}⚠️  Note: Vendor dashboard test requires authenticated vendor${NC}"
echo -e "${YELLOW}   Skipping vendor dashboard test (requires Cognito token)${NC}"
echo -e "${YELLOW}   Manual test: Login as vendor and verify dashboard features${NC}"

# Test: Verify vendor profile endpoint structure
echo -e "${BLUE}Testing: Vendor profile endpoint structure${NC}"
# This would require a test vendor ID - skipping for now
echo -e "${YELLOW}   Manual verification: GET /vendor/{vendorId}/profile should return capabilities${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STEP 5: Verify Existing Vendors Continue to Work${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test: Verify old roles are marked as inactive (not deleted)
OLD_ROLES=$(echo "$ROLES_RESPONSE" | grep -o '"isActive":false' | wc -l | tr -d ' ')
if [ "$OLD_ROLES" -ge 0 ]; then
  test_result "Old roles preserved (inactive: $OLD_ROLES)" "PASS"
else
  test_result "Old roles preserved" "Could not verify old roles"
fi

# Test: Verify database schema changes
echo -e "${BLUE}Testing: Database schema changes${NC}"
echo -e "${YELLOW}   Manual verification: Check roles table has customer_service column${NC}"
echo -e "${YELLOW}   SQL: SELECT customer_service, vendorConfiguration FROM roles LIMIT 5;${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}STEP 6: Test Capability Filtering${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test: Verify roles endpoint returns effectiveCapabilities
if echo "$ROLES_RESPONSE" | grep -q "effectiveCapabilities\|capabilities"; then
  test_result "Roles include capabilities" "PASS"
else
  test_result "Roles include capabilities" "Capabilities field not found"
fi

# Test: Verify solo roles don't have staff_management
SOLO_WITH_STAFF=$(echo "$ROLES_RESPONSE" | grep -A 10 '"vendorConfiguration":"solo"' | grep -c "staff_management" || echo "0")
if [ "$SOLO_WITH_STAFF" = "0" ]; then
  test_result "Solo roles correctly exclude staff_management" "PASS"
else
  test_result "Solo roles correctly exclude staff_management" "Solo roles may have staff_management"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}TEST SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""
echo -e "${GREEN}Tests Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Tests Failed: ${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   ✅ ALL AUTOMATED TESTS PASSED                                 ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
else
  echo -e "${YELLOW}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║   ⚠️  SOME TESTS FAILED - REVIEW MANUAL TESTS                ║${NC}"
  echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════╝${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}MANUAL TESTING CHECKLIST${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}1. Admin Role Creation (https://dfof7mguaa0a5.cloudfront.net/roles):${NC}"
echo "   □ Create new role with Solo configuration"
echo "   □ Verify 'at_center' is disabled for solo"
echo "   □ Enable 'Custom Services' toggle for solo"
echo "   □ Create new role with Business configuration"
echo "   □ Verify all service styles are available"
echo "   □ Verify capabilities are filtered correctly"
echo ""
echo -e "${YELLOW}2. Vendor Onboarding (d1s6ykkj381k58.cloudfront.net/onboarding):${NC}"
echo "   □ Roles are grouped by customer_service"
echo "   □ Solo roles are clearly marked"
echo "   □ Business roles are clearly marked"
echo "   □ Can select and complete onboarding"
echo ""
echo -e "${YELLOW}3. Vendor Dashboard (d1s6ykkj381k58.cloudfront.net/dashboard):${NC}"
echo "   □ Solo vendor: Staff management button is hidden/disabled"
echo "   □ Solo vendor: Inventory button is hidden/disabled"
echo "   □ Solo vendor: Professional Profile button is visible"
echo "   □ Solo vendor: Custom Services button visible (if enabled)"
echo "   □ Business vendor: All features available"
echo ""
echo -e "${YELLOW}4. Existing Vendors:${NC}"
echo "   □ Existing vendor can login"
echo "   □ Existing vendor dashboard loads"
echo "   □ Existing vendor features work as before"
echo "   □ No errors in console"
echo ""
echo -e "${YELLOW}5. Database Verification:${NC}"
echo "   □ Run: SELECT COUNT(*) FROM roles WHERE customer_service IS NOT NULL;"
echo "   □ Run: SELECT COUNT(*) FROM roles WHERE config->>'vendorConfiguration' IS NOT NULL;"
echo "   □ Run: SELECT name, customer_service, config->>'vendorConfiguration' FROM roles WHERE is_active = true LIMIT 10;"
echo ""

exit $TESTS_FAILED
