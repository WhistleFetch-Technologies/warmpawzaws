#!/bin/bash
#================================================================
# FRONTEND APPLICATIONS E2E TEST
#================================================================
# Tests actual UIs to find broken pages and handlers
#================================================================

echo "🔍 TESTING FRONTEND APPLICATIONS - FINDING REAL ISSUES"
echo "======================================================="
echo ""

# URLs
ADMIN_URL="https://dfof7mguaa0a5.cloudfront.net"
VENDOR_URL="https://d1s6ykkj381k58.cloudfront.net"
CUSTOMER_URL="https://d2aoyjj8ine0wk.cloudfront.net"
API_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"

echo "📍 Testing URLs:"
echo "  Admin: $ADMIN_URL"
echo "  Vendor: $VENDOR_URL"
echo "  Customer: $CUSTOMER_URL"
echo "  API: $API_URL"
echo ""

# Test Admin UI
echo "🔧 Testing Admin Dashboard..."
echo "------------------------------"

echo "Test 1: Admin Homepage"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$ADMIN_URL/")
echo "  Homepage: HTTP $STATUS $([ "$STATUS" = "200" ] && echo "✅" || echo "❌")"

echo ""
echo "Test 2: Admin Pages (checking if they load)"
ADMIN_PAGES=(
  "/"
  "/vendors"
  "/customers"
  "/services"
  "/bookings"
  "/analytics"
  "/settings"
  "/roles"
  "/capabilities"
  "/policies"
  "/gst-config"
  "/reports"
)

ADMIN_PASS=0
ADMIN_FAIL=0

for page in "${ADMIN_PAGES[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$ADMIN_URL$page")
  if [ "$STATUS" = "200" ]; then
    echo "  ✅ $page - HTTP $STATUS"
    ((ADMIN_PASS++))
  else
    echo "  ❌ $page - HTTP $STATUS FAILED"
    ((ADMIN_FAIL++))
  fi
done

echo ""
echo "Admin UI Test Results: $ADMIN_PASS passed, $ADMIN_FAIL failed"
echo ""

# Test Vendor UI
echo "🏪 Testing Vendor Portal..."
echo "------------------------------"

echo "Test 3: Vendor Homepage"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$VENDOR_URL/")
echo "  Homepage: HTTP $STATUS $([ "$STATUS" = "200" ] && echo "✅" || echo "❌")"

echo ""
echo "Test 4: Vendor Pages"
VENDOR_PAGES=(
  "/"
  "/dashboard"
  "/services"
  "/bookings"
  "/staff"
  "/schedule"
  "/analytics"
  "/profile"
  "/settings"
)

VENDOR_PASS=0
VENDOR_FAIL=0

for page in "${VENDOR_PAGES[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$VENDOR_URL$page")
  if [ "$STATUS" = "200" ]; then
    echo "  ✅ $page - HTTP $STATUS"
    ((VENDOR_PASS++))
  else
    echo "  ❌ $page - HTTP $STATUS FAILED"
    ((VENDOR_FAIL++))
  fi
done

echo ""
echo "Vendor UI Test Results: $VENDOR_PASS passed, $VENDOR_FAIL failed"
echo ""

# Test Customer UI
echo "👥 Testing Customer App..."
echo "------------------------------"

echo "Test 5: Customer Homepage"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$CUSTOMER_URL/")
echo "  Homepage: HTTP $STATUS $([ "$STATUS" = "200" ] && echo "✅" || echo "❌")"

echo ""
echo "Test 6: Customer Pages"
CUSTOMER_PAGES=(
  "/"
  "/services"
  "/search"
  "/bookings"
  "/pets"
  "/profile"
  "/wallet"
  "/shop"
  "/orders"
)

CUSTOMER_PASS=0
CUSTOMER_FAIL=0

for page in "${CUSTOMER_PAGES[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$CUSTOMER_URL$page")
  if [ "$STATUS" = "200" ]; then
    echo "  ✅ $page - HTTP $STATUS"
    ((CUSTOMER_PASS++))
  else
    echo "  ❌ $page - HTTP $STATUS FAILED"
    ((CUSTOMER_FAIL++))
  fi
done

echo ""
echo "Customer UI Test Results: $CUSTOMER_PASS passed, $CUSTOMER_FAIL failed"
echo ""

# Test API Endpoints that UIs depend on
echo "🔌 Testing Critical API Endpoints..."
echo "------------------------------"

API_ENDPOINTS=(
  "/health"
  "/regions"
  "/roles"
  "/admin/capabilities"
  "/services"
  "/customer/vendors/search?city=Bangalore"
)

API_PASS=0
API_FAIL=0

for endpoint in "${API_ENDPOINTS[@]}"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint")
  if [ "$STATUS" = "200" ]; then
    echo "  ✅ $endpoint - HTTP $STATUS"
    ((API_PASS++))
  else
    echo "  ❌ $endpoint - HTTP $STATUS FAILED"
    ((API_FAIL++))
  fi
done

echo ""
echo "API Endpoint Test Results: $API_PASS passed, $API_FAIL failed"
echo ""

# Summary
echo "======================================================="
echo "📊 FRONTEND TEST SUMMARY"
echo "======================================================="
echo ""
echo "Admin UI:    $ADMIN_PASS/$((ADMIN_PASS + ADMIN_FAIL)) pages working"
echo "Vendor UI:   $VENDOR_PASS/$((VENDOR_PASS + VENDOR_FAIL)) pages working"
echo "Customer UI: $CUSTOMER_PASS/$((CUSTOMER_PASS + CUSTOMER_FAIL)) pages working"
echo "API:         $API_PASS/$((API_PASS + API_FAIL)) endpoints working"
echo ""

TOTAL_PASS=$((ADMIN_PASS + VENDOR_PASS + CUSTOMER_PASS + API_PASS))
TOTAL_TESTS=$((ADMIN_PASS + ADMIN_FAIL + VENDOR_PASS + VENDOR_FAIL + CUSTOMER_PASS + CUSTOMER_FAIL + API_PASS + API_FAIL))

if [ $TOTAL_PASS -eq $TOTAL_TESTS ]; then
  echo "✅ ALL TESTS PASSED ($TOTAL_PASS/$TOTAL_TESTS)"
  exit 0
else
  FAILED=$((TOTAL_TESTS - TOTAL_PASS))
  echo "❌ SOME TESTS FAILED: $TOTAL_PASS passed, $FAILED failed"
  echo ""
  echo "⚠️  ISSUES FOUND - Frontend apps have broken pages/handlers"
  exit 1
fi
