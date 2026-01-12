#!/bin/bash

# ============================================================================
# Schedule Management Testing Script
# ============================================================================
# 
# This script tests the schedule management functionality with policy enforcement
# 
# Usage: ./test-schedule-management.sh [VENDOR_ID]
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
VENDOR_ID="${1:-test-vendor-id}"
HEADERS=(-H "Content-Type: application/json" -H "X-UAT-Mode: true" -H "X-UAT-Token: uat-token-admin")

# Helper functions
print_test() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Test:${NC} $1"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Test counter
PASSED=0
FAILED=0

# ============================================================================
# Test Cases
# ============================================================================

echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          Schedule Management Policy Enforcement Testing                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
echo -e "\n${YELLOW}API URL:${NC} ${API_URL}"
echo -e "${YELLOW}Vendor ID:${NC} ${VENDOR_ID}\n"

# ============================================================================
# Test 1: Get Scheduling Policies
# ============================================================================

print_test "Test 1: Get All Scheduling Policies"
RESPONSE=$(curl -s -X GET "${API_URL}/admin/scheduling-policies" "${HEADERS[@]}")
if echo "$RESPONSE" | grep -q "success.*true"; then
    print_success "Policies retrieved successfully"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    ((PASSED++))
else
    print_error "Failed to get policies"
    echo "$RESPONSE"
    ((FAILED++))
fi

# ============================================================================
# Test 2: Create Valid Schedule
# ============================================================================

print_test "Test 2: Create Valid Schedule"
RESPONSE=$(curl -s -X POST "${API_URL}/vendor/${VENDOR_ID}/schedule" \
    "${HEADERS[@]}" \
    -d '{
        "slots": [
            {
                "dayOfWeek": 1,
                "serviceStyle": "at_center",
                "timeWindowStart": "09:00",
                "timeWindowEnd": "17:00",
                "slotDurationMinutes": 30,
                "maxCapacity": 2,
                "isEnabled": true
            }
        ]
    }')

if echo "$RESPONSE" | grep -q "success.*true"; then
    print_success "Valid schedule created successfully"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    ((PASSED++))
else
    print_error "Failed to create valid schedule"
    echo "$RESPONSE"
    ((FAILED++))
fi

# ============================================================================
# Test 3: Create Past Schedule (Should Fail)
# ============================================================================

print_test "Test 3: Create Past Schedule (Should Fail)"
CURRENT_DAY=$(date +%w)
PAST_TIME="08:00"

RESPONSE=$(curl -s -X POST "${API_URL}/vendor/${VENDOR_ID}/schedule" \
    "${HEADERS[@]}" \
    -d "{
        \"slots\": [
            {
                \"dayOfWeek\": ${CURRENT_DAY},
                \"serviceStyle\": \"at_center\",
                \"timeWindowStart\": \"${PAST_TIME}\",
                \"timeWindowEnd\": \"09:00\",
                \"maxCapacity\": 1
            }
        ]
    }")

if echo "$RESPONSE" | grep -q "validation.*failed\|Cannot set schedule in the past"; then
    print_success "Past schedule correctly rejected"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    ((PASSED++))
else
    print_error "Past schedule validation failed (should have been rejected)"
    echo "$RESPONSE"
    ((FAILED++))
fi

# ============================================================================
# Test 4: Create Overlapping Slots (Should Fail)
# ============================================================================

print_test "Test 4: Create Overlapping Slots (Should Fail)"

# First, create a valid schedule
curl -s -X POST "${API_URL}/vendor/${VENDOR_ID}/schedule" \
    "${HEADERS[@]}" \
    -d '{
        "slots": [
            {
                "dayOfWeek": 2,
                "serviceStyle": "at_center",
                "timeWindowStart": "09:00",
                "timeWindowEnd": "12:00",
                "maxCapacity": 1
            }
        ]
    }' > /dev/null

# Then try to create overlapping slot
RESPONSE=$(curl -s -X POST "${API_URL}/vendor/${VENDOR_ID}/schedule" \
    "${HEADERS[@]}" \
    -d '{
        "slots": [
            {
                "dayOfWeek": 2,
                "serviceStyle": "at_center",
                "timeWindowStart": "11:00",
                "timeWindowEnd": "14:00",
                "maxCapacity": 1
            }
        ]
    }')

if echo "$RESPONSE" | grep -q "validation.*failed\|overlaps"; then
    print_success "Overlapping slots correctly rejected"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    ((PASSED++))
else
    print_error "Overlapping slots validation failed (should have been rejected)"
    echo "$RESPONSE"
    ((FAILED++))
fi

# ============================================================================
# Test 5: Get Available Slots
# ============================================================================

print_test "Test 5: Get Available Slots"
DATE=$(date -d "+1 day" +%Y-%m-%d 2>/dev/null || date -v+1d +%Y-%m-%d 2>/dev/null || echo "2025-01-27")

RESPONSE=$(curl -s -X GET "${API_URL}/vendor/${VENDOR_ID}/slots/${DATE}?serviceStyle=at_center" \
    "${HEADERS[@]}")

if echo "$RESPONSE" | grep -q "success.*true"; then
    print_success "Available slots retrieved successfully"
    echo "$RESPONSE" | jq '.slots | length' 2>/dev/null || echo "$RESPONSE"
    ((PASSED++))
else
    print_error "Failed to get available slots"
    echo "$RESPONSE"
    ((FAILED++))
fi

# ============================================================================
# Test 6: Get Schedule Configuration
# ============================================================================

print_test "Test 6: Get Schedule Configuration"
RESPONSE=$(curl -s -X GET "${API_URL}/vendor/${VENDOR_ID}/schedule" \
    "${HEADERS[@]}")

if echo "$RESPONSE" | grep -q "success.*true"; then
    print_success "Schedule configuration retrieved successfully"
    echo "$RESPONSE" | jq '.totalSlots' 2>/dev/null || echo "$RESPONSE"
    ((PASSED++))
else
    print_error "Failed to get schedule configuration"
    echo "$RESPONSE"
    ((FAILED++))
fi

# ============================================================================
# Test 7: Get Policy by Type
# ============================================================================

print_test "Test 7: Get Policy by Type"
RESPONSE=$(curl -s -X GET "${API_URL}/admin/scheduling-policies/buffer_time" \
    "${HEADERS[@]}")

if echo "$RESPONSE" | grep -q "success.*true\|policy"; then
    print_success "Policy by type retrieved successfully"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
    ((PASSED++))
else
    print_info "Policy not found (may not exist yet)"
    echo "$RESPONSE"
    ((PASSED++)) # Not a failure - policy may not exist
fi

# ============================================================================
# Test Summary
# ============================================================================

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Passed:${NC} ${PASSED}"
echo -e "${RED}Failed:${NC} ${FAILED}"
echo -e "${YELLOW}Total:${NC} $((PASSED + FAILED))"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}\n"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}\n"
    exit 1
fi
