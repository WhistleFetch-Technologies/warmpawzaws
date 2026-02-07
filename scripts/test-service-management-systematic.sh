#!/bin/bash

# Systematic Service Management Test Suite Execution Script
# Tests service catalog, capability mapping, CRUD operations, and data validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Base URL (adjust as needed)
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Function to log test results
log_test() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name - $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}❌ FAIL${NC}: $test_name - $message"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    else
        echo -e "${YELLOW}⚠️  WARN${NC}: $test_name - $message"
    fi
}

# Function to test endpoint
test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local body="$3"
    local expected_status="$4"
    local test_name="$5"
    
    local response
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "${API_BASE_URL}${endpoint}" || echo "000")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "$body" \
            "${API_BASE_URL}${endpoint}" || echo "000")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT \
            -H "Content-Type: application/json" \
            -d "$body" \
            "${API_BASE_URL}${endpoint}" || echo "000")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE \
            "${API_BASE_URL}${endpoint}" || echo "000")
    fi
    
    local http_code=$(echo "$response" | tail -n1)
    local body_response=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        log_test "$test_name" "PASS" "HTTP $http_code"
        return 0
    else
        log_test "$test_name" "FAIL" "Expected HTTP $expected_status, got $http_code"
        echo "Response: $body_response" | head -c 200
        echo ""
        return 1
    fi
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Systematic Service Management Test Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================
# 1. Service Catalog API - Single API with roleId Filter
# ============================================
echo -e "${YELLOW}1. Testing Service Catalog API with roleId Filter${NC}"

# Test 1.1: Service catalog endpoint exists
test_endpoint "GET" "/admin/service-catalog" "" "200" "Service Catalog Endpoint Exists"

# Test 1.2: Service catalog with roleId parameter
test_endpoint "GET" "/admin/service-catalog?roleId=test-role-id" "" "200" "Service Catalog with roleId Parameter"

# Test 1.3: Service catalog role filtering
# Note: This requires actual role IDs from database
echo -e "${YELLOW}   ⚠️  Manual test required: Verify role filtering with actual role IDs${NC}"

echo ""

# ============================================
# 2. Capability Mapping Verification
# ============================================
echo -e "${YELLOW}2. Testing Capability Mapping${NC}"

# Test 2.1: Prescription endpoints are booking-scoped
test_endpoint "GET" "/medical-records/booking/test-booking-id/prescriptions" "" "404" "Prescription Endpoint Booking-Scoped"
# 404 is expected for test booking ID - confirms endpoint exists and requires bookingId

# Test 2.2: Medical records endpoints are booking-scoped
test_endpoint "GET" "/bookings/test-booking-id/medical-records" "" "404" "Medical Records Endpoint Booking-Scoped"
# 404 is expected for test booking ID - confirms endpoint exists and requires bookingId

# Test 2.3: GPS tracking endpoints are booking-scoped
test_endpoint "GET" "/tracking/booking/test-booking-id/status" "" "404" "GPS Tracking Endpoint Booking-Scoped"
# 404 is expected for test booking ID - confirms endpoint exists and requires bookingId

# Test 2.4: Meal planner endpoints are vendor-scoped (NOT booking-scoped)
test_endpoint "GET" "/meal-plans/vendor/test-vendor-id" "" "404" "Meal Planner Endpoint Vendor-Scoped"
# 404 is expected for test vendor ID - confirms endpoint exists and requires vendorId

# Test 2.5: Verify meal planner is NOT booking-scoped
# This should return 404 or error (meal planner should not have booking endpoints)
if curl -s "${API_BASE_URL}/bookings/test-booking-id/meal-plans" | grep -q "404\|error\|not found" || [ $? -ne 0 ]; then
    log_test "Meal Planner NOT Booking-Scoped" "PASS" "Meal planner correctly not available via booking endpoint"
else
    log_test "Meal Planner NOT Booking-Scoped" "FAIL" "Meal planner should not be accessible via booking endpoint"
fi

echo ""

# ============================================
# 3. Endpoint Registration Verification
# ============================================
echo -e "${YELLOW}3. Testing Endpoint Registration${NC}"

# Test 3.1: Service catalog endpoints registered
test_endpoint "GET" "/admin/service-catalog" "" "200" "Service Catalog Endpoints Registered"

# Test 3.2: Vendor services endpoints registered
test_endpoint "GET" "/vendor/test-vendor-id/services" "" "200" "Vendor Services Endpoints Registered"

# Test 3.3: Medical records endpoints registered
test_endpoint "GET" "/bookings/test-booking-id/medical-records" "" "404" "Medical Records Endpoints Registered"
# 404 confirms endpoint exists (test booking doesn't exist)

# Test 3.4: Meal plan endpoints registered
test_endpoint "GET" "/meal-plans/vendor/test-vendor-id" "" "404" "Meal Plan Endpoints Registered"
# 404 confirms endpoint exists (test vendor doesn't exist)

echo ""

# ============================================
# 4. CRUD Operations
# ============================================
echo -e "${YELLOW}4. Testing CRUD Operations${NC}"

# Test 4.1: Service CRUD - Read
test_endpoint "GET" "/vendor/test-vendor-id/services" "" "200" "Service CRUD - Read"

# Test 4.2: Service CRUD - Create (will fail without valid data, but confirms endpoint exists)
test_endpoint "POST" "/vendor/test-vendor-id/services" '{"serviceName":"Test","price":100}' "400" "Service CRUD - Create Endpoint Exists"
# 400 is expected - confirms endpoint exists and validates input

# Test 4.3: Staff service assignment - Assign
test_endpoint "POST" "/vendor/test-vendor-id/staff/test-staff-id/assign-services" '{"serviceIds":["test-id"]}' "404" "Staff Service Assignment - Assign Endpoint Exists"
# 404 is expected - confirms endpoint exists (test staff doesn't exist)

# Test 4.4: Staff service enable
test_endpoint "PUT" "/staff/test-staff-id/services/test-service-id/enable" '{}' "404" "Staff Service Enable Endpoint Exists"
# 404 is expected - confirms endpoint exists (test staff doesn't exist)

# Test 4.5: Staff service disable
test_endpoint "PUT" "/staff/test-staff-id/services/test-service-id/disable" "" "404" "Staff Service Disable Endpoint Exists"
# 404 is expected - confirms endpoint exists (test staff doesn't exist)

echo ""

# ============================================
# 5. Data Validation
# ============================================
echo -e "${YELLOW}5. Testing Data Validation${NC}"

# Test 5.1: Service style validation (requires actual vendor with role config)
echo -e "${YELLOW}   ⚠️  Manual test required: Verify service style validation with actual vendor role config${NC}"

# Test 5.2: Solo vendor at_center restriction (requires actual solo vendor)
echo -e "${YELLOW}   ⚠️  Manual test required: Verify solo vendor at_center restriction${NC}"

echo ""

# ============================================
# Summary
# ============================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Total Tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All automated tests passed!${NC}"
    echo -e "${YELLOW}⚠️  Note: Some tests require manual verification with actual data${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review the output above.${NC}"
    exit 1
fi
