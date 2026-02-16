#!/bin/bash
# ============================================================================
# Test Razorpay Production API
# ============================================================================

set -e

API_BASE_URL=${1:-https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com}
AMOUNT=${2:-400}

echo "🧪 Testing Razorpay Production API"
echo "=================================="
echo "API: $API_BASE_URL"
echo "Amount: ₹$AMOUNT"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test 1: Create Razorpay order (booking_prepaid type - no booking required)
echo -e "${BLUE}Test 1: Creating Razorpay order (booking_prepaid)...${NC}"
CREATE_RESPONSE=$(curl -X POST "$API_BASE_URL/razorpay/create-order" \
  -H "Content-Type: application/json" \
  -H "Origin: https://dg69gqp2frh39.cloudfront.net" \
  -d "{
    \"type\": \"booking_prepaid\",
    \"amount\": $AMOUNT,
    \"customerId\": \"1a903ccc-77b0-40db-9993-fba8bc0648ef\",
    \"vendorId\": \"13b59aea-00a8-4679-bfc9-c0e211a160a0\",
    \"currency\": \"INR\"
  }" \
  -s \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$CREATE_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
CREATE_BODY=$(echo "$CREATE_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "HTTP Status: $HTTP_STATUS"
echo "Response:"
echo "$CREATE_BODY" | jq '.' 2>/dev/null || echo "$CREATE_BODY"
echo ""

if [ "$HTTP_STATUS" == "200" ] || [ "$HTTP_STATUS" == "201" ]; then
  echo -e "${GREEN}✅ Razorpay order created successfully!${NC}"
  ORDER_ID=$(echo "$CREATE_BODY" | jq -r '.orderId' 2>/dev/null || echo "")
  if [ -n "$ORDER_ID" ] && [ "$ORDER_ID" != "null" ]; then
    echo -e "${GREEN}Order ID: $ORDER_ID${NC}"
  fi
else
  echo -e "${RED}❌ Razorpay order creation failed${NC}"
  ERROR_CODE=$(echo "$CREATE_BODY" | jq -r '.error.code' 2>/dev/null || echo "")
  ERROR_MSG=$(echo "$CREATE_BODY" | jq -r '.error.message' 2>/dev/null || echo "")
  if [ -n "$ERROR_CODE" ] && [ "$ERROR_CODE" != "null" ]; then
    echo -e "${YELLOW}Error Code: $ERROR_CODE${NC}"
    echo -e "${YELLOW}Error Message: $ERROR_MSG${NC}"
  fi
fi

echo ""
echo -e "${BLUE}Test 2: Checking Razorpay configuration...${NC}"
echo "This test verifies that Razorpay keys are configured in:"
echo "  1. AWS Secrets Manager (warmpawz/prod/razorpay)"
echo "  2. Database (platform_integrations table)"
echo "  3. Environment variables (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)"
echo ""
echo "If the order creation failed, check:"
echo "  - AWS Secrets Manager permissions"
echo "  - Database connection"
echo "  - Environment variables in Lambda"
echo "  - Razorpay API connectivity from Lambda (VPC/NAT Gateway)"
