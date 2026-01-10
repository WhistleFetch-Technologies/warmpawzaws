#!/bin/bash
# Comprehensive Test Script for All Admin Web UI Pages
# Tests Cognito Authorizer compatibility for all pages

set -e

echo "=========================================="
echo "All Admin Web UI Pages - Cognito Test"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_GATEWAY_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
CLOUDFRONT_URL="https://dfof7mguaa0a5.cloudfront.net"

# Test results
PASSED=0
FAILED=0
TOTAL=0

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local page_name=$2
    local expected_code=${3:-401}  # Default to 401 (unauthorized without token)
    
    TOTAL=$((TOTAL + 1))
    echo -e "${BLUE}Testing: $page_name${NC}"
    echo "  Endpoint: $endpoint"
    
    RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$API_GATEWAY_URL$endpoint" \
        -H "Content-Type: application/json" 2>&1)
    HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
    BODY=$(echo "$RESPONSE" | sed '/HTTP_CODE/d')
    
    if [ "$HTTP_CODE" == "$expected_code" ]; then
        echo -e "  ${GREEN}✅ PASS${NC} - Returned $HTTP_CODE (expected $expected_code)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "  ${RED}❌ FAIL${NC} - Returned $HTTP_CODE (expected $expected_code)"
        echo "  Response: $BODY"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo -e "${YELLOW}Step 1: Testing Public Endpoint${NC}"
test_endpoint "/health" "Health Check" "200"
echo ""

echo -e "${YELLOW}Step 2: Testing All Admin Page Endpoints (Should Require Auth)${NC}"
echo ""

# Dashboard & Analytics
test_endpoint "/admin/vendors/stats" "Dashboard - Vendor Stats"
test_endpoint "/admin/vendors?status=pending" "Dashboard - Pending Vendors"
test_endpoint "/admin/analytics" "Analytics Page"
test_endpoint "/admin/analytics/revenue" "Analytics - Revenue"
test_endpoint "/admin/analytics/vendors" "Analytics - Vendors"
test_endpoint "/admin/analytics/customers" "Analytics - Customers"

# Vendors
test_endpoint "/admin/vendors/all" "Vendors - All Vendors"
test_endpoint "/admin/vendors" "Vendors - List"
test_endpoint "/quality/alerts" "Vendors - Quality Alerts"
test_endpoint "/admin/vendors/pending" "Vendors - Pending Applications"

# E-Commerce
test_endpoint "/admin/ecommerce/analytics/platform" "E-Commerce - Analytics"
test_endpoint "/admin/vendor/list" "E-Commerce - Seller List"
test_endpoint "/admin/ecommerce/products?status=pending_approval" "E-Commerce - Pending Products"
test_endpoint "/admin/ecommerce/orders" "E-Commerce - Orders"
test_endpoint "/admin/ecommerce/commission/settings" "E-Commerce - Commission Settings"
test_endpoint "/admin/ecommerce/analytics?days=30" "E-Commerce - Analytics (30 days)"

# Marketing
test_endpoint "/admin/marketing/promotions" "Marketing - Promotions"
test_endpoint "/admin/marketing/coupons" "Marketing - Coupons"
test_endpoint "/admin/marketing/banners" "Marketing - Banners"

# Finance
test_endpoint "/admin/finance/payment-policies" "Finance - Payment Policies"
test_endpoint "/admin/finance/tiers" "Finance - Tiers"
test_endpoint "/admin/finance/payouts" "Finance - Payouts"
test_endpoint "/admin/finance/settlements" "Finance - Settlements"

# Roles & Governance
test_endpoint "/config/roles" "Roles - List"
test_endpoint "/admin/roles" "Roles - Admin"
test_endpoint "/admin/governance/audit-logs" "Governance - Audit Logs"

# Other Pages
test_endpoint "/admin/catalog/services" "Catalog - Services"
test_endpoint "/admin/regions" "Regions - List"
test_endpoint "/admin/loyalty/rules" "Loyalty - Rules"
test_endpoint "/admin/support/tickets" "Support - Tickets"
test_endpoint "/admin/notifications" "Notifications - List"
test_endpoint "/admin/pet-info/breeds" "Pet Info - Breeds"
test_endpoint "/admin/enterprise/clients" "Enterprise - Clients"
test_endpoint "/admin/logistics/tracking" "Logistics - Tracking"
test_endpoint "/admin/integrations" "Integrations - List"
test_endpoint "/admin/platform-settings" "Platform Settings"
test_endpoint "/admin/reports" "Reports - List"
test_endpoint "/admin/sellers" "Sellers - List"
test_endpoint "/admin/settlements" "Settlements - List"
test_endpoint "/admin/tiers" "Tiers - List"
test_endpoint "/admin/promotions" "Promotions - List"
test_endpoint "/admin/refunds" "Refunds - List"

echo ""
echo -e "${YELLOW}Step 3: Verifying API Gateway Configuration${NC}"
echo ""

# Check authorizer
AUTHORIZERS=$(aws apigatewayv2 get-authorizers --api-id z0b3obweb6 --query 'Items[*].[AuthorizerId,Name]' --output text 2>&1)
if [ -n "$AUTHORIZERS" ]; then
    echo -e "${GREEN}✅ Cognito JWT Authorizer is configured${NC}"
    echo "$AUTHORIZERS"
else
    echo -e "${RED}❌ No authorizers found${NC}"
    FAILED=$((FAILED + 1))
fi
echo ""

# Check routes
ROUTES=$(aws apigatewayv2 get-routes --api-id z0b3obweb6 --query 'Items[*].[RouteKey,AuthorizationType]' --output table 2>&1)
echo "Route Configuration:"
echo "$ROUTES"
echo ""

# Check CORS
CORS_ORIGINS=$(aws apigatewayv2 get-api --api-id z0b3obweb6 --query 'CorsConfiguration.AllowOrigins' --output json 2>&1)
if echo "$CORS_ORIGINS" | grep -q "dfof7mguaa0a5.cloudfront.net"; then
    echo -e "${GREEN}✅ CORS includes CloudFront domain${NC}"
else
    echo -e "${YELLOW}⚠️  CloudFront domain may not be in CORS${NC}"
fi
echo ""

echo -e "${YELLOW}Step 4: Verifying All Admin Pages Exist${NC}"
echo ""

PAGES=(
    "analytics"
    "vendors"
    "ecommerce"
    "marketing"
    "finance"
    "banners"
    "catalog"
    "enterprise"
    "governance"
    "integrations"
    "logistics"
    "loyalty"
    "notifications"
    "pet-info"
    "platform-settings"
    "promotions"
    "refunds"
    "regions"
    "reports"
    "roles"
    "sellers"
    "settlements"
    "support"
    "tiers"
)

for page in "${PAGES[@]}"; do
    if [ -f "apps/admin-web/app/$page/page.tsx" ] || [ -f "apps/admin-web/app/$page/page.tsx" ]; then
        echo -e "${GREEN}✅ $page/page.tsx exists${NC}"
    else
        echo -e "${YELLOW}⚠️  $page/page.tsx not found${NC}"
    fi
done
echo ""

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

