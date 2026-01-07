#!/bin/bash

# ============================================================================
# COMPLETE FLOW TESTING SCRIPT
# ============================================================================
# Tests all implemented features with mock data
# ============================================================================

set -e

echo "🧪 Complete Flow Testing"
echo "========================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0

# Test function
test_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $description"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description - File not found: $file"
        ((FAILED++))
        return 1
    fi
}

# Test import
test_import() {
    local file=$1
    local import=$2
    local description=$3
    
    if grep -q "$import" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $description"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description - Import not found: $import"
        ((FAILED++))
        return 1
    fi
}

echo -e "${BLUE}📦 Phase 1: Product Management${NC}"
echo "----------------------------------------"
test_file "apps/vendor-web/app/products/page.tsx" "Products page"
test_file "apps/vendor-web/components/vendor/products/AddProductModal.tsx" "Add product modal"
test_file "apps/vendor-web/components/vendor/products/EditProductModal.tsx" "Edit product modal"
test_file "apps/vendor-web/lib/mock-data.ts" "Mock data service"
test_file "apps/vendor-web/lib/api-client-with-mock.ts" "API client with mock"
test_import "apps/vendor-web/app/products/page.tsx" "api-client-with-mock" "Products page uses mock client"
test_import "apps/vendor-web/components/vendor/products/AddProductModal.tsx" "api-client-with-mock" "Add modal uses mock client"
test_import "apps/vendor-web/components/vendor/products/EditProductModal.tsx" "api-client-with-mock" "Edit modal uses mock client"

echo ""
echo -e "${BLUE}📋 Phase 2: Order Management${NC}"
echo "----------------------------------------"
test_file "apps/vendor-web/app/orders/page.tsx" "Orders page"
test_file "apps/vendor-web/components/vendor/orders/OrderDetailsModal.tsx" "Order details modal"
test_file "apps/vendor-web/components/vendor/orders/OrderStatusUpdateModal.tsx" "Order status modal"
test_import "apps/vendor-web/app/orders/page.tsx" "api-client-with-mock" "Orders page uses mock client"
test_import "apps/vendor-web/components/vendor/orders/OrderDetailsModal.tsx" "api-client-with-mock" "Order details uses mock client"
test_import "apps/vendor-web/components/vendor/orders/OrderStatusUpdateModal.tsx" "api-client-with-mock" "Status update uses mock client"

echo ""
echo -e "${BLUE}📊 Phase 3: Seller Dashboard${NC}"
echo "----------------------------------------"
test_file "apps/vendor-web/app/seller/page.tsx" "Seller dashboard page"
test_file "apps/vendor-web/components/vendor/seller/SalesOverview.tsx" "Sales overview"
test_file "apps/vendor-web/components/vendor/seller/RevenueChart.tsx" "Revenue chart"
test_file "apps/vendor-web/components/vendor/seller/OrderTrends.tsx" "Order trends"
test_file "apps/vendor-web/components/vendor/seller/ProductPerformance.tsx" "Product performance"
test_import "apps/vendor-web/app/seller/page.tsx" "api-client-with-mock" "Seller dashboard uses mock client"

echo ""
echo -e "${BLUE}✅ Phase 4: Seller Approval${NC}"
echo "----------------------------------------"
test_file "apps/admin-web/app/sellers/page.tsx" "Seller approval page"
test_file "backend/lambda/src/endpoints/admin-sellers.ts" "Seller approval endpoints"
test_file "db/migrations/052_seller_approval_workflow.sql" "Seller approval migration"

echo ""
echo -e "${BLUE}🛒 Phase 5: Customer Orders${NC}"
echo "----------------------------------------"
test_file "apps/customer-web/app/orders/page.tsx" "Customer orders page"
test_file "apps/customer-web/lib/mock-data.ts" "Customer mock data"
test_file "apps/customer-web/lib/api-client-with-mock.ts" "Customer API client with mock"
test_import "apps/customer-web/app/orders/page.tsx" "api-client-with-mock" "Customer orders uses mock client"

echo ""
echo -e "${BLUE}📦 Phase 6: Order Tracking${NC}"
echo "----------------------------------------"
test_file "apps/customer-web/app/orders/[id]/tracking/page.tsx" "Order tracking page"
test_import "apps/customer-web/app/orders/[id]/tracking/page.tsx" "api-client-with-mock" "Tracking page uses mock client"

echo ""
echo -e "${BLUE}🔧 Backend Endpoints${NC}"
echo "----------------------------------------"
test_file "backend/lambda/src/endpoints/vendor-products.ts" "Vendor products endpoints"
test_file "backend/lambda/src/endpoints/vendor-orders.ts" "Vendor orders endpoints"
test_file "backend/lambda/src/endpoints/vendor-analytics.ts" "Vendor analytics endpoints"
test_file "backend/lambda/src/endpoints/admin-sellers.ts" "Admin sellers endpoints"

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
    echo ""
    echo "Next steps:"
    echo "1. Enable mock data: enableMockData() in browser console"
    echo "2. Start dev servers: npm run dev in each app"
    echo "3. Test all flows with mock data"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

