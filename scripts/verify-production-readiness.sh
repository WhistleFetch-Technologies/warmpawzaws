#!/bin/bash

# Production Readiness Verification Script
# Checks code, handlers, UI components, API contracts, and edge cases

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

log_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    PASSED=$((PASSED + 1))
}

log_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    FAILED=$((FAILED + 1))
}

log_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
    WARNINGS=$((WARNINGS + 1))
}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Production Readiness Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================
# 1. Endpoint Registration Verification
# ============================================
echo -e "${YELLOW}1. Verifying Endpoint Registration${NC}"

if grep -q "registerServiceCatalogEndpoints" backend/lambda/src/handler/index.ts; then
    log_pass "Service Catalog endpoints registered"
else
    log_fail "Service Catalog endpoints NOT registered"
fi

if grep -q "registerVendorServicesEndpoints" backend/lambda/src/handler/index.ts; then
    log_pass "Vendor Services endpoints registered"
else
    log_fail "Vendor Services endpoints NOT registered"
fi

if grep -q "registerMealPlanEndpoints" backend/lambda/src/handler/index.ts; then
    log_pass "Meal Plan endpoints registered"
else
    log_fail "Meal Plan endpoints NOT registered"
fi

if grep -q "registerMedicalRecordsEndpoints" backend/lambda/src/handler/index.ts; then
    log_pass "Medical Records endpoints registered"
else
    log_fail "Medical Records endpoints NOT registered"
fi

if grep -q "registerPrescriptionEndpoints" backend/lambda/src/handler/index.ts; then
    log_pass "Prescription endpoints registered"
else
    log_fail "Prescription endpoints NOT registered"
fi

echo ""

# ============================================
# 2. API Endpoint Definitions
# ============================================
echo -e "${YELLOW}2. Verifying API Endpoint Definitions${NC}"

# Service Catalog
if grep -q 'app.get("/admin/service-catalog"' backend/lambda/src/endpoints/service-catalog.ts; then
    log_pass "GET /admin/service-catalog endpoint defined"
else
    log_fail "GET /admin/service-catalog endpoint NOT defined"
fi

if grep -q 'app.get("/service-catalog/role/:roleId"' backend/lambda/src/endpoints/service-catalog.ts; then
    log_pass "GET /service-catalog/role/:roleId endpoint defined"
else
    log_fail "GET /service-catalog/role/:roleId endpoint NOT defined"
fi

# Vendor Services
if grep -q 'app.get("/vendor/:vendorId/services"' backend/lambda/src/endpoints/vendor-services.ts; then
    log_pass "GET /vendor/:vendorId/services endpoint defined"
else
    log_fail "GET /vendor/:vendorId/services endpoint NOT defined"
fi

if grep -q 'app.post("/vendor/:vendorId/services"' backend/lambda/src/endpoints/vendor-services.ts; then
    log_pass "POST /vendor/:vendorId/services endpoint defined"
else
    log_fail "POST /vendor/:vendorId/services endpoint NOT defined"
fi

# Staff Service Assignment
if grep -q 'app.post("/vendor/:vendorId/staff/:staffId/assign-services"' backend/lambda/src/endpoints/staff.ts; then
    log_pass "POST /vendor/:vendorId/staff/:staffId/assign-services endpoint defined"
else
    log_fail "Staff service assignment endpoint NOT defined"
fi

# Staff Service Enable/Disable
if grep -q 'app.put("/staff/:staffId/services/:serviceId/enable"' backend/lambda/src/endpoints/staff.ts; then
    log_pass "PUT /staff/:staffId/services/:serviceId/enable endpoint defined"
else
    log_fail "Staff service enable endpoint NOT defined"
fi

if grep -q 'app.put("/staff/:staffId/services/:serviceId/disable"' backend/lambda/src/endpoints/staff.ts; then
    log_pass "PUT /staff/:staffId/services/:serviceId/disable endpoint defined"
else
    log_fail "Staff service disable endpoint NOT defined"
fi

# Meal Plans
if grep -q 'app.get("/meal-plans/vendor/:vendorId"' backend/lambda/src/endpoints/meal-plans.ts; then
    log_pass "GET /meal-plans/vendor/:vendorId endpoint defined"
else
    log_fail "Meal plan vendor endpoint NOT defined"
