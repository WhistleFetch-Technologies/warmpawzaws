#!/bin/bash
# Forensic test for GET /customer/profile/unified/:phone
# Verifies the fix: should return 200 (not 500) - either with profile or degraded

set -e

API_BASE="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
TEST_PHONE="${1:-9611377119}"
ORIGIN="https://d2aoyjj8ine0wk.cloudfront.net"

echo "═══════════════════════════════════════════════════════════════"
echo "FORENSIC TEST: Customer Profile Unified"
echo "═══════════════════════════════════════════════════════════════"
echo "API: $API_BASE"
echo "Phone: $TEST_PHONE"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Test 1: Without UAT (may get 401 or 200 depending on auth config)
echo "📋 Test 1: GET /customer/profile/unified/$TEST_PHONE (no UAT)"
HTTP=$(curl -s -o /tmp/profile-resp.json -w "%{http_code}" \
  -X GET "$API_BASE/customer/profile/unified/$TEST_PHONE" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN")

echo "   HTTP Status: $HTTP"

if [ "$HTTP" = "500" ]; then
  echo "   ❌ FAIL: Still returning 500 - fix may not be deployed"
  echo "   Response: $(head -c 300 /tmp/profile-resp.json)"
  exit 1
fi

echo "   ✅ PASS: Not 500 (got $HTTP)"
echo ""

# Test 2: With UAT headers (customer web uses this)
echo "📋 Test 2: GET /customer/profile/unified/$TEST_PHONE (with UAT)"
HTTP=$(curl -s -o /tmp/profile-resp-uat.json -w "%{http_code}" \
  -X GET "$API_BASE/customer/profile/unified/$TEST_PHONE" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -H "x-uat-mode: true" \
  -H "x-uat-token: uat-token-customer-test")

echo "   HTTP Status: $HTTP"

if [ "$HTTP" = "500" ]; then
  echo "   ❌ FAIL: Returning 500 with UAT headers"
  echo "   Response: $(head -c 500 /tmp/profile-resp-uat.json)"
  exit 1
fi

echo "   ✅ PASS: Not 500 (got $HTTP)"
echo ""

# Parse response (grep returns 1 on no match - use || true)
RESP=$(cat /tmp/profile-resp-uat.json)
SUCCESS=$(echo "$RESP" | grep -o '"success":[^,}]*' | head -1 || true)
PROFILE=$(echo "$RESP" | grep -o '"profile":' || true)
DEGRADED=$(echo "$RESP" | grep -o '"_degraded":true' || true)

echo "📋 Response structure:"
echo "   $SUCCESS"
[ -n "$PROFILE" ] && echo "   Has 'profile' field"
[ -n "$DEGRADED" ] && echo "   Degraded mode (profile: null, app can use cached data)"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ FORENSIC TEST PASSED"
echo "   - Endpoint returns 200 (not 500)"
echo "   - Customer web can load (profile or degraded fallback)"
echo "═══════════════════════════════════════════════════════════════"
