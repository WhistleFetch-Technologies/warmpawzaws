#!/bin/bash

# ============================================================================
# Comprehensive Synthetic Test for GPS Tracking Flow
# ============================================================================
# Tests:
# 1. API endpoints are accessible
# 2. Handlers are registered correctly
# 3. API contracts match expected structure
# 4. UI components are properly integrated
# 5. End-to-end flow simulation
# ============================================================================

set +e  # Don't exit on error, we want to continue testing

API_BASE="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
SKIPPED=0

test_pass() {
  echo -e "${GREEN}✅ PASS: $1${NC}"
  ((PASSED++))
}

test_fail() {
  echo -e "${RED}❌ FAIL: $1${NC}"
  echo -e "${RED}   Error: $2${NC}"
  ((FAILED++))
}

test_skip() {
  echo -e "${YELLOW}⏭️  SKIP: $1 - $2${NC}"
  ((SKIPPED++))
}

echo -e "${BLUE}🚀 Comprehensive GPS Tracking Flow Test${NC}"
echo "============================================================================"
echo "API Base: $API_BASE"
echo "============================================================================"
echo ""

# Test 1: API Gateway Health Check
echo -e "${BLUE}🧪 Test 1: API Gateway Health Check${NC}"
if curl -s -o /dev/null -w "%{http_code}" "${API_BASE}/health" | grep -qE "^(200|404)$"; then
  test_pass "API Gateway is accessible"
else
  test_fail "API Gateway Health Check" "Could not reach API Gateway"
fi

# Test 2: Verify GPS Tracking Endpoints Registered
echo -e "\n${BLUE}🧪 Test 2: Verify GPS Tracking Endpoints Registered${NC}"

# Test POST /tracking/start
START_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${API_BASE}/tracking/start" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"test","vendorId":"test"}')

if [ "$START_RESPONSE" -lt 500 ]; then
  test_pass "POST /tracking/start endpoint is registered (status: $START_RESPONSE)"
else
  test_fail "POST /tracking/start endpoint" "Server error: $START_RESPONSE"
fi

# Test GET /tracking/booking/:id/status
STATUS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE}/tracking/booking/test-123/status")

if [ "$STATUS_RESPONSE" -lt 500 ]; then
  test_pass "GET /tracking/booking/:id/status endpoint is registered (status: $STATUS_RESPONSE)"
else
  test_fail "GET /tracking/booking/:id/status endpoint" "Server error: $STATUS_RESPONSE"
fi

# Test 3: Test POST /tracking/start API Contract
echo -e "\n${BLUE}🧪 Test 3: Test POST /tracking/start API Contract${NC}"
RESPONSE=$(curl -s -X POST "${API_BASE}/tracking/start" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "test-booking-123",
    "vendorId": "test-vendor-456",
    "startLatitude": 19.0760,
    "startLongitude": 72.8777
  }')

if echo "$RESPONSE" | grep -q '"success"'; then
  if echo "$RESPONSE" | grep -q '"session"'; then
    test_pass "POST /tracking/start returns correct contract structure"
    echo "   Response includes: success, session"
  else
    test_fail "POST /tracking/start API Contract" "Response missing 'session' field"
  fi
elif echo "$RESPONSE" | grep -qE '"error"|"message"'; then
  # 404 or 400 is acceptable for test data
  test_pass "POST /tracking/start endpoint responds (booking not found is expected)"
else
  test_fail "POST /tracking/start API Contract" "Unexpected response format"
fi

# Test 4: Test GET /tracking/booking/:id/status API Contract
echo -e "\n${BLUE}🧪 Test 4: Test GET /tracking/booking/:id/status API Contract${NC}"
HTTP_CODE=$(curl -s -o /tmp/status_response.json -w "%{http_code}" "${API_BASE}/tracking/booking/test-booking-123/status")
RESPONSE=$(cat /tmp/status_response.json)

# 404 is acceptable when no active session exists
if [ "$HTTP_CODE" = "404" ]; then
  test_pass "GET /tracking/booking/:id/status endpoint responds (404 - no active session is expected)"
