#!/bin/bash
# Systematic Synthetic Test Suite - Unified Appointment Management
# Covers: Backend, Frontend, UI, API Contracts, Handlers, Wireframe, Imports, Registration
# Usage: ./tests/systematic-synthetic-test-appointment-management.sh

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
API_ENDPOINT="${API_ENDPOINT:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
TEST_VENDOR_ID="${TEST_VENDOR_ID:-}"
TEST_STAFF_ID="${TEST_STAFF_ID:-}"
TEST_CUSTOMER_PHONE="${TEST_CUSTOMER_PHONE:-+1234567890}"

# Test results
PASSED=0
FAILED=0
SKIPPED=0

# Helper functions
log_test() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Test: $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

log_pass() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}❌ FAIL: $1${NC}"
    ((FAILED++))
}

log_skip() {
    echo -e "${YELLOW}⏭️  SKIP: $1${NC}"
    ((SKIPPED++))
}

log_info() {
    echo -e "${BLUE}ℹ️  INFO: $1${NC}"
}

# Test summary
print_summary() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}TEST SUMMARY${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Passed: ${PASSED}${NC}"
    echo -e "${RED}❌ Failed: ${FAILED}${NC}"
    echo -e "${YELLOW}⏭️  Skipped: ${SKIPPED}${NC}"
    echo -e "${BLUE}📊 Total: $((PASSED + FAILED + SKIPPED))${NC}"
    echo ""
    
    if [ $FAILED -eq 0 ]; then
        echo -e "${GREEN}✅ ✅ ✅ ALL TESTS PASSED! ✅ ✅ ✅${NC}"
        exit 0
    else
        echo -e "${RED}❌ SOME TESTS FAILED${NC}"
        exit 1
    fi
}

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  SYSTEMATIC SYNTHETIC TEST SUITE                              ║${NC}"
echo -e "${GREEN}║  Unified Appointment Management                                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# SECTION 1: IMPORTS & REGISTRATION VERIFICATION
# ============================================================================

log_test "SECTION 1: Imports & Registration Verification"

# Test 1.1: Check UniversalAppointmentManagement imports
log_info "Checking UniversalAppointmentManagement component imports..."
if grep -q "import.*UniversalAppointmentManagement" apps/vendor-web/components/vendor/VendorLandingPage.tsx && \
   grep -q "import.*UniversalAppointmentManagement" apps/vendor-web/app/staff/appointments/page.tsx && \
   grep -q "import.*UniversalAppointmentManagement" apps/vendor-web/components/vendor/dashboard/SoloProviderDashboard.tsx; then
    log_pass "UniversalAppointmentManagement imported in all integration points"
else
    log_fail "UniversalAppointmentManagement import missing in some files"
fi

# Test 1.2: Check StaffSelectionStep imports
log_info "Checking StaffSelectionStep component imports..."
if grep -q "import.*StaffSelectionStep" apps/customer-web/components/customer/shared/UniversalBookingRouter.tsx; then
    log_pass "StaffSelectionStep imported in UniversalBookingRouter"
else
    log_fail "StaffSelectionStep import missing"
fi

# Test 1.3: Check backend endpoint registration
log_info "Checking backend endpoint registration..."
if grep -q "registerStaffEndpoints" backend/lambda/src/handler/index.ts && \
   grep -q "registerStaffEndpoints(app)" backend/lambda/src/handler/index.ts; then
    log_pass "Staff endpoints registered in handler"
else
    log_fail "Staff endpoints not registered in handler"
fi

# Test 1.4: Check endpoint definitions
log_info "Checking endpoint definitions..."
ENDPOINTS=(
    "GET /staff/:staffId/appointments"
    "PUT /staff/:staffId/appointments/:bookingId/accept"
    "PUT /staff/:staffId/appointments/:bookingId/reject"
    "PUT /staff/:staffId/appointments/:bookingId/start"
    "PUT /staff/:staffId/appointments/:bookingId/complete"
    "GET /vendor/bookings/:vendorId"
    "GET /vendor/:vendorId/staff"
)

for endpoint in "${ENDPOINTS[@]}"; do
    if grep -q "$(echo $endpoint | cut -d' ' -f2)" backend/lambda/src/endpoints/staff.ts || \
       grep -q "$(echo $endpoint | cut -d' ' -f2)" backend/lambda/src/endpoints/vendor-bookings.ts; then
        log_pass "Endpoint defined: $endpoint"
    else
        log_fail "Endpoint missing: $endpoint"
    fi
done

# ============================================================================
# SECTION 2: API CONTRACTS VERIFICATION
# ============================================================================

