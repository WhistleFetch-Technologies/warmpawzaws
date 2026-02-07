#!/bin/bash

# ============================================================================
# TEST SCRIPT: Vendor Discovery Gap Fixes
# ============================================================================
# Tests all new endpoints and functionality after deployment
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# API Base URL (default to dev)
API_BASE="${API_BASE:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

echo -e "${GREEN}=== Testing Vendor Discovery Gap Fixes ===${NC}\n"

# Test counters
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local name="$1"
    local method="$2"
    local url="$3"
    local data="$4"
    local expected_status="${5:-200}"
    
    echo -e "${YELLOW}Testing: ${name}${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url" || echo "000")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$url" || echo "000")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ] || [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        echo "Response: $body"
        ((FAILED++))
        return 1
    fi
}

# ============================================================================
# TEST 1: Package Discovery with serviceStyle
# ============================================================================
echo -e "\n${GREEN}[1] Testing Package Discovery with serviceStyle${NC}"

test_endpoint \
    "Package Discovery - at_center" \
    "GET" \
    "${API_BASE}/packages/discover?serviceStyle=at_center&serviceType=vet"

test_endpoint \
    "Package Discovery - at_home" \
    "GET" \
    "${API_BASE}/packages/discover?serviceStyle=at_home&serviceType=training"

test_endpoint \
    "Package Discovery - tele" \
    "GET" \
    "${API_BASE}/packages/discover?serviceStyle=tele"

# ============================================================================
# TEST 2: Package Check for Booking with serviceStyle
# ============================================================================
echo -e "\n${GREEN}[2] Testing Package Check for Booking${NC}"

# Note: Replace with actual test IDs
PHONE="${TEST_PHONE:-9876543210}"
VENDOR_ID="${TEST_VENDOR_ID:-test-vendor-id}"

test_endpoint \
    "Package Check - with serviceStyle" \
    "GET" \
    "${API_BASE}/packages/check-for-booking?phone=${PHONE}&vendorId=${VENDOR_ID}&serviceStyle=at_home"

# ============================================================================
# TEST 3: Diagnostic Test Creation with New Fields
# ============================================================================
echo -e "\n${GREEN}[3] Testing Diagnostic Test Creation${NC}"

DIAGNOSTIC_TEST_DATA='{
    "testName": "Complete Blood Count - Test",
    "testCode": "CBC-TEST",
    "category": "blood",
    "description": "Test diagnostic with new fields",
    "price": 500,
    "durationMinutes": 30,
    "sampleType": "blood",
    "preparationInstructions": "Fasting required",
    "isFreeHomeCollection": true,
    "homeCollectionFee": 0,
    "termsConditions": "Test terms and conditions",
    "turnaroundTimeHours": 24,
    "isPackageAvailable": false
}'

# Note: Requires vendor ID with diagnostics capability
VENDOR_ID_DIAG="${TEST_VENDOR_ID_DIAG:-test-vendor-id}"

test_endpoint \
    "Create Diagnostic Test - with new fields" \
    "POST" \
    "${API_BASE}/vendor/${VENDOR_ID_DIAG}/diagnostics/tests" \
    "$DIAGNOSTIC_TEST_DATA" \
    "200"

# ============================================================================
# TEST 4: Sample Collection Assignment
# ============================================================================
echo -e "\n${GREEN}[4] Testing Sample Collection Assignment${NC}"

SAMPLE_ASSIGNMENT_DATA='{
    "bookingId": "test-booking-id",
    "vendorId": "test-vendor-id",
    "staffId": "test-staff-id",
    "customerId": "test-customer-id",
    "customerName": "Test Customer",
    "customerPhone": "9876543210",
    "customerAddress": {
        "street": "123 Test Street",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400001"
    },
    "scheduledDate": "2026-01-28",
    "scheduledTime": "10:00:00",
    "diagnosticTests": [{"testId": "test-1", "testName": "CBC"}]
}'

test_endpoint \
    "Assign Sample Collection" \
    "POST" \
    "${API_BASE}/diagnostics/sample-collection/assign" \
    "$SAMPLE_ASSIGNMENT_DATA" \
    "200"

# ============================================================================
# TEST 5: Chat Status Check
# ============================================================================
echo -e "\n${GREEN}[5] Testing Chat Status Endpoint${NC}"

BOOKING_ID="${TEST_BOOKING_ID:-test-booking-id}"

test_endpoint \
    "Check Chat Status" \
    "GET" \
    "${API_BASE}/reminders/chat-status/${BOOKING_ID}"

# ============================================================================
# TEST 6: Reminder Send (5-minute for tele)
# ============================================================================
echo -e "\n${GREEN}[6] Testing Reminder Send${NC}"

REMINDER_DATA='{
    "reminderMinutes": 5,
    "serviceStyles": ["tele"],
    "dryRun": true
}'

test_endpoint \
    "Send 5-Minute Reminder (dry run)" \
    "POST" \
    "${API_BASE}/reminders/send" \
    "$REMINDER_DATA" \
    "200"

# ============================================================================
# SUMMARY
# ============================================================================
echo -e "\n${GREEN}=== Test Summary ===${NC}"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}✗ Some tests failed. Check output above.${NC}"
    exit 1
fi
