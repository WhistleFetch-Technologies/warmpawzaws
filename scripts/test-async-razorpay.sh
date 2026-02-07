#!/bin/bash
# ============================================================================
# Test Async Razorpay Order Creation Flow
# ============================================================================

set -e

API_BASE_URL=${1:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}
BOOKING_ID=${2:-516768d9-e975-466c-98c8-fa2414f7d136}
AMOUNT=${3:-2049}
CUSTOMER_ID=${4:-39c84571-b26d-475a-bb38-94975cb8262d}

echo "🧪 Testing Async Razorpay Order Creation"
echo "========================================"
echo "API: $API_BASE_URL"
echo "Booking ID: $BOOKING_ID"
echo "Amount: $AMOUNT"
echo "Customer ID: $CUSTOMER_ID"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Create order
echo -e "${BLUE}Step 1: Creating Razorpay order...${NC}"
CREATE_RESPONSE=$(curl -X POST "$API_BASE_URL/razorpay/create-order" \
  -H "Content-Type: application/json" \
  -H "Origin: https://d2aoyjj8ine0wk.cloudfront.net" \
  -d "{
    \"bookingId\": \"$BOOKING_ID\",
    \"amount\": $AMOUNT,
    \"customerId\": \"$CUSTOMER_ID\",
    \"currency\": \"INR\"
  }" \
  -s \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$CREATE_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
CREATE_BODY=$(echo "$CREATE_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$HTTP_STATUS" != "202" ]; then
  echo -e "${RED}❌ Failed to create order${NC}"
  echo "HTTP Status: $HTTP_STATUS"
  echo "$CREATE_BODY" | jq '.' 2>/dev/null || echo "$CREATE_BODY"
  exit 1
fi

echo -e "${GREEN}✅ Order creation request successful${NC}"
echo "$CREATE_BODY" | jq '.' 2>/dev/null || echo "$CREATE_BODY"
echo ""

PAYMENT_ID=$(echo "$CREATE_BODY" | jq -r '.paymentId' 2>/dev/null || echo "")

if [ -z "$PAYMENT_ID" ] || [ "$PAYMENT_ID" == "null" ]; then
  echo -e "${RED}❌ No paymentId in response${NC}"
  exit 1
fi

echo -e "${GREEN}Payment ID: $PAYMENT_ID${NC}"
echo ""

# Step 2: Check status immediately
echo -e "${BLUE}Step 2: Checking status (immediately)...${NC}"
STATUS_RESPONSE=$(curl "$API_BASE_URL/razorpay/order-status/$PAYMENT_ID" \
  -s \
  -w "\nHTTP_STATUS:%{http_code}")

STATUS_HTTP=$(echo "$STATUS_RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
STATUS_BODY=$(echo "$STATUS_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')

echo "$STATUS_BODY" | jq '.' 2>/dev/null || echo "$STATUS_BODY"
echo ""

INITIAL_STATUS=$(echo "$STATUS_BODY" | jq -r '.status' 2>/dev/null || echo "")

if [ "$INITIAL_STATUS" == "processing" ]; then
  echo -e "${YELLOW}⚠️  Status: processing (expected)${NC}"
elif [ "$INITIAL_STATUS" == "ready" ]; then
  echo -e "${GREEN}✅ Status: ready (already processed!)${NC}"
  echo "$STATUS_BODY" | jq '.'
  exit 0
else
  echo -e "${YELLOW}⚠️  Status: $INITIAL_STATUS${NC}"
fi

# Step 3: Poll for completion
echo -e "${BLUE}Step 3: Polling for completion (max 20 attempts, 2s interval)...${NC}"

MAX_ATTEMPTS=20
ATTEMPT=0
FINAL_STATUS=""

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  echo -n "Attempt $ATTEMPT/$MAX_ATTEMPTS... "
  
  sleep 2
  
  STATUS_RESPONSE=$(curl "$API_BASE_URL/razorpay/order-status/$PAYMENT_ID" \
    -s \
    -w "\nHTTP_STATUS:%{http_code}")
  
  STATUS_BODY=$(echo "$STATUS_RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')
  FINAL_STATUS=$(echo "$STATUS_BODY" | jq -r '.status' 2>/dev/null || echo "")
  
  if [ "$FINAL_STATUS" == "ready" ]; then
    echo -e "${GREEN}✅ Ready!${NC}"
    echo ""
    echo -e "${GREEN}Final Status:${NC}"
    echo "$STATUS_BODY" | jq '.'
    exit 0
  elif [ "$FINAL_STATUS" == "failed" ]; then
    echo -e "${RED}❌ Failed${NC}"
    echo ""
    echo "$STATUS_BODY" | jq '.'
    exit 1
  else
    echo -e "${YELLOW}$FINAL_STATUS${NC}"
  fi
done

echo ""
echo -e "${RED}❌ Timeout: Order still processing after $MAX_ATTEMPTS attempts${NC}"
echo "Final status: $FINAL_STATUS"
echo "$STATUS_BODY" | jq '.' 2>/dev/null || echo "$STATUS_BODY"
exit 1
