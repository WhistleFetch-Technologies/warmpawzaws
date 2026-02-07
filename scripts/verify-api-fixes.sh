#!/bin/bash

# ============================================================================
# API Fixes Verification Script
# ============================================================================
# This script verifies that all API fixes are working correctly
# Usage: ./scripts/verify-api-fixes.sh [API_BASE_URL]
# ============================================================================

set -e

API_BASE_URL="${1:-http://localhost:3000}"
TEST_PHONE="0123456780"

echo "=========================================="
echo "API Fixes Verification Script"
echo "=========================================="
echo "API Base URL: $API_BASE_URL"
echo "Test Phone: $TEST_PHONE"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test an endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local url="$3"
    local expected_status="${4:-200}"
    
    echo -n "Testing $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$url" -H "Content-Type: application/json" 2>&1)
    elif [ "$method" = "OPTIONS" ]; then
        response=$(curl -s -w "\n%{http_code}" -X OPTIONS "$url" -H "Content-Type: application/json" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" -H "Content-Type: application/json" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        
        # Check for specific error patterns
        if echo "$body" | grep -q "Service Unavailable"; then
            echo -e "  ${RED}⚠ WARNING: Response contains 'Service Unavailable'${NC}"
        fi
        if echo "$body" | grep -q "invalid input syntax for type uuid"; then
            echo -e "  ${RED}⚠ WARNING: Response contains UUID parsing error${NC}"
        fi
        if echo "$body" | grep -q "column.*does not exist"; then
            echo -e "  ${RED}⚠ WARNING: Response contains column error${NC}"
        fi
    else
        echo -e "${RED}✗ FAILED${NC} (Expected HTTP $expected_status, got HTTP $http_code)"
        echo "  Response: $body"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

echo "=========================================="
echo "Phase 1: Database Migration Verification"
echo "=========================================="
echo "Note: Run migration script manually:"
echo "  psql \$DATABASE_URL -f db/migrations/300_add_customer_phone_to_bookings.sql"
echo ""

echo "=========================================="
echo "Phase 2: Endpoint Fixes Verification"
echo "=========================================="

# Test 1: Appointment Reminders (Tele Consultation)
echo "Test 1: Tele Consultation Reminders"
test_endpoint \
    "GET /reminders/upcoming (tele)" \
    "GET" \
    "$API_BASE_URL/reminders/upcoming?minutes=60&serviceStyle=tele" \
    "200"

# Test 2: Active Bookings Route
echo "Test 2: Active Bookings Route"
test_endpoint \
    "GET /customer/bookings/active" \
    "GET" \
    "$API_BASE_URL/customer/bookings/active?phone=$TEST_PHONE" \
    "200"

# Test 3: Customer by Phone
echo "Test 3: Get Customer by Phone"
test_endpoint \
    "GET /customer/by-phone" \
    "GET" \
    "$API_BASE_URL/customer/by-phone?phone=$TEST_PHONE" \
    "200"

# Test 4: Customer Bookings with Status
echo "Test 4: Customer Bookings with Status"
test_endpoint \
    "GET /customer/bookings (in_progress)" \
    "GET" \
    "$API_BASE_URL/customer/bookings?phone=$TEST_PHONE&status=in_progress" \
    "200"

# Test 5: Customer Notifications
echo "Test 5: Customer Notifications"
test_endpoint \
    "GET /customer/notifications" \
    "GET" \
    "$API_BASE_URL/customer/notifications/$TEST_PHONE?limit=10" \
    "200"

# Test 6: CORS Preflight (OPTIONS)
echo "Test 6: CORS Preflight (OPTIONS)"
test_endpoint \
    "OPTIONS /customer/discover-services" \
    "OPTIONS" \
    "$API_BASE_URL/customer/discover-services?category=vet&roleId=veterinarian" \
    "200"

# Test 7: Discover Services
echo "Test 7: Discover Services"
test_endpoint \
    "GET /customer/discover-services" \
    "GET" \
    "$API_BASE_URL/customer/discover-services?category=vet&roleId=veterinarian" \
    "200"

echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please review the errors above.${NC}"
    exit 1
fi
