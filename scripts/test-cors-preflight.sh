#!/bin/bash

# CORS Preflight Diagnostic Script
# Tests OPTIONS requests to identify CORS configuration issues

API_BASE="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
ORIGIN="https://d2aoyjj8ine0wk.cloudfront.net"

echo "🔍 CORS Preflight Diagnostic Test"
echo "=================================="
echo ""
echo "API Base: $API_BASE"
echo "Origin: $ORIGIN"
echo ""

# Test 1: OPTIONS request to platform services endpoint
echo "📋 Test 1: OPTIONS /customer/services/platform"
echo "-----------------------------------------------"
RESPONSE=$(curl -s -w "\n%{http_code}" -X OPTIONS \
  "${API_BASE}/customer/services/platform?roleId=veterinarian&serviceStyle=tele" \
  -H "Origin: ${ORIGIN}" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -v 2>&1)

HTTP_CODE=$(echo "$RESPONSE" | grep -oP '< HTTP/\d+\.\d+ \K\d+')
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ OPTIONS request returned 200 OK"
else
  echo "❌ OPTIONS request returned $HTTP_CODE (expected 200)"
fi

# Check for CORS headers
if echo "$RESPONSE" | grep -qi "access-control-allow-origin"; then
  echo "✅ CORS headers present"
  echo "$RESPONSE" | grep -i "access-control"
else
  echo "❌ CORS headers missing"
fi

echo ""
echo ""

# Test 2: OPTIONS request to available-providers endpoint
echo "📋 Test 2: OPTIONS /customer/tele/available-providers"
echo "-----------------------------------------------------"
RESPONSE2=$(curl -s -w "\n%{http_code}" -X OPTIONS \
  "${API_BASE}/customer/tele/available-providers?roleId=veterinarian&category=vet&serviceId=instant-general&availableIn=5" \
  -H "Origin: ${ORIGIN}" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization,content-type" \
  -v 2>&1)

HTTP_CODE2=$(echo "$RESPONSE2" | grep -oP '< HTTP/\d+\.\d+ \K\d+')
echo "HTTP Status: $HTTP_CODE2"

if [ "$HTTP_CODE2" = "200" ]; then
  echo "✅ OPTIONS request returned 200 OK"
else
  echo "❌ OPTIONS request returned $HTTP_CODE2 (expected 200)"
fi

# Check for CORS headers
if echo "$RESPONSE2" | grep -qi "access-control-allow-origin"; then
  echo "✅ CORS headers present"
  echo "$RESPONSE2" | grep -i "access-control"
else
  echo "❌ CORS headers missing"
fi

echo ""
echo ""

# Test 3: Actual GET request (should work if CORS is fixed)
echo "📋 Test 3: GET /customer/services/platform (Actual Request)"
echo "-----------------------------------------------------------"
RESPONSE3=$(curl -s -w "\n%{http_code}" -X GET \
  "${API_BASE}/customer/services/platform?roleId=veterinarian&serviceStyle=tele" \
  -H "Origin: ${ORIGIN}" \
  -H "Content-Type: application/json" \
  -v 2>&1)

HTTP_CODE3=$(echo "$RESPONSE3" | grep -oP '< HTTP/\d+\.\d+ \K\d+')
echo "HTTP Status: $HTTP_CODE3"

if [ "$HTTP_CODE3" = "200" ]; then
  echo "✅ GET request succeeded"
else
  echo "⚠️  GET request returned $HTTP_CODE3"
fi

echo ""
echo ""

# Summary
echo "📊 Summary"
echo "=========="
echo "OPTIONS Test 1: $([ "$HTTP_CODE" = "200" ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "OPTIONS Test 2: $([ "$HTTP_CODE2" = "200" ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "GET Test: $([ "$HTTP_CODE3" = "200" ] && echo "✅ PASS" || echo "⚠️  CHECK")"
echo ""
echo "💡 Next Steps:"
if [ "$HTTP_CODE" != "200" ] || [ "$HTTP_CODE2" != "200" ]; then
  echo "   1. Check API Gateway CORS configuration in AWS Console"
  echo "   2. Ensure OPTIONS requests return 200 OK"
  echo "   3. Verify CORS headers are present in OPTIONS responses"
  echo "   4. Check Lambda logs if OPTIONS requests reach Lambda"
else
  echo "   ✅ CORS preflight is working correctly"
  echo "   If browser still shows CORS errors, check:"
  echo "   - Browser cache (try hard refresh)"
  echo "   - Network tab in DevTools for actual request/response"
fi
