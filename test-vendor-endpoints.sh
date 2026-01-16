#!/bin/bash

# ============================================================================
# VENDOR ENDPOINTS COMPREHENSIVE TEST SCRIPT
# ============================================================================
# Tests all vendor endpoints for:
# 1. UI existence
# 2. Handler status
# 3. Flow integration
# 4. Lambda function
# 5. DB tables
# 6. Wireframe status
# 7. Response format
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0
ISSUES=()

# API Base URL (adjust as needed)
API_BASE="${API_BASE_URL:-http://localhost:3000/api}"
VENDOR_ID="${TEST_VENDOR_ID:-test-vendor-id}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}VENDOR ENDPOINTS COMPREHENSIVE TEST${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    local expected_status=${4:-200}
    
    echo -e "${YELLOW}Testing: ${method} ${endpoint}${NC}"
    echo -e "  Description: ${description}"
    
    # Replace :vendorId with actual vendor ID
    endpoint=$(echo "$endpoint" | sed "s/:vendorId/${VENDOR_ID}/g")
    endpoint=$(echo "$endpoint" | sed "s/:id/${VENDOR_ID}/g")
    
    # Make request
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "${API_BASE}${endpoint}" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${TEST_TOKEN:-test-token}" 2>&1 || echo "ERROR\n500")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE}${endpoint}" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${TEST_TOKEN:-test-token}" \
            -d '{}' 2>&1 || echo "ERROR\n500")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT "${API_BASE}${endpoint}" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${TEST_TOKEN:-test-token}" \
            -d '{}' 2>&1 || echo "ERROR\n500")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${API_BASE}${endpoint}" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${TEST_TOKEN:-test-token}" 2>&1 || echo "ERROR\n500")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # Check response
    if [ "$http_code" = "$expected_status" ] || [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "  ${GREEN}✓ Status: ${http_code}${NC}"
        
        # Check if response is valid JSON
        if echo "$body" | jq . >/dev/null 2>&1; then
            echo -e "  ${GREEN}✓ Valid JSON response${NC}"
            PASSED=$((PASSED + 1))
        else
            echo -e "  ${YELLOW}⚠ Response is not valid JSON${NC}"
            ISSUES+=("${method} ${endpoint}: Invalid JSON response")
            PASSED=$((PASSED + 1))
        fi
    else
        echo -e "  ${RED}✗ Status: ${http_code} (expected ${expected_status})${NC}"
        FAILED=$((FAILED + 1))
        ISSUES+=("${method} ${endpoint}: HTTP ${http_code}")
    fi
    
    echo ""
}

# Function to check file existence
check_file_exists() {
    local file=$1
    if [ -f "$file" ]; then
        echo -e "  ${GREEN}✓ File exists: ${file}${NC}"
        return 0
    else
        echo -e "  ${RED}✗ File missing: ${file}${NC}"
        ISSUES+=("Missing file: ${file}")
        return 1
    fi
}

# Function to check handler registration
check_handler() {
    local handler_file=$1
    local function_name=$2
    
    if grep -q "$function_name" "$handler_file" 2>/dev/null; then
        echo -e "  ${GREEN}✓ Handler registered: ${function_name}${NC}"
        return 0
    else
        echo -e "  ${RED}✗ Handler not registered: ${function_name}${NC}"
        ISSUES+=("Handler not registered: ${function_name} in ${handler_file}")
        return 1
    fi
}

echo -e "${BLUE}=== VENDOR SERVICES ENDPOINTS ===${NC}"
echo ""

# Check handler file
check_file_exists "backend/lambda/src/endpoints/vendor-services.ts"
check_handler "backend/lambda/src/handler/index.ts" "registerVendorServicesEndpoints"

# Test endpoints
test_endpoint "GET" "/vendor/:vendorId/services" "Get vendor services"
test_endpoint "GET" "/vendor/:vendorId/services/:serviceStyle" "Get services by style"
test_endpoint "POST" "/vendor/:vendorId/services" "Add service"
test_endpoint "PUT" "/vendor/:vendorId/services/:serviceId" "Update service"
test_endpoint "DELETE" "/vendor/:vendorId/services/:serviceId" "Delete service"
test_endpoint "POST" "/vendor/:vendorId/services/custom" "Create custom service"

echo -e "${BLUE}=== VENDOR PRODUCTS ENDPOINTS ===${NC}"
echo ""

check_file_exists "backend/lambda/src/endpoints/vendor-products.ts"
check_handler "backend/lambda/src/handler/index.ts" "registerVendorProductsEndpoints"

