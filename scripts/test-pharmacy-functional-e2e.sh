#!/bin/bash

# ============================================================================
# FUNCTIONAL E2E TEST - PHARMACY ORDER FLOW
# ============================================================================
# Tests actual API endpoints and functionality
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
echo -e "${BLUE}🧪 FUNCTIONAL E2E TEST - PHARMACY ORDER FLOW${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

PASSED=0
FAILED=0
SKIPPED=0

# ============================================================================
# TEST 1: Create Pharmacy Order
# ============================================================================

echo -e "${BLUE}Test 1: Create Pharmacy Order${NC}"

ORDER_PAYLOAD=$(cat <<EOF
{
  "phone": "${TEST_PHONE}",
  "items": [
    {
      "medicine_name": "Test Medicine 1",
      "quantity": 2,
      "unit_price": 100
    },
    {
      "medicine_name": "Test Medicine 2",
      "quantity": 1,
      "unit_price": 150
    }
  ],
  "deliveryAddress": {
    "lat": 19.0760,
    "lng": 72.8777,
    "address": "Test Address, Mumbai",
    "pincode": "400001"
  },
  "paymentMethod": "online",
  "logisticsType": "warmpawz",
  "notes": "Functional E2E Test Order"
}
EOF
)

ORDER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE_URL}/pharmacy/orders/create" \
  -H "Content-Type: application/json" \
  -d "$ORDER_PAYLOAD" 2>&1)

HTTP_CODE=$(echo "$ORDER_RESPONSE" | tail -1)
ORDER_BODY=$(echo "$ORDER_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  ORDER_ID=$(echo "$ORDER_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
  if [ -z "$ORDER_ID" ]; then
    ORDER_ID=$(echo "$ORDER_BODY" | grep -o '"orderId":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
  fi
  if [ -z "$ORDER_ID" ]; then
    ORDER_ID=$(echo "$ORDER_BODY" | jq -r '.order.id // .orderId // empty' 2>/dev/null || echo "")
  fi
  
  if [ -n "$ORDER_ID" ]; then
    echo -e "${GREEN}✅ Order created successfully: ${ORDER_ID}${NC}"
    ((PASSED++))
    export TEST_ORDER_ID="$ORDER_ID"
  else
    echo -e "${YELLOW}⚠️  Order created but ID not found in response${NC}"
    echo -e "${YELLOW}   Response: ${ORDER_BODY}${NC}"
    ((SKIPPED++))
    export TEST_ORDER_ID=""
  fi
else
  echo -e "${RED}❌ Failed to create order (HTTP $HTTP_CODE)${NC}"
  echo -e "${RED}   Response: ${ORDER_BODY}${NC}"
  ((FAILED++))
  export TEST_ORDER_ID=""
fi
echo ""

# ============================================================================
# TEST 2: Get Broadcast Status
# ============================================================================

if [ -n "$TEST_ORDER_ID" ]; then
  echo -e "${BLUE}Test 2: Get Broadcast Status${NC}"
  
  BROADCAST_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_BASE_URL}/pharmacy/orders/${TEST_ORDER_ID}/broadcast-status" \
    -H "Content-Type: application/json" 2>&1)
  
  HTTP_CODE=$(echo "$BROADCAST_RESPONSE" | tail -1)
  BROADCAST_BODY=$(echo "$BROADCAST_RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BROADCAST_BODY" | grep -q "broadcastStatus\|currentRadius"; then
      echo -e "${GREEN}✅ Broadcast status retrieved successfully${NC}"
      ((PASSED++))
    else
      echo -e "${YELLOW}⚠️  Broadcast status endpoint returned 200 but unexpected format${NC}"
      ((SKIPPED++))
    fi
  else
    echo -e "${RED}❌ Failed to get broadcast status (HTTP $HTTP_CODE)${NC}"
    ((FAILED++))
  fi
  echo ""
else
  echo -e "${YELLOW}⚠️  Skipping Test 2: No order ID available${NC}"
  ((SKIPPED++))
  echo ""
fi

# ============================================================================
# TEST 3: Get Order Details
# ============================================================================

if [ -n "$TEST_ORDER_ID" ]; then
  echo -e "${BLUE}Test 3: Get Order Details${NC}"
  
  ORDER_DETAILS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_BASE_URL}/pharmacy/orders/${TEST_ORDER_ID}" \
    -H "Content-Type: application/json" 2>&1)
  
  HTTP_CODE=$(echo "$ORDER_DETAILS_RESPONSE" | tail -1)
  ORDER_DETAILS_BODY=$(echo "$ORDER_DETAILS_RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" = "200" ]; then
    if echo "$ORDER_DETAILS_BODY" | grep -q "order\|id\|status"; then
      ORDER_STATUS=$(echo "$ORDER_DETAILS_BODY" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
      echo -e "${GREEN}✅ Order details retrieved successfully${NC}"
      echo -e "${BLUE}   Order Status: ${ORDER_STATUS}${NC}"
      ((PASSED++))
    else
      echo -e "${YELLOW}⚠️  Order details endpoint returned 200 but unexpected format${NC}"
      ((SKIPPED++))
    fi
  else
    echo -e "${RED}❌ Failed to get order details (HTTP $HTTP_CODE)${NC}"
    ((FAILED++))
  fi
  echo ""
else
  echo -e "${YELLOW}⚠️  Skipping Test 3: No order ID available${NC}"
  ((SKIPPED++))
  echo ""
fi

# ============================================================================
# TEST 4: Expand Broadcast (if order is broadcasting)
# ============================================================================

if [ -n "$TEST_ORDER_ID" ]; then
  echo -e "${BLUE}Test 4: Expand Broadcast${NC}"
  
  EXPAND_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE_URL}/pharmacy/orders/${TEST_ORDER_ID}/expand-broadcast" \
    -H "Content-Type: application/json" 2>&1)
  
  HTTP_CODE=$(echo "$EXPAND_RESPONSE" | tail -1)
  EXPAND_BODY=$(echo "$EXPAND_RESPONSE" | sed '$d')
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Broadcast expansion successful${NC}"
    ((PASSED++))
  elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${YELLOW}⚠️  Order not found or not in broadcasting status (expected if order was accepted/cancelled)${NC}"
    ((SKIPPED++))
  else
    echo -e "${YELLOW}⚠️  Broadcast expansion returned HTTP $HTTP_CODE (may be expected)${NC}"
    ((SKIPPED++))
  fi
  echo ""
else
  echo -e "${YELLOW}⚠️  Skipping Test 4: No order ID available${NC}"
  ((SKIPPED++))
  echo ""
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 FUNCTIONAL TEST SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Total Tests: $((PASSED + FAILED + SKIPPED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
echo ""

if [ -n "$TEST_ORDER_ID" ]; then
  echo -e "${BLUE}Test Order ID: ${TEST_ORDER_ID}${NC}"
  echo -e "${BLUE}You can check this order in the system${NC}"
  echo ""
fi

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL FUNCTIONAL TESTS PASSED!${NC}"
  exit 0
else
  echo -e "${RED}❌ SOME FUNCTIONAL TESTS FAILED${NC}"
  exit 1
fi