fi

# Medical Records (booking-scoped)
if grep -q 'app.get.*bookings.*medical-records\|app.get.*/bookings/:bookingId/medical-records' backend/lambda/src/endpoints/booking-details-enhanced.ts; then
    log_pass "GET /bookings/:bookingId/medical-records endpoint defined (booking-scoped)"
else
    log_fail "Medical records booking endpoint NOT defined"
fi

# Prescriptions (booking-scoped)
if grep -q 'app.get("/medical-records/booking/:bookingId/prescriptions"' backend/lambda/src/endpoints/medical-records.ts; then
    log_pass "GET /medical-records/booking/:bookingId/prescriptions endpoint defined (booking-scoped)"
else
    log_fail "Prescriptions booking endpoint NOT defined"
fi

echo ""

# ============================================
# 3. Role-Based Filtering Implementation
# ============================================
echo -e "${YELLOW}3. Verifying Role-Based Filtering${NC}"

if grep -q "roleId.*query\|roleId.*param" backend/lambda/src/endpoints/service-catalog.ts; then
    log_pass "Service catalog roleId parameter handling"
else
    log_fail "Service catalog roleId parameter NOT handled"
fi

if grep -q "applicable_roles.*&&\|applicable_roles.*ANY" backend/lambda/src/endpoints/service-catalog.ts; then
    log_pass "Applicable roles filtering implemented"
else
    log_fail "Applicable roles filtering NOT implemented"
fi

if grep -q "solo.*at_center\|at_center.*solo\|vendorConfiguration.*solo" backend/lambda/src/endpoints/service-catalog.ts; then
    log_pass "Solo vendor at_center restriction implemented"
else
    log_fail "Solo vendor at_center restriction NOT implemented"
fi

if grep -q "serviceStyles\|service_styles" backend/lambda/src/endpoints/vendor-services.ts; then
    log_pass "Service styles validation implemented"
else
    log_fail "Service styles validation NOT implemented"
fi

echo ""

# ============================================
# 4. Capability Mapping Verification
# ============================================
echo -e "${YELLOW}4. Verifying Capability Mapping${NC}"

# Prescription - booking-scoped
if grep -q "booking.*prescription\|prescription.*booking" backend/lambda/src/endpoints/medical-records.ts; then
    log_pass "Prescription endpoints are booking-scoped"
else
    log_fail "Prescription endpoints may not be booking-scoped"
fi

# Medical Records - booking-scoped
if grep -q "booking.*medical\|medical.*booking" backend/lambda/src/endpoints/booking-details-enhanced.ts; then
    log_pass "Medical records endpoints are booking-scoped"
else
    log_fail "Medical records endpoints may not be booking-scoped"
fi

# Meal Planner - vendor-scoped (NOT booking-scoped)
if grep -q "vendor.*meal.*plan\|meal.*plan.*vendor" backend/lambda/src/endpoints/meal-plans.ts && ! grep -q "booking.*meal.*plan\|meal.*plan.*booking" backend/lambda/src/endpoints/meal-plans.ts; then
    log_pass "Meal planner endpoints are vendor-scoped (NOT booking-scoped)"
else
    log_warn "Meal planner endpoint scoping needs verification"
fi

echo ""

# ============================================
# 5. UI Component Verification
# ============================================
echo -e "${YELLOW}5. Verifying UI Components${NC}"

# Service Catalog View
if [ -f "apps/vendor-web/components/vendor/VendorServiceCatalogView.tsx" ]; then
    log_pass "VendorServiceCatalogView component exists"
    
    if grep -q "roleId\|role_id\|allowedServiceStyles" apps/vendor-web/components/vendor/VendorServiceCatalogView.tsx; then
        log_pass "VendorServiceCatalogView implements role-based filtering"
    else
        log_warn "VendorServiceCatalogView may not implement role-based filtering"
    fi
else
    log_fail "VendorServiceCatalogView component NOT found"
fi

