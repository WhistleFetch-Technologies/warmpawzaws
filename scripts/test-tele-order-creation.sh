#!/bin/bash

# ============================================================================
# TEST TELE CONSULTATION ORDER CREATION
# ============================================================================

set -e

echo "🧪 Testing Tele Consultation Order Creation..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# API Base URL
API_BASE="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

# Test data
TEST_PHONE="${TEST_PHONE:-9611377119}"
TEST_CUSTOMER_ID="${TEST_CUSTOMER_ID:-39c84571-b26d-475a-bb38-94975cb8262d}"
TEST_PET_ID="${TEST_PET_ID:-6e28df3a-3880-460a-b747-bd359330fc32}"

echo -e "${BLUE}📋 Test Configuration:${NC}"
echo "  API Base: $API_BASE"
echo "  Test Phone: $TEST_PHONE"
echo "  Customer ID: $TEST_CUSTOMER_ID"
echo "  Pet ID: $TEST_PET_ID"
echo ""

# Test 1: Create order with null shipping address (tele consultation)
echo -e "${BLUE}Test 1: Create Tele Consultation Order (Auto-Assign)${NC}"
ORDER_PAYLOAD=$(cat <<EOF
{
  "items": [
    {
      "product_id": "vet_tele_consult",
      "service_id": "vet_tele_consult",
      "quantity": 1,
      "price": 300,
      "total": 300,
      "service_name": "Online video consultation"
    }
  ],
  "vendorId": "platform",
  "quantity": 1,
  "customerPhone": "$TEST_PHONE",
  "customerId": "$TEST_CUSTOMER_ID",
  "subtotal": 300,
  "taxAmount": 54,
  "total": 354,
  "orderType": "service",
  "serviceId": "vet_tele_consult",
  "serviceName": "Online video consultation",
  "serviceStyle": "tele",
  "petId": "$TEST_PET_ID",
  "shippingAddress": null
}
EOF
)

echo "Request payload:"
echo "$ORDER_PAYLOAD" | jq '.' 2>/dev/null || echo "$ORDER_PAYLOAD"
echo ""

RESPONSE=$(curl -s -X POST "${API_BASE}/customer/orders" \
  -H "Content-Type: application/json" \
  -d "$ORDER_PAYLOAD" || echo "{}")

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q "error\|Error\|ERROR"; then
  echo -e "${RED}❌ Order creation failed${NC}"
  ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // .message // "Unknown error"' 2>/dev/null || echo "Unknown error")
  echo "  Error: $ERROR_MSG"
  exit 1
elif echo "$RESPONSE" | grep -q "orderId\|id\|success"; then
  echo -e "${GREEN}✅ Order created successfully${NC}"
  ORDER_ID=$(echo "$RESPONSE" | jq -r '.orderId // .order.id // .id // "unknown"' 2>/dev/null || echo "unknown")
  echo "  Order ID: $ORDER_ID"
else
  echo -e "${YELLOW}⚠️  Unexpected response${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ TEST COMPLETE                                             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
