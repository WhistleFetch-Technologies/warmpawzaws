#!/bin/bash
# ============================================================================
# TEST CORS FOR VERIFY-OTP ENDPOINT
# ============================================================================
# This script tests the CORS configuration for the verify-otp endpoint
# to verify that OPTIONS preflight requests work correctly.
#
# Date: 2026-01-22
# ============================================================================

set -e

API_GATEWAY_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
VENDOR_ORIGIN="https://d1s6ykkj381k58.cloudfront.net"
ENDPOINT="/auth/verify-otp"

echo "🧪 Testing CORS for verify-otp endpoint..."
echo "   API Gateway: $API_GATEWAY_URL"
echo "   Origin: $VENDOR_ORIGIN"
echo "   Endpoint: $ENDPOINT"
echo ""

# Test OPTIONS preflight request
echo "1️⃣  Testing OPTIONS preflight request..."
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

# Check CORS headers
echo ""
echo "2️⃣  Checking CORS headers..."
OPTIONS_HEADERS=$(curl -s -X OPTIONS "$API_GATEWAY_URL$ENDPOINT" \
  -H "Origin: $VENDOR_ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -i)

if echo "$OPTIONS_HEADERS" | grep -q "access-control-allow-origin.*$VENDOR_ORIGIN"; then
  echo "   ✅ Access-Control-Allow-Origin header present"
else
  echo "   ❌ Access-Control-Allow-Origin header missing or incorrect"
  exit 1
fi

if echo "$OPTIONS_HEADERS" | grep -qi "access-control-allow-methods.*POST"; then
  echo "   ✅ Access-Control-Allow-Methods includes POST"
else
  echo "   ❌ Access-Control-Allow-Methods missing or incorrect"
  exit 1
fi

# Test POST request
echo ""
echo "3️⃣  Testing POST request (with CORS headers)..."
POST_RESPONSE=$(curl -s -X POST "$API_GATEWAY_URL$ENDPOINT" \
  -H "Origin: $VENDOR_ORIGIN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"1234567890","otp":"123456","role":"vendor"}' \
  -w "\nHTTP_CODE:%{http_code}" \
  -o /tmp/post_response.json)

POST_HTTP_CODE=$(echo "$POST_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)

if [ "$POST_HTTP_CODE" = "200" ]; then
  echo "   ✅ POST request returned HTTP 200 (success)"
else
  echo "   ⚠️  POST request returned HTTP $POST_HTTP_CODE (may be expected for invalid OTP)"
fi

# Check POST CORS headers
POST_HEADERS=$(curl -s -X POST "$API_GATEWAY_URL$ENDPOINT" \
  -H "Origin: $VENDOR_ORIGIN" \
  -H "Content-Type: application/json" \
  -d '{"phone":"1234567890","otp":"123456","role":"vendor"}' \
  -i)

if echo "$POST_HEADERS" | grep -q "access-control-allow-origin.*$VENDOR_ORIGIN"; then
  echo "   ✅ POST response includes CORS headers"
else
  echo "   ❌ POST response missing CORS headers"
  exit 1
fi

echo ""
echo "✅ All CORS tests passed!"
echo ""
echo "If you're still seeing CORS errors in the browser:"
echo "1. Clear browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)"
echo "2. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)"
echo "3. Try in incognito/private mode"
echo "4. Check browser console for exact error message"
