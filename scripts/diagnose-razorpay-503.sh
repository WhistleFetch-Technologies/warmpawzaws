#!/bin/bash
# ============================================================================
# Diagnose Razorpay 503 Service Unavailable Error
# ============================================================================
# Tests the endpoint and checks for CORS, routing, and Lambda errors
# ============================================================================

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-south-1}

echo "🔍 Diagnosing Razorpay 503 Error"
echo "=================================="
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Find API Gateway URL
echo -e "${BLUE}Step 1: Finding API Gateway URL...${NC}"
API_URL=$(aws apigatewayv2 get-apis --region "$AWS_REGION" --query "Items[?ApiId=='z0b3obweb6'].ApiEndpoint" --output text 2>/dev/null || echo "")

if [ -z "$API_URL" ]; then
  # Try alternative method
  API_URL="https://z0b3obweb6.execute-api.${AWS_REGION}.amazonaws.com"
fi

if [ -z "$API_URL" ]; then
  echo -e "${RED}❌ Could not find API Gateway URL${NC}"
  exit 1
fi

echo -e "${GREEN}✅ API Gateway URL: $API_URL${NC}"
echo ""

# Test 1: OPTIONS request (CORS preflight)
echo -e "${BLUE}Step 2: Testing CORS Preflight (OPTIONS)...${NC}"
OPTIONS_RESPONSE=$(curl -s -w "\n%{http_code}" -X OPTIONS "$API_URL/razorpay/create-order" \
  -H "Origin: https://d2aoyjj8ine0wk.cloudfront.net" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  --max-time 10 2>&1 || echo -e "\n000")

OPTIONS_HTTP_CODE=$(echo "$OPTIONS_RESPONSE" | tail -1)
OPTIONS_BODY=$(echo "$OPTIONS_RESPONSE" | sed '$d')

if [ "$OPTIONS_HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ CORS preflight OK (HTTP $OPTIONS_HTTP_CODE)${NC}"
  echo "   CORS Headers:"
  echo "$OPTIONS_BODY" | grep -i "access-control" || echo "   (No CORS headers in response)"
else
  echo -e "${YELLOW}⚠️  CORS preflight returned HTTP $OPTIONS_HTTP_CODE${NC}"
  echo "   Response: $OPTIONS_BODY"
fi
echo ""

# Test 2: POST request with minimal payload
echo -e "${BLUE}Step 3: Testing POST /razorpay/create-order...${NC}"
POST_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/razorpay/create-order" \
  -H "Content-Type: application/json" \
  -H "Origin: https://d2aoyjj8ine0wk.cloudfront.net" \
  -d '{"bookingId":"test-diagnostic","amount":100,"currency":"INR"}' \
  --max-time 30 2>&1 || echo -e "\n000")

POST_HTTP_CODE=$(echo "$POST_RESPONSE" | tail -1)
POST_BODY=$(echo "$POST_RESPONSE" | sed '$d')

echo "   HTTP Status: $POST_HTTP_CODE"
echo "   Response: $POST_BODY"
echo ""

if [ "$POST_HTTP_CODE" = "503" ]; then
  echo -e "${RED}❌ 503 Service Unavailable detected${NC}"
  echo ""
  echo -e "${BLUE}Step 4: Checking Lambda logs for errors...${NC}"
  
  # Get recent Lambda logs
  LOG_GROUP="/aws/lambda/warmpawz-${ENVIRONMENT}-api-handler"
  
  echo "   Fetching logs from: $LOG_GROUP"
  RECENT_LOGS=$(aws logs tail "$LOG_GROUP" --since 10m --region "$AWS_REGION" --format short 2>&1 | tail -30 || echo "No logs found")
  
  if echo "$RECENT_LOGS" | grep -qi "razorpay\|503\|error\|exception\|timeout"; then
    echo -e "${YELLOW}⚠️  Found relevant log entries:${NC}"
    echo "$RECENT_LOGS" | grep -i "razorpay\|503\|error\|exception\|timeout" | head -10
  else
    echo -e "${YELLOW}⚠️  No obvious errors in recent logs${NC}"
    echo "   Last 5 log entries:"
    echo "$RECENT_LOGS" | tail -5
  fi
  echo ""
  
  echo -e "${BLUE}Step 5: Checking Lambda function status...${NC}"
  LAMBDA_STATUS=$(aws lambda get-function \
    --function-name "warmpawz-${ENVIRONMENT}-api-handler" \
    --region "$AWS_REGION" \
    --query 'Configuration.[State,LastUpdateStatus,Timeout]' \
    --output text 2>/dev/null || echo "unknown unknown unknown")
  
  echo "   Lambda State: $(echo $LAMBDA_STATUS | awk '{print $1}')"
  echo "   Last Update Status: $(echo $LAMBDA_STATUS | awk '{print $2}')"
  echo "   Timeout: $(echo $LAMBDA_STATUS | awk '{print $3}')s"
  echo ""
  
  echo -e "${BLUE}Step 6: Checking API Gateway integration...${NC}"
  # Check if API Gateway can reach Lambda
  API_ID="z0b3obweb6"
  INTEGRATIONS=$(aws apigatewayv2 get-integrations \
    --api-id "$API_ID" \
    --region "$AWS_REGION" \
    --query 'Items[*].[IntegrationId,IntegrationUri]' \
    --output text 2>/dev/null || echo "")
  
  if [ -n "$INTEGRATIONS" ]; then
    echo "   Found integrations:"
    echo "$INTEGRATIONS" | head -5
  else
    echo -e "${YELLOW}⚠️  Could not fetch integration details${NC}"
  fi
  echo ""
  
  echo -e "${YELLOW}💡 Possible causes:${NC}"
  echo "   1. Lambda function error (check logs above)"
  echo "   2. Lambda timeout (check timeout setting)"
  echo "   3. VPC networking issue (NAT Gateway, security groups)"
  echo "   4. API Gateway integration misconfiguration"
  echo "   5. CORS issue (though OPTIONS should handle this)"
  echo ""
  
elif [ "$POST_HTTP_CODE" = "200" ] || [ "$POST_HTTP_CODE" = "400" ] || [ "$POST_HTTP_CODE" = "404" ]; then
  echo -e "${GREEN}✅ Endpoint is reachable (HTTP $POST_HTTP_CODE)${NC}"
  echo "   This is expected - error is likely configuration-related, not network-related"
else
  echo -e "${YELLOW}⚠️  Unexpected status code: $POST_HTTP_CODE${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Diagnostic Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "CORS Preflight: $OPTIONS_HTTP_CODE"
echo "POST Request: $POST_HTTP_CODE"
echo ""
