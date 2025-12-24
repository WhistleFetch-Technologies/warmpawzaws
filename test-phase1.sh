#!/bin/bash

# Phase 1 Test Runner
# Tests all migrated endpoints for KV to SQL migration

BASE_URL="https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475"
VENDOR_ID="vendor_9611377119"
TEST_PHONE="9611377119"

echo "🧪 PHASE 1 TEST SUITE - KV TO SQL MIGRATION"
echo "=========================================="
echo ""

PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    local expected_status=${5:-200}
    
    echo -n "Testing: $name ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$url" \
            -H "Authorization: Bearer $SUPABASE_ANON_KEY" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$url" \
            -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo "✅ PASSED"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo "❌ FAILED (Status: $http_code)"
        echo "   Response: $body"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "⚠️  SUPABASE_ANON_KEY not set. Some tests may fail."
fi

echo "📦 TEST 1: Marketplace Products"
echo "-------------------------------"

# Test 1.1: Get Vendor Products
test_endpoint "Get Vendor Products" "GET" "/vendor/$VENDOR_ID/marketplace-products"

# Test 1.2: Create Product
PRODUCT_DATA='{"name":"Test Product","category":"Toys","price":299,"stock":50,"description":"Test description"}'
test_endpoint "Create Product" "POST" "/vendor/$VENDOR_ID/marketplace-products" "$PRODUCT_DATA"

# Get created product ID (would need to parse response in real test)
PRODUCT_ID="test_product_123" # Placeholder

echo ""
echo "📊 TEST 2: GST Configuration"
echo "-------------------------------"

# Test 2.1: Get GST Configs
test_endpoint "Get GST Configs" "GET" "/admin/finance/gst-config"

# Test 2.2: Create GST Config
GST_DATA='{"hsn_code":"12345678","category":"Pet Food","gst_rate":18,"cgst_rate":9,"sgst_rate":9}'
test_endpoint "Create GST Config" "POST" "/admin/finance/gst-config" "$GST_DATA"

echo ""
echo "🎁 TEST 3: Promotions"
echo "-------------------------------"

# Test 3.1: Get Active Promotions
test_endpoint "Get Active Promotions" "GET" "/promotions/active"

# Test 3.2: Get All Promotions (Admin)
test_endpoint "Get All Promotions" "GET" "/admin/promotions"

echo ""
echo "💰 TEST 4: Settlement Automation"
echo "-------------------------------"

# Test 4.1: Get Pending Settlements
test_endpoint "Get Pending Settlements" "GET" "/payment/settlement/pending"

# Test 4.2: Get Vendor Settlements
test_endpoint "Get Vendor Settlements" "GET" "/payment/settlement/vendor/$VENDOR_ID"

echo ""
echo "🛒 TEST 5: Ecommerce Routes"
echo "-------------------------------"

# Test 5.1: Get Commission Settings
test_endpoint "Get Commission Settings" "GET" "/ecommerce/commission/settings"

# Test 5.2: Get Categories
test_endpoint "Get Categories" "GET" "/ecommerce/categories"

# Test 5.3: Get Admin Orders
test_endpoint "Get Admin Orders" "GET" "/ecommerce/admin/orders"

# Test 5.4: Get Logistics Vendors
test_endpoint "Get Logistics Vendors" "GET" "/ecommerce/logistics/vendors"

# Test 5.5: Get Seller Analytics
test_endpoint "Get Seller Analytics" "GET" "/ecommerce/analytics/seller/$VENDOR_ID"

# Test 5.6: Get Platform Analytics
test_endpoint "Get Platform Analytics" "GET" "/ecommerce/analytics/platform"

echo ""
echo "=========================================="
echo "📊 TEST RESULTS"
echo "=========================================="
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 ALL TESTS PASSED! Phase 1 migration successful."
    exit 0
else
    echo "⚠️  Some tests failed. Review errors above."
    exit 1
fi

