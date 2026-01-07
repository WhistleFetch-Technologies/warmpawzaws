#!/bin/bash

# ============================================================================
# LOCAL UI TESTING SCRIPT
# ============================================================================
# Tests UI components with mock data (no database required)
# ============================================================================

set -e

echo "🧪 Local UI Testing - Mock Data Mode"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Test function
test_component() {
    local component=$1
    local description=$2
    
    echo -n "Testing: $description... "
    
    # Check if component file exists
    if [ -f "$component" ]; then
        echo -e "${GREEN}✓ PASS${NC} (File exists)"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (File not found)"
        ((FAILED++))
        return 1
    fi
}

# ============================================================================
# PHASE 1: PRODUCT MANAGEMENT COMPONENTS
# ============================================================================

echo ""
echo -e "${BLUE}📦 Phase 1: Product Management Components${NC}"
echo "----------------------------------------"

test_component "apps/vendor-web/app/products/page.tsx" "Products page"
test_component "apps/vendor-web/components/vendor/products/AddProductModal.tsx" "Add product modal"
test_component "apps/vendor-web/components/vendor/products/EditProductModal.tsx" "Edit product modal"
test_component "apps/vendor-web/lib/mock-data.ts" "Mock data service"
test_component "apps/vendor-web/lib/api-client-with-mock.ts" "API client with mock"

# ============================================================================
# PHASE 2: ORDER MANAGEMENT COMPONENTS
# ============================================================================

echo ""
echo -e "${BLUE}📋 Phase 2: Order Management Components${NC}"
echo "----------------------------------------"

test_component "apps/vendor-web/app/orders/page.tsx" "Orders page"
test_component "apps/vendor-web/components/vendor/orders/OrderDetailsModal.tsx" "Order details modal"
test_component "apps/vendor-web/components/vendor/orders/OrderStatusUpdateModal.tsx" "Order status update modal"

# ============================================================================
# PHASE 3: SELLER DASHBOARD COMPONENTS
# ============================================================================

echo ""
echo -e "${BLUE}📊 Phase 3: Seller Dashboard Components${NC}"
echo "----------------------------------------"

test_component "apps/vendor-web/app/seller/page.tsx" "Seller dashboard page"
test_component "apps/vendor-web/components/vendor/seller/SalesOverview.tsx" "Sales overview"
test_component "apps/vendor-web/components/vendor/seller/RevenueChart.tsx" "Revenue chart"
test_component "apps/vendor-web/components/vendor/seller/OrderTrends.tsx" "Order trends"
test_component "apps/vendor-web/components/vendor/seller/ProductPerformance.tsx" "Product performance"

# ============================================================================
# PHASE 4: SELLER APPROVAL COMPONENTS
# ============================================================================

echo ""
echo -e "${BLUE}✅ Phase 4: Seller Approval Components${NC}"
echo "----------------------------------------"

test_component "apps/admin-web/app/sellers/page.tsx" "Seller approval page"

# ============================================================================
# PHASE 5: CUSTOMER ORDER HISTORY
# ============================================================================

echo ""
echo -e "${BLUE}🛒 Phase 5: Customer Order History${NC}"
echo "----------------------------------------"

test_component "apps/customer-web/app/orders/page.tsx" "Customer orders page"
test_component "apps/customer-web/lib/mock-data.ts" "Customer mock data"
test_component "apps/customer-web/lib/api-client-with-mock.ts" "Customer API client with mock"

# ============================================================================
# PHASE 6: ORDER TRACKING
# ============================================================================

echo ""
echo -e "${BLUE}📦 Phase 6: Order Tracking${NC}"
echo "----------------------------------------"

test_component "apps/customer-web/app/orders/[id]/tracking/page.tsx" "Order tracking page"

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
    echo -e "${GREEN}✅ All component files exist!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Enable mock data mode:"
    echo "   - Open browser console"
    echo "   - Run: enableMockData()"
    echo "   - Or set localStorage.setItem('useMockData', 'true')"
    echo ""
    echo "2. Start development servers:"
    echo "   - Vendor Web: cd apps/vendor-web && npm run dev"
    echo "   - Customer Web: cd apps/customer-web && npm run dev"
    echo "   - Admin Web: cd apps/admin-web && npm run dev"
    echo ""
    echo "3. Test all flows with mock data"
    exit 0
else
    echo -e "${RED}❌ Some component files are missing${NC}"
    exit 1
fi