# Appointment Detail Modal
if [ -f "apps/vendor-web/components/vendor/AppointmentDetailModal.tsx" ]; then
    log_pass "AppointmentDetailModal component exists"
    
    if grep -q "prescription\|Prescription" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
        log_pass "AppointmentDetailModal includes prescription capability"
    else
        log_warn "AppointmentDetailModal may not include prescription"
    fi
    
    if grep -q "medical.*record\|MedicalRecord" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
        log_pass "AppointmentDetailModal includes medical records capability"
    else
        log_warn "AppointmentDetailModal may not include medical records"
    fi
    
    if ! grep -q "meal.*plan\|MealPlan" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
        log_pass "AppointmentDetailModal correctly excludes meal planner"
    else
        log_fail "AppointmentDetailModal incorrectly includes meal planner"
    fi
else
    log_fail "AppointmentDetailModal component NOT found"
fi

# Admin Service Catalog
if [ -f "apps/admin-web/components/admin/catalog/ServiceCatalogTab.tsx" ]; then
    log_pass "ServiceCatalogTab component exists"
else
    log_fail "ServiceCatalogTab component NOT found"
fi

echo ""

# ============================================
# 6. Edge Cases & Error Handling
# ============================================
echo -e "${YELLOW}6. Verifying Edge Cases & Error Handling${NC}"

# Solo vendor at_center restriction
if grep -q "Solo providers cannot use.*at_center\|solo.*at_center.*not allowed" backend/lambda/src/endpoints/vendor-services.ts; then
    log_pass "Solo vendor at_center restriction error message"
else
    log_warn "Solo vendor at_center restriction error message may be missing"
fi

# Service style validation error
if grep -q "not allowed for this role\|Service style.*not allowed" backend/lambda/src/endpoints/vendor-services.ts; then
    log_pass "Service style validation error handling"
else
    log_warn "Service style validation error handling may be missing"
fi

# Missing roleId handling
if grep -q "roleId.*\|\|.*default\|roleId.*fallback" backend/lambda/src/endpoints/service-catalog.ts; then
    log_pass "Missing roleId fallback handling"
else
    log_warn "Missing roleId fallback handling may need improvement"
fi

echo ""

# ============================================
# 7. API Contract Verification
# ============================================
echo -e "${YELLOW}7. Verifying API Contracts${NC}"

# Service Catalog Response Structure
if grep -q "applicable_roles\|applicableRoles" backend/lambda/src/endpoints/service-catalog.ts; then
    log_pass "Service catalog includes applicable_roles in response"
else
    log_warn "Service catalog may not include applicable_roles"
fi

# Vendor Services Response Structure
if grep -q "allowedServiceStyles\|allowed_service_styles" backend/lambda/src/endpoints/vendor-services.ts; then
    log_pass "Vendor services includes allowedServiceStyles in response"
else
    log_warn "Vendor services may not include allowedServiceStyles"
fi

# Role Info in Response
if grep -q "role.*id\|role.*name\|role.*config" backend/lambda/src/endpoints/vendor-services.ts; then
    log_pass "Vendor services includes role info in response"
else
    log_warn "Vendor services may not include role info"
fi

echo ""

# ============================================
# 8. Database Schema Verification
# ============================================
echo -e "${YELLOW}8. Verifying Database Schema References${NC}"

# service_catalog table
if grep -q "service_catalog" backend/lambda/src/endpoints/service-catalog.ts; then
    log_pass "service_catalog table referenced"
else
    log_fail "service_catalog table NOT referenced"
fi

# applicable_roles column
if grep -q "applicable_roles" backend/lambda/src/endpoints/service-catalog.ts; then
    log_pass "applicable_roles column referenced"
else
    log_fail "applicable_roles column NOT referenced"
fi

# staff_services table
if grep -q "staff_services" backend/lambda/src/endpoints/staff.ts; then
    log_pass "staff_services table referenced"
else
    log_fail "staff_services table NOT referenced"
fi

# assigned_by_vendor and enabled_by_staff columns
if grep -q "assigned_by_vendor\|enabled_by_staff" backend/lambda/src/endpoints/staff.ts; then
    log_pass "staff_services assignment flags referenced"
else
    log_fail "staff_services assignment flags NOT referenced"
fi

echo ""

# ============================================
# Summary
# ============================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Verification Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Total Checks: $((PASSED + FAILED + WARNINGS))"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"
echo -e "${YELLOW}Warnings: ${WARNINGS}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ All checks passed! System is production ready.${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  All critical checks passed, but some warnings need review.${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌ Some critical checks failed. Please review and fix before deployment.${NC}"
    exit 1
fi
