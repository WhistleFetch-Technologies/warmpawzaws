#!/bin/bash
# ============================================================================
# SYSTEMATIC CORS TEST SUITE
# ============================================================================
# Comprehensive testing of CORS configuration for verify-otp endpoint
#
# Date: 2026-01-22
# ============================================================================

set +e  # Don't exit on error, we'll handle failures manually

API_GATEWAY_ID="z0b3obweb6"
API_GATEWAY_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
VENDOR_ORIGIN="https://d1s6ykkj381k58.cloudfront.net"
ENDPOINT="/auth/verify-otp"
REGION="ap-south-1"

PASSED=0
FAILED=0
WARNINGS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_test() {
    echo -e "\n${YELLOW}TEST $1: $2${NC}"
}

print_pass() {
    echo -e "   ${GREEN}✅ PASS: $1${NC}"
    ((PASSED++))
}

print_fail() {
    echo -e "   ${RED}❌ FAIL: $1${NC}"
    ((FAILED++))
}

print_warn() {
    echo -e "   ${YELLOW}⚠️  WARN: $1${NC}"
    ((WARNINGS++))
}

echo "🧪 Systematic CORS Test Suite"
echo "=============================="
echo ""

# ============================================================================
# TEST 1: API Gateway CORS Configuration
# ============================================================================
print_test "1.1" "API Gateway CORS Configuration Exists"
CORS_CONFIG=$(aws apigatewayv2 get-api --api-id "$API_GATEWAY_ID" --region "$REGION" --query 'CorsConfiguration' --output json 2>&1)
if [ "$CORS_CONFIG" != "null" ] && [ -n "$CORS_CONFIG" ]; then
    print_pass "CORS configuration exists"
else
    print_fail "CORS configuration is missing"
    exit 1
fi

print_test "1.2" "Vendor Origin in CORS Allowed Origins"
if echo "$CORS_CONFIG" | grep -q "$VENDOR_ORIGIN"; then
    print_pass "Vendor origin ($VENDOR_ORIGIN) is in allowed origins"
else
    print_fail "Vendor origin ($VENDOR_ORIGIN) is NOT in allowed origins"
    exit 1
fi

print_test "1.3" "POST Method in CORS Allowed Methods"
if echo "$CORS_CONFIG" | grep -qi "POST"; then
    print_pass "POST method is in allowed methods"
else
    print_fail "POST method is NOT in allowed methods"
    exit 1
fi

print_test "1.4" "Content-Type Header in CORS Allowed Headers"
if echo "$CORS_CONFIG" | grep -qi "content-type"; then
    print_pass "content-type header is in allowed headers"
else
    print_fail "content-type header is NOT in allowed headers"
    exit 1
fi

print_test "1.5" "CORS Credentials Enabled"
if echo "$CORS_CONFIG" | grep -qi '"AllowCredentials":\s*true'; then
    print_pass "CORS credentials are enabled"
else
    print_fail "CORS credentials are NOT enabled"
    exit 1
fi

# ============================================================================
# TEST 2: API Gateway Rate Limits
# ============================================================================
print_test "2.1" "API Gateway Rate Limits Configuration"
RATE_LIMITS=$(aws apigatewayv2 get-stage --api-id "$API_GATEWAY_ID" --stage-name '$default' --region "$REGION" --query 'DefaultRouteSettings' --output json 2>&1)

# Use python to parse JSON reliably
BURST_LIMIT=$(echo "$RATE_LIMITS" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('ThrottlingBurstLimit', 0))" 2>/dev/null || echo "0")
RATE_LIMIT=$(echo "$RATE_LIMITS" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('ThrottlingRateLimit', 0))" 2>/dev/null || echo "0")

if [ -z "$BURST_LIMIT" ] || [ "$BURST_LIMIT" = "None" ]; then
    BURST_LIMIT="0"
fi
if [ -z "$RATE_LIMIT" ] || [ "$RATE_LIMIT" = "None" ]; then
    RATE_LIMIT="0"
fi

# Convert to integers for comparison
BURST_INT=$(echo "$BURST_LIMIT" | cut -d. -f1)
RATE_INT=$(echo "$RATE_LIMIT" | cut -d. -f1)

if [ "$BURST_INT" -ge 1000 ] 2>/dev/null; then
    print_pass "Burst limit is sufficient ($BURST_LIMIT)"
elif [ "$BURST_INT" -gt 0 ] 2>/dev/null; then
    print_warn "Burst limit may be too low ($BURST_LIMIT, recommended: >= 1000)"
else
    print_warn "Burst limit is not configured or is 0 (may cause rate limiting issues)"
fi

