#!/bin/bash

# Integration Test Script: Razorpay + Shiprocket
# Tests P0 critical integrations

echo "========================================="
echo "Testing Payment & Logistics Integrations"
echo "========================================="
echo ""

BASE_URL="https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475"
AUTH_TOKEN="YOUR_TOKEN_HERE"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local data=$4
  
  echo -e "${BLUE}Testing: $name${NC}"
  
  if [ "$method" = "GET" ]; then
    RESPONSE=$(curl -s -X GET "${BASE_URL}${endpoint}" \
      -H "Authorization: Bearer ${AUTH_TOKEN}")
  else
    RESPONSE=$(curl -s -X POST "${BASE_URL}${endpoint}" \
      -H "Authorization: Bearer ${AUTH_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  if echo "$RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASSED${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}❌ FAILED${NC}"
    echo "Response: $RESPONSE"
    ((TESTS_FAILED++))
  fi
  echo ""
}

echo "========================================="
echo -e "${YELLOW}PART 1: PAYMENT GATEWAY (RAZORPAY)${NC}"
echo "========================================="
echo ""

# Test 1: Get payment settings
test_endpoint "Get Payment Settings" "GET" "/admin/settings/payment-gateway" ""

# Test 2: Save payment settings
test_endpoint "Save Payment Settings" "POST" "/admin/settings/payment-gateway" '{
  "razorpay": {
    "enabled": true,
    "key_id": "rzp_test_xxx",
    "key_secret": "secret_xxx",
    "webhook_secret": "whsec_xxx",
    "auto_capture": true,
    "test_mode": true
  },
  "default_gateway": "razorpay",
  "commission_percentage": 15
}'

# Test 3: Create Razorpay order
test_endpoint "Create Razorpay Order" "POST" "/payments/razorpay/create-order" '{
  "bookingId": "test_booking_001",
  "amount": 1000,
  "currency": "INR",
  "notes": {
    "testMode": true
  }
}'

echo "========================================="
echo -e "${YELLOW}PART 2: LOGISTICS (SHIPROCKET)${NC}"
echo "========================================="
echo ""

# Test 4: Get logistics settings
test_endpoint "Get Logistics Settings" "GET" "/admin/settings/logistics" ""

# Test 5: Save logistics settings
test_endpoint "Save Logistics Settings" "POST" "/admin/settings/logistics" '{
  "shiprocket": {
    "enabled": true,
    "email": "test@warmpawz.com",
    "password": "test_password",
    "auto_awb": true,
    "auto_pickup": true,
    "test_mode": true
  },
  "default_provider": "shiprocket",
  "warehouse_address": {
    "name": "Test Warehouse",
    "city": "Bangalore",
    "pincode": "560001"
  }
}'

# Test 6: Check courier serviceability
test_endpoint "Check Courier Serviceability" "GET" "/logistics/shiprocket/couriers/serviceability?pickupPincode=560001&deliveryPincode=110001&weight=1&cod=0" ""

echo "========================================="
echo -e "${YELLOW}TEST SUMMARY${NC}"
echo "========================================="
echo ""
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Configure production credentials"
  echo "2. Setup webhook URLs"
  echo "3. Test with real Razorpay order"
  echo "4. Test with real Shiprocket shipment"
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  echo ""
  echo "Please check:"
  echo "1. Server is running"
  echo "2. Routes are mounted correctly"
  echo "3. KV store is accessible"
  echo "4. Integration files are present"
fi

echo ""
echo "========================================="
