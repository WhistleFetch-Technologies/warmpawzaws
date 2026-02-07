#!/bin/bash

# Quick test script to verify CORS and 500 fixes are working
# Run this after deployment to verify the fixes

set -e

API_BASE="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
ORIGIN="https://d2aoyjj8ine0wk.cloudfront.net"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🧪 Quick Test: CORS and 500 Fixes"
echo "=================================="
echo ""

# Test 1: OPTIONS request
echo "Test 1: OPTIONS /customer/services/platform"
OPTIONS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS \
  "${API_BASE}/customer/services/platform?roleId=veterinarian&serviceStyle=tele" \
  -H "Origin: ${ORIGIN}" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  --max-time 10)

if [ "$OPTIONS_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ PASS: OPTIONS returns 200 OK${NC}"
else
  echo -e "${RED}❌ FAIL: OPTIONS returned ${OPTIONS_STATUS} (expected 200)${NC}"
fi

# Test 2: Check CORS headers
echo ""
echo "Test 2: CORS Headers in OPTIONS response"
CORS_HEADERS=$(curl -s -I -X OPTIONS \
  "${API_BASE}/customer/services/platform?roleId=veterinarian&serviceStyle=tele" \
  -H "Origin: ${ORIGIN}" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  --max-time 10 | grep -i "access-control")

if echo "$CORS_HEADERS" | grep -qi "access-control-allow-origin"; then
  echo -e "${GREEN}✅ PASS: CORS headers present${NC}"
  echo "$CORS_HEADERS" | head -3
else
  echo -e "${RED}❌ FAIL: CORS headers missing${NC}"
fi

# Test 3: Notifications endpoint
echo ""
echo "Test 3: GET /customer/notifications/:phone"
NOTIFICATIONS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X GET \
  "${API_BASE}/customer/notifications/9611377119?limit=10" \
  --max-time 10)

if [ "$NOTIFICATIONS_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ PASS: Notifications returns 200 OK${NC}"
else
  echo -e "${RED}❌ FAIL: Notifications returned ${NOTIFICATIONS_STATUS} (expected 200)${NC}"
fi

# Test 4: Notifications response body
echo ""
echo "Test 4: Notifications response structure"
NOTIFICATIONS_BODY=$(curl -s -X GET \
  "${API_BASE}/customer/notifications/9611377119?limit=10" \
  --max-time 10)

if echo "$NOTIFICATIONS_BODY" | grep -q '"success"'; then
  echo -e "${GREEN}✅ PASS: Response has success field${NC}"
  echo "Response: $(echo "$NOTIFICATIONS_BODY" | head -c 100)..."
else
  echo -e "${YELLOW}⚠️  Response structure unexpected${NC}"
  echo "Response: $NOTIFICATIONS_BODY"
fi

# Summary
echo ""
echo "=================================="
echo "📊 Test Summary"
echo "=================================="
echo "OPTIONS Status: ${OPTIONS_STATUS}"
echo "CORS Headers: $([ -n "$CORS_HEADERS" ] && echo "Present" || echo "Missing")"
echo "Notifications Status: ${NOTIFICATIONS_STATUS}"
echo ""

if [ "$OPTIONS_STATUS" = "200" ] && [ "$NOTIFICATIONS_STATUS" = "200" ] && [ -n "$CORS_HEADERS" ]; then
  echo -e "${GREEN}✅ All tests passed! Fixes are working.${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Some tests failed. Check the output above.${NC}"
  exit 1
fi
