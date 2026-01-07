#!/bin/bash

# ============================================================================
# E-COMMERCE IMPLEMENTATION TEST SCRIPT
# ============================================================================
# Tests all implemented e-commerce features:
# - Product Management
# - Order Management
# - Seller Dashboard
# ============================================================================

set -e

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
VENDOR_ID="${VENDOR_ID:-test-vendor-id}"
CUSTOMER_ID="${CUSTOMER_ID:-test-customer-id}"

echo "🧪 Testing E-Commerce Implementation"
echo "======================================"
echo "API Base URL: $API_BASE_URL"
echo "Vendor ID: $VENDOR_ID"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -n "Testing: $description... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -w "\n%{http_code}" -X PUT "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$API_BASE_URL$endpoint" \
            -H "Content-Type: application/json")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        echo "  Response: $body"
        ((FAILED++))
        return 1
    fi
}

# ============================================================================
# PHASE 1: PRODUCT MANAGEMENT TESTS
# ============================================================================

echo ""
echo "📦 Phase 1: Product Management"
echo "-------------------------------"

# Test 1: Get categories
test_endpoint "GET" "/ecommerce/categories" "" "Get e-commerce categories"

# Test 2: List vendor products
test_endpoint "GET" "/vendor/$VENDOR_ID/products" "" "List vendor products"

# Test 3: Create product
PRODUCT_DATA='{
  "name": "Test Product",
  "description": "Test product description",
  "price": 599,
  "stock": 100,
  "hsn_code": "2309",
  "gst_rate": 18,
  "is_active": true
}'
test_endpoint "POST" "/vendor/$VENDOR_ID/products" "$PRODUCT_DATA" "Create product"

# Get created product ID (if available)
PRODUCT_ID="test-product-id"

# Test 4: Get product details
test_endpoint "GET" "/vendor/$VENDOR_ID/products/$PRODUCT_ID" "" "Get product details"

# Test 5: Update product
UPDATE_DATA='{
  "name": "Updated Test Product",
  "price": 699
}'
test_endpoint "PUT" "/vendor/$VENDOR_ID/products/$PRODUCT_ID" "$UPDATE_DATA" "Update product"

# ============================================================================
# PHASE 2: ORDER MANAGEMENT TESTS
# ============================================================================

echo ""
echo "📋 Phase 2: Order Management"
echo "-------------------------------"

# Test 6: List vendor orders
test_endpoint "GET" "/vendor/$VENDOR_ID/orders" "" "List vendor orders"

# Test 7: Get order statistics
test_endpoint "GET" "/vendor/$VENDOR_ID/orders/stats" "" "Get order statistics"

# Test 8: Get order with filters
test_endpoint "GET" "/vendor/$VENDOR_ID/orders?status=pending&dateFilter=today" "" "Get filtered orders"

# ============================================================================
# PHASE 3: SELLER ANALYTICS TESTS
# ============================================================================

echo ""
echo "📊 Phase 3: Seller Analytics"
echo "-------------------------------"

# Test 9: Get sales analytics
test_endpoint "GET" "/vendor/$VENDOR_ID/analytics/sales?period=month" "" "Get sales analytics"

# Test 10: Get product performance
test_endpoint "GET" "/vendor/$VENDOR_ID/analytics/products?period=month" "" "Get product performance"

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "======================================"
echo "Test Summary"
echo "======================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