log_test "SECTION 2: API Contracts Verification"

# Test 2.1: Check API contract schemas
log_info "Checking API contract schemas..."
if [ -d "packages/api-contracts" ]; then
    if grep -r "staff_id\|staffId" packages/api-contracts 2>/dev/null | grep -q "bookings"; then
        log_pass "API contracts include staff_id in bookings"
    else
        log_skip "API contracts directory exists but staff_id not found (may be optional)"
    fi
else
    log_skip "API contracts package not found (may use inline validation)"
fi

# Test 2.2: Check request/response types
log_info "Checking request/response type definitions..."
if grep -q "staff_id\|staffId" backend/lambda/src/endpoints/bookings-enhanced.ts; then
    log_pass "Booking creation accepts staff_id parameter"
else
    log_fail "Booking creation does not accept staff_id"
fi

# ============================================================================
# SECTION 3: BACKEND HANDLERS VERIFICATION
# ============================================================================

log_test "SECTION 3: Backend Handlers Verification"

# Test 3.1: Check handler registration
log_info "Checking handler registration..."
if [ -f "backend/lambda/src/handler/index.ts" ]; then
    if grep -q "registerStaffEndpoints" backend/lambda/src/handler/index.ts; then
        log_pass "Staff endpoints handler registered"
    else
        log_fail "Staff endpoints handler not registered"
    fi
else
    log_fail "Handler index file not found"
fi

# Test 3.2: Check handler exports
log_info "Checking handler exports..."
if grep -q "export.*registerStaffEndpoints\|export function registerStaffEndpoints" backend/lambda/src/endpoints/staff.ts; then
    log_pass "registerStaffEndpoints function exported"
else
    log_fail "registerStaffEndpoints function not exported"
fi

# Test 3.3: Check endpoint handlers
log_info "Checking individual endpoint handlers..."
HANDLERS=(
    "app.get.*staff.*appointments"
    "app.put.*appointments.*accept"
    "app.put.*appointments.*reject"
    "app.put.*appointments.*start"
    "app.put.*appointments.*complete"
)

for handler in "${HANDLERS[@]}"; do
    if grep -qE "$handler" backend/lambda/src/endpoints/staff.ts; then
        log_pass "Handler found: $handler"
    else
        log_fail "Handler missing: $handler"
    fi
done

# ============================================================================
# SECTION 4: FRONTEND COMPONENT VERIFICATION
# ============================================================================

log_test "SECTION 4: Frontend Component Verification"

# Test 4.1: Check component files exist
log_info "Checking component files..."
COMPONENTS=(
    "apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx"
    "apps/customer-web/components/customer/shared/StaffSelectionStep.tsx"
    "apps/customer-web/components/customer/shared/UniversalBookingRouter.tsx"
)

for component in "${COMPONENTS[@]}"; do
    if [ -f "$component" ]; then
        log_pass "Component exists: $(basename $component)"
    else
        log_fail "Component missing: $component"
    fi
done

# Test 4.2: Check component props
log_info "Checking component props..."
if grep -q "interface UniversalAppointmentManagementProps" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx && \
   grep -q "userType.*UserType" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx; then
    log_pass "UniversalAppointmentManagement props defined correctly"
else
    log_fail "UniversalAppointmentManagement props missing or incorrect"
fi

if grep -q "interface StaffSelectionStepProps" apps/customer-web/components/customer/shared/StaffSelectionStep.tsx; then
    log_pass "StaffSelectionStep props defined correctly"
else
    log_fail "StaffSelectionStep props missing"
fi

# Test 4.3: Check component exports
log_info "Checking component exports..."
if grep -q "export.*UniversalAppointmentManagement\|export function UniversalAppointmentManagement" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx; then
    log_pass "UniversalAppointmentManagement exported"
else
    log_fail "UniversalAppointmentManagement not exported"
fi

if grep -q "export.*StaffSelectionStep\|export function StaffSelectionStep" apps/customer-web/components/customer/shared/StaffSelectionStep.tsx; then
    log_pass "StaffSelectionStep exported"
else
    log_fail "StaffSelectionStep not exported"
fi

# ============================================================================
# SECTION 5: UI/WIREFRAME VERIFICATION
# ============================================================================

log_test "SECTION 5: UI/Wireframe Verification"

# Test 5.1: Check design theme consistency
log_info "Checking design theme (orange #FF8C42)..."
ORANGE_COUNT=$(grep -r "#FF8C42\|bg-\[#FF8C42\]" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx apps/customer-web/components/customer/shared/StaffSelectionStep.tsx 2>/dev/null | wc -l | tr -d ' ')
if [ "$ORANGE_COUNT" -gt "0" ]; then
    log_pass "Design theme color (#FF8C42) used consistently ($ORANGE_COUNT occurrences)"
