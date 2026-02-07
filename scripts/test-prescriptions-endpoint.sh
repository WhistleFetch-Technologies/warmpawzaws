#!/bin/bash

# ============================================================================
# Test Prescriptions Endpoint
# ============================================================================
# Tests the /medical-records/booking/:bookingId/prescriptions endpoint
# ============================================================================

set -e

API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🧪 Testing Prescriptions Endpoint"
echo "=================================="
echo ""

# Test booking ID from error message
BOOKING_ID="af2e232e-3487-4815-af89-282ce97cf141"

echo "${YELLOW}📋 Testing: GET /medical-records/booking/${BOOKING_ID}/prescriptions${NC}"
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  "${API_BASE_URL}/medical-records/booking/${BOOKING_ID}/prescriptions")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "Response (HTTP ${HTTP_STATUS}):"
echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "${GREEN}✅ SUCCESS: Prescriptions loaded successfully${NC}"
  PRESCRIPTION_COUNT=$(echo "$RESPONSE_BODY" | jq '.prescriptions | length' 2>/dev/null || echo "0")
  echo "${GREEN}   Found ${PRESCRIPTION_COUNT} prescription(s)${NC}"
else
  echo "${RED}❌ FAILED: HTTP ${HTTP_STATUS}${NC}"
  exit 1
fi

echo ""
echo "${GREEN}✅ Test completed!${NC}"