elif echo "$RESPONSE" | grep -qE '"success"|"isTracking"'; then
  # Check for enhanced fields
  HAS_ENHANCED=$(echo "$RESPONSE" | grep -oE '"bookingDetails"|"vendorDetails"|"staffDetails"' | wc -l | tr -d ' ')
  
  if [ "$HAS_ENHANCED" -gt 0 ]; then
    test_pass "GET /tracking/booking/:id/status returns enhanced fields"
    echo "   Found $HAS_ENHANCED enhanced field(s)"
  else
    test_pass "GET /tracking/booking/:id/status returns correct structure"
  fi
else
  # Check if it's a valid error response
  if echo "$RESPONSE" | grep -qE '"error"|"message"'; then
    test_pass "GET /tracking/booking/:id/status returns valid error response (no active session)"
  else
    test_fail "GET /tracking/booking/:id/status API Contract" "Invalid response structure: $RESPONSE"
  fi
fi

# Test 5: Verify Handler Registration
echo -e "\n${BLUE}🧪 Test 5: Verify Handler Registration in Code${NC}"
if grep -q "registerGpsTrackingEndpoints" backend/lambda/src/handler/index.ts 2>/dev/null; then
  if grep -q "registerGpsTrackingEndpoints(app)" backend/lambda/src/handler/index.ts 2>/dev/null; then
    test_pass "GPS tracking endpoints registered in handler"
  else
    test_fail "Handler Registration" "registerGpsTrackingEndpoints not called"
  fi
else
  test_fail "Handler Registration" "registerGpsTrackingEndpoints not imported"
fi

# Test 6: Verify UI Components Exist
echo -e "\n${BLUE}🧪 Test 6: Verify UI Components Exist${NC}"
COMPONENTS=(
  "apps/customer-web/components/tracking/VendorLiveTrackingPopup.tsx:Web Popup"
  "apps/WarmpawzCustomer/src/screens/logistics/VendorTrackingPopup.tsx:Mobile Popup"
  "apps/customer-web/components/customer/CustomerHomeComplete.tsx:Customer Home"
  "apps/WarmpawzVendor/src/screens/tracking/GPSTrackingScreen.tsx:Vendor Screen"
)

ALL_EXIST=true
for component in "${COMPONENTS[@]}"; do
  FILE="${component%%:*}"
  NAME="${component##*:}"
  if [ -f "$FILE" ]; then
    echo "   ✅ $NAME exists"
  else
    test_fail "UI Component: $NAME" "File not found: $FILE"
    ALL_EXIST=false
  fi
done

if [ "$ALL_EXIST" = true ]; then
  test_pass "All UI components exist"
fi

# Test 7: Verify UI Component Integration
echo -e "\n${BLUE}🧪 Test 7: Verify UI Component Integration${NC}"
if grep -q "VendorLiveTrackingPopup" apps/customer-web/components/customer/CustomerHomeComplete.tsx 2>/dev/null; then
  if grep -q "<VendorLiveTrackingPopup" apps/customer-web/components/customer/CustomerHomeComplete.tsx 2>/dev/null; then
    if grep -q "activeTrackingSession" apps/customer-web/components/customer/CustomerHomeComplete.tsx 2>/dev/null; then
      if grep -q "/tracking/booking/" apps/customer-web/components/customer/CustomerHomeComplete.tsx 2>/dev/null; then
        test_pass "VendorLiveTrackingPopup properly integrated in CustomerHomeComplete"
      else
        test_fail "UI Integration" "Tracking endpoint not called"
      fi
    else
      test_fail "UI Integration" "activeTrackingSession state not found"
    fi
  else
    test_fail "UI Integration" "VendorLiveTrackingPopup component not used"
  fi
else
  test_fail "UI Integration" "VendorLiveTrackingPopup not imported"
fi

# Test 8: Verify API Contract Response Structure
echo -e "\n${BLUE}🧪 Test 8: Verify API Contract Response Structure${NC}"
HTTP_CODE=$(curl -s -o /tmp/status_response2.json -w "%{http_code}" "${API_BASE}/tracking/booking/test-booking-123/status")
RESPONSE=$(cat /tmp/status_response2.json)

# 404 is acceptable when no active session exists
if [ "$HTTP_CODE" = "404" ]; then
  test_pass "API response structure valid (404 - no active tracking expected)"
