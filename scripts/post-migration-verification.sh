#!/bin/bash

# ============================================================================
# Post-Migration Verification Script
# ============================================================================
# Verifies that migration 300 completed successfully and endpoints work
# Usage: ./scripts/post-migration-verification.sh [environment] [api_base_url]
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
API_BASE_URL="${2:-http://localhost:3000}"

echo "=========================================="
echo "Post-Migration Verification"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "API Base URL: $API_BASE_URL"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0
WARNINGS=0

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local method="$2"
    local url="$3"
    local expected_status="${4:-200}"
    
    echo -n "Testing $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$url" -H "Content-Type: application/json" 2>&1)
    elif [ "$method" = "OPTIONS" ]; then
        response=$(curl -s -w "\n%{http_code}" -X OPTIONS "$url" -H "Content-Type: application/json" -H "Origin: https://customer.warmpawz.com" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" -H "Content-Type: application/json" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        
        # Check for error patterns
        if echo "$body" | grep -q "Service Unavailable"; then
            echo -e "  ${RED}⚠ ERROR: Response contains 'Service Unavailable'${NC}"
            FAILED=$((FAILED + 1))
            PASSED=$((PASSED - 1))
        fi
        if echo "$body" | grep -q "invalid input syntax for type uuid"; then
            echo -e "  ${RED}⚠ ERROR: Response contains UUID parsing error${NC}"
            FAILED=$((FAILED + 1))
            PASSED=$((PASSED - 1))
        fi
        if echo "$body" | grep -q "column.*does not exist"; then
            echo -e "  ${RED}⚠ ERROR: Response contains column error${NC}"
            FAILED=$((FAILED + 1))
            PASSED=$((PASSED - 1))
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
echo ""
echo -e "${BLUE}Note:${NC} Run these SQL queries to verify migration:"
echo ""
echo "  SELECT column_name, data_type"
echo "  FROM information_schema.columns"
echo "  WHERE table_name = 'bookings' AND column_name = 'customer_phone';"
echo ""
echo "  SELECT COUNT(*) as total, COUNT(customer_phone) as with_phone"
echo "  FROM bookings;"
echo ""
echo "Press Enter to continue to endpoint testing..."
read
echo ""

echo "=========================================="
echo "Phase 2: Endpoint Verification"
echo "=========================================="
echo ""

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
    "$API_BASE_URL/customer/bookings/active?phone=0123456780" \
    "200"

# Test 3: Customer by Phone
echo "Test 3: Get Customer by Phone"
test_endpoint \
    "GET /customer/by-phone" \
    "GET" \
    "$API_BASE_URL/customer/by-phone?phone=0123456780" \
    "200"

# Test 4: Customer Bookings with Status
echo "Test 4: Customer Bookings with Status"
test_endpoint \
    "GET /customer/bookings (in_progress)" \
    "GET" \
    "$API_BASE_URL/customer/bookings?phone=0123456780&status=in_progress" \
    "200"

# Test 5: Customer Notifications
echo "Test 5: Customer Notifications"
test_endpoint \
    "GET /customer/notifications" \
    "GET" \
    "$API_BASE_URL/customer/notifications/0123456780?limit=10" \
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
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All endpoint tests passed!${NC}"
    echo ""
    echo "Next Steps:"
    echo "  1. Monitor CloudWatch for 24-48 hours"
    echo "  2. Test customer flows manually"
    echo "  3. Gather customer feedback"
    echo "  4. Update documentation"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please review the errors above.${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check if migration completed successfully"
    echo "  2. Verify code is deployed"
    echo "  3. Check CloudWatch logs for errors"
    echo "  4. Verify database connectivity"
    exit 1
fi
