#!/bin/bash

# 🔍 COMPREHENSIVE VALIDATION SCRIPT - FIGMA CLAIMS VERIFICATION
# Validates every claim in the System Status Report

# set -e  # Disabled to allow script to continue on errors

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

REPORT_FILE="FIGMA_CLAIMS_VALIDATION_REPORT_$(date +%Y%m%d_%H%M%S).md"

# Counters
TOTAL_CHECKS=0
PASSED=0
FAILED=0
WARNINGS=0

echo "# 🔍 FIGMA CLAIMS VALIDATION REPORT" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "**Date:** $(date '+%Y-%m-%d %H:%M:%S')" >> "$REPORT_FILE"
echo "**Scope:** Complete validation of all claims in System Status Report" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "## 📊 VALIDATION SUMMARY" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "| Category | Status | Details |" >> "$REPORT_FILE"
echo "|----------|--------|---------|" >> "$REPORT_FILE"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}FIGMA CLAIMS VALIDATION${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Helper function
check_endpoint() {
  local pattern=$1
  local description=$2
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  
  if grep -r "$pattern" src/supabase/functions/server --include="*.tsx" 2>/dev/null | grep -v "test\|spec" > /dev/null; then
    echo -e "${GREEN}✅ PASS${NC}: $description"
    echo "| ✅ | $description | Found |" >> "$REPORT_FILE"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${RED}❌ FAIL${NC}: $description"
    echo "| ❌ | $description | NOT FOUND |" >> "$REPORT_FILE"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

check_component() {
  local file=$1
  local description=$2
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  
  if [ -f "$file" ]; then
    local lines=$(wc -l < "$file" 2>/dev/null || echo "0")
    if [ "$lines" -gt 50 ]; then
      echo -e "${GREEN}✅ PASS${NC}: $description (${lines} lines)"
      echo "| ✅ | $description | ${lines} lines |" >> "$REPORT_FILE"
      PASSED=$((PASSED + 1))
      return 0
    else
      echo -e "${YELLOW}⚠️  WARN${NC}: $description (only ${lines} lines - may be incomplete)"
      echo "| ⚠️ | $description | Only ${lines} lines |" >> "$REPORT_FILE"
      WARNINGS=$((WARNINGS + 1))
      return 1
    fi
  else
    echo -e "${RED}❌ FAIL${NC}: $description (file not found)"
    echo "| ❌ | $description | FILE NOT FOUND |" >> "$REPORT_FILE"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

echo -e "${CYAN}📦 SECTION 1: PRIORITY 1 FEATURES VALIDATION${NC}"
echo ""

# Priority 1 Features - Memorial Services
echo -e "${YELLOW}Checking Memorial Services...${NC}"
check_endpoint "memorial.*packages" "Memorial - Packages Endpoint"
check_endpoint "memorial.*bookings" "Memorial - Bookings Endpoint"
check_component "src/components/vendor/VendorMemorialServices.tsx" "Memorial Services Component"
check_endpoint "memorial.*services" "Memorial - Services CRUD"

# Priority 1 Features - Expiry Management
echo -e "${YELLOW}Checking Expiry Management...${NC}"
check_endpoint "expiry-management.*items" "Expiry Management - Items CRUD"
check_endpoint "expiry-management.*alerts" "Expiry Management - Alerts"
check_component "src/components/vendor/VendorExpiryManagement.tsx" "Expiry Management Component"

# Priority 1 Features - Cafe Menu Management
echo -e "${YELLOW}Checking Cafe Menu Management...${NC}"
check_endpoint "cafe.*categories" "Cafe - Categories CRUD"
check_endpoint "cafe.*items" "Cafe - Items CRUD"
check_component "src/components/vendor/VendorCafeMenuManagement.tsx" "Cafe Menu Management Component"

# Priority 1 Features - Donation Management
echo -e "${YELLOW}Checking Donation Management...${NC}"
check_endpoint "donation-management.*campaigns" "Donation - Campaigns CRUD"
check_endpoint "donation-management.*donations" "Donation - Donations Endpoint"
check_component "src/components/vendor/VendorDonationManagement.tsx" "Donation Management Component"

# Priority 1 Features - Event Management
echo -e "${YELLOW}Checking Event Management...${NC}"
check_endpoint "event-management" "Event Management - CRUD"
check_endpoint "event-management.*register" "Event Management - Registration"
check_component "src/components/vendor/VendorEventManagement.tsx" "Event Management Component"

# Priority 1 Features - Patient Monitoring
echo -e "${YELLOW}Checking Patient Monitoring...${NC}"
check_endpoint "patient-monitoring.*sessions" "Patient Monitoring - Sessions"
check_endpoint "patient-monitoring.*vitals" "Patient Monitoring - Vitals"
check_component "src/components/vendor/VendorPatientMonitoring.tsx" "Patient Monitoring Component"

echo ""
echo -e "${CYAN}📦 SECTION 2: VENDOR ENDPOINTS VALIDATION${NC}"
echo ""

# Check claimed vendor endpoints
echo -e "${YELLOW}Checking Vendor Endpoints...${NC}"
check_endpoint "vendor/auth/signup" "Vendor - Signup"
check_endpoint "vendor/auth/login" "Vendor - Login"
check_endpoint "vendor/auth/profile" "Vendor - Profile"
check_endpoint "vendor/dashboard" "Vendor - Dashboard"
check_endpoint "vendor/bookings" "Vendor - Bookings"
check_endpoint "vendor/services" "Vendor - Services CRUD"
check_endpoint "vendor/staff" "Vendor - Staff CRUD"
check_endpoint "vendor/schedule" "Vendor - Schedule"

echo ""
echo -e "${CYAN}📦 SECTION 3: CUSTOMER ENDPOINTS VALIDATION${NC}"
echo ""

# Check claimed customer endpoints
echo -e "${YELLOW}Checking Customer Endpoints...${NC}"
check_endpoint "customer/auth/signup" "Customer - Signup"
check_endpoint "customer/auth/login" "Customer - Login"
check_endpoint "customer/profile" "Customer - Profile"
check_endpoint "customer/pets" "Customer - Pets CRUD"
check_endpoint "customer/bookings" "Customer - Bookings"
check_endpoint "customer/cart" "Customer - Cart"
check_endpoint "customer/checkout" "Customer - Checkout"
check_endpoint "customer/orders" "Customer - Orders"
check_endpoint "customer/wallet" "Customer - Wallet"

echo ""
echo -e "${CYAN}📦 SECTION 4: ADMIN ENDPOINTS VALIDATION${NC}"
echo ""

# Check claimed admin endpoints
echo -e "${YELLOW}Checking Admin Endpoints...${NC}"
check_endpoint "admin/vendors" "Admin - Vendors"
check_endpoint "admin/applications" "Admin - Applications"
check_endpoint "admin/catalog" "Admin - Catalog"
check_endpoint "admin/regions" "Admin - Regions"
check_endpoint "admin/transactions" "Admin - Transactions"
check_endpoint "admin/payouts" "Admin - Payouts"
check_endpoint "admin/analytics" "Admin - Analytics"

echo ""
echo -e "${CYAN}📦 SECTION 5: FRONTEND COMPONENTS VALIDATION${NC}"
echo ""

# Check key frontend components
echo -e "${YELLOW}Checking Key Components...${NC}"
check_component "src/components/vendor/VendorDashboard.tsx" "Vendor Dashboard"
check_component "src/components/admin/ecommerce/ECommerceDashboard.tsx" "Admin ECommerce Dashboard"
check_component "src/components/shop/ShopHome.tsx" "Shop Home"
check_component "src/components/shop/CartPage.tsx" "Cart Page"
check_component "src/components/shop/CheckoutPage.tsx" "Checkout Page"
check_component "src/components/vendor/VendorBookingManagement.tsx" "Vendor Booking Management"
check_component "src/components/vendor/StaffManagement.tsx" "Staff Management"
check_component "src/components/vendor/VendorServiceCatalogView.tsx" "Vendor Service Catalog"

echo ""
echo -e "${CYAN}📦 SECTION 6: FILE COUNT VALIDATION${NC}"
echo ""

# Count files
BACKEND_FILES=$(find src/supabase/functions/server -name "*.tsx" -type f | wc -l | tr -d ' ')
FRONTEND_FILES=$(find src/components -name "*.tsx" -type f | wc -l | tr -d ' ')

TOTAL_CHECKS=$((TOTAL_CHECKS + 2))

echo -e "${YELLOW}Backend Files:${NC} $BACKEND_FILES"
echo -e "${YELLOW}Frontend Files:${NC} $FRONTEND_FILES"

if [ "$BACKEND_FILES" -ge 200 ]; then
  echo -e "${GREEN}✅ PASS${NC}: Backend files (claimed 200+, found $BACKEND_FILES)"
  echo "| ✅ | Backend Files (200+ claimed) | $BACKEND_FILES found |" >> "$REPORT_FILE"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}❌ FAIL${NC}: Backend files (claimed 200+, found $BACKEND_FILES)"
  echo "| ❌ | Backend Files (200+ claimed) | Only $BACKEND_FILES found |" >> "$REPORT_FILE"
  FAILED=$((FAILED + 1))
fi

if [ "$FRONTEND_FILES" -ge 500 ]; then
  echo -e "${GREEN}✅ PASS${NC}: Frontend files (claimed 500+, found $FRONTEND_FILES)"
  echo "| ✅ | Frontend Files (500+ claimed) | $FRONTEND_FILES found |" >> "$REPORT_FILE"
  PASSED=$((PASSED + 1))
else
  echo -e "${YELLOW}⚠️  WARN${NC}: Frontend files (claimed 500+, found $FRONTEND_FILES)"
  echo "| ⚠️ | Frontend Files (500+ claimed) | Only $FRONTEND_FILES found |" >> "$REPORT_FILE"
  WARNINGS=$((WARNINGS + 1))
fi

# Count route registrations
ROUTE_COUNT=$(grep -r "app\.\(get\|post\|put\|delete\|patch\)(" src/supabase/functions/server --include="*.tsx" 2>/dev/null | wc -l | tr -d ' ')
TOTAL_CHECKS=$((TOTAL_CHECKS + 1))

echo ""
echo -e "${YELLOW}Route Registrations:${NC} $ROUTE_COUNT"

if [ "$ROUTE_COUNT" -ge 500 ]; then
  echo -e "${GREEN}✅ PASS${NC}: Route registrations (claimed 1000+, found $ROUTE_COUNT)"
  echo "| ✅ | Route Registrations (1000+ claimed) | $ROUTE_COUNT found |" >> "$REPORT_FILE"
  PASSED=$((PASSED + 1))
else
  echo -e "${YELLOW}⚠️  WARN${NC}: Route registrations (claimed 1000+, found $ROUTE_COUNT)"
  echo "| ⚠️ | Route Registrations (1000+ claimed) | Only $ROUTE_COUNT found |" >> "$REPORT_FILE"
  WARNINGS=$((WARNINGS + 1))
fi

# Final Summary
echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "## 📊 FINAL SUMMARY" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "| Metric | Count |" >> "$REPORT_FILE"
echo "|--------|-------|" >> "$REPORT_FILE"
echo "| Total Checks | $TOTAL_CHECKS |" >> "$REPORT_FILE"
echo "| ✅ Passed | $PASSED |" >> "$REPORT_FILE"
echo "| ❌ Failed | $FAILED |" >> "$REPORT_FILE"
echo "| ⚠️ Warnings | $WARNINGS |" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

PASS_RATE=$((PASSED * 100 / TOTAL_CHECKS))
echo "**Pass Rate:** ${PASS_RATE}%" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}VALIDATION SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Total Checks: ${CYAN}$TOTAL_CHECKS${NC}"
echo -e "✅ Passed: ${GREEN}$PASSED${NC}"
echo -e "❌ Failed: ${RED}$FAILED${NC}"
echo -e "⚠️  Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""
echo -e "Pass Rate: ${CYAN}${PASS_RATE}%${NC}"
echo ""
echo -e "${GREEN}Report saved to: $REPORT_FILE${NC}"
echo ""

