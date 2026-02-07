#!/bin/bash
# Verify CORS fix is working and provide browser cache clearing instructions

set -e

API_BASE="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
ORIGIN="https://dfof7mguaa0a5.cloudfront.net"

echo "🔍 Verifying CORS Fix"
echo "===================="
echo ""

ENDPOINTS=(
  "/admin/catalog/categories"
  "/admin/service-catalog?groupBy=subcategory"
  "/admin/catalog/stats"
  "/admin/roles"
  "/service-catalog/categories"
)

ALL_PASSED=true

for endpoint in "${ENDPOINTS[@]}"; do
  echo -n "Testing OPTIONS $endpoint ... "
  
  response=$(curl -s -w "\n%{http_code}" -X OPTIONS \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: authorization,content-type" \
    "${API_BASE}${endpoint}" 2>&1)
  
  http_code=$(echo "$response" | tail -n1)
  headers=$(curl -s -I -X OPTIONS \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: authorization,content-type" \
    "${API_BASE}${endpoint}" 2>&1)
  
  if [ "$http_code" = "200" ]; then
    if echo "$headers" | grep -qi "access-control-allow-origin"; then
      echo "✅ PASS (200 with CORS headers)"
    else
      echo "⚠️  WARN (200 but missing CORS headers)"
      ALL_PASSED=false
    fi
  else
    echo "❌ FAIL (HTTP $http_code)"
    ALL_PASSED=false
  fi
done

echo ""
if [ "$ALL_PASSED" = true ]; then
  echo "✅ All endpoints return 200 with CORS headers!"
  echo ""
  echo "📱 Browser Cache Clearing Instructions:"
  echo "   Browsers cache preflight OPTIONS responses for up to 24 hours."
  echo "   To see the fix immediately:"
  echo "   1. Open DevTools (F12)"
  echo "   2. Go to Application/Storage tab"
  echo "   3. Click 'Clear site data' or 'Clear storage'"
  echo "   4. OR use Hard Refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)"
  echo "   5. OR open in Incognito/Private mode"
else
  echo "❌ Some endpoints are still failing. Check API Gateway CORS configuration."
fi
