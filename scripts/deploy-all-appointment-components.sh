#!/bin/bash
# Deploy All Appointment Management Components
# This script deploys all components in sequence:
# 1. Backend endpoints
# 2. Vendor web component (UniversalAppointmentManagement)
# 3. Customer web component (StaffSelectionStep)
# Usage: ./scripts/deploy-all-appointment-components.sh

set -e

echo "🚀 Deploying All Appointment Management Components..."
echo "====================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Step 1: Deploy Backend Endpoints
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1/3: Deploying Backend Endpoints${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f "${SCRIPT_DIR}/deploy-appointment-endpoints.sh" ]; then
    bash "${SCRIPT_DIR}/deploy-appointment-endpoints.sh"
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Backend deployment failed!${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  deploy-appointment-endpoints.sh not found, skipping...${NC}"
fi

echo ""
echo -e "${GREEN}✅ Backend endpoints deployed${NC}"
echo ""

# Step 2: Deploy Vendor Web Component
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2/3: Deploying Vendor Web Component (UniversalAppointmentManagement)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f "${SCRIPT_DIR}/deploy-unified-appointment-management.sh" ]; then
    bash "${SCRIPT_DIR}/deploy-unified-appointment-management.sh"
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Vendor web deployment failed!${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ deploy-unified-appointment-management.sh not found!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Vendor web component deployed${NC}"
echo ""

# Step 3: Deploy Customer Web Component
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3/3: Deploying Customer Web Component (StaffSelectionStep)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -f "${SCRIPT_DIR}/deploy-staff-selection.sh" ]; then
    bash "${SCRIPT_DIR}/deploy-staff-selection.sh"
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Customer web deployment failed!${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ deploy-staff-selection.sh not found!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Customer web component deployed${NC}"
echo ""

# Final Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ ✅ ✅ ALL APPOINTMENT MANAGEMENT COMPONENTS DEPLOYED SUCCESSFULLY! ✅ ✅ ✅${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📋 Deployment Summary:${NC}"
echo -e "   ✅ Backend Endpoints (Lambda)"
echo -e "   ✅ UniversalAppointmentManagement (Vendor Web)"
echo -e "   ✅ StaffSelectionStep (Customer Web)"
echo ""
echo -e "${GREEN}🎉 All components deployed and ready!${NC}"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo -e "   1. Test the deployed components"
echo -e "   2. Verify endpoints are accessible"
echo -e "   3. Test appointment management flows"
echo ""