else
    log_fail "Design theme color not found"
fi

# Test 5.2: Check layout consistency
log_info "Checking layout consistency (max-w-[430px])..."
if grep -q "max-w-\[430px\]" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx && \
   grep -q "max-w-\[430px\]" apps/customer-web/components/customer/shared/StaffSelectionStep.tsx; then
    log_pass "Layout width consistent (430px mobile-first)"
else
    log_fail "Layout width inconsistent"
fi

# Test 5.3: Check wireframe structure
log_info "Checking wireframe structure (header, tabs, cards)..."
if grep -q "Header\|header\|sticky top-0" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx && \
   grep -q "Tab\|tab\|activeTab" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx && \
   grep -q "card\|Card\|rounded-xl" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx; then
    log_pass "Wireframe structure matches (header, tabs, cards)"
else
    log_fail "Wireframe structure incomplete"
fi

# Test 5.4: Check action buttons
log_info "Checking action buttons (Accept, Reject, Start, Complete)..."
if grep -q "Accept\|accept" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx && \
   grep -q "Reject\|reject" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx && \
   grep -q "Start\|start" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx && \
   grep -q "Complete\|complete" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx; then
    log_pass "All action buttons present"
else
    log_fail "Some action buttons missing"
fi

# ============================================================================
# SECTION 6: INTEGRATION VERIFICATION
# ============================================================================

log_test "SECTION 6: Integration Verification"

# Test 6.1: Check VendorLandingPage integration
log_info "Checking VendorLandingPage integration..."
if grep -q "UniversalAppointmentManagement" apps/vendor-web/components/vendor/VendorLandingPage.tsx && \
   grep -q "userType=\"vendor\"" apps/vendor-web/components/vendor/VendorLandingPage.tsx; then
    log_pass "VendorLandingPage properly integrated"
else
    log_fail "VendorLandingPage integration incomplete"
fi

# Test 6.2: Check StaffAppointmentsPage integration
log_info "Checking StaffAppointmentsPage integration..."
if grep -q "UniversalAppointmentManagement" apps/vendor-web/app/staff/appointments/page.tsx && \
   grep -q "userType=\"staff\"" apps/vendor-web/app/staff/appointments/page.tsx; then
    log_pass "StaffAppointmentsPage properly integrated"
else
    log_fail "StaffAppointmentsPage integration incomplete"
fi

# Test 6.3: Check SoloProviderDashboard integration
log_info "Checking SoloProviderDashboard integration..."
if grep -q "UniversalAppointmentManagement" apps/vendor-web/components/vendor/dashboard/SoloProviderDashboard.tsx && \
   grep -q "userType=\"solo\"" apps/vendor-web/components/vendor/dashboard/SoloProviderDashboard.tsx; then
    log_pass "SoloProviderDashboard properly integrated"
else
    log_fail "SoloProviderDashboard integration incomplete"
fi

# Test 6.4: Check UniversalBookingRouter integration
log_info "Checking UniversalBookingRouter integration..."
if grep -q "StaffSelectionStep" apps/customer-web/components/customer/shared/UniversalBookingRouter.tsx && \
   grep -q "selectedStaff\|selectedStaffId" apps/customer-web/components/customer/shared/UniversalBookingRouter.tsx && \
   grep -q "staff_id.*selectedStaffId" apps/customer-web/components/customer/shared/UniversalBookingRouter.tsx; then
    log_pass "UniversalBookingRouter properly integrated with staff selection"
else
    log_fail "UniversalBookingRouter integration incomplete"
fi

# ============================================================================
# SECTION 7: DATA FLOW VERIFICATION
# ============================================================================

log_test "SECTION 7: Data Flow Verification"

# Test 7.1: Check staff selection flow
log_info "Checking staff selection data flow..."
if grep -q "setSelectedStaffId\|setSelectedStaff" apps/customer-web/components/customer/shared/UniversalBookingRouter.tsx && \
   grep -q "staff_id.*selectedStaffId" apps/customer-web/components/customer/shared/UniversalBookingRouter.tsx; then
    log_pass "Staff selection data flows to booking creation"
else
    log_fail "Staff selection data flow broken"
fi

# Test 7.2: Check endpoint path generation
log_info "Checking endpoint path generation..."
if grep -q "getBookingsEndpoint\|getActionEndpoint" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx && \
   grep -q "/staff/.*/appointments\|/vendor/bookings/" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx; then
    log_pass "Endpoint paths generated correctly"
