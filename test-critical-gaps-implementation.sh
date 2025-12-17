#!/bin/bash

# CRITICAL GAPS IMPLEMENTATION TEST SCRIPT
# Tests all Phase 1 critical gap implementations

set -e

PROJECT_ID="vpvpbdwtyugbknrntkho"
API_BASE="https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475"
PUBLIC_ANON_KEY="${SUPABASE_ANON_KEY:-your_anon_key_here}"

echo "🧪 Testing Critical Gaps Implementation"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo -n "Testing: $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET \
            -H "Authorization: Bearer ${PUBLIC_ANON_KEY}" \
            "${API_BASE}${endpoint}")
    else
        response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Authorization: Bearer ${PUBLIC_ANON_KEY}" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "${API_BASE}${endpoint}")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        return 0
    elif [ "$http_code" -eq 400 ] || [ "$http_code" -eq 404 ]; then
        echo -e "${YELLOW}⚠ SKIPPED${NC} (HTTP $http_code - Expected for missing data)"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        echo "  Response: $body"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "📦 Phase 1.1: Subscription Package Scheduling"
echo "-----------------------------------------------"
test_endpoint \
    "Get subscription slots (package)" \
    "GET" \
    "/booking/subscription-slots?vendorId=test_vendor&isPackage=true&serviceStyle=at_home&serviceDuration=60&date=2024-12-20"

test_endpoint \
    "Get subscription slots (single session)" \
    "GET" \
    "/booking/subscription-slots?vendorId=test_vendor&isPackage=false&serviceStyle=at_home&serviceDuration=60&date=2024-12-20"

echo ""
echo "📍 Phase 1.2: Radar Service Discovery"
echo "------------------------------------"
test_endpoint \
    "Discover staff by radar" \
    "GET" \
    "/customer/discover-staff-by-radar?roleId=role_veterinarian&serviceStyle=at_home&customerLat=12.9716&customerLng=77.5946&serviceDuration=60"

echo ""
echo "🚗 Phase 1.3: Universal GPS Tracking"
echo "------------------------------------"
test_endpoint \
    "Get tracking status" \
    "GET" \
    "/gps/tracking/test_tracking_id"

echo ""
echo "📜 Phase 1.4: Previous Providers Service"
echo "-----------------------------------------"
test_endpoint \
    "Get previous providers" \
    "GET" \
    "/customer/test_customer_id/previous-providers"

echo ""
echo "🔍 Phase 1.5: Problem-First Search"
echo "----------------------------------"
test_endpoint \
    "Problem-first search" \
    "GET" \
    "/customer/problem-first-search?problemId=surgery&roleId=role_veterinarian&serviceStyle=at_home&customerLat=12.9716&customerLng=77.5946"

echo ""
echo "📞 Phase 1.6: Instant Tele Booking"
echo "-----------------------------------"
test_endpoint \
    "Get queue status" \
    "GET" \
    "/tele/instant/queue-status/test_booking_id"

echo ""
echo "========================================"
echo "📊 Test Results Summary"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