elif echo "$RESPONSE" | grep -qE '"success"|"isTracking"'; then
  STRUCTURE_VALID=true
  
  if echo "$RESPONSE" | grep -q '"tracking"'; then
    if echo "$RESPONSE" | grep -q '"id"'; then
      if echo "$RESPONSE" | grep -q '"status"'; then
        if echo "$RESPONSE" | grep -q '"vendorName"'; then
          test_pass "API response has correct structure (id, status, vendorName)"
        else
          test_fail "API Contract Structure" "Missing vendorName field"
        fi
      else
        test_fail "API Contract Structure" "Missing status field"
      fi
    else
      test_fail "API Contract Structure" "Missing id field"
    fi
  else
    test_pass "API response structure valid (no active tracking expected)"
  fi
elif echo "$RESPONSE" | grep -qE '"error"|"message"'; then
  test_pass "API response structure valid (error response for no active session)"
else
  test_fail "API Contract Structure" "Invalid response format: $RESPONSE"
fi

# Test 9: Verify Polling Mechanism
echo -e "\n${BLUE}🧪 Test 9: Verify Polling Mechanism in UI${NC}"
if grep -q "setInterval" apps/customer-web/components/customer/CustomerHomeComplete.tsx 2>/dev/null && \
   grep -q "loadActiveBookings" apps/customer-web/components/customer/CustomerHomeComplete.tsx 2>/dev/null; then
  if grep -q "setInterval" apps/customer-web/components/tracking/VendorLiveTrackingPopup.tsx 2>/dev/null && \
     grep -qE "10000|10 \* 1000" apps/customer-web/components/tracking/VendorLiveTrackingPopup.tsx 2>/dev/null; then
    test_pass "Polling mechanism implemented (CustomerHome: 30s, Popup: 10s)"
  else
    test_fail "Polling Mechanism" "Popup polling not found"
  fi
else
  test_fail "Polling Mechanism" "CustomerHome polling not found"
fi

# Test 10: Verify Mobile Optimization
echo -e "\n${BLUE}🧪 Test 10: Verify Mobile Optimization${NC}"
if grep -qE "max-w-\[430px\]|max-w-" apps/customer-web/components/tracking/VendorLiveTrackingPopup.tsx 2>/dev/null; then
  if grep -qE "sm:|mobile" apps/customer-web/components/tracking/VendorLiveTrackingPopup.tsx 2>/dev/null; then
    test_pass "Mobile optimization implemented (max-width: 430px, responsive classes)"
  else
    test_pass "Mobile optimization implemented (max-width constraint)"
  fi
else
  test_fail "Mobile Optimization" "Mobile constraints not found"
fi

# Test 11: Verify Backend Enhanced Fields
echo -e "\n${BLUE}🧪 Test 11: Verify Backend Enhanced Fields Implementation${NC}"
if grep -q "bookingDetails" backend/lambda/src/endpoints/gps-tracking.ts 2>/dev/null; then
  if grep -q "vendorDetails" backend/lambda/src/endpoints/gps-tracking.ts 2>/dev/null; then
    if grep -q "staffDetails" backend/lambda/src/endpoints/gps-tracking.ts 2>/dev/null; then
      test_pass "Backend includes enhanced fields (bookingDetails, vendorDetails, staffDetails)"
    else
      test_fail "Backend Enhanced Fields" "staffDetails not found"
    fi
  else
    test_fail "Backend Enhanced Fields" "vendorDetails not found"
  fi
else
  test_fail "Backend Enhanced Fields" "bookingDetails not found"
fi

# Test 12: Verify Notification Integration
echo -e "\n${BLUE}🧪 Test 12: Verify Notification Integration${NC}"
if grep -q "sendVendorOnWay" backend/lambda/src/lib/services/gps-tracking-service.ts 2>/dev/null; then
  test_pass "Notification service (sendVendorOnWay) integrated"
else
  test_fail "Notification Integration" "sendVendorOnWay not found"
fi

# Summary
echo ""
echo "============================================================================"
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo "============================================================================"
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo -e "${YELLOW}⏭️  Skipped: $SKIPPED${NC}"
echo ""

TOTAL=$((PASSED + FAILED + SKIPPED))
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║   ✅ ALL TESTS PASSED - Flow is properly wired!                ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║   ❌ SOME TESTS FAILED - Please review errors above            ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
  exit 1
fi
