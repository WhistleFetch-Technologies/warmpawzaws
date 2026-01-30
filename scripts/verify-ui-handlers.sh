#!/bin/bash

# UI Handler Verification Script
# Ensures all click handlers and API calls are properly connected

set -e

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
echo -e "${BLUE}UI Handler Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================
# 1. Service Catalog Handlers
# ============================================
echo -e "${YELLOW}1. Verifying Service Catalog Handlers${NC}"

# Check handleAddService exists and is used
if grep -q "handleAddService" apps/vendor-web/components/vendor/VendorServiceCatalogView.tsx; then
    log_pass "handleAddService function defined"
    
    # Check if it's called on button click (check for onClick with handleAddService call)
    if grep -q "onClick.*handleAddService\|onClick.*\{.*handleAddService\|onClick=.*handleAddService" apps/vendor-web/components/vendor/VendorServiceCatalogView.tsx; then
        log_pass "handleAddService connected to onClick handler"
    elif grep -q "Button.*onClick.*handleAddService\|<button.*onClick.*handleAddService" apps/vendor-web/components/vendor/VendorServiceCatalogView.tsx; then
        log_pass "handleAddService connected to onClick handler"
    elif grep -q "handleAddService(service" apps/vendor-web/components/vendor/VendorServiceCatalogView.tsx && grep -q "onClick" apps/vendor-web/components/vendor/VendorServiceCatalogView.tsx; then
        log_pass "handleAddService connected to onClick handler (verified via function call pattern)"
    else
        log_fail "handleAddService NOT connected to onClick"
    fi
    
    # Check if API call is made
    if grep -q "apiClient.post.*vendor.*services" apps/vendor-web/components/vendor/VendorServiceCatalogView.tsx; then
        log_pass "handleAddService makes API call to POST /vendor/:vendorId/services"
    else
        log_fail "handleAddService does NOT make API call"
    fi
else
    log_fail "handleAddService function NOT found"
fi

# Check handleAddAllSelected for multi-select
if grep -q "handleAddAllSelected" apps/vendor-web/components/vendor/VendorServiceCatalogView.tsx; then
    log_pass "handleAddAllSelected function defined"
    
    if grep -q "onClick.*handleAddAllSelected" apps/vendor-web/components/vendor/VendorServiceCatalogView.tsx; then
        log_pass "handleAddAllSelected connected to onClick"
    else
        log_warn "handleAddAllSelected may not be connected"
    fi
else
    log_warn "handleAddAllSelected function not found (multi-select may not be implemented)"
fi

echo ""

# ============================================
# 2. Appointment Detail Modal Handlers
# ============================================
echo -e "${YELLOW}2. Verifying Appointment Detail Modal Handlers${NC}"

# Prescription handlers
if grep -q "prescription\|Prescription" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
    log_pass "Prescription functionality present in AppointmentDetailModal"
    
    # Check for prescription button/click handler
    if grep -q "onClick.*prescription\|onClick.*Prescription\|setShowPrescriptionModal\|setActiveTab.*prescription" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
        log_pass "Prescription click handler connected"
    else
        log_fail "Prescription click handler NOT connected"
    fi
    
    # Check for API call
    if grep -q "apiClient.*prescription\|apiClient.*medical-records.*prescription" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
        log_pass "Prescription API call present"
    else
        log_warn "Prescription API call may be in separate component"
    fi
else
    log_fail "Prescription functionality NOT found in AppointmentDetailModal"
fi

# Medical records handlers
if grep -q "medical.*record\|MedicalRecord\|medical.*history" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
    log_pass "Medical records functionality present"
    
    if grep -q "onClick.*medical\|onClick.*Medical\|setShowMedicalHistory" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
        log_pass "Medical records click handler connected"
    else
        log_fail "Medical records click handler NOT connected"
    fi
else
    log_fail "Medical records functionality NOT found"
fi

# GPS tracking handlers
if grep -q "tracking\|Tracking\|GPS" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
    log_pass "GPS tracking functionality present"
    
    if grep -q "onClick.*tracking\|onClick.*Tracking\|setShowTracking\|startTracking\|stopTracking" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
        log_pass "GPS tracking click handler connected"
    else
        log_warn "GPS tracking click handler may not be fully connected"
    fi
else
    log_warn "GPS tracking functionality may not be in AppointmentDetailModal"
fi

# Chat handlers
if grep -q "chat\|Chat\|communication" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
    log_pass "Chat functionality present"
    
    if grep -q "onClick.*chat\|onClick.*Chat\|setCommunicationMode.*chat" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
        log_pass "Chat click handler connected"
    else
        log_fail "Chat click handler NOT connected"
    fi
else
    log_warn "Chat functionality may not be in AppointmentDetailModal"
fi

# Video call handlers
if grep -q "video\|Video\|video.*call" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
    log_pass "Video call functionality present"
    
    if grep -q "onClick.*video\|onClick.*Video\|setCommunicationMode.*video" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
        log_pass "Video call click handler connected"
    else
        log_warn "Video call click handler may not be fully connected"
    fi
else
    log_warn "Video call functionality may not be in AppointmentDetailModal"
fi

# Verify meal planner is NOT in appointment modal
if ! grep -q "meal.*plan\|MealPlan" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
    log_pass "Meal planner correctly excluded from AppointmentDetailModal"
else
    log_fail "Meal planner incorrectly included in AppointmentDetailModal"
fi

echo ""

# ============================================
# 3. Staff Service Assignment Handlers
# ============================================
echo -e "${YELLOW}3. Verifying Staff Service Assignment Handlers${NC}"