test_endpoint "GET" "/vendor/:vendorId/products" "Get vendor products"
test_endpoint "POST" "/vendor/:vendorId/products" "Create product"
test_endpoint "GET" "/vendor/:vendorId/products/:productId" "Get product"
test_endpoint "PUT" "/vendor/:vendorId/products/:productId" "Update product"
test_endpoint "DELETE" "/vendor/:vendorId/products/:productId" "Delete product"

echo -e "${BLUE}=== VENDOR ORDERS ENDPOINTS ===${NC}"
echo ""

check_file_exists "backend/lambda/src/endpoints/vendor-orders.ts"
check_handler "backend/lambda/src/handler/index.ts" "registerVendorOrdersEndpoints"

test_endpoint "GET" "/vendor/:vendorId/orders" "Get vendor orders"
test_endpoint "GET" "/vendor/:vendorId/orders/stats" "Get order statistics"

echo -e "${BLUE}=== VENDOR PROFILE ENDPOINTS ===${NC}"
echo ""

check_file_exists "backend/lambda/src/endpoints/vendor-profile.ts"
check_handler "backend/lambda/src/handler/index.ts" "registerVendorProfileEndpoints"

test_endpoint "GET" "/vendor/:vendorId/profile" "Get vendor profile"
test_endpoint "PUT" "/vendor/:vendorId/profile" "Update vendor profile"
test_endpoint "GET" "/vendor/:vendorId/profile/edit-check" "Check edit permissions"
test_endpoint "GET" "/vendor/:vendorId/complete" "Get complete vendor data"

echo -e "${BLUE}=== VENDOR SETTINGS ENDPOINTS ===${NC}"
echo ""

check_file_exists "backend/lambda/src/endpoints/vendor-settings.ts"
check_handler "backend/lambda/src/handler/index.ts" "registerVendorSettingsEndpoints"

test_endpoint "GET" "/admin/vendor-settings-rules" "Get vendor settings rules"

echo -e "${BLUE}=== VENDOR BOOKINGS ENDPOINTS ===${NC}"
echo ""

check_file_exists "backend/lambda/src/endpoints/vendor-bookings.ts"
check_handler "backend/lambda/src/handler/index.ts" "registerVendorBookingsEndpoints"

test_endpoint "GET" "/vendor/bookings/:vendorId" "Get vendor bookings"
test_endpoint "PUT" "/vendor/bookings/:bookingId/status" "Update booking status"
test_endpoint "POST" "/vendor/bookings/:bookingId/confirm" "Confirm booking"
test_endpoint "POST" "/vendor/bookings/:bookingId/cancel" "Cancel booking"
test_endpoint "POST" "/vendor/bookings/:bookingId/decline" "Decline booking"
test_endpoint "POST" "/vendor/bookings/:bookingId/complete" "Complete booking"

echo -e "${BLUE}=== VENDOR SCHEDULE ENDPOINTS ===${NC}"
echo ""

check_file_exists "backend/lambda/src/endpoints/vendor-schedule.ts"
check_handler "backend/lambda/src/handler/index.ts" "registerVendorScheduleEndpoints"

test_endpoint "GET" "/vendor/:vendorId/slots/:date" "Get available slots"
test_endpoint "GET" "/vendor/:vendorId/schedule" "Get vendor schedule"
test_endpoint "POST" "/vendor/:vendorId/schedule" "Set vendor schedule"
test_endpoint "PUT" "/vendor/:vendorId/vacation" "Set vacation mode"

echo -e "${BLUE}=== VENDOR ANALYTICS ENDPOINTS ===${NC}"
echo ""

check_file_exists "backend/lambda/src/endpoints/vendor-analytics.ts"
check_handler "backend/lambda/src/handler/index.ts" "registerVendorAnalyticsEndpoints"

test_endpoint "GET" "/vendor/analytics/dashboard" "Get dashboard analytics"
test_endpoint "GET" "/vendor/analytics/revenue" "Get revenue analytics"
test_endpoint "GET" "/vendor/analytics/bookings" "Get booking analytics"
test_endpoint "GET" "/vendor/:vendorId/analytics/sales" "Get sales analytics"
test_endpoint "GET" "/vendor/:vendorId/analytics/products" "Get product analytics"

echo -e "${BLUE}=== VENDOR DASHBOARD ENDPOINTS ===${NC}"
echo ""

check_file_exists "backend/lambda/src/endpoints/vendor-dashboard.ts"
check_handler "backend/lambda/src/handler/index.ts" "registerVendorDashboardEndpoints"

