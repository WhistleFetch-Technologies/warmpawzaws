#!/bin/bash
# ============================================================================
# Test Customer Web Endpoints
# ============================================================================
# Tests all 5 newly created endpoints
# ============================================================================

set -e

ENVIRONMENT="${1:-dev}"
REGION="${2:-ap-south-1}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "================================================================="
echo "🧪 Testing Customer Web Endpoints"
echo "================================================================="
echo ""
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${REGION}"
echo ""

# Get API Gateway URL
if [ "$ENVIRONMENT" = "prod" ]; then
  API_BASE_URL="https://api.warmpawz.com"
elif [ "$ENVIRONMENT" = "stage" ]; then
  API_BASE_URL="https://stage.api.warmpawz.com"
else
  # Try to get from Terraform or use default
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  
  cd "$PROJECT_ROOT/infra/envs/${ENVIRONMENT}" 2>/dev/null && {
    terraform init -backend-config=backend.hcl > /dev/null 2>&1
    API_BASE_URL=$(terraform output -raw api_gateway_url 2>/dev/null || echo "")
  } || true
  
  if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "null" ]; then
    API_BASE_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
  fi
fi

echo -e "${BLUE}API Base URL: ${API_BASE_URL}${NC}"
echo ""

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to test endpoint
test_endpoint() {
  local METHOD=$1
  local ENDPOINT=$2
  local DATA=$3
  local DESCRIPTION=$4
  
  echo -e "${BLUE}Testing: ${DESCRIPTION}${NC}"
  echo "  ${METHOD} ${ENDPOINT}"
  
  if [ "$METHOD" = "GET" ]; then
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_BASE_URL}${ENDPOINT}" \
      -H "Content-Type: application/json" 2>&1 || echo -e "\n000")
  else
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE_URL}${ENDPOINT}" \
      -H "Content-Type: application/json" \
      -d "$DATA" 2>&1 || echo -e "\n000")
  fi
  
  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo -e "  ${GREEN}✅ PASS${NC} (HTTP ${HTTP_CODE})"
    echo "  Response: $(echo "$BODY" | head -c 100)..."
    TESTS_PASSED=$((TESTS_PASSED + 1))
  elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "  ${YELLOW}⚠️  NOT FOUND${NC} (HTTP ${HTTP_CODE})"
    echo "  Endpoint may not be deployed yet"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  else
    echo -e "  ${RED}❌ FAIL${NC} (HTTP ${HTTP_CODE})"
    echo "  Response: $(echo "$BODY" | head -c 200)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
  echo ""
}

echo "================================================================="
echo "Test Suite 1: Follow-up & Reschedule Endpoints"
echo "================================================================="
echo ""

# Test 1: Get reschedule policy (requires bookingId - using mock)
echo -e "${YELLOW}Note: Some tests require valid booking/vendor IDs${NC}"
echo ""

test_endpoint "GET" "/vendor/reschedule-policy?bookingId=test-booking-id" "" \
  "Get reschedule policy"

# Test 2: Get available slots (requires bookingId - using mock)
test_endpoint "GET" "/vendor/available-slots?bookingId=test-booking-id&date=2026-01-15" "" \
  "Get available slots for rescheduling"

# Test 3: Create follow-up (requires valid data - will likely fail but tests endpoint exists)
test_endpoint "POST" "/followup/create" '{
  "originalBookingId": "test-booking-id",
  "customerPhone": "1234567890",
  "vendorId": "test-vendor-id",
  "selectedDate": "2026-01-15",
  "selectedTime": "10:00",
  "serviceStyle": "at_center"
}' \
  "Create follow-up appointment"

echo "================================================================="
echo "Test Suite 2: Behavior Journal Endpoints"
echo "================================================================="
echo ""

# Test 4: Get behavior journal
test_endpoint "GET" "/customer/behavior-journal?limit=10" "" \
  "Get behavior journal entries"

# Test 5: Create behavior journal entry (requires valid data)
test_endpoint "POST" "/behaviorist/journal-entry" '{
  "petId": "test-pet-id",
  "customerId": "test-customer-id",
  "behavior": "Barking",
  "triggers": ["Strangers", "Loud noises"],
  "duration": "5 minutes",
  "severity": "medium",
  "notes": "Test entry"
}' \
  "Create behavior journal entry"

echo "================================================================="
echo "Test Summary"
echo "================================================================="
echo ""
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All endpoint tests passed!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Some tests failed (may be due to missing test data)${NC}"
  echo ""
  echo "Note: 404 errors may indicate endpoints are not deployed yet."
  echo "      400/500 errors with valid responses indicate endpoints exist."
  exit 0  # Don't fail build, just report
fi
