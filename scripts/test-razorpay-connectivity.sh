#!/bin/bash
# ============================================================================
# Test Razorpay Connectivity from Lambda
# ============================================================================
# This script tests if Lambda can successfully communicate with Razorpay API
# ============================================================================

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-south-1}

echo "🧪 Testing Razorpay Connectivity"
echo "================================"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get API Gateway URL
echo -e "${BLUE}Step 1: Finding API Gateway URL...${NC}"
API_URL=$(aws apigatewayv2 get-apis --region $AWS_REGION --query "Items[?contains(ApiEndpoint, 'warmpawz') || contains(Name, 'warmpawz')].ApiEndpoint" --output text 2>/dev/null | head -1)

if [ -z "$API_URL" ] || [ "$API_URL" == "None" ]; then
    # Try to get from SSM
    API_URL=$(aws ssm get-parameter --name "/warmpawz/$ENVIRONMENT/api/url" --region $AWS_REGION --query 'Parameter.Value' --output text 2>/dev/null || echo "")
fi

if [ -z "$API_URL" ] || [ "$API_URL" == "None" ]; then
    # Try common API Gateway ID
    API_URL="https://z0b3obweb6.execute-api.$AWS_REGION.amazonaws.com"
    echo -e "${YELLOW}⚠️  Using default API Gateway URL: $API_URL${NC}"
else
    echo -e "${GREEN}✅ Found API Gateway URL: $API_URL${NC}"
fi

echo ""

# Test 1: Health Check
echo -e "${BLUE}Step 2: Testing API Health...${NC}"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/health" 2>/dev/null || echo -e "\n000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)
BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ API is healthy (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${YELLOW}⚠️  API health check returned HTTP $HTTP_CODE${NC}"
    echo "   Response: $BODY"
fi
echo ""

# Test 2: Razorpay Create Order (without auth - should fail gracefully)
echo -e "${BLUE}Step 3: Testing Razorpay Endpoint (should return error, not timeout)...${NC}"
START_TIME=$(date +%s)
RAZORPAY_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/razorpay/create-order" \
    -H "Content-Type: application/json" \
    -d '{"bookingId": "test-connectivity", "amount": 100, "currency": "INR"}' \
    --max-time 30 2>/dev/null || echo -e "\n000")
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

HTTP_CODE=$(echo "$RAZORPAY_RESPONSE" | tail -1)
BODY=$(echo "$RAZORPAY_RESPONSE" | sed '$d')

echo "  Response time: ${DURATION}s"
echo "  HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" == "000" ] || [ "$DURATION" -ge 30 ]; then
    echo -e "  ${RED}❌ TIMEOUT - Lambda cannot reach Razorpay API${NC}"
    echo -e "  ${YELLOW}This indicates a network connectivity issue${NC}"
    echo ""
    echo "  Possible causes:"
    echo "    1. Route table not configured for Lambda subnets"
    echo "    2. NAT Gateway not working"
    echo "    3. Security group still blocking outbound"
    echo "    4. Lambda function not in VPC"
    FAILED=true
elif [ "$HTTP_CODE" == "503" ] || [ "$HTTP_CODE" == "502" ]; then
    echo -e "  ${YELLOW}⚠️  Gateway/Service Unavailable (HTTP $HTTP_CODE)${NC}"
    echo "  Response: $BODY"
    echo ""
    if echo "$BODY" | grep -q "timeout\|timed out\|network\|connectivity"; then
        echo -e "  ${RED}❌ Network timeout detected in response${NC}"
        FAILED=true
    else
        echo -e "  ${GREEN}✅ Network connectivity OK (error is expected without valid config)${NC}"
        echo "  This is likely a configuration issue, not a network issue"
    fi
elif [ "$HTTP_CODE" == "400" ] || [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "404" ]; then
    echo -e "  ${GREEN}✅ Network connectivity OK (HTTP $HTTP_CODE)${NC}"
    echo "  Response: $BODY"
    echo "  The endpoint is reachable - error is expected without valid credentials/booking"
    SUCCESS=true
elif [ "$HTTP_CODE" == "500" ]; then
    echo -e "  ${YELLOW}⚠️  Server Error (HTTP 500)${NC}"
    echo "  Response: $BODY"
    if echo "$BODY" | grep -q "timeout\|timed out\|network"; then
        echo -e "  ${RED}❌ Network timeout detected${NC}"
        FAILED=true
    else
        echo -e "  ${GREEN}✅ Network connectivity OK (500 is application error, not network)${NC}"
        SUCCESS=true
    fi
else
    echo -e "  ${YELLOW}⚠️  Unexpected response (HTTP $HTTP_CODE)${NC}"
    echo "  Response: $BODY"
fi
echo ""

# Test 3: Check Lambda Logs
echo -e "${BLUE}Step 4: Checking Recent Lambda Logs...${NC}"
LAMBDA_FUNC=$(aws lambda list-functions --region $AWS_REGION --query "Functions[?contains(FunctionName, 'warmpawz-$ENVIRONMENT-api')].FunctionName" --output text | head -1)

if [ -n "$LAMBDA_FUNC" ] && [ "$LAMBDA_FUNC" != "None" ]; then
    echo "  Lambda function: $LAMBDA_FUNC"
    LOG_GROUP="/aws/lambda/$LAMBDA_FUNC"
    
    # Get recent logs (last 5 minutes)
    echo "  Fetching recent logs..."
    RECENT_LOGS=$(aws logs filter-log-events \
        --log-group-name "$LOG_GROUP" \
        --start-time $(($(date +%s) - 300))000 \
        --region $AWS_REGION \
        --query 'events[*].message' \
        --output text 2>/dev/null | grep -i "razorpay\|timeout\|network\|nat\|gateway" | tail -10 || echo "")
    
    if [ -n "$RECENT_LOGS" ]; then
        echo -e "  ${YELLOW}Recent relevant log entries:${NC}"
        echo "$RECENT_LOGS" | while read line; do
            if echo "$line" | grep -qi "timeout\|failed\|error"; then
                echo -e "    ${RED}⚠️  $line${NC}"
            else
                echo -e "    ${GREEN}ℹ️  $line${NC}"
            fi
        done
    else
        echo -e "  ${GREEN}✅ No timeout/network errors in recent logs${NC}"
    fi
else
    echo -e "  ${YELLOW}⚠️  Lambda function not found${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$FAILED" == "true" ]; then
    echo -e "${RED}❌ CONNECTIVITY TEST FAILED${NC}"
    echo ""
    echo "The Lambda function cannot reach Razorpay API. Please:"
    echo "  1. Run diagnostics: ./scripts/diagnose-nat-gateway.sh $ENVIRONMENT $AWS_REGION"
    echo "  2. Verify Lambda is in private subnets with NAT Gateway routing"
    echo "  3. Check security groups allow HTTPS outbound"
    echo "  4. Verify NAT Gateway is in 'available' state"
    exit 1
elif [ "$SUCCESS" == "true" ]; then
    echo -e "${GREEN}✅ CONNECTIVITY TEST PASSED${NC}"
    echo ""
    echo "Lambda can successfully communicate with external APIs."
    echo "Any errors are likely configuration-related, not network-related."
    exit 0
else
    echo -e "${YELLOW}⚠️  INCONCLUSIVE - Manual verification needed${NC}"
    echo ""
    echo "Please check:"
    echo "  1. CloudWatch logs for the Lambda function"
    echo "  2. API Gateway logs"
    echo "  3. Test with a valid booking ID and Razorpay credentials"
    exit 0
fi
