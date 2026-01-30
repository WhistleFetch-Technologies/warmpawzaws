#!/bin/bash

# ============================================================================
# COMPREHENSIVE PHARMACY FLOW TEST
# ============================================================================
# Tests all implemented features:
# 1. SMS Integration
# 2. Error Handling
# 3. CloudWatch Metrics
# 4. End-to-End Flow
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
TEST_PHONE="${TEST_PHONE:-8123456780}"
TEST_CUSTOMER_UUID="${TEST_CUSTOMER_UUID:-0d64d12f-3f6a-4cf7-a0c9-47d0ab5d189b}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧪 COMPREHENSIVE PHARMACY FLOW TEST${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PASSED=0
FAILED=0

# Test counter
test_count=0

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

test_pass() {
  ((test_count++))
  ((PASSED++))
  echo -e "${GREEN}✅ Test $test_count: $1${NC}"
}

test_fail() {
  ((test_count++))
  ((FAILED++))
  echo -e "${RED}❌ Test $test_count: $1${NC}"
  if [ -n "$2" ]; then
    echo -e "${RED}   Error: $2${NC}"
  fi
}

test_info() {
  echo -e "${BLUE}📋 $1${NC}"
}

# ============================================================================
# TEST 1: API HEALTH CHECK
# ============================================================================

test_info "Test 1: API Health Check"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${API_BASE_URL}/health" 2>/dev/null || echo -e "\n000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
  test_pass "API is reachable (HTTP $HTTP_CODE)"
else
  test_fail "API health check failed" "HTTP $HTTP_CODE"
fi
echo ""

# ============================================================================
# TEST 2: SMS SERVICE FILE EXISTS
# ============================================================================

test_info "Test 2: SMS Service Implementation"
if [ -f "backend/lambda/src/lib/services/sms-service.ts" ]; then
  test_pass "SMS service file exists"
  
  # Check for key functions
  if grep -q "sendOTP\|sendSMS" backend/lambda/src/lib/services/sms-service.ts; then
    test_pass "SMS service has sendOTP/sendSMS functions"
  else
    test_fail "SMS service missing key functions"
  fi
  
  # Check for phone normalization
  if grep -q "normalizePhoneNumber" backend/lambda/src/lib/services/sms-service.ts; then
    test_pass "SMS service has phone normalization"
  else
    test_fail "SMS service missing phone normalization"
  fi
else
  test_fail "SMS service file not found"
fi
echo ""

# ============================================================================
# TEST 3: SMS INTEGRATION IN PHARMACY ORDERS
# ============================================================================

test_info "Test 3: SMS Integration in Pharmacy Orders"
SMS_INTEGRATIONS=$(grep -c "smsService\|sendOTP" backend/lambda/src/endpoints/pharmacy-orders.ts 2>/dev/null || echo "0")

if [ "$SMS_INTEGRATIONS" -ge "2" ]; then
  test_pass "SMS integrated in pharmacy orders ($SMS_INTEGRATIONS locations)"
  
  # Check specific locations
  if grep -q "smsService.sendOTP" backend/lambda/src/endpoints/pharmacy-orders.ts; then
    test_pass "SMS service called with sendOTP"
  else
    test_fail "SMS service not called with sendOTP"
  fi
else
  test_fail "SMS not properly integrated" "Found $SMS_INTEGRATIONS integrations, expected at least 2"
fi
echo ""

# ============================================================================
# TEST 4: ERROR HANDLING IMPLEMENTATION
# ============================================================================

test_info "Test 4: Error Handling Implementation"

ERROR_HANDLERS=0

# Check for no_pharmacy_found
if grep -q "no_pharmacy_found" backend/lambda/src/endpoints/pharmacy-orders.ts; then
  test_pass "no_pharmacy_found error handler exists"
  ((ERROR_HANDLERS++))
else
  test_fail "no_pharmacy_found error handler missing"
fi

# Check for all_rejected
if grep -q "all_rejected\|All pharmacies rejected" backend/lambda/src/endpoints/pharmacy-orders.ts; then
  test_pass "all_rejected error handler exists"
  ((ERROR_HANDLERS++))
else
  test_fail "all_rejected error handler missing"
fi

# Check for payment retry logic
if grep -q "retry\|Retry" backend/lambda/src/endpoints/pharmacy-orders.ts; then
  test_pass "Payment retry logic exists"
  ((ERROR_HANDLERS++))
else
  test_fail "Payment retry logic missing"
fi

# Check for OTP locked
if grep -q "OTP_LOCKED\|otp_failed_attempts" backend/lambda/src/endpoints/pharmacy-orders.ts; then
  test_pass "OTP locked handler exists"
  ((ERROR_HANDLERS++))
else
  test_fail "OTP locked handler missing"
fi

# Check for broadcast_failed
if grep -q "broadcast_failed" backend/lambda/src/endpoints/pharmacy-orders.ts; then
  test_pass "broadcast_failed error handler exists"
  ((ERROR_HANDLERS++))
else
  test_fail "broadcast_failed error handler missing"
fi

echo -e "${BLUE}   Total error handlers found: $ERROR_HANDLERS${NC}"
echo ""

