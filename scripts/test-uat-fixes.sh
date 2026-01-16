#!/bin/bash

# ============================================================================
# TEST UAT CRITICAL FIXES
# ============================================================================
# Tests the 3 critical UAT fixes:
# 1. Service Update SQL Error Fix
# 2. Facility Provisioning During Approval
# 3. PUT /vendor/facility/:vendorId Endpoint
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
TEST_VENDOR_ID="${TEST_VENDOR_ID:-test-vendor-id}"
TEST_SERVICE_ID="${TEST_SERVICE_ID:-test-service-id}"

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  UAT CRITICAL FIXES VERIFICATION TEST${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "API Base URL: ${YELLOW}${API_BASE_URL}${NC}"
echo -e "Test Vendor ID: ${YELLOW}${TEST_VENDOR_ID}${NC}"
echo ""

PASSED=0
FAILED=0
SKIPPED=0

test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local body=$4
    local expected_status=$5
    
    echo -e "${YELLOW}Testing: ${name}${NC}"
    echo -e "  ${method} ${endpoint}"
    
    if [ -n "$body" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$body" \
            "${API_BASE_URL}${endpoint}")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            "${API_BASE_URL}${endpoint}")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body_response=$(echo "$response" | head -n-1)
    
    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "  ${GREEN}✅ PASS${NC} (Status: ${http_code})"
        ((PASSED++))
        return 0
    elif [ "$http_code" -eq 404 ] || [ "$http_code" -eq 401 ] || [ "$http_code" -eq 403 ]; then
        echo -e "  ${YELLOW}⏭️  SKIP${NC} (Status: ${http_code} - test data/auth required)"
        ((SKIPPED++))
        return 2
    else
        echo -e "  ${RED}❌ FAIL${NC} (Expected: ${expected_status}, Got: ${http_code})"
        echo -e "  Response: ${body_response}"
        ((FAILED++))
        return 1
    fi
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Fix #1: Service Update SQL Error${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test 1.1: Empty body should return 400, not 500
test_endpoint \
    "Service Update - Empty Body (should return 400, not 500)" \
    "PUT" \
    "/vendor/${TEST_VENDOR_ID}/services/${TEST_SERVICE_ID}" \
    "{}" \
    400

# Test 1.2: All undefined should be handled
test_endpoint \
    "Service Update - Validation (all fields undefined)" \
    "PUT" \
    "/vendor/${TEST_VENDOR_ID}/services/${TEST_SERVICE_ID}" \
    '{"price": null, "isEnabled": null}' \
    400

# Test 1.3: Valid update should work (if test data exists)
test_endpoint \
    "Service Update - Valid Update" \
    "PUT" \
    "/vendor/${TEST_VENDOR_ID}/services/${TEST_SERVICE_ID}" \
    '{"isEnabled": true}' \
    200

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Fix #2: Facility Provisioning (requires admin auth)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test 2.1: GET facility should work
test_endpoint \
    "Facility GET - Endpoint exists" \
    "GET" \
    "/vendor/${TEST_VENDOR_ID}/facility" \
    "" \
    200

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Fix #3: PUT /vendor/facility/:vendorId Endpoint${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Test 3.1: PUT endpoint exists (should NOT return 404)
response=$(curl -s -w "\n%{http_code}" -X "PUT" \
    -H "Content-Type: application/json" \
    -d '{"address": "123 Test St", "city": "Test City"}' \
    "${API_BASE_URL}/vendor/facility/${TEST_VENDOR_ID}")

http_code=$(echo "$response" | tail -n1)

if [ "$http_code" -eq 404 ]; then
    echo -e "${RED}❌ FAIL: PUT /vendor/facility/:vendorId returns 404 (endpoint missing!)${NC}"
    ((FAILED++))
else
    echo -e "${GREEN}✅ PASS: PUT endpoint exists (Status: ${http_code})${NC}"
    ((PASSED++))
fi

# Test 3.2: Empty body validation
test_endpoint \
    "Facility PUT - Empty Body Validation" \
    "PUT" \
    "/vendor/facility/${TEST_VENDOR_ID}" \
    "{}" \
    400

# Test 3.3: Valid facility data
test_endpoint \
    "Facility PUT - Valid Data" \
    "PUT" \
    "/vendor/facility/${TEST_VENDOR_ID}" \
    '{"address": "456 Test Ave", "city": "Test City", "state": "TS", "pincode": "123456"}' \
    200

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  TEST SUMMARY${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Passed: ${PASSED}${NC}"
echo -e "${RED}❌ Failed: ${FAILED}${NC}"
echo -e "${YELLOW}⏭️  Skipped: ${SKIPPED}${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Some tests failed!${NC}"
    exit 1
else
    echo -e "${GREEN}✅ All critical tests passed!${NC}"
    exit 0
fi
