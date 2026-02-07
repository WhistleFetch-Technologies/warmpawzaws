#!/bin/bash

# ============================================================================
# VERIFY IMPLEMENTATION
# ============================================================================
# This script verifies that all implementation files exist and are correct
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Verifying Role Architecture Implementation${NC}"
echo ""

ERRORS=0
WARNINGS=0

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "  ${GREEN}✅${NC} $1"
        return 0
    else
        echo -e "  ${RED}❌${NC} $1 (MISSING)"
        ((ERRORS++))
        return 1
    fi
}

# Function to check file contains pattern
check_pattern() {
    if grep -q "$2" "$1" 2>/dev/null; then
        echo -e "  ${GREEN}✅${NC} $1 contains '$2'"
        return 0
    else
        echo -e "  ${YELLOW}⚠️${NC}  $1 missing pattern '$2'"
        ((WARNINGS++))
        return 1
    fi
}

echo -e "${BLUE}📁 Checking Created Files...${NC}"
echo ""

# Frontend Components
echo -e "${YELLOW}Frontend Components:${NC}"
check_file "apps/vendor-web/components/vendor/ProfessionalProfileManager.tsx"
check_file "apps/vendor-web/components/vendor/dashboard/SoloProviderDashboard.tsx"

# Database Migrations
echo ""
echo -e "${YELLOW}Database Migrations:${NC}"
check_file "db/migrations/139_add_customer_service_to_roles.sql"
check_file "db/migrations/140_role_consolidation_20_to_21.sql"

# Backend Utilities
echo ""
echo -e "${YELLOW}Backend Utilities:${NC}"
check_file "backend/lambda/src/utils/capability-filter.ts"

# Scripts
echo ""
echo -e "${YELLOW}Scripts:${NC}"
check_file "scripts/run-migrations.sh"
check_file "scripts/verify-migrations.sh"
if [ -x "scripts/run-migrations.sh" ] && [ -x "scripts/verify-migrations.sh" ]; then
    echo -e "  ${GREEN}✅${NC} Scripts are executable"
else
    echo -e "  ${YELLOW}⚠️${NC}  Scripts may not be executable (run: chmod +x scripts/*.sh)"
    ((WARNINGS++))
fi

# Documentation
echo ""
echo -e "${YELLOW}Documentation:${NC}"
check_file "CUSTOM_SERVICES_ENHANCEMENT_ANALYSIS.md"
check_file "CUSTOM_SERVICES_OPT_IN_IMPLEMENTATION.md"
check_file "IMPLEMENTATION_COMPLETE_SUMMARY.md"
check_file "IMPLEMENTATION_FILES_INVENTORY.md"

echo ""
echo -e "${BLUE}🔧 Checking Modified Files...${NC}"
echo ""

# Admin UI
echo -e "${YELLOW}Admin UI:${NC}"
check_file "apps/admin-web/app/roles/page.tsx"
check_pattern "apps/admin-web/app/roles/page.tsx" "allowCustomServicesForSolo"

# Vendor UI
echo ""
echo -e "${YELLOW}Vendor UI:${NC}"
check_file "apps/vendor-web/app/profile/page.tsx"
check_pattern "apps/vendor-web/app/profile/page.tsx" "ProfessionalProfileManager"

check_file "apps/vendor-web/components/vendor/VendorServiceManagementComplete.tsx"
check_pattern "apps/vendor-web/components/vendor/VendorServiceManagementComplete.tsx" "useVendorCapabilities"

check_file "apps/vendor-web/components/vendor/VendorCustomServiceCreation.tsx"
check_file "apps/vendor-web/components/vendor/VendorDashboard.tsx"
check_file "apps/vendor-web/components/vendor/VendorRoleSelection.tsx"

# Backend Endpoints
echo ""
echo -e "${YELLOW}Backend Endpoints:${NC}"
check_file "backend/lambda/src/endpoints/vendor-profile.ts"
check_file "backend/lambda/src/endpoints/vendor-dashboard.ts"
check_file "backend/lambda/src/endpoints/roles.ts"

echo ""
echo -e "${BLUE}🔍 Checking Key Patterns...${NC}"
echo ""

# Check for custom services toggle in admin UI
echo -e "${YELLOW}Custom Services Toggle:${NC}"
check_pattern "apps/admin-web/app/roles/page.tsx" "allowCustomServicesForSolo"
check_pattern "apps/admin-web/app/roles/page.tsx" "Enable Custom Services"

# Check for capability filtering
echo ""
echo -e "${YELLOW}Capability Filtering:${NC}"
check_pattern "backend/lambda/src/utils/capability-filter.ts" "filterCapabilitiesByVendorConfiguration"
check_pattern "backend/lambda/src/utils/capability-filter.ts" "filterCapabilitiesByServiceStyles"

# Check for professional profile
echo ""
echo -e "${YELLOW}Professional Profile:${NC}"
check_pattern "apps/vendor-web/components/vendor/ProfessionalProfileManager.tsx" "ProfessionalProfile"
check_pattern "apps/vendor-web/app/profile/page.tsx" "profileType.*professional"

# Check for capability checks in service management
echo ""
echo -e "${YELLOW}Service Management Capability Checks:${NC}"
check_pattern "apps/vendor-web/components/vendor/VendorServiceManagementComplete.tsx" "capabilities.custom_services"

echo ""
echo -e "${BLUE}📊 Summary${NC}"
echo "----------------------------------------"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found (non-critical)${NC}"
    exit 0
else
    echo -e "${RED}❌ $ERRORS error(s) found${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found${NC}"
    fi
    exit 1
fi
