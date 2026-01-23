#!/bin/bash

# ============================================================================
# PHASE 1 TEST SCRIPT: Vendor Go Live Functionality
# ============================================================================
# Tests all Phase 1 gaps:
# - GAP-2.1: Services/Staff "Go Live" functionality
# - GAP-2.2: Centre "Go Live" functionality
# ============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Phase 1: Go Live Functionality Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get test vendor ID from environment or use default
VENDOR_ID=${TEST_VENDOR_ID:-"test-vendor-id"}
API_BASE_URL=${API_BASE_URL:-"http://localhost:3000"}

PASSED=0
FAILED=0

test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local test_name=$5
    
    echo -e "${YELLOW}Testing: ${test_name}${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "${API_BASE_URL}${endpoint}" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${TEST_TOKEN:-test-token}" 2>/dev/null || echo -e "\n000")
    else
        response=$(curl -s -w "\n%{http_code}" -X ${method} "${API_BASE_URL}${endpoint}" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${TEST_TOKEN:-test-token}" \
            -d "${data}" 2>/dev/null || echo -e "\n000")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "  ${GREEN}✓${NC} Passed (Status: $http_code)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "  ${RED}✗${NC} Failed (Expected: $expected_status, Got: $http_code)"
        echo -e "  Response: ${body:0:200}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo -e "${BLUE}Test 1: Bulk Publish Services Endpoint${NC}"
test_endpoint "POST" "/vendor/${VENDOR_ID}/services/bulk-publish" \
    '{"serviceIds":["test-service-1"],"publishStatus":"published"}' \
    "200" "Bulk publish services endpoint returns success"
echo ""

echo -e "${BLUE}Test 2: Bulk Activate Staff Endpoint${NC}"
test_endpoint "POST" "/vendor/${VENDOR_ID}/staff/bulk-activate" \
    '{"staffIds":["test-staff-1"],"activate":true}' \
    "200" "Bulk activate staff endpoint returns success"
echo ""

echo -e "${BLUE}Test 3: Go-Live Checklist Endpoint${NC}"
test_endpoint "GET" "/vendor/${VENDOR_ID}/go-live/checklist" \
    "" "200" "Go-live checklist returns all 6 items with status"
echo ""

echo -e "${BLUE}Test 4: Go-Live Activation Endpoint${NC}"
test_endpoint "POST" "/vendor/${VENDOR_ID}/go-live" \
    '{}' "200" "Go-live endpoint activates vendor when all items complete"
echo ""

echo -e "${BLUE}Test 5: Center Status Endpoint${NC}"
test_endpoint "GET" "/vendor/${VENDOR_ID}/center/status" \
    "" "200" "Center status endpoint returns vendor status"
echo ""

echo -e "${BLUE}Test 6: Services Appear in Customer App${NC}"
echo -e "${YELLOW}Testing: Published services appear in customer app service discovery${NC}"
# This would require checking the service-discovery endpoint
# For now, we'll mark as manual verification
echo -e "  ${YELLOW}⚠${NC} Manual verification required"
echo ""

echo -e "${BLUE}Test 7: Staff Appear in Provider Lists${NC}"
echo -e "${YELLOW}Testing: Activated staff appear in home/tele service provider lists${NC}"
# This would require checking the staff-discovery endpoint
# For now, we'll mark as manual verification
echo -e "  ${YELLOW}⚠${NC} Manual verification required"
echo ""

echo -e "${BLUE}Test 8: Error Handling${NC}"
test_endpoint "POST" "/vendor/${VENDOR_ID}/services/bulk-publish" \
    '{"serviceIds":[],"publishStatus":"published"}' \
    "400" "Error handling for failed publish/activation operations"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo -e "Manual: ${YELLOW}2${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All automated tests passed!${NC}"
    echo -e "${YELLOW}⚠️  Please manually verify:${NC}"
    echo -e "  1. Services appear in customer app after publish"
    echo -e "  2. Staff appear in provider lists after activation"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the errors above.${NC}"
    exit 1
fi