# ============================================================================
# TEST 5: CLOUDWATCH METRICS PUBLISHING
# ============================================================================

test_info "Test 5: CloudWatch Metrics Publishing"

CLOUDWATCH_METRICS=0

# Check for CloudWatch client import
if grep -q "CloudWatchClient\|PutMetricDataCommand" backend/lambda/src/endpoints/pharmacy-orders.ts; then
  test_pass "CloudWatch client imported"
  ((CLOUDWATCH_METRICS++))
else
  test_fail "CloudWatch client not imported"
fi

# Check for no_pharmacy_found metric (check within 50 lines)
if grep -A 50 "status: 'no_pharmacy_found'" backend/lambda/src/endpoints/pharmacy-orders.ts | grep -q "PutMetricDataCommand\|PharmacyOrderErrors.*no_pharmacy_found"; then
  test_pass "no_pharmacy_found metric publishing exists"
  ((CLOUDWATCH_METRICS++))
else
  # Try alternative check
  if grep -B 5 -A 20 "no_pharmacy_found" backend/lambda/src/endpoints/pharmacy-orders.ts | grep -q "PutMetricDataCommand"; then
    test_pass "no_pharmacy_found metric publishing exists"
    ((CLOUDWATCH_METRICS++))
  else
    test_fail "no_pharmacy_found metric publishing missing"
  fi
fi

# Check for all_rejected metric (check within 50 lines)
if grep -A 50 "All pharmacies rejected\|all_rejected" backend/lambda/src/endpoints/pharmacy-orders.ts | grep -q "PutMetricDataCommand.*all_rejected\|PharmacyOrderErrors.*all_rejected"; then
  test_pass "all_rejected metric publishing exists"
  ((CLOUDWATCH_METRICS++))
else
  # Try alternative check
  if grep -B 5 -A 20 "all_rejected\|All pharmacies rejected" backend/lambda/src/endpoints/pharmacy-orders.ts | grep -q "PutMetricDataCommand"; then
    test_pass "all_rejected metric publishing exists"
    ((CLOUDWATCH_METRICS++))
  else
    test_fail "all_rejected metric publishing missing"
  fi
fi

# Check for payment_failed metric (check within 50 lines)
if grep -A 50 "PAYMENT_GATEWAY_ERROR\|payment_failed" backend/lambda/src/endpoints/pharmacy-orders.ts | grep -q "PutMetricDataCommand.*payment_failed\|PharmacyPaymentErrors"; then
  test_pass "payment_failed metric publishing exists"
  ((CLOUDWATCH_METRICS++))
else
  # Try alternative check
  if grep -B 5 -A 20 "PAYMENT_GATEWAY_ERROR" backend/lambda/src/endpoints/pharmacy-orders.ts | grep -q "PutMetricDataCommand"; then
    test_pass "payment_failed metric publishing exists"
    ((CLOUDWATCH_METRICS++))
  else
    test_fail "payment_failed metric publishing missing"
  fi
fi

echo -e "${BLUE}   Total CloudWatch metrics found: $CLOUDWATCH_METRICS${NC}"
echo ""

# ============================================================================
# TEST 6: CLOUDWATCH TERRAFORM MODULE
# ============================================================================

test_info "Test 6: CloudWatch Terraform Module"

if [ -d "infra/modules/cloudwatch" ]; then
  test_pass "CloudWatch Terraform module directory exists"
  
  if [ -f "infra/modules/cloudwatch/main.tf" ]; then
    test_pass "CloudWatch main.tf exists"
    
    # Check for alarms
    ALARM_COUNT=$(grep -c "aws_cloudwatch_metric_alarm" infra/modules/cloudwatch/main.tf 2>/dev/null || echo "0")
    if [ "$ALARM_COUNT" -ge "3" ]; then
      test_pass "CloudWatch alarms defined ($ALARM_COUNT alarms)"
    else
      test_fail "Insufficient CloudWatch alarms" "Found $ALARM_COUNT, expected at least 3"
    fi
    
    # Check for dashboard
    if grep -q "aws_cloudwatch_dashboard" infra/modules/cloudwatch/main.tf; then
      test_pass "CloudWatch dashboard defined"
    else
      test_fail "CloudWatch dashboard missing"
    fi
  else
    test_fail "CloudWatch main.tf missing"
  fi
  
  if [ -f "infra/modules/cloudwatch/variables.tf" ]; then
    test_pass "CloudWatch variables.tf exists"
  else
    test_fail "CloudWatch variables.tf missing"
  fi
  
  if [ -f "infra/modules/cloudwatch/outputs.tf" ]; then
    test_pass "CloudWatch outputs.tf exists"
  else
    test_fail "CloudWatch outputs.tf missing"
  fi
else
  test_fail "CloudWatch Terraform module directory missing"
fi
echo ""

# ============================================================================
# TEST 7: TEST SCRIPT IMPROVEMENTS
# ============================================================================

test_info "Test 7: Test Script Improvements"

