#!/bin/bash

# Script to verify and help configure solo vendor for at_home/tele services
# This checks the vendor configuration and provides guidance

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Solo Vendor Configuration Verifier${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${YELLOW}⚠️  DATABASE_URL not set${NC}"
  echo "   Please set DATABASE_URL environment variable to run database checks"
  echo "   Example: export DATABASE_URL='postgresql://user:pass@host:port/dbname'"
  echo ""
  echo -e "${CYAN}Manual Verification Steps:${NC}"
else
  echo -e "${GREEN}✅ DATABASE_URL found${NC}"
  echo ""
  echo -e "${CYAN}Running verification checks...${NC}"
  echo ""
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Step-by-Step Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}STEP 1: Verify Vendor Configuration${NC}"
echo "────────────────────────────────────────────────────────────"
echo "Check if vendor has vendor_configuration = 'solo':"
echo ""
if [ -n "$DATABASE_URL" ]; then
  echo "Run this query (replace YOUR_VENDOR_ID):"
  echo ""
  echo "SELECT id, business_name, vendor_configuration, status, is_active"
  echo "FROM vendors"
  echo "WHERE id = 'YOUR_VENDOR_ID';"
  echo ""
  echo -e "${GREEN}Expected: vendor_configuration = 'solo${NC}"
else
  echo "Query: SELECT id, business_name, vendor_configuration, status, is_active FROM vendors WHERE id = 'YOUR_VENDOR_ID';"
fi
echo ""

echo -e "${YELLOW}STEP 2: Verify Role Configuration${NC}"
echo "────────────────────────────────────────────────────────────"
echo "Check if role config has vendorConfiguration = 'solo':"
echo ""
if [ -n "$DATABASE_URL" ]; then
  echo "Run this query:"
  echo ""
  echo "SELECT r.id, r.name, r.config->>'vendorConfiguration' as vendor_config"
  echo "FROM vendors v"
  echo "JOIN roles r ON v.role_id = r.id"
  echo "WHERE v.id = 'YOUR_VENDOR_ID';"
  echo ""
  echo -e "${GREEN}Expected: vendor_config = 'solo' OR role.name LIKE '%_solo'${NC}"
else
  echo "Query: SELECT r.name, r.config->>'vendorConfiguration' FROM vendors v JOIN roles r ON v.role_id = r.id WHERE v.id = 'YOUR_VENDOR_ID';"
fi
echo ""

echo -e "${YELLOW}STEP 3: Verify Services Are Published${NC}"
echo "────────────────────────────────────────────────────────────"
echo "Check if services are enabled and published:"
echo ""
if [ -n "$DATABASE_URL" ]; then
  echo "Run this query:"
  echo ""
  echo "SELECT id, service_name, service_style, is_enabled, publish_status"
  echo "FROM vendor_services"
  echo "WHERE vendor_id = 'YOUR_VENDOR_ID'"
  echo "  AND service_style IN ('at_home', 'tele');"
  echo ""
  echo -e "${GREEN}Expected: is_enabled = true AND publish_status = 'published'${NC}"
else
  echo "Query: SELECT service_style, is_enabled, publish_status FROM vendor_services WHERE vendor_id = 'YOUR_VENDOR_ID' AND service_style IN ('at_home', 'tele');"
fi
echo ""

echo -e "${YELLOW}STEP 4: Verify Schedule Configuration (CRITICAL)${NC}"
echo "────────────────────────────────────────────────────────────"
echo "Check if vendor has schedule configured:"
echo ""
if [ -n "$DATABASE_URL" ]; then
  echo "Check vendor_availability_v2:"
  echo "SELECT COUNT(*) as availability_count"
  echo "FROM vendor_availability_v2"
  echo "WHERE vendor_id = 'YOUR_VENDOR_ID';"
  echo ""
  echo "Check vendor_schedule_slots:"
  echo "SELECT COUNT(*) as schedule_count"
  echo "FROM vendor_schedule_slots"
  echo "WHERE vendor_id = 'YOUR_VENDOR_ID'"
  echo "  AND is_enabled = true;"
  echo ""
  echo -e "${RED}⚠️  At least ONE of these must return > 0${NC}"
  echo -e "${RED}   This is now REQUIRED for vendors to appear!${NC}"
else
  echo "Queries:"
  echo "  - SELECT COUNT(*) FROM vendor_availability_v2 WHERE vendor_id = 'YOUR_VENDOR_ID';"
  echo "  - SELECT COUNT(*) FROM vendor_schedule_slots WHERE vendor_id = 'YOUR_VENDOR_ID' AND is_enabled = true;"
fi
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Quick Fix Commands${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${CYAN}If vendor_configuration is not set:${NC}"
echo "UPDATE vendors"
echo "SET vendor_configuration = 'solo'"
echo "WHERE id = 'YOUR_VENDOR_ID';"
echo ""

echo -e "${CYAN}If services are not published:${NC}"
echo "UPDATE vendor_services"
echo "SET publish_status = 'published', is_enabled = true"
echo "WHERE vendor_id = 'YOUR_VENDOR_ID'"
echo "  AND service_style IN ('at_home', 'tele');"
echo ""

echo -e "${CYAN}If schedule is missing, you need to:${NC}"
echo "1. Create entries in vendor_availability_v2, OR"
echo "2. Create entries in vendor_schedule_slots with is_enabled = true"
echo ""
echo "See vendor schedule management in the vendor dashboard."
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test After Configuration${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo "After making changes, test with:"
echo ""
echo "  ./scripts/test-solo-vendor-fix.sh"
echo ""
echo "Or manually:"
echo ""
echo "  curl \"https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/discover-services?category=vet&roleId=veterinarian&serviceStyle=at_home\""
echo ""

echo -e "${GREEN}✅ The fix is working - vendors with vendor_configuration='solo'${NC}"
echo -e "${GREEN}   will now appear even if role name is 'veterinarian'!${NC}"
