#!/bin/bash
# ============================================================================
# Test Razorpay API Connectivity Directly via Lambda
# ============================================================================

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-south-1}

echo "🧪 Testing Razorpay API Connectivity via Lambda"
echo "================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get Lambda function name
LAMBDA_FUNC=$(aws lambda list-functions --region $AWS_REGION \
  --query "Functions[?contains(FunctionName, 'warmpawz-${ENVIRONMENT}-api')].FunctionName" \
  --output text | head -1)

if [ -z "$LAMBDA_FUNC" ] || [ "$LAMBDA_FUNC" == "None" ]; then
  echo -e "${RED}❌ Lambda function not found${NC}"
  exit 1
fi

echo -e "${BLUE}Found Lambda: $LAMBDA_FUNC${NC}"
echo ""

# Test 1: Create a test Razorpay order
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test: Creating Razorpay Order${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

TEST_PAYLOAD=$(cat <<EOF
{
  "requestContext": {
    "http": {
      "method": "POST",
      "path": "/razorpay/create-order"
    }
  },
  "body": "{\"amount\": 100, \"currency\": \"INR\", \"receipt\": \"test-$(date +%s)\"}",
  "headers": {
    "Content-Type": "application/json"
  }
}
EOF
)

echo "Invoking Lambda to create Razorpay order..."
LAMBDA_RESPONSE=$(aws lambda invoke \
  --function-name "$LAMBDA_FUNC" \
  --payload "$(echo "$TEST_PAYLOAD" | jq -c .)" \
  --region $AWS_REGION \
  /tmp/razorpay-test-response.json 2>&1)

if [ -f /tmp/razorpay-test-response.json ]; then
  RESPONSE_BODY=$(cat /tmp/razorpay-test-response.json)
  HTTP_CODE=$(echo "$RESPONSE_BODY" | jq -r '.statusCode // 500')
  BODY_CONTENT=$(echo "$RESPONSE_BODY" | jq -r '.body // "{}"')
  
  echo "HTTP Status: $HTTP_CODE"
  echo "Response: $BODY_CONTENT" | head -20
  
  if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "201" ]; then
    echo -e "${GREEN}✅ Razorpay API is reachable and working!${NC}"
  elif [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "403" ]; then
    echo -e "${YELLOW}⚠️  Razorpay API is reachable but authentication failed${NC}"
    echo "   This means connectivity is working, just needs valid credentials"
  elif echo "$BODY_CONTENT" | grep -qi "timeout\|connection\|network"; then
    echo -e "${RED}❌ Razorpay API connectivity issue detected${NC}"
  else
    echo -e "${YELLOW}⚠️  Razorpay API returned: HTTP $HTTP_CODE${NC}"
  fi
else
  echo -e "${RED}❌ Failed to invoke Lambda${NC}"
fi

echo ""

# Check CloudWatch logs for Razorpay calls
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Checking CloudWatch Logs${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

LOG_GROUP="/aws/lambda/$LAMBDA_FUNC"
echo "Checking logs for Razorpay API calls in the last 10 minutes..."

RAZORPAY_LOGS=$(aws logs filter-log-events \
  --log-group-name "$LOG_GROUP" \
  --start-time $(($(date +%s) - 600))000 \
  --filter-pattern "razorpay api.razorpay" \
  --region $AWS_REGION \
  --query 'events[*].message' \
  --output text 2>/dev/null | head -10 || echo "")

if [ -n "$RAZORPAY_LOGS" ]; then
  echo -e "${GREEN}✅ Found Razorpay API references in logs:${NC}"
  echo "$RAZORPAY_LOGS" | head -5
else
  echo -e "${YELLOW}ℹ️  No Razorpay API calls found in recent logs${NC}"
fi

echo ""
echo -e "${GREEN}✅ Test Complete${NC}"
echo ""
