#!/bin/bash

# Marketing Routes API Test Script
# Tests all marketing endpoints with actual API calls

PROJECT_ID="vpvpbdwtyugbknrntkho"
PUBLIC_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM"
BASE_URL="https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475"

echo "🧪 Testing Marketing Routes API"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo -n "Testing: $name ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET \
            "${BASE_URL}${endpoint}" \
            -H "Authorization: Bearer ${PUBLIC_ANON_KEY}" \
            -H "Content-Type: application/json")
    else
        response=$(curl -s -w "\n%{http_code}" -X ${method} \
            "${BASE_URL}${endpoint}" \
            -H "Authorization: Bearer ${PUBLIC_ANON_KEY}" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        ((FAILED++))
        return 1
    fi
    echo ""
}

echo "📋 CUSTOMER ENDPOINTS"
echo "===================="
echo ""

# Test 1: Customer Promotions List
test_endpoint "GET /promotions/active" "GET" "/promotions/active" ""

# Test 2: Coupon Validation
test_endpoint "POST /coupons/validate" "POST" "/coupons/validate" '{
  "code": "TEST20",
  "orderAmount": 1000,
  "customerId": "test_customer_123"
}'

# Test 3: Apply Coupon
test_endpoint "POST /coupons/apply" "POST" "/coupons/apply" '{
  "code": "TEST20",
  "orderAmount": 1000,
  "customerId": "test_customer_123",
  "orderId": "test_order_123"
}'

echo ""
echo "👨‍💼 ADMIN ENDPOINTS"
echo "==================="
echo ""

# Test 4: Admin Promotion Creation
PROMO_DATA='{
  "name": "Test Promotion",
  "type": "percentage",
  "value": 20,
  "validFrom": "2024-01-01T00:00:00Z",
  "validUntil": "2024-12-31T23:59:59Z",
  "isActive": true,
  "applicableTo": "all",
  "priority": 1
}'
test_endpoint "POST /admin/promotions/create" "POST" "/admin/promotions/create" "$PROMO_DATA"

# Get the promotion ID from the response for update/delete tests
PROMO_RESPONSE=$(curl -s -X POST \
    "${BASE_URL}/admin/promotions/create" \
    -H "Authorization: Bearer ${PUBLIC_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "$PROMO_DATA")
PROMO_ID=$(echo "$PROMO_RESPONSE" | jq -r '.promotion.id' 2>/dev/null)

# Test 5: Admin Promotion List
test_endpoint "GET /admin/promotions" "GET" "/admin/promotions" ""

# Test 6: Admin Promotion Update
if [ -n "$PROMO_ID" ] && [ "$PROMO_ID" != "null" ]; then
    test_endpoint "PUT /admin/promotions/:id" "PUT" "/admin/promotions/${PROMO_ID}" '{
      "name": "Updated Test Promotion",
      "value": 25
    }'
fi

# Test 7: Admin Promotion Delete
if [ -n "$PROMO_ID" ] && [ "$PROMO_ID" != "null" ]; then
    test_endpoint "DELETE /admin/promotions/:id" "DELETE" "/admin/promotions/${PROMO_ID}" ""
fi

# Test 8: Admin Coupon List
test_endpoint "GET /admin/coupons" "GET" "/admin/coupons" ""

# Test 9: Admin Coupon Creation
COUPON_DATA='{
  "code": "TESTCOUPON20",
  "type": "percentage",
  "value": 20,
  "minOrderAmount": 500,
  "maxDiscountAmount": 200,
  "validFrom": "2024-01-01T00:00:00Z",
  "validUntil": "2024-12-31T23:59:59Z",
  "usageLimit": 100,
  "userUsageLimit": 1,
  "isActive": true
}'
test_endpoint "POST /admin/coupons/create" "POST" "/admin/coupons/create" "$COUPON_DATA"

# Test 10: Admin Bulk Coupon Generation
BULK_COUPON_DATA='{
  "prefix": "BULK",
  "quantity": 5,
  "format": "alphanumeric",
  "length": 6,
  "type": "percentage",
  "value": 15,
  "minOrderAmount": 1000,
  "maxDiscountAmount": 500,
  "validFrom": "2024-01-01T00:00:00Z",
  "validUntil": "2024-12-31T23:59:59Z",
  "usageLimit": 1,
  "userUsageLimit": 1,
  "isActive": true
}'
test_endpoint "POST /admin/coupons/bulk-generate" "POST" "/admin/coupons/bulk-generate" "$BULK_COUPON_DATA"

echo ""
echo "=================================="
echo "📊 TEST SUMMARY"
echo "=================================="
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed${NC}"
    exit 1
fi

