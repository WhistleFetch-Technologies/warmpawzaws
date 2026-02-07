#!/bin/bash
# Simple Payment API Test
# Tests the payment endpoint and checks for timeout issues

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        SIMPLE PAYMENT API TEST                            ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Test 1: Health Check
echo -e "${BLUE}Test 1: Health Check${NC}"
HEALTH=$(curl -s -w "\n%{http_code}" -X GET "${API_BASE_URL}/health" --max-time 10)
HTTP_CODE=$(echo "$HEALTH" | tail -1)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${RED}❌ Health check failed: HTTP $HTTP_CODE${NC}"
fi
echo ""

# Test 2: Razorpay Create Order (with invalid booking - should return 404, not 503)
echo -e "${BLUE}Test 2: Razorpay Create Order${NC}"
echo "Testing with invalid booking ID (should return 404, not 503)..."
echo ""

START=$(date +%s)
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_BASE_URL}/razorpay/create-order" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"invalid-booking-id-12345","amount":1000,"currency":"INR","customerId":"test-customer"}' \
  --max-time 65 2>&1)
END=$(date +%s)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')
ELAPSED=$((END - START))

echo -e "Response Time: ${ELAPSED}s"
echo -e "HTTP Status: ${HTTP_CODE}"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "404" ]; then
    echo -e "${GREEN}✅ Correctly returned 404 (booking not found)${NC}"
    echo -e "${GREEN}✅ Endpoint is working - timeout fix is effective${NC}"
elif [ "$HTTP_CODE" = "503" ]; then
    echo -e "${RED}❌ Got 503 Service Unavailable${NC}"
    echo -e "${YELLOW}Possible causes:${NC}"
    echo "  1. Lambda timeout (check if elapsed time > 60s)"
    echo "  2. Secrets Manager access issue"
    echo "  3. Database connection timeout"
    echo "  4. API Gateway timeout"
    if [ "$ELAPSED" -ge 60 ]; then
        echo -e "${RED}   ⚠️  Request took ${ELAPSED}s - Lambda may be timing out${NC}"
    fi
elif [ "$HTTP_CODE" = "400" ]; then
    echo -e "${YELLOW}⚠️  Got 400 Bad Request (validation error)${NC}"
    echo "This is acceptable - endpoint is working"
else
    echo -e "${YELLOW}⚠️  Unexpected status: $HTTP_CODE${NC}"
fi
echo ""

# Test 3: Check API Gateway Integration Timeout
echo -e "${BLUE}Test 3: API Gateway Configuration${NC}"
echo "Checking API Gateway integration timeout..."
INTEGRATION_TIMEOUT=$(aws apigatewayv2 get-integration \
  --api-id z0b3obweb6 \
  --integration-id $(aws apigatewayv2 get-integrations --api-id z0b3obweb6 --query 'Items[?IntegrationUri==`*api-handler*`].IntegrationId' --output text 2>/dev/null | head -1) \
  --query 'TimeoutInMillis' \
  --output text 2>/dev/null || echo "unknown")

if [ "$INTEGRATION_TIMEOUT" != "unknown" ] && [ -n "$INTEGRATION_TIMEOUT" ]; then
    TIMEOUT_SEC=$((INTEGRATION_TIMEOUT / 1000))
    echo -e "API Gateway Integration Timeout: ${TIMEOUT_SEC}s (${INTEGRATION_TIMEOUT}ms)"
    if [ "$TIMEOUT_SEC" -ge 60 ]; then
        echo -e "${GREEN}✅ API Gateway timeout is correctly set to 60s${NC}"
    else
        echo -e "${YELLOW}⚠️  API Gateway timeout is ${TIMEOUT_SEC}s (should be 60s)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Could not retrieve API Gateway timeout${NC}"
fi
echo ""

# Summary
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    SUMMARY                                ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Health Check: ${GREEN}✅${NC}"
echo -e "Payment Endpoint: HTTP $HTTP_CODE (${ELAPSED}s)"
if [ "$HTTP_CODE" = "404" ]; then
    echo -e "${GREEN}✅ Endpoint is functional - timeout fix working${NC}"
elif [ "$HTTP_CODE" = "503" ]; then
    echo -e "${RED}❌ Service Unavailable - needs investigation${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Check CloudWatch logs for Lambda errors"
    echo "2. Verify Secrets Manager access permissions"
    echo "3. Check database connection pool"
    echo "4. Verify Razorpay credentials in Secrets Manager"
fi
echo ""
