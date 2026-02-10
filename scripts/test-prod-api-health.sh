#!/bin/bash

# ============================================================================
# Test Production API Gateway Health Check
# ============================================================================
# Simple script to test if production API Gateway is working
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Production API Gateway URL
API_URL="${API_URL:-https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com}"
HEALTH_ENDPOINT="${API_URL}/health"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Production API Gateway Health Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Testing endpoint: ${HEALTH_ENDPOINT}"
echo ""

# Test the health endpoint
START_TIME=$(date +%s.%N)
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}" \
  -X GET "${HEALTH_ENDPOINT}" \
  --max-time 10 \
  --connect-timeout 5) || {
  echo -e "${RED}❌ Connection failed${NC}"
  exit 1
}
END_TIME=$(date +%s.%N)
DURATION=$(echo "$END_TIME - $START_TIME" | bc)

# Parse response
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
TIME_TOTAL=$(echo "$RESPONSE" | grep "TIME_TOTAL:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:" | grep -v "TIME_TOTAL:")

echo -e "${BLUE}Results:${NC}"
echo "HTTP Status: ${HTTP_CODE}"
echo "Response Time: ${TIME_TOTAL}s"
echo "Total Duration: ${DURATION}s"
echo ""
echo "Response Body:"
echo "${BODY}" | jq . 2>/dev/null || echo "${BODY}"
echo ""

# Analyze result
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✅ API Gateway is WORKING!${NC}"
  echo ""
  echo "The API Gateway is:"
  echo "  - Accessible"
  echo "  - Routing requests correctly"
  echo "  - Lambda function is responding"
  
  # Check if database is connected
  if echo "$BODY" | grep -q '"database".*"connected".*true' || echo "$BODY" | grep -q '"status".*"ok"'; then
    echo "  - Database is connected"
  else
    echo -e "${YELLOW}  ⚠️  Database may not be connected (check response above)${NC}"
  fi
  
  exit 0
elif [ "$HTTP_CODE" = "503" ]; then
  echo -e "${YELLOW}⚠️  API Gateway is responding but service is degraded${NC}"
  echo "This usually means:"
  echo "  - Lambda function is working"
  echo "  - Database connection may be failing"
  echo ""
  echo "Check the response body above for details."
  exit 1
elif [ "$HTTP_CODE" = "000" ] || [ -z "$HTTP_CODE" ]; then
  echo -e "${RED}❌ API Gateway is NOT responding${NC}"
  echo ""
  echo "Possible issues:"
  echo "  1. API Gateway endpoint is incorrect"
  echo "  2. API Gateway is not deployed"
  echo "  3. Network connectivity issue"
  echo "  4. API Gateway route is not configured"
  exit 1
else
  echo -e "${YELLOW}⚠️  Unexpected response: ${HTTP_CODE}${NC}"
  echo "Check the response body above for details."
  exit 1
fi
