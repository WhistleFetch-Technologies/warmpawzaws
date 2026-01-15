#!/bin/bash

# Quick Verification Script for Walker & Seller Onboarding
# Run this to verify all implementation is in place

echo "🔍 Quick Verification - Walker & Seller Onboarding"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track results
PASSED=0
FAILED=0

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} $2"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌${NC} $2 - File not found: $1"
        ((FAILED++))
        return 1
    fi
}

# Function to check file contains string
check_contains() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "${GREEN}✅${NC} $3"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌${NC} $3 - Not found in: $1"
        ((FAILED++))
        return 1
    fi
}

echo "📁 Checking Key Files..."
echo ""

# Backend files
check_file "backend/lambda/src/endpoints/vendor-onboarding.ts" "Backend onboarding endpoint"
check_contains "backend/lambda/src/endpoints/vendor-onboarding.ts" "getRoleSpecificFields" "Backend has getRoleSpecificFields method"
check_contains "backend/lambda/src/endpoints/vendor-onboarding.ts" "walker_gps_tracking" "Backend has walker fields"
check_contains "backend/lambda/src/endpoints/vendor-onboarding.ts" "seller_product_categories" "Backend has seller fields"

echo ""
echo "📁 Checking Frontend Files..."
echo ""

# Frontend files
check_file "apps/vendor-web/components/vendor/DynamicVendorOnboardingForm.tsx" "Frontend onboarding form"
check_contains "apps/vendor-web/components/vendor/DynamicVendorOnboardingForm.tsx" "case 'multiselect'" "Frontend has multiselect support"
check_file "apps/vendor-web/lib/service-catalogs.ts" "Service catalogs"
check_file "apps/vendor-web/lib/vendor-utils.ts" "Vendor utilities"
check_file "apps/vendor-web/components/vendor/CapabilityGate.tsx" "CapabilityGate component"

echo ""
echo "📁 Checking Documentation..."
echo ""

# Documentation
check_file "docs/TESTING_GUIDE_WALKER_SELLER.md" "Testing guide"
check_file "docs/QUICK_START_TESTING.md" "Quick start guide"
check_file "docs/IMPLEMENTATION_STATUS.md" "Implementation status"
check_file "docs/READY_FOR_TESTING.md" "Ready for testing doc"

echo ""
echo "🔍 Checking Implementation Details..."
echo ""

# Check walker fields count
WALKER_FIELDS=$(grep -c "walker_" backend/lambda/src/endpoints/vendor-onboarding.ts 2>/dev/null || echo "0")
if [ "$WALKER_FIELDS" -ge "5" ]; then
    echo -e "${GREEN}✅${NC} Walker fields defined ($WALKER_FIELDS found)"
    ((PASSED++))
else
    echo -e "${RED}❌${NC} Walker fields - Expected at least 5, found $WALKER_FIELDS"
    ((FAILED++))
fi

# Check seller fields count
SELLER_FIELDS=$(grep -c "seller_" backend/lambda/src/endpoints/vendor-onboarding.ts 2>/dev/null || echo "0")
if [ "$SELLER_FIELDS" -ge "5" ]; then
    echo -e "${GREEN}✅${NC} Seller fields defined ($SELLER_FIELDS found)"
    ((PASSED++))
else
    echo -e "${RED}❌${NC} Seller fields - Expected at least 5, found $SELLER_FIELDS"
    ((FAILED++))
fi

# Check multiselect implementation
if grep -q "multiselect" apps/vendor-web/components/vendor/DynamicVendorOnboardingForm.tsx 2>/dev/null; then
    echo -e "${GREEN}✅${NC} Multiselect field type implemented"
    ((PASSED++))
else
    echo -e "${RED}❌${NC} Multiselect not found in form"
    ((FAILED++))
fi

# Check role configs
if grep -q "walker:" apps/vendor-web/lib/role-config.ts 2>/dev/null; then
    echo -e "${GREEN}✅${NC} Walker role config exists"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️${NC}  Walker role config - Check if needed"
fi

if grep -q "seller:" apps/vendor-web/lib/role-config.ts 2>/dev/null; then
    echo -e "${GREEN}✅${NC} Seller role config exists"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️${NC}  Seller role config - Check if needed"
fi

echo ""
echo "=================================================="
echo "📊 Verification Summary"
echo "=================================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All checks passed! Ready for testing.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some checks failed. Please review above.${NC}"
    exit 1
fi
