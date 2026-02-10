#!/bin/bash

# ============================================================================
# Test send-otp Endpoint
# ============================================================================
# Simple script to test the send-otp endpoint with timing information
# 
# Usage:
#   ./test-send-otp-endpoint.sh [phone_number] [api_url]
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PHONE="${1:-919876543210}"
API_URL="${2:-https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com}"
ENDPOINT="${API_URL}/auth/send-otp"

echo -e "${BLUE}Testing send-otp endpoint${NC}"
echo "URL: ${ENDPOINT}"
echo "Phone: ${PHONE}"
echo ""

# Test with timeout
echo -e "${YELLOW}Making request (35s timeout)...${NC}"
START=$(date +%s.%N)

RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}\n" \
  -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"${PHONE}\",\"role\":\"vendor\"}" \
  --max-time 35 \
  --connect-timeout 10) || {
    echo -e "${RED}❌ Request failed or timed out${NC}"
    exit 1
  }

END=$(date +%s.%N)
DURATION=$(echo "$END - $START" | bc)

# Parse response
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
TIME_TOTAL=$(echo "$RESPONSE" | grep "TIME_TOTAL:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:" | grep -v "TIME_TOTAL:")

echo ""
echo -e "${BLUE}Results:${NC}"
echo "HTTP Status: ${HTTP_CODE}"
echo "cURL Time: ${TIME_TOTAL}s"
echo "Total Duration: ${DURATION}s"
echo ""
echo "Response Body:"
echo "${BODY}" | jq . 2>/dev/null || echo "${BODY}"
echo ""

# Analyze result
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo -e "${GREEN}✅ Success!${NC}"
  
  # Check if response time is acceptable
  if (( $(echo "$TIME_TOTAL > 25" | bc -l) )); then
    echo -e "${YELLOW}⚠️  Warning: Response time is close to timeout (${TIME_TOTAL}s)${NC}"
  fi
  exit 0
elif [ "$HTTP_CODE" = "503" ] || [ "$HTTP_CODE" = "504" ]; then
  echo -e "${RED}❌ Timeout Error (${HTTP_CODE})${NC}"
  echo ""
  echo "This indicates the request exceeded the 30-second API Gateway timeout."
  echo "Check CloudWatch logs for more details."
  exit 1
elif [ "$HTTP_CODE" = "000" ]; then
  echo -e "${RED}❌ Connection Failed${NC}"
  exit 1
else
  echo -e "${YELLOW}⚠️  Unexpected response: ${HTTP_CODE}${NC}"
  exit 1
fi
