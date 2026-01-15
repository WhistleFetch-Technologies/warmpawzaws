#!/bin/bash
# Test Package Booking, GPS Tracking, and Training Progress Endpoints
# Usage: ./scripts/test-package-gps-training-endpoints.sh [phone]

set -euo pipefail

# Configuration
# Use API Gateway URL from existing scripts, fallback to default
API_BASE="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
TEST_PHONE="${1:-9876543210}"
VENDOR_ID="${2:-4dd488a2-54a9-4246-80b4-8b3e28636998}"  # Test vendor ID

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🧪 Testing Package Booking, GPS Tracking, and Training Progress Endpoints${NC}"
echo "======================================================================"
echo -e "API Base: ${YELLOW}${API_BASE}${NC}"
echo -e "Test Phone: ${YELLOW}${TEST_PHONE}${NC}"
echo -e "Vendor ID: ${YELLOW}${VENDOR_ID}${NC}"
echo ""

# Test counter
PASSED=0
FAILED=0

test_endpoint() {
    local name="$1"
    local method="$2"
    local url="$3"
    local data="${4:-}"
    
    echo -e "${BLUE}Testing: ${name}${NC}"
    echo -e "  ${YELLOW}${method} ${url}${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "${url}" 2>&1)
    else
        if [ -n "$data" ]; then
            response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "${url}" 2>&1)
        else
            response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" "${url}" 2>&1)
        fi
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "  ${GREEN}✅ PASS${NC} (HTTP $http_code)"
        if command -v jq > /dev/null 2>&1; then
            echo "$body" | jq '.' 2>/dev/null | head -20 || echo "$body" | head -5
        else
            echo "$body" | head -5
        fi
        ((PASSED++))
    else
        echo -e "  ${RED}❌ FAIL${NC} (HTTP $http_code)"
        echo "$body" | head -10
        ((FAILED++))
    fi
    echo ""
}

# Test 1: Get customer packages (training)
test_endpoint \
    "GET /customer/:phone/packages (training)" \
    "GET" \
    "${API_BASE}/customer/${TEST_PHONE}/packages?serviceType=training"

# Test 2: Get customer packages (walking)
test_endpoint \
    "GET /customer/:phone/packages (walking)" \
    "GET" \
    "${API_BASE}/customer/${TEST_PHONE}/packages?serviceType=walking"

# Test 3: Get customer packages (all)
test_endpoint \
    "GET /customer/:phone/packages (all)" \
    "GET" \
    "${API_BASE}/customer/${TEST_PHONE}/packages"

# Test 4: Get active walks
test_endpoint \
    "GET /customer/:phone/active-walks" \
    "GET" \
    "${API_BASE}/customer/${TEST_PHONE}/active-walks"

# Test 5: Get pet skills
test_endpoint \
    "GET /customer/:phone/pet-skills" \
    "GET" \
    "${API_BASE}/customer/${TEST_PHONE}/pet-skills"

# Test 6: Check for booking packages (with phone)
test_endpoint \
    "GET /packages/check-for-booking (with phone)" \
    "GET" \
    "${API_BASE}/packages/check-for-booking?phone=${TEST_PHONE}&vendorId=${VENDOR_ID}"

# Test 7: Check for booking packages (with customerId - if we can resolve it)
echo -e "${BLUE}Testing: GET /packages/check-for-booking (with customerId)${NC}"
echo -e "  ${YELLOW}Note: Requires customerId resolution${NC}"
# This would need customerId, skipping for now
echo -e "  ${YELLOW}⏭️  SKIPPED (requires customerId)${NC}"
echo ""

# Summary
echo "======================================================================"
echo -e "${BLUE}📊 Test Summary${NC}"
echo -e "  ${GREEN}✅ Passed: ${PASSED}${NC}"
echo -e "  ${RED}❌ Failed: ${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