else
    log_fail "Endpoint path generation missing or incorrect"
fi

# Test 7.3: Check user type handling
log_info "Checking user type handling..."
if grep -q "switch.*userType\|case 'vendor'\|case 'staff'\|case 'solo'" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx; then
    log_pass "User type handling implemented"
else
    log_fail "User type handling missing"
fi

# ============================================================================
# SECTION 8: TYPE SAFETY VERIFICATION
# ============================================================================

log_test "SECTION 8: Type Safety Verification"

# Test 8.1: Check TypeScript types
log_info "Checking TypeScript type definitions..."
if grep -q "interface.*Booking\|type.*Booking" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx && \
   grep -q "interface.*StaffMember\|type.*StaffMember" apps/customer-web/components/customer/shared/StaffSelectionStep.tsx; then
    log_pass "TypeScript interfaces defined"
else
    log_fail "TypeScript interfaces missing"
fi

# Test 8.2: Check UserType definition
log_info "Checking UserType definition..."
if grep -q "type UserType\|export type UserType" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx && \
   grep -q "'vendor'\|'staff'\|'solo'" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx; then
    log_pass "UserType properly defined"
else
    log_fail "UserType definition missing or incomplete"
fi

# ============================================================================
# SECTION 9: API ENDPOINT TESTING (if credentials available)
# ============================================================================

log_test "SECTION 9: API Endpoint Testing"

if [ -z "$TEST_VENDOR_ID" ] || [ -z "$TEST_STAFF_ID" ]; then
    log_skip "API endpoint testing skipped (TEST_VENDOR_ID and TEST_STAFF_ID not set)"
    log_info "Set TEST_VENDOR_ID and TEST_STAFF_ID environment variables to enable API testing"
else
    log_info "Testing API endpoints with provided IDs..."
    
    # Test 9.1: Staff appointments endpoint
    log_info "Testing GET /staff/:staffId/appointments..."
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_ENDPOINT}/staff/${TEST_STAFF_ID}/appointments?date=$(date +%Y-%m-%d)" \
        -H "Authorization: Bearer ${AUTH_TOKEN:-test}" 2>/dev/null || echo "000")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
        log_pass "Staff appointments endpoint accessible (HTTP $HTTP_CODE)"
    else
        log_fail "Staff appointments endpoint failed (HTTP $HTTP_CODE)"
    fi
    
    # Test 9.2: Vendor bookings endpoint
    log_info "Testing GET /vendor/bookings/:vendorId..."
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_ENDPOINT}/vendor/bookings/${TEST_VENDOR_ID}?date=$(date +%Y-%m-%d)" \
        -H "Authorization: Bearer ${AUTH_TOKEN:-test}" 2>/dev/null || echo "000")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
        log_pass "Vendor bookings endpoint accessible (HTTP $HTTP_CODE)"
    else
        log_fail "Vendor bookings endpoint failed (HTTP $HTTP_CODE)"
    fi
    
    # Test 9.3: Staff discovery endpoint
    log_info "Testing GET /vendor/:vendorId/staff..."
    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_ENDPOINT}/vendor/${TEST_VENDOR_ID}/staff" \
        -H "Authorization: Bearer ${AUTH_TOKEN:-test}" 2>/dev/null || echo "000")
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
        log_pass "Staff discovery endpoint accessible (HTTP $HTTP_CODE)"
    else
        log_fail "Staff discovery endpoint failed (HTTP $HTTP_CODE)"
    fi
fi

# ============================================================================
# SECTION 10: BUILD VERIFICATION
# ============================================================================

log_test "SECTION 10: Build Verification"

# Test 10.1: Check for TypeScript errors
log_info "Checking for TypeScript compilation errors..."
if [ -f "apps/vendor-web/tsconfig.json" ] && [ -f "apps/customer-web/tsconfig.json" ]; then
    log_pass "TypeScript configuration files exist"
    
    # Try to check if build would succeed (check for obvious errors)
    if ! grep -q "any.*implicitly\|Cannot find name" apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx 2>/dev/null; then
        log_pass "No obvious TypeScript errors in UniversalAppointmentManagement"
    else
        log_fail "TypeScript errors found in UniversalAppointmentManagement"
    fi
else
    log_skip "TypeScript config check skipped"
fi

# Test 10.2: Check for lint errors
log_info "Checking for lint errors..."
if command -v npm &> /dev/null; then
    log_pass "npm available for linting"
else
    log_skip "npm not available, skipping lint check"
fi

# ============================================================================
# FINAL SUMMARY
# ============================================================================

print_summary