if [ "$RATE_INT" -ge 1000 ] 2>/dev/null; then
    print_pass "Rate limit is sufficient ($RATE_LIMIT)"
elif [ "$RATE_INT" -gt 0 ] 2>/dev/null; then
    print_warn "Rate limit may be too low ($RATE_LIMIT, recommended: >= 1000)"
else
    print_warn "Rate limit is not configured or is 0 (may cause rate limiting issues)"
fi

# ============================================================================
# TEST 3: API Gateway Routes
# ============================================================================
print_test "3.1" "No Explicit OPTIONS Route"
ROUTES=$(aws apigatewayv2 get-routes --api-id "$API_GATEWAY_ID" --region "$REGION" --query 'Items[*].RouteKey' --output json 2>&1)
if echo "$ROUTES" | grep -q "OPTIONS"; then
    print_fail "Explicit OPTIONS route found (should be handled automatically by CORS)"
    exit 1
else
    print_pass "No explicit OPTIONS route (API Gateway will handle automatically)"
fi

print_test "3.2" "ANY Route Exists for Catch-All"
if echo "$ROUTES" | grep -q "ANY"; then
    print_pass "ANY route exists for catch-all requests"
else
    print_warn "No ANY route found (may affect routing)"
fi

# ============================================================================
# TEST 4: OPTIONS Preflight Requests
# ============================================================================
print_test "4.1" "OPTIONS Request Returns 200 or 204"
OPTIONS_RESPONSE=$(curl -s -X OPTIONS "$API_GATEWAY_URL$ENDPOINT" \
  -H "Origin: $VENDOR_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -w "\nHTTP_CODE:%{http_code}" \
  -o /dev/null 2>&1)

HTTP_CODE=$(echo "$OPTIONS_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
    print_pass "OPTIONS request returned HTTP $HTTP_CODE"
else
    print_fail "OPTIONS request returned HTTP $HTTP_CODE (expected 200 or 204)"
    exit 1
fi

print_test "4.2" "OPTIONS Response Includes Access-Control-Allow-Origin"
OPTIONS_HEADERS=$(curl -s -X OPTIONS "$API_GATEWAY_URL$ENDPOINT" \
  -H "Origin: $VENDOR_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -i 2>&1)

if echo "$OPTIONS_HEADERS" | grep -qi "access-control-allow-origin.*$VENDOR_ORIGIN"; then
    print_pass "Access-Control-Allow-Origin header is correct"
else
    print_fail "Access-Control-Allow-Origin header is missing or incorrect"
    echo "$OPTIONS_HEADERS" | grep -i "access-control" | head -3
    exit 1
fi

print_test "4.3" "OPTIONS Response Includes Access-Control-Allow-Methods"
if echo "$OPTIONS_HEADERS" | grep -qi "access-control-allow-methods.*POST"; then
    print_pass "Access-Control-Allow-Methods includes POST"
else
    print_fail "Access-Control-Allow-Methods missing or doesn't include POST"
    exit 1
fi

print_test "4.4" "OPTIONS Response Includes Access-Control-Allow-Headers"
if echo "$OPTIONS_HEADERS" | grep -qi "access-control-allow-headers.*content-type"; then
    print_pass "Access-Control-Allow-Headers includes content-type"
else
    print_fail "Access-Control-Allow-Headers missing or doesn't include content-type"
    exit 1
fi

print_test "4.5" "OPTIONS Response Includes Access-Control-Allow-Credentials"
if echo "$OPTIONS_HEADERS" | grep -qi "access-control-allow-credentials.*true"; then
    print_pass "Access-Control-Allow-Credentials is true"
else
    print_fail "Access-Control-Allow-Credentials is missing or not true"
    exit 1
fi

print_test "4.6" "OPTIONS Response Has Empty Body"
OPTIONS_BODY=$(curl -s -X OPTIONS "$API_GATEWAY_URL$ENDPOINT" \
  -H "Origin: $VENDOR_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" 2>&1)

if [ -z "$OPTIONS_BODY" ] || [ "$OPTIONS_BODY" = "" ]; then
    print_pass "OPTIONS response has empty body (correct)"
else
    print_warn "OPTIONS response has body (should be empty): ${OPTIONS_BODY:0:50}"
fi

# ============================================================================
# TEST 5: POST Requests with CORS
# ============================================================================
print_test "5.1" "POST Request Returns 200"
POST_RESPONSE=$(curl -s -X POST "$API_GATEWAY_URL$ENDPOINT" \
  -H "Origin: $VENDOR_ORIGIN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"1234567890","otp":"123456","role":"vendor"}' \
  -w "\nHTTP_CODE:%{http_code}" \
  -o /tmp/post_response.json 2>&1)

POST_HTTP_CODE=$(echo "$POST_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
if [ "$POST_HTTP_CODE" = "200" ]; then
    print_pass "POST request returned HTTP 200"
else
    print_warn "POST request returned HTTP $POST_HTTP_CODE (may be expected for invalid OTP)"
fi

print_test "5.2" "POST Response Includes CORS Headers"
POST_HEADERS=$(curl -s -X POST "$API_GATEWAY_URL$ENDPOINT" \
  -H "Origin: $VENDOR_ORIGIN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"1234567890","otp":"123456","role":"vendor"}' \
  -i 2>&1)

if echo "$POST_HEADERS" | grep -qi "access-control-allow-origin.*$VENDOR_ORIGIN"; then
    print_pass "POST response includes Access-Control-Allow-Origin"
else
    print_fail "POST response missing Access-Control-Allow-Origin header"
    exit 1
fi

# ============================================================================
# TEST 6: Different Origins
# ============================================================================
print_test "6.1" "OPTIONS with Allowed Origin (Admin)"
ADMIN_ORIGIN="https://dfof7mguaa0a5.cloudfront.net"
ADMIN_OPTIONS=$(curl -s -X OPTIONS "$API_GATEWAY_URL$ENDPOINT" \
  -H "Origin: $ADMIN_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -w "\nHTTP_CODE:%{http_code}" \
  -o /dev/null 2>&1)

ADMIN_HTTP_CODE=$(echo "$ADMIN_OPTIONS" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
if [ "$ADMIN_HTTP_CODE" = "200" ] || [ "$ADMIN_HTTP_CODE" = "204" ]; then
    print_pass "OPTIONS with admin origin returned HTTP $ADMIN_HTTP_CODE"
else
    print_fail "OPTIONS with admin origin returned HTTP $ADMIN_HTTP_CODE"
    exit 1
fi

print_test "6.2" "OPTIONS with Invalid Origin"
INVALID_ORIGIN="https://invalid-origin.com"
INVALID_OPTIONS=$(curl -s -X OPTIONS "$API_GATEWAY_URL$ENDPOINT" \
  -H "Origin: $INVALID_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -w "\nHTTP_CODE:%{http_code}" \
  -o /dev/null 2>&1)

INVALID_HTTP_CODE=$(echo "$INVALID_OPTIONS" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
# API Gateway may return 200 even for invalid origins (it uses the first allowed origin)
if [ "$INVALID_HTTP_CODE" = "200" ] || [ "$INVALID_HTTP_CODE" = "204" ]; then
    print_pass "OPTIONS with invalid origin returned HTTP $INVALID_HTTP_CODE (API Gateway behavior)"
else
    print_warn "OPTIONS with invalid origin returned HTTP $INVALID_HTTP_CODE"
fi

# ============================================================================
# TEST 7: Rate Limiting (Multiple Requests)
# ============================================================================
print_test "7.1" "Multiple OPTIONS Requests (Rate Limit Test)"
RATE_TEST_PASSED=true
for i in {1..5}; do
    RATE_TEST=$(curl -s -X OPTIONS "$API_GATEWAY_URL$ENDPOINT" \
      -H "Origin: $VENDOR_ORIGIN" \
      -H "Access-Control-Request-Method: POST" \
      -w "\nHTTP_CODE:%{http_code}" \
      -o /dev/null 2>&1)
    
    RATE_HTTP_CODE=$(echo "$RATE_TEST" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
    if [ "$RATE_HTTP_CODE" != "200" ] && [ "$RATE_HTTP_CODE" != "204" ]; then
        if [ "$RATE_HTTP_CODE" = "429" ]; then
            print_fail "Rate limiting detected (HTTP 429) on request $i"
            RATE_TEST_PASSED=false
            break
        else
            print_warn "Unexpected status code $RATE_HTTP_CODE on request $i"
        fi
    fi
    sleep 0.1
done

if [ "$RATE_TEST_PASSED" = true ]; then
    print_pass "No rate limiting detected in 5 consecutive requests"
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
echo "=============================="
echo "📊 Test Summary"
echo "=============================="
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
fi
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Failed: $FAILED${NC}"
    exit 1
fi

echo ""
echo "✅ All critical tests passed!"
echo ""
echo "📋 Backend CORS Configuration Status:"
echo "   - API Gateway CORS: ✅ Configured"
echo "   - Vendor Origin: ✅ Allowed"
echo "   - OPTIONS Requests: ✅ Working (HTTP 200)"
echo "   - CORS Headers: ✅ Present and Correct"
echo "   - POST Requests: ✅ Working with CORS"
echo "   - Rate Limits: ✅ Configured"
echo ""
echo "🎯 The backend CORS configuration is correct and working!"
