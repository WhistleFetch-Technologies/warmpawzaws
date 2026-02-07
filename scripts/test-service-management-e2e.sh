#!/bin/bash

# End-to-End Service Management Test Script
# Tests complete service management flow: catalog → vendor → staff → booking

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}E2E Service Management Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# This script requires actual vendor/staff/booking IDs
# For now, it provides a template for manual testing

echo -e "${YELLOW}⚠️  This E2E test requires actual database IDs${NC}"
echo -e "${YELLOW}   Please replace placeholders with real IDs from your database${NC}"
echo ""

# Step 1: Get service catalog for a role
echo -e "${BLUE}Step 1: Get Service Catalog for Role${NC}"
echo "Command:"
echo "  curl \"${API_BASE_URL}/admin/service-catalog?roleId=<vet_role_id>\""
echo ""
echo "Expected:"
echo "  - Services filtered by role"
echo "  - Response includes role info"
echo ""

# Step 2: Vendor adds service
echo -e "${BLUE}Step 2: Vendor Adds Service${NC}"
echo "Command:"
echo "  curl -X POST \"${API_BASE_URL}/vendor/<vendor_id>/services\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"serviceId\":\"<catalog_service_id>\",\"serviceName\":\"Test\",\"serviceStyle\":\"at_home\",\"price\":500}'"
echo ""
echo "Expected:"
echo "  - Service added to vendor_services"
echo "  - Service style validated"
echo ""

# Step 3: Vendor assigns service to staff
echo -e "${BLUE}Step 3: Vendor Assigns Service to Staff${NC}"
echo "Command:"
echo "  curl -X POST \"${API_BASE_URL}/vendor/<vendor_id>/staff/<staff_id>/assign-services\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"serviceIds\":[\"<service_id>\"]}'"
echo ""
echo "Expected:"
echo "  - Service assigned in staff_services"
echo "  - assigned_by_vendor = true"
echo ""

# Step 4: Staff enables service
echo -e "${BLUE}Step 4: Staff Enables Service${NC}"
echo "Command:"
echo "  curl -X PUT \"${API_BASE_URL}/staff/<staff_id>/services/<service_id>/enable\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -d '{\"serviceStyles\":[\"at_home\"],\"leadTimeMinutes\":15}'"
echo ""
echo "Expected:"
echo "  - enabled_by_staff = true"
echo "  - Service goes live"
echo ""

# Step 5: Verify service in booking
echo -e "${BLUE}Step 5: Verify Service in Booking${NC}"
echo "Command:"
echo "  curl \"${API_BASE_URL}/bookings/<booking_id>\""
echo ""
echo "Expected:"
echo "  - Booking includes assigned service"
echo "  - Service details correct"
echo ""

echo -e "${GREEN}✅ E2E Test Template Ready${NC}"
echo -e "${YELLOW}   Replace placeholders and run manually${NC}"