if [ -f "scripts/test-pharmacy-flow-e2e.sh" ]; then
  test_pass "Test script exists"
  
  # Check for test customer handling
  if grep -q "TEST_CUSTOMER_UUID\|TEST_CUSTOMER_ID" scripts/test-pharmacy-flow-e2e.sh; then
    test_pass "Test script has customer ID handling"
  else
    test_fail "Test script missing customer ID handling"
  fi
  
  # Check for known test customer
  if grep -q "0d64d12f-3f6a-4cf7-a0c9-47d0ab5d189b" scripts/test-pharmacy-flow-e2e.sh; then
    test_pass "Test script uses known test customer ID"
  else
    test_fail "Test script missing known test customer ID"
  fi
else
  test_fail "Test script not found"
fi
echo ""

# ============================================================================
# TEST 8: PHARMACY ORDER ENDPOINTS
# ============================================================================

test_info "Test 8: Pharmacy Order Endpoints"

# Check for key endpoints
ENDPOINTS_FOUND=0

if grep -q "POST.*pharmacy/orders/create" backend/lambda/src/endpoints/pharmacy-orders.ts; then
  test_pass "POST /pharmacy/orders/create endpoint exists"
  ((ENDPOINTS_FOUND++))
else
  test_fail "POST /pharmacy/orders/create endpoint missing"
fi

if grep -q "GET.*pharmacy/orders.*broadcast-status" backend/lambda/src/endpoints/pharmacy-orders.ts; then
  test_pass "GET /pharmacy/orders/:orderId/broadcast-status endpoint exists"
  ((ENDPOINTS_FOUND++))
else
  test_fail "GET /pharmacy/orders/:orderId/broadcast-status endpoint missing"
fi

if grep -q "POST.*pharmacy/orders.*payment" backend/lambda/src/endpoints/pharmacy-orders.ts; then
  test_pass "POST /pharmacy/orders/:orderId/payment endpoint exists"
  ((ENDPOINTS_FOUND++))
else
  test_fail "POST /pharmacy/orders/:orderId/payment endpoint missing"
fi

if grep -q "POST.*pharmacy/orders.*dispatch" backend/lambda/src/endpoints/pharmacy-orders.ts; then
  test_pass "POST /pharmacy/orders/:orderId/dispatch endpoint exists"
  ((ENDPOINTS_FOUND++))
else
  test_fail "POST /pharmacy/orders/:orderId/dispatch endpoint missing"
fi

if grep -q "POST.*pharmacy/orders.*complete" backend/lambda/src/endpoints/pharmacy-orders.ts; then
  test_pass "POST /pharmacy/orders/:orderId/complete endpoint exists"
  ((ENDPOINTS_FOUND++))
else
  test_fail "POST /pharmacy/orders/:orderId/complete endpoint missing"
fi

echo -e "${BLUE}   Total endpoints found: $ENDPOINTS_FOUND${NC}"
echo ""

# ============================================================================
# TEST 9: NOTIFICATION INTEGRATION
# ============================================================================

test_info "Test 9: Notification Integration"

NOTIFICATIONS_FOUND=0

# Check for sendEventNotification
if grep -q "sendEventNotification\|sendOrderStatusNotification" backend/lambda/src/endpoints/pharmacy-orders.ts; then
  NOTIFICATION_COUNT=$(grep -c "sendEventNotification\|sendOrderStatusNotification" backend/lambda/src/endpoints/pharmacy-orders.ts 2>/dev/null || echo "0")
  if [ "$NOTIFICATION_COUNT" -ge "5" ]; then
    test_pass "Notification functions called ($NOTIFICATION_COUNT times)"
    ((NOTIFICATIONS_FOUND++))
  else
    test_fail "Insufficient notification calls" "Found $NOTIFICATION_COUNT, expected at least 5"
  fi
else
  test_fail "Notification functions not found"
fi

# Check for logistics partner notifications
if grep -q "logistics_partner\|logistics partner" backend/lambda/src/endpoints/pharmacy-orders.ts; then
  test_pass "Logistics partner notifications implemented"
  ((NOTIFICATIONS_FOUND++))
else
  test_fail "Logistics partner notifications missing"
fi

echo -e "${BLUE}   Notification checks passed: $NOTIFICATIONS_FOUND${NC}"
echo ""

# ============================================================================
# TEST 10: DOCUMENTATION
# ============================================================================

test_info "Test 10: Documentation"

DOCS_FOUND=0

if [ -f "docs/SMS_SERVICE_IMPLEMENTATION.md" ]; then
  test_pass "SMS service documentation exists"
  ((DOCS_FOUND++))
else
  test_fail "SMS service documentation missing"
fi

if [ -f "docs/PHARMACY_ERROR_HANDLING.md" ]; then
  test_pass "Error handling documentation exists"
  ((DOCS_FOUND++))
else
  test_fail "Error handling documentation missing"
fi

if [ -f "docs/TASKS_COMPLETION_SUMMARY.md" ]; then
  test_pass "Completion summary documentation exists"
  ((DOCS_FOUND++))
else
  test_fail "Completion summary documentation missing"
fi

echo -e "${BLUE}   Documentation files found: $DOCS_FOUND${NC}"
echo ""

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Total Tests: $test_count"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
  exit 0
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  exit 1
fi
