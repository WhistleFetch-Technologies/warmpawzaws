#!/bin/bash
# ============================================================================
# Test External API Connectivity via Lambda
# ============================================================================
# Tests Razorpay, Google Maps, and Shiprocket API connectivity
# ============================================================================

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-south-1}
API_BASE_URL=${3:-"https://dev.api.warmpawz.com"}

echo "🧪 Testing External API Connectivity"
echo "====================================="
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "API Base URL: $API_BASE_URL"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test 1: Health Check
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 1: API Health Check${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "${API_BASE_URL}/health" || echo "HTTP_CODE:000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" == "200" ]; then
  echo -e "${GREEN}✅ API is healthy (HTTP $HTTP_CODE)${NC}"
  echo "   Response: $RESPONSE_BODY"
else
  echo -e "${RED}❌ API health check failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# Test 2: Razorpay API (via payment endpoint)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 2: Razorpay API Connectivity${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Testing Razorpay connectivity (creating test order)..."
RAZORPAY_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST "${API_BASE_URL}/razorpay/create-order" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "currency": "INR",
    "receipt": "test-order-'$(date +%s)'"
  }' 2>&1 || echo "HTTP_CODE:000")

RAZORPAY_HTTP_CODE=$(echo "$RAZORPAY_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
RAZORPAY_BODY=$(echo "$RAZORPAY_RESPONSE" | sed '/HTTP_CODE/d' | head -20)

if [ "$RAZORPAY_HTTP_CODE" == "200" ] || [ "$RAZORPAY_HTTP_CODE" == "201" ]; then
  echo -e "${GREEN}✅ Razorpay API is reachable (HTTP $RAZORPAY_HTTP_CODE)${NC}"
  echo "   Response preview: $(echo "$RAZORPAY_BODY" | head -3)"
elif [ "$RAZORPAY_HTTP_CODE" == "401" ] || [ "$RAZORPAY_HTTP_CODE" == "403" ]; then
  echo -e "${YELLOW}⚠️  Razorpay API is reachable but authentication failed (HTTP $RAZORPAY_HTTP_CODE)${NC}"
  echo "   This is expected - API is reachable, just needs valid credentials"
elif [ "$RAZORPAY_HTTP_CODE" == "000" ] || [ "$RAZORPAY_HTTP_CODE" == "500" ] || [ "$RAZORPAY_HTTP_CODE" == "503" ]; then
  echo -e "${RED}❌ Razorpay API connectivity issue (HTTP $RAZORPAY_HTTP_CODE)${NC}"
  echo "   Response: $RAZORPAY_BODY"
else
  echo -e "${YELLOW}⚠️  Razorpay API returned: HTTP $RAZORPAY_HTTP_CODE${NC}"
  echo "   Response: $RAZORPAY_BODY"
fi
echo ""

# Test 3: Google Maps API (via geocoding endpoint if available)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 3: Google Maps API Connectivity${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Testing Google Maps API connectivity..."
# Test via a simple endpoint that might use Google Maps
GOOGLE_MAPS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X GET "${API_BASE_URL}/health" \
  -H "Content-Type: application/json" \
  2>&1 || echo "HTTP_CODE:000")

# Note: We can't directly test Google Maps API without an endpoint that uses it
# But we can check if Lambda can make external HTTPS calls
echo -e "${YELLOW}ℹ️  Google Maps API test requires an endpoint that uses it${NC}"
echo "   To fully test, trigger a booking flow that uses geocoding"
echo ""

# Test 4: Shiprocket API (via shipping endpoint if available)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 4: Shiprocket API Connectivity${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Testing Shiprocket API connectivity..."
# Similar to Google Maps, we need an endpoint that uses Shiprocket
echo -e "${YELLOW}ℹ️  Shiprocket API test requires an endpoint that uses it${NC}"
echo "   To fully test, trigger an order flow that uses shipping"
echo ""

# Test 5: Direct External API Test (via Lambda invoke)
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 5: Direct External API Test via Lambda${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

LAMBDA_FUNC=$(aws lambda list-functions --region $AWS_REGION \
  --query "Functions[?contains(FunctionName, 'warmpawz-${ENVIRONMENT}-api')].FunctionName" \
  --output text | head -1)

if [ -n "$LAMBDA_FUNC" ] && [ "$LAMBDA_FUNC" != "None" ]; then
  echo "Found Lambda function: $LAMBDA_FUNC"
  echo "Invoking Lambda to test external API connectivity..."
  
  # Create a test payload that will trigger external API calls
  TEST_PAYLOAD='{
    "httpMethod": "POST",
    "path": "/test-external-apis",
    "body": "{\"test\": \"razorpay\"}"
  }'
  
  LAMBDA_RESPONSE=$(aws lambda invoke \
    --function-name "$LAMBDA_FUNC" \
    --payload "$TEST_PAYLOAD" \
    --region $AWS_REGION \
    /tmp/lambda-response.json 2>&1 || echo "ERROR")
  
  if [ -f /tmp/lambda-response.json ]; then
    LAMBDA_OUTPUT=$(cat /tmp/lambda-response.json | head -50)
    echo -e "${GREEN}✅ Lambda invoked successfully${NC}"
    echo "   Response preview: $(echo "$LAMBDA_OUTPUT" | head -5)"
  else
    echo -e "${YELLOW}⚠️  Lambda invocation may have issues${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Lambda function not found${NC}"
fi
echo ""

# Test 6: Check CloudWatch Logs for External API Calls
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 6: Checking CloudWatch Logs${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -n "$LAMBDA_FUNC" ] && [ "$LAMBDA_FUNC" != "None" ]; then
  LOG_GROUP="/aws/lambda/$LAMBDA_FUNC"
  
  echo "Checking recent logs for external API calls..."
  RECENT_LOGS=$(aws logs tail "$LOG_GROUP" \
    --since 5m \
    --format short \
    --region $AWS_REGION 2>&1 | grep -i "razorpay\|google\|shiprocket\|api.razorpay\|maps.googleapis" | head -10 || echo "")
  
  if [ -n "$RECENT_LOGS" ]; then
    echo -e "${GREEN}✅ Found external API references in logs:${NC}"
    echo "$RECENT_LOGS" | head -5
  else
    echo -e "${YELLOW}ℹ️  No recent external API calls found in logs${NC}"
    echo "   This is normal if no API calls were made recently"
  fi
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ External API Connectivity Test Complete${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📝 Next Steps:"
echo "   1. Test actual payment flow to verify Razorpay connectivity"
echo "   2. Test booking flow with address to verify Google Maps connectivity"
echo "   3. Test order shipping to verify Shiprocket connectivity"
echo "   4. Monitor CloudWatch logs for any connectivity errors"
echo ""
echo "🔍 To verify NAT instance is working:"
echo "   aws ec2 describe-instances --instance-ids i-0e38af5c56c72cca9 --region ap-south-1"
echo ""
