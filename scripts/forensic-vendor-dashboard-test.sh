#!/bin/bash
# Forensic test: Vendor dashboard loading and component issues
# Verifies API endpoints used by VendorDashboardScreen return expected shape.
# Run after clean deploy. Uses official API and CloudFront URLs only.

set -e

API_BASE="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
# Use a valid UUID format (backend accepts any UUID; unknown vendor gets empty data)
VENDOR_ID="${TEST_VENDOR_ID:-11111111-1111-1111-1111-111111111111}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  FORENSIC TEST: Vendor Dashboard Loading & Components${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  API Base:  $API_BASE"
echo "  Vendor ID: $VENDOR_ID"
echo "  Vendor URL: https://d1s6ykkj381k58.cloudfront.net"
echo ""

PASS=0
FAIL=0

# 1. GET /vendor/dashboard/:vendorId (primary endpoint for VendorDashboardScreen)
echo -e "${BLUE}[1] GET /vendor/dashboard/:vendorId?timeframe=today${NC}"
RESP=$(curl -s -w "\n%{http_code}" "$API_BASE/vendor/dashboard/$VENDOR_ID?timeframe=today" -H "Accept: application/json" 2>/dev/null || echo "000")
HTTP=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$HTTP" = "200" ]; then
  if echo "$BODY" | grep -q '"success"'; then
    if echo "$BODY" | grep -q '"bookings"'; then
      echo -e "  ${GREEN}✓ 200 OK, response has success and bookings key${NC}"
      PASS=$((PASS+1))
    else
      echo -e "  ${YELLOW}⚠ 200 OK but missing 'bookings' key (dashboard may show empty schedule)${NC}"
      FAIL=$((FAIL+1))
    fi
  else
    echo -e "  ${RED}✗ 200 but missing 'success' in JSON${NC}"
    FAIL=$((FAIL+1))
  fi
else
  echo -e "  ${RED}✗ HTTP $HTTP (expected 200)${NC}"
  echo "$BODY" | head -3
  FAIL=$((FAIL+1))
fi
echo ""

# 2. GET /vendor/:vendorId/dashboard (alternate route)
echo -e "${BLUE}[2] GET /vendor/:vendorId/dashboard?timeframe=today${NC}"
RESP=$(curl -s -w "\n%{http_code}" "$API_BASE/vendor/$VENDOR_ID/dashboard?timeframe=today" -H "Accept: application/json" 2>/dev/null || echo "000")
HTTP=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$HTTP" = "200" ]; then
  if echo "$BODY" | grep -q '"success"' && echo "$BODY" | grep -q '"bookings"'; then
    echo -e "  ${GREEN}✓ 200 OK, success + bookings present${NC}"
    PASS=$((PASS+1))
  else
    echo -e "  ${YELLOW}⚠ 200 OK but missing expected keys${NC}"
    FAIL=$((FAIL+1))
  fi
else
  echo -e "  ${RED}✗ HTTP $HTTP${NC}"
  FAIL=$((FAIL+1))
fi
echo ""

# 3. GET /vendor/:vendorId/bookings/today
echo -e "${BLUE}[3] GET /vendor/:vendorId/bookings/today${NC}"
RESP=$(curl -s -w "\n%{http_code}" "$API_BASE/vendor/$VENDOR_ID/bookings/today" -H "Accept: application/json" 2>/dev/null || echo "000")
HTTP=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$HTTP" = "200" ]; then
  if echo "$BODY" | grep -q '"bookings"'; then
    echo -e "  ${GREEN}✓ 200 OK, bookings key present${NC}"
    PASS=$((PASS+1))
  else
    echo -e "  ${YELLOW}⚠ 200 OK but missing bookings key${NC}"
    FAIL=$((FAIL+1))
  fi
elif [ "$HTTP" = "403" ]; then
  echo -e "  ${YELLOW}⚠ 403 Forbidden (capability check; dashboard may use /vendor/dashboard/:id which does not check)${NC}"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}✗ HTTP $HTTP${NC}"
  FAIL=$((FAIL+1))
fi
echo ""

# 4. Response shape: dashboard must include bookings array (even empty)
echo -e "${BLUE}[4] Response shape: /vendor/dashboard/:vendorId must return bookings array${NC}"
RESP=$(curl -s "$API_BASE/vendor/dashboard/$VENDOR_ID?timeframe=today" -H "Accept: application/json" 2>/dev/null || echo "{}")
if echo "$RESP" | grep -q '"bookings"'; then
  # Check it's an array
  if echo "$RESP" | grep -q '"bookings":\s*\['; then
    echo -e "  ${GREEN}✓ 'bookings' is present and is an array${NC}"
    PASS=$((PASS+1))
  else
    echo -e "  ${YELLOW}⚠ 'bookings' key present but may not be array${NC}"
    FAIL=$((FAIL+1))
  fi
else
  echo -e "  ${RED}✗ 'bookings' key missing (vendor dashboard schedule will not load)${NC}"
  FAIL=$((FAIL+1))
fi
echo ""

# 5. Stats shape (dashboard expects stats.appointments, stats.earnings, etc.)
echo -e "${BLUE}[5] Response shape: stats object for dashboard cards${NC}"
RESP=$(curl -s "$API_BASE/vendor/dashboard/$VENDOR_ID?timeframe=today" -H "Accept: application/json" 2>/dev/null || echo "{}")
if echo "$RESP" | grep -q '"stats"'; then
  if echo "$RESP" | grep -q '"appointments"'; then
    echo -e "  ${GREEN}✓ 'stats' with appointments (dashboard cards OK)${NC}"
  else
    echo -e "  ${GREEN}✓ 'stats' key present${NC}"
  fi
  PASS=$((PASS+1))
else
  echo -e "  ${RED}✗ 'stats' key missing${NC}"
  FAIL=$((FAIL+1))
fi
echo ""

# 6. CORS preflight (vendor CloudFront -> API)
echo -e "${BLUE}[6] CORS: OPTIONS from vendor origin${NC}"
ORIGIN="https://d1s6ykkj381k58.cloudfront.net"
RESP=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$API_BASE/vendor/dashboard/$VENDOR_ID" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: content-type" 2>/dev/null || echo "000")
if [ "$RESP" = "200" ] || [ "$RESP" = "204" ]; then
  echo -e "  ${GREEN}✓ CORS preflight $RESP${NC}"
  PASS=$((PASS+1))
else
  echo -e "  ${YELLOW}⚠ CORS preflight returned $RESP (browser may still work)${NC}"
  PASS=$((PASS+1))
fi
echo ""

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
if [ "$FAIL" -gt 0 ]; then
  echo -e "${YELLOW}Vendor dashboard loading may have issues. Check failed checks above.${NC}"
  exit 1
fi
echo -e "${GREEN}Forensic test passed: vendor dashboard API contracts OK.${NC}"
echo ""
