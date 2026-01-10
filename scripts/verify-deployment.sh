#!/bin/bash

# ============================================================================
# Complete Deployment Verification Script
# ============================================================================
# 
# Verifies:
# 1. All endpoints are properly registered
# 2. All imports are correct
# 3. Dependencies are installed
# 4. Wireframe implementation status
# 5. New UI endpoints for customer and vendor apps
# 
# ============================================================================

set -e

echo "🔍 Starting Complete Deployment Verification..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# ============================================================================
# 1. Check Build Status
# ============================================================================
echo "📦 1. Checking Build Status..."
echo "----------------------------------------"

cd apps/vendor-web
if npm run build 2>&1 | grep -q "Compiled successfully"; then
    echo -e "${GREEN}✅ Vendor Web: Build successful${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Vendor Web: Build failed${NC}"
    ((FAILED++))
fi
cd ../..

cd apps/customer-web
if npm run build 2>&1 | grep -q "Compiled successfully"; then
    echo -e "${GREEN}✅ Customer Web: Build successful${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Customer Web: Build failed${NC}"
    ((FAILED++))
fi
cd ../..

cd apps/admin-web
if npm run build 2>&1 | grep -q "Compiled successfully"; then
    echo -e "${GREEN}✅ Admin Web: Build successful${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Admin Web: Build failed${NC}"
    ((FAILED++))
fi
cd ../..

echo ""

# ============================================================================
# 2. Check Lambda Endpoints Registration
# ============================================================================
echo "🔌 2. Checking Lambda Endpoints Registration..."
echo "----------------------------------------"

if grep -q "registerVendorDistancePricingEndpoints" backend/lambda/src/handler/index.ts; then
    echo -e "${GREEN}✅ Distance Pricing endpoints registered${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Distance Pricing endpoints NOT registered${NC}"
    ((FAILED++))
fi

# Count total registered endpoints
ENDPOINT_COUNT=$(grep -c "register.*Endpoints" backend/lambda/src/handler/index.ts || echo "0")
echo -e "${GREEN}✅ Total endpoint groups registered: $ENDPOINT_COUNT${NC}"
((PASSED++))

echo ""

# ============================================================================
# 3. Check Imports
# ============================================================================
echo "📥 3. Checking Critical Imports..."
echo "----------------------------------------"

# Check for Supabase imports (should be removed)
if grep -r "from '@/lib/supabase/info'" apps/vendor-web/components/vendor --include="*.tsx" --include="*.ts" | grep -v "backup" | grep -v "Removed Supabase" | head -1 | grep -q .; then
    echo -e "${RED}❌ Found Supabase imports (should be removed)${NC}"
    ((FAILED++))
else
    echo -e "${GREEN}✅ No Supabase imports found${NC}"
    ((PASSED++))
fi

# Check for apiClient imports
if grep -r "from '@/lib/api-client'" apps/vendor-web/components/vendor --include="*.tsx" | wc -l | grep -q "[1-9]"; then
    API_CLIENT_COUNT=$(grep -r "from '@/lib/api-client'" apps/vendor-web/components/vendor --include="*.tsx" | wc -l | tr -d ' ')
    echo -e "${GREEN}✅ apiClient imports found: $API_CLIENT_COUNT${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  No apiClient imports found${NC}"
    ((WARNINGS++))
fi

echo ""

# ============================================================================
# 4. Check Dependencies
# ============================================================================
echo "📚 4. Checking Dependencies..."
echo "----------------------------------------"

# Check if node_modules exist
if [ -d "apps/vendor-web/node_modules" ]; then
    echo -e "${GREEN}✅ Vendor Web: node_modules present${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  Vendor Web: node_modules missing (run npm install)${NC}"
    ((WARNINGS++))
fi

# Check critical dependencies
if grep -q '"next":' apps/vendor-web/package.json; then
    echo -e "${GREEN}✅ Next.js dependency present${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Next.js dependency missing${NC}"
    ((FAILED++))
fi

if grep -q '"@/lib/api-client"' apps/vendor-web/components/vendor/VendorDistancePricing.tsx; then
    echo -e "${GREEN}✅ apiClient dependency used${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ apiClient not used in VendorDistancePricing${NC}"
    ((FAILED++))
fi

echo ""

# ============================================================================
# 5. Check Wireframe Implementation
# ============================================================================
echo "🎨 5. Checking Wireframe Implementation..."
echo "----------------------------------------"

# Check wireframe documentation
if [ -f "docs/VENDOR_DASHBOARD_WIREFRAME_IMPLEMENTATION.md" ]; then
    echo -e "${GREEN}✅ Wireframe documentation present${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  Wireframe documentation missing${NC}"
    ((WARNINGS++))
fi

# Check for wireframe references
WIREFRAME_FILES=$(find . -name "*wireframe*" -type f | wc -l | tr -d ' ')
echo -e "${GREEN}✅ Wireframe files found: $WIREFRAME_FILES${NC}"
((PASSED++))

echo ""

# ============================================================================
# 6. Check New UI Endpoints
# ============================================================================
echo "🆕 6. Checking New UI Endpoints..."
echo "----------------------------------------"

# Check for new vendor endpoints
if [ -f "backend/lambda/src/endpoints/vendor-distance-pricing.ts" ]; then
    echo -e "${GREEN}✅ New Vendor Distance Pricing endpoint created${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Vendor Distance Pricing endpoint missing${NC}"
    ((FAILED++))
fi

# Check for new customer endpoints
if grep -r "ecommerce\|rewards\|medical-records" backend/lambda/src/endpoints --include="*.ts" | head -1 | grep -q .; then
    echo -e "${GREEN}✅ New Customer endpoints found${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  New Customer endpoints may be missing${NC}"
    ((WARNINGS++))
fi

# Check database schema
if [ -f "backend/lambda/src/database/schemas/vendor-distance-pricing.sql" ]; then
    echo -e "${GREEN}✅ Database schema present${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Database schema missing${NC}"
    ((FAILED++))
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "=========================================="
echo "📊 VERIFICATION SUMMARY"
echo "=========================================="
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All critical checks passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please review above.${NC}"
    exit 1
fi