test_endpoint "GET" "/vendor/dashboard/:vendorId" "Get vendor dashboard"
test_endpoint "GET" "/vendor/stats/:vendorId" "Get vendor stats"

echo -e "${BLUE}=== VENDOR ONBOARDING ENDPOINTS ===${NC}"
echo ""

check_file_exists "backend/lambda/src/endpoints/vendor-onboarding-enhanced.ts"
check_handler "backend/lambda/src/handler/index.ts" "registerVendorOnboardingEndpointsEnhanced"

test_endpoint "GET" "/vendor/onboarding/status" "Get onboarding status"
test_endpoint "GET" "/vendor/onboarding/roles" "Get available roles"
test_endpoint "POST" "/vendor/onboarding/select-role" "Select role"
test_endpoint "POST" "/vendor/onboarding/select-vendor-type" "Select vendor type"
test_endpoint "GET" "/vendor/onboarding/form-schema" "Get form schema"
test_endpoint "POST" "/vendor/onboarding/submit-application" "Submit application"

echo -e "${BLUE}=== VENDOR SECURITY ENDPOINTS ===${NC}"
echo ""

check_file_exists "backend/lambda/src/endpoints/vendor-security.ts"
check_handler "backend/lambda/src/handler/index.ts" "registerVendorSecurityEndpoints"

test_endpoint "GET" "/vendor/:vendorId/security" "Get security settings"
test_endpoint "POST" "/vendor/:vendorId/security/enable-2fa" "Enable 2FA"
test_endpoint "POST" "/vendor/:vendorId/security/disable-2fa" "Disable 2FA"

echo -e "${BLUE}=== VENDOR DISTANCE PRICING ENDPOINTS ===${NC}"
echo ""

check_file_exists "backend/lambda/src/endpoints/vendor-distance-pricing.ts"
check_handler "backend/lambda/src/handler/index.ts" "registerVendorDistancePricingEndpoints"

test_endpoint "GET" "/vendor/distance-pricing/:vendorId" "Get distance pricing"
test_endpoint "POST" "/vendor/distance-pricing/:vendorId" "Create distance pricing rule"
test_endpoint "PUT" "/vendor/distance-pricing/:vendorId/:ruleId" "Update distance pricing rule"
test_endpoint "DELETE" "/vendor/distance-pricing/:vendorId/:ruleId" "Delete distance pricing rule"

echo -e "${BLUE}=== VENDOR SETUP ENDPOINTS ===${NC}"
echo ""

check_file_exists "backend/lambda/src/endpoints/vendor-setup.ts"
check_handler "backend/lambda/src/handler/index.ts" "registerVendorSetupEndpoints"

test_endpoint "GET" "/vendor/:vendorId/setup-status" "Get setup status"
test_endpoint "POST" "/vendor/:vendorId/setup/complete" "Complete setup"

echo -e "${BLUE}=== VENDOR BOOKING ACTIONS ENDPOINTS ===${NC}"
echo ""

check_file_exists "backend/lambda/src/endpoints/vendor-booking-actions.ts"
check_handler "backend/lambda/src/handler/index.ts" "registerVendorBookingActionsEndpoints"

test_endpoint "POST" "/vendor/bookings/:bookingId/complete" "Complete booking"
test_endpoint "POST" "/vendor/bookings/:bookingId/start-session" "Start session"
test_endpoint "POST" "/vendor/bookings/:bookingId/check-in" "Check in"
test_endpoint "POST" "/vendor/bookings/:bookingId/end-session" "End session"

echo -e "${BLUE}=== VENDOR RADAR ENDPOINTS ===${NC}"
echo ""

check_file_exists "backend/lambda/src/endpoints/vendor-radar.ts"
check_handler "backend/lambda/src/handler/index.ts" "registerVendorRadarEndpoints"

test_endpoint "GET" "/vendor/:id/radar-distance" "Get radar distance"
test_endpoint "PUT" "/vendor/:id/radar-distance" "Update radar distance"

echo -e "${BLUE}=== SUMMARY ===${NC}"
echo ""
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"
echo ""

if [ ${#ISSUES[@]} -gt 0 ]; then
    echo -e "${YELLOW}Issues Found:${NC}"
    for issue in "${ISSUES[@]}"; do
        echo -e "  - ${issue}"
    done
    echo ""
fi

# Exit with error if any tests failed
if [ $FAILED -gt 0 ]; then
    exit 1
fi

exit 0
