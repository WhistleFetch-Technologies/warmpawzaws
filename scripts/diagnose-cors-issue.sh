#!/bin/bash
# ============================================================================
# DIAGNOSE CORS ISSUE - COMPREHENSIVE CHECK
# ============================================================================
# This script performs comprehensive checks to diagnose CORS issues
#
# Date: 2026-01-22
# ============================================================================

set -e

API_GATEWAY_ID="z0b3obweb6"
API_GATEWAY_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
VENDOR_ORIGIN="https://d1s6ykkj381k58.cloudfront.net"
ENDPOINT="/auth/verify-otp"
REGION="ap-south-1"

echo "🔍 CORS Issue Diagnostic Tool"
echo "=============================="
echo ""

# 1. Check API Gateway CORS Configuration
echo "1️⃣  Checking API Gateway CORS Configuration..."
CORS_CONFIG=$(aws apigatewayv2 get-api --api-id "$API_GATEWAY_ID" --region "$REGION" --query 'CorsConfiguration' --output json 2>&1)

if echo "$CORS_CONFIG" | grep -q "$VENDOR_ORIGIN"; then
  echo "   ✅ Vendor origin ($VENDOR_ORIGIN) is in CORS config"
else
  echo "   ❌ Vendor origin ($VENDOR_ORIGIN) is NOT in CORS config"
  echo "   CORS Config: $CORS_CONFIG"
  exit 1
fi

# 2. Check Rate Limits
echo ""
echo "2️⃣  Checking API Gateway Rate Limits..."
RATE_LIMITS=$(aws apigatewayv2 get-stage --api-id "$API_GATEWAY_ID" --stage-name '$default' --region "$REGION" --query 'DefaultRouteSettings' --output json 2>&1)

BURST_LIMIT=$(echo "$RATE_LIMITS" | grep -o '"ThrottlingBurstLimit":[0-9]*' | cut -d: -f2 || echo "0")
RATE_LIMIT=$(echo "$RATE_LIMITS" | grep -o '"ThrottlingRateLimit":[0-9.]*' | cut -d: -f2 || echo "0")

if [ -n "$BURST_LIMIT" ] && [ -n "$RATE_LIMIT" ] && [ "$BURST_LIMIT" -ge 1000 ]; then
  echo "   ✅ Rate limits are sufficient (Burst: $BURST_LIMIT, Rate: $RATE_LIMIT)"
else
  echo "   ⚠️  Rate limits may be too low (Burst: ${BURST_LIMIT:-unknown}, Rate: ${RATE_LIMIT:-unknown})"
fi

# 3. Check Routes
echo ""
echo "3️⃣  Checking API Gateway Routes..."
ROUTES=$(aws apigatewayv2 get-routes --api-id "$API_GATEWAY_ID" --region "$REGION" --query 'Items[*].RouteKey' --output json 2>&1)

if echo "$ROUTES" | grep -q "OPTIONS"; then
  echo "   ⚠️  Explicit OPTIONS route found (should be handled automatically by CORS)"
else
  echo "   ✅ No explicit OPTIONS route (API Gateway will handle automatically)"
fi

# 4. Test OPTIONS Request
echo ""
echo "4️⃣  Testing OPTIONS Preflight Request..."
OPTIONS_RESPONSE=$(curl -s -X OPTIONS "$API_GATEWAY_URL$ENDPOINT" \
  -H "Origin: $VENDOR_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -w "\nHTTP_CODE:%{http_code}" \
  -o /dev/null)

HTTP_CODE=$(echo "$OPTIONS_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
  echo "   ✅ OPTIONS request returned HTTP $HTTP_CODE (success)"
else
  echo "   ❌ OPTIONS request returned HTTP $HTTP_CODE (expected 200 or 204)"
  exit 1
fi

# 5. Check CORS Headers
echo ""
echo "5️⃣  Checking CORS Headers in OPTIONS Response..."
OPTIONS_HEADERS=$(curl -s -X OPTIONS "$API_GATEWAY_URL$ENDPOINT" \
  -H "Origin: $VENDOR_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -i)

if echo "$OPTIONS_HEADERS" | grep -qi "access-control-allow-origin.*$VENDOR_ORIGIN"; then
  echo "   ✅ Access-Control-Allow-Origin header is correct"
else
  echo "   ❌ Access-Control-Allow-Origin header is missing or incorrect"
  echo "   Headers:"
  echo "$OPTIONS_HEADERS" | grep -i "access-control" | head -5
  exit 1
fi

if echo "$OPTIONS_HEADERS" | grep -qi "access-control-allow-methods.*POST"; then
  echo "   ✅ Access-Control-Allow-Methods includes POST"
else
  echo "   ❌ Access-Control-Allow-Methods missing or incorrect"
  exit 1
fi

# 6. Test POST Request
echo ""
echo "6️⃣  Testing POST Request with CORS..."
POST_RESPONSE=$(curl -s -X POST "$API_GATEWAY_URL$ENDPOINT" \
  -H "Origin: $VENDOR_ORIGIN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"1234567890","otp":"123456","role":"vendor"}' \
  -w "\nHTTP_CODE:%{http_code}" \
  -o /tmp/post_response.json 2>&1)

POST_HTTP_CODE=$(echo "$POST_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)

if [ "$POST_HTTP_CODE" = "200" ]; then
  echo "   ✅ POST request returned HTTP 200 (success)"
else
  echo "   ⚠️  POST request returned HTTP $POST_HTTP_CODE (may be expected for invalid OTP)"
fi

POST_HEADERS=$(curl -s -X POST "$API_GATEWAY_URL$ENDPOINT" \
  -H "Origin: $VENDOR_ORIGIN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"1234567890","otp":"123456","role":"vendor"}' \
  -i)

if echo "$POST_HEADERS" | grep -qi "access-control-allow-origin.*$VENDOR_ORIGIN"; then
  echo "   ✅ POST response includes CORS headers"
else
  echo "   ❌ POST response missing CORS headers"
  exit 1
fi

echo ""
echo "✅ All backend checks passed!"
echo ""
echo "📋 Next Steps:"
echo "1. Clear browser cache completely (Ctrl+Shift+Delete or Cmd+Shift+Delete)"
echo "2. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)"
echo "3. Try in incognito/private mode"
echo "4. Check browser console (F12) for exact error message"
echo "5. Check Network tab for OPTIONS request status code"
echo ""
echo "If the issue persists, please share:"
echo "- Exact error message from browser console"
echo "- OPTIONS request status code from Network tab"
echo "- Screenshot of the error (if possible)"
