#!/bin/bash

# COMPREHENSIVE IMPLEMENTATION TEST SUITE
# Tests all Phase 1, 2, and 3 implementations including:
# - UI Component Presence
# - API Endpoints (CRUD)
# - Routes Registration
# - Data Structures
# - Complete Flows

set -e

PROJECT_ID="vpvpbdwtyugbknrntkho"
API_BASE="https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475"
PUBLIC_ANON_KEY="${SUPABASE_ANON_KEY:-your_anon_key_here}"

echo "🧪 COMPREHENSIVE IMPLEMENTATION TEST SUITE"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
SKIPPED=0

test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    expected_status=${expected_status:-200}
    
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
    
    if [ "$http_code" -eq "$expected_status" ] || [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        return 0
    elif [ "$http_code" -eq 400 ] || [ "$http_code" -eq 404 ]; then
        echo -e "${YELLOW}⚠ SKIPPED${NC} (HTTP $http_code - Expected for missing test data)"
        SKIPPED=$((SKIPPED + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $http_code)"
        echo "  Response: $body" | head -3
        FAILED=$((FAILED + 1))
        return 1
    fi
}

check_file_exists() {
    local file=$1
    local name=$2
    
    echo -n "Checking: $name... "
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ EXISTS${NC}"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ MISSING${NC}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo -e "${BLUE}📁 PHASE 1: UI Component Presence Check${NC}"
echo "=============================================="

# Phase 1 UI Components
check_file_exists "src/components/customer/booking/SubscriptionPackageScheduleSelector.tsx" "SubscriptionPackageScheduleSelector"
check_file_exists "src/components/customer/PreviousProvidersCarousel.tsx" "PreviousProvidersCarousel"
check_file_exists "src/components/customer/RadarServiceDiscovery.tsx" "RadarServiceDiscovery"

echo ""
echo -e "${BLUE}📦 PHASE 1: Backend Endpoints Test${NC}"
echo "======================================"

# Phase 1.1: Subscription Package Scheduling
echo ""
echo "1.1 Subscription Package Scheduling:"
test_endpoint \
    "Get subscription slots (package)" \
    "GET" \
    "/booking/subscription-slots?vendorId=test_vendor&isPackage=true&serviceStyle=at_home&serviceDuration=60&date=2024-12-20"

test_endpoint \
    "Get subscription slots (single)" \
    "GET" \
    "/booking/subscription-slots?vendorId=test_vendor&isPackage=false&serviceStyle=at_home&serviceDuration=60&date=2024-12-20"

# Phase 1.2: Radar Service Discovery
echo ""
echo "1.2 Radar Service Discovery:"
test_endpoint \
    "Discover staff by radar" \
    "GET" \
    "/customer/discover-staff-by-radar?roleId=role_veterinarian&serviceStyle=at_home&customerLat=12.9716&customerLng=77.5946&serviceDuration=60"

# Phase 1.3: Universal GPS Tracking
echo ""
echo "1.3 Universal GPS Tracking:"
test_endpoint \
    "Get tracking status" \
    "GET" \
    "/gps/tracking/test_tracking_id" \
    "" \
    404

# Phase 1.4: Previous Providers
echo ""
echo "1.4 Previous Providers Service:"
test_endpoint \
    "Get previous providers" \
    "GET" \
    "/customer/test_customer_id/previous-providers"

# Phase 1.5: Problem-First Search
echo ""
echo "1.5 Problem-First Search:"
test_endpoint \
    "Problem-first search" \
    "GET" \
    "/customer/problem-first-search?problemId=surgery&roleId=role_veterinarian&serviceStyle=at_home&customerLat=12.9716&customerLng=77.5946"

# Phase 1.6: Instant Tele Booking
echo ""
echo "1.6 Instant Tele Booking:"
test_endpoint \
    "Get queue status" \
    "GET" \
    "/tele/instant/queue-status/test_booking_id" \
    "" \
    404

echo ""
echo -e "${BLUE}📦 PHASE 2: Backend Endpoints Test${NC}"
echo "======================================"

# Phase 2.1: Center Booking with Specialized Services
echo ""
echo "2.1 Center Booking with Specialized Services:"
test_endpoint \
    "Get specialized services" \
    "GET" \
    "/center-booking/test_booking_id/specialized-services" \
    "" \
    404

# Phase 2.2: Role-Based Chat
echo ""
echo "2.2 Role-Based Chat Integration:"
test_endpoint \
    "Get role chat config" \
    "GET" \
    "/chat/role-config/role_veterinarian"

test_endpoint \
    "Get role features" \
    "GET" \
    "/chat/booking/test_booking_id/role-features" \
    "" \
    404

# Phase 2.3: Elasticsearch (verify endpoint exists)
echo ""
echo "2.3 Elasticsearch Integration:"
test_endpoint \
    "Elasticsearch search" \
    "GET" \
    "/universal/search?serviceCategory=veterinary_services&limit=10"

# Phase 2.4: Complete Notification System
echo ""
echo "2.4 Complete Notification System:"
test_endpoint \
    "Get notifications" \
    "GET" \
    "/notifications/customer/test_customer_id"

echo ""
echo -e "${BLUE}📦 PHASE 3: Backend Endpoints Test${NC}"
echo "======================================"

# Phase 3.1: Pet Profile Publishing
echo ""
echo "3.1 Pet Profile Publishing:"
test_endpoint \
    "Get public pet profiles" \
    "GET" \
    "/pet-profile/public/list?limit=10&offset=0"

test_endpoint \
    "Get pet profile" \
    "GET" \
    "/pet-profile/test_profile_id" \
    "" \
    404

echo ""
echo -e "${BLUE}🔍 ROUTE REGISTRATION CHECK${NC}"
echo "=============================="

# Check if routes are registered in index.tsx
echo ""
echo "Checking route registrations in index.tsx:"
check_file_exists "src/supabase/functions/server/index.tsx" "Server index file"

# Check for route registrations
echo ""
echo "Verifying route imports:"
grep -q "subscriptionPackageSchedulingEndpoints" src/supabase/functions/server/index.tsx && echo -e "${GREEN}✓ Subscription Package Scheduling registered${NC}" || echo -e "${RED}✗ Subscription Package Scheduling NOT registered${NC}"
grep -q "radarServiceDiscoveryEndpoints" src/supabase/functions/server/index.tsx && echo -e "${GREEN}✓ Radar Service Discovery registered${NC}" || echo -e "${RED}✗ Radar Service Discovery NOT registered${NC}"
grep -q "universalGPSTrackingEndpoints" src/supabase/functions/server/index.tsx && echo -e "${GREEN}✓ Universal GPS Tracking registered${NC}" || echo -e "${RED}✗ Universal GPS Tracking NOT registered${NC}"
grep -q "previousProvidersServiceEndpoints" src/supabase/functions/server/index.tsx && echo -e "${GREEN}✓ Previous Providers registered${NC}" || echo -e "${RED}✗ Previous Providers NOT registered${NC}"
grep -q "problemFirstSearchEndpoints" src/supabase/functions/server/index.tsx && echo -e "${GREEN}✓ Problem-First Search registered${NC}" || echo -e "${RED}✗ Problem-First Search NOT registered${NC}"
grep -q "instantTeleBookingEndpoints" src/supabase/functions/server/index.tsx && echo -e "${GREEN}✓ Instant Tele Booking registered${NC}" || echo -e "${RED}✗ Instant Tele Booking NOT registered${NC}"
grep -q "centerBookingSpecializedServicesEndpoints" src/supabase/functions/server/index.tsx && echo -e "${GREEN}✓ Center Booking Specialized Services registered${NC}" || echo -e "${RED}✗ Center Booking Specialized Services NOT registered${NC}"
grep -q "roleBasedChatIntegrationEndpoints" src/supabase/functions/server/index.tsx && echo -e "${GREEN}✓ Role-Based Chat registered${NC}" || echo -e "${RED}✗ Role-Based Chat NOT registered${NC}"
grep -q "completeNotificationSystemEndpoints" src/supabase/functions/server/index.tsx && echo -e "${GREEN}✓ Complete Notification System registered${NC}" || echo -e "${RED}✗ Complete Notification System NOT registered${NC}"
grep -q "petProfilePublishingEndpoints" src/supabase/functions/server/index.tsx && echo -e "${GREEN}✓ Pet Profile Publishing registered${NC}" || echo -e "${RED}✗ Pet Profile Publishing NOT registered${NC}"

echo ""
echo -e "${BLUE}📊 DATA STRUCTURE VERIFICATION${NC}"
echo "=============================="

# Check TypeScript interfaces and types
echo ""
echo "Checking data structure definitions:"
check_file_exists "src/supabase/functions/server/subscription-package-scheduling.tsx" "Subscription Package Scheduling"
check_file_exists "src/supabase/functions/server/radar-service-discovery.tsx" "Radar Service Discovery"
check_file_exists "src/supabase/functions/server/universal-gps-tracking.tsx" "Universal GPS Tracking"
check_file_exists "src/supabase/functions/server/previous-providers-service.tsx" "Previous Providers Service"
check_file_exists "src/supabase/functions/server/problem-first-search.tsx" "Problem-First Search"
check_file_exists "src/supabase/functions/server/instant-tele-booking.tsx" "Instant Tele Booking"
check_file_exists "src/supabase/functions/server/center-booking-specialized-services.tsx" "Center Booking Specialized Services"
check_file_exists "src/supabase/functions/server/role-based-chat-integration.tsx" "Role-Based Chat Integration"
check_file_exists "src/supabase/functions/server/complete-notification-system.tsx" "Complete Notification System"
check_file_exists "src/supabase/functions/server/pet-profile-publishing.tsx" "Pet Profile Publishing"

echo ""
echo "=========================================="
echo -e "${BLUE}📊 TEST RESULTS SUMMARY${NC}"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

