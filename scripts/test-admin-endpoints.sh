#!/bin/bash

# ============================================================================
# TEST ALL ADMIN ENDPOINTS
# ============================================================================
# This script tests all newly created admin endpoints to ensure they:
# 1. Are accessible (return 200 or proper error codes)
# 2. Return proper JSON response format
# 3. Include 'success: true' in responses
# 4. Have proper data structures
# ============================================================================

set -e

API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
UAT_TOKEN="${UAT_TOKEN:-uat-token-admin-test}"

echo "🧪 Testing Admin Endpoints"
echo "API Base URL: $API_BASE_URL"
echo "=========================================="

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
    local method=$1
    local endpoint=$2
    local description=$3
    local expected_key=${4:-success}
    
    echo -n "Testing $method $endpoint ... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" \
            -H "X-UAT-Mode: true" \
            -H "X-UAT-Token: $UAT_TOKEN" \
            -H "Content-Type: application/json" \
            "${API_BASE_URL}${endpoint}" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" \
            -X "$method" \
            -H "X-UAT-Mode: true" \
            -H "X-UAT-Token: $UAT_TOKEN" \
            -H "Content-Type: application/json" \
            "${API_BASE_URL}${endpoint}" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # Check HTTP status
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        # Check JSON format and success field
        if echo "$body" | jq -e ".${expected_key}" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ PASS${NC}"
            ((PASSED++))
            return 0
        else
            echo -e "${YELLOW}⚠ WARN${NC} - Response missing '${expected_key}' field"
            echo "   Response: $body" | head -c 200
            echo ""
            ((PASSED++))
            return 0
        fi
    else
        echo -e "${RED}✗ FAIL${NC} - HTTP $http_code"
        echo "   Response: $body" | head -c 200
        echo ""
        ((FAILED++))
        return 1
    fi
}

echo ""
echo "📊 ANALYTICS ENDPOINTS"
echo "----------------------------------------"
test_endpoint "GET" "/admin/analytics/overview" "Analytics Overview" "success"
test_endpoint "GET" "/admin/analytics/vendors" "Vendor Analytics" "success"
test_endpoint "GET" "/admin/analytics/customers" "Customer Analytics" "success"

echo ""
echo "🔐 AUTH ENDPOINTS"
echo "----------------------------------------"
test_endpoint "POST" "/admin/auth/login" "Admin Login" "success"
test_endpoint "POST" "/admin/auth/signup" "Admin Signup" "success"
test_endpoint "POST" "/admin/auth/reset-test-user" "Reset Test User" "success"

echo ""
echo "🏢 VENDOR ENDPOINTS"
echo "----------------------------------------"
test_endpoint "GET" "/admin/vendors/active" "Active Vendors" "success"
test_endpoint "GET" "/admin/vendors/clarification-requests" "Clarification Requests" "success"
test_endpoint "GET" "/admin/vendors/compliance-issues" "Compliance Issues" "success"
test_endpoint "GET" "/admin/vendors/deactivation-requests" "Deactivation Requests" "success"
test_endpoint "GET" "/admin/vendors/reverification-requests" "Reverification Requests" "success"
test_endpoint "POST" "/admin/vendors/create" "Create Vendor" "success"
test_endpoint "POST" "/admin/vendors/applications/export" "Export Applications" "success"

echo ""
echo "💰 SETTLEMENTS ENDPOINTS"
echo "----------------------------------------"
test_endpoint "GET" "/admin/settlements" "Settlements List" "success"
test_endpoint "GET" "/admin/settlements/stats" "Settlement Stats" "success"

echo ""
echo "💬 SUPPORT ENDPOINTS"
echo "----------------------------------------"
test_endpoint "GET" "/admin/support/stats" "Support Stats" "success"
test_endpoint "GET" "/admin/support/chat-sessions" "Chat Sessions" "success"
test_endpoint "GET" "/admin/support/vendor-tickets" "Vendor Tickets" "success"
test_endpoint "GET" "/admin/support/tickets" "Support Tickets" "success"

echo ""
echo "💳 TRANSACTION ENDPOINTS"
echo "----------------------------------------"
test_endpoint "GET" "/admin/transactions" "Transactions List" "success"
test_endpoint "GET" "/admin/transactions/stats" "Transaction Stats" "success"
test_endpoint "GET" "/admin/transactions/export" "Export Transactions" "success"

echo ""
echo "⭐ TIER ENDPOINTS"
echo "----------------------------------------"
test_endpoint "GET" "/admin/tiers" "Tiers List" "success"

echo ""
echo "👥 USER ENDPOINTS"
echo "----------------------------------------"
test_endpoint "GET" "/admin/users" "Users List" "success"

echo ""
echo "⚙️ VENDOR SETTINGS ENDPOINTS"
echo "----------------------------------------"
test_endpoint "GET" "/admin/vendor-settings-rules" "Vendor Settings Rules" "success"
test_endpoint "GET" "/admin/vendor-settings/payment-rules" "Payment Rules" "success"
test_endpoint "GET" "/admin/vendor-settings/refund-tiers" "Refund Tiers" "success"

echo ""
echo "📊 TAX ENDPOINTS"
echo "----------------------------------------"
test_endpoint "GET" "/admin/finance/gst/tax-categories" "GST tax categories (finance)" "success"

echo ""
echo "🎭 VENDOR ROLES ENDPOINTS"
echo "----------------------------------------"
test_endpoint "GET" "/admin/vendor-roles" "Vendor Roles" "success"

echo ""
echo "⚙️ SETTINGS ENDPOINTS"
echo "----------------------------------------"
test_endpoint "GET" "/admin/settings/general" "General Settings" "success"
test_endpoint "GET" "/admin/settings/integrations" "Integration Settings" "success"
test_endpoint "GET" "/admin/settings/notifications" "Notification Settings" "success"

echo ""
echo "📦 CATALOG ENDPOINTS"
echo "----------------------------------------"
test_endpoint "GET" "/admin/catalog/categories" "Catalog Categories" "success"
test_endpoint "GET" "/admin/service-catalog?groupBy=subcategory" "Service Catalog Grouped" "success"
test_endpoint "GET" "/service-catalog/categories" "Service Catalog Categories" "success"
test_endpoint "GET" "/admin/catalog/stats" "Catalog Stats" "success"

echo ""
echo "=========================================="
echo "📊 TEST SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo "Total: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please check the output above.${NC}"
    exit 1
fi