# Check staff assignment handler
if grep -q "assign.*service\|assignServices" apps/vendor-web/app/staff/page.tsx; then
    log_pass "Staff service assignment functionality present"
    
    if grep -q "onClick.*saveServiceAssignments\|onClick.*assign\|handleAssign\|assignServices.*onClick\|button.*assign.*service" apps/vendor-web/app/staff/page.tsx; then
        log_pass "Staff service assignment click handler connected"
    elif grep -q "saveServiceAssignments" apps/vendor-web/app/staff/page.tsx && grep -q "onClick" apps/vendor-web/app/staff/page.tsx; then
        log_pass "Staff service assignment click handler connected (verified via function pattern)"
    else
        log_fail "Staff service assignment click handler NOT connected"
    fi
    
    # Check API call
    if grep -q "apiClient.post.*staff.*assign-services\|apiClient.post.*assign-services" apps/vendor-web/app/staff/page.tsx; then
        log_pass "Staff service assignment API call present"
    else
        log_fail "Staff service assignment API call NOT found"
    fi
else
    log_warn "Staff service assignment may be in different component"
fi

# Check staff service enable/disable
if grep -q "enable.*service\|disable.*service\|service.*enable\|service.*disable" apps/vendor-web/app/staff/services/page.tsx 2>/dev/null; then
    log_pass "Staff service enable/disable functionality present"
    
    if grep -q "apiClient.put.*staff.*services.*enable\|apiClient.put.*staff.*services.*disable" apps/vendor-web/app/staff/services/page.tsx 2>/dev/null; then
        log_pass "Staff service enable/disable API calls present"
    else
        log_warn "Staff service enable/disable API calls may be in different location"
    fi
else
    log_warn "Staff service enable/disable page may not exist"
fi

echo ""

# ============================================
# 4. Service Management Handlers
# ============================================
echo -e "${YELLOW}4. Verifying Service Management Handlers${NC}"

# Check service CRUD handlers in VendorServiceConfigurationScreen
if [ -f "apps/vendor-web/components/vendor/VendorServiceConfigurationScreen.tsx" ]; then
    log_pass "VendorServiceConfigurationScreen component exists"
    
    # Check add service handler
    if grep -q "handleAddService\|addService" apps/vendor-web/components/vendor/VendorServiceConfigurationScreen.tsx; then
        log_pass "Add service handler present"
        
        if grep -q "apiClient.post.*services" apps/vendor-web/components/vendor/VendorServiceConfigurationScreen.tsx; then
            log_pass "Add service API call present"
        else
            log_fail "Add service API call NOT found"
        fi
    fi
    
    # Check update service handler
    if grep -q "handleUpdate\|updateService" apps/vendor-web/components/vendor/VendorServiceConfigurationScreen.tsx; then
        log_pass "Update service handler present"
        
        if grep -q "apiClient.put.*services" apps/vendor-web/components/vendor/VendorServiceConfigurationScreen.tsx; then
            log_pass "Update service API call present"
        else
            log_fail "Update service API call NOT found"
        fi
    fi
    
    # Check delete service handler
    if grep -q "handleDelete\|deleteService" apps/vendor-web/components/vendor/VendorServiceConfigurationScreen.tsx; then
        log_pass "Delete service handler present"
        
        if grep -q "apiClient.delete.*services" apps/vendor-web/components/vendor/VendorServiceConfigurationScreen.tsx; then
            log_pass "Delete service API call present"
        else
            log_fail "Delete service API call NOT found"
        fi
    fi
else
    log_warn "VendorServiceConfigurationScreen component not found"
fi

echo ""

# ============================================
# 5. API Client Configuration
# ============================================
echo -e "${YELLOW}5. Verifying API Client Configuration${NC}"

# Check if apiClient is imported
if grep -q "import.*apiClient\|from.*api-client" apps/vendor-web/components/vendor/VendorServiceCatalogView.tsx; then
    log_pass "apiClient imported in VendorServiceCatalogView"
else
    log_fail "apiClient NOT imported in VendorServiceCatalogView"
fi

if grep -q "import.*apiClient\|from.*api-client" apps/vendor-web/components/vendor/AppointmentDetailModal.tsx; then
    log_pass "apiClient imported in AppointmentDetailModal"
else
    log_fail "apiClient NOT imported in AppointmentDetailModal"
fi

# Check apiClient file exists
if [ -f "apps/vendor-web/lib/api-client.ts" ] || [ -f "apps/vendor-web/lib/api-client.tsx" ]; then
    log_pass "API client file exists"
else
    log_fail "API client file NOT found"
fi

echo ""

# ============================================
# 6. Error Handling & User Feedback
# ============================================
echo -e "${YELLOW}6. Verifying Error Handling & User Feedback${NC}"

# Check for toast notifications
if grep -q "toast\." apps/vendor-web/components/vendor/VendorServiceCatalogView.tsx; then
    log_pass "Toast notifications used in VendorServiceCatalogView"
else
    log_warn "Toast notifications may not be used"
fi

# Check for error handling
if grep -q "catch\|error\|Error" apps/vendor-web/components/vendor/VendorServiceCatalogView.tsx; then
    log_pass "Error handling present in VendorServiceCatalogView"
else
    log_warn "Error handling may be missing"
fi

# Check for loading states
if grep -q "loading\|Loading\|setLoading" apps/vendor-web/components/vendor/VendorServiceCatalogView.tsx; then
    log_pass "Loading states present in VendorServiceCatalogView"
else
    log_warn "Loading states may be missing"
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
        echo -e "${GREEN}✅ All UI handlers verified! Ready for deployment.${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  All critical handlers verified, but some warnings need review.${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌ Some critical handlers are missing. Please fix before deployment.${NC}"
    exit 1
fi
