#!/bin/bash

# Diagnostic script to check why a solo vendor might not be appearing
# This helps identify what configuration is missing

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Solo Vendor Diagnostic Checklist${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}For a solo vendor to appear in at_home/tele listings, they need:${NC}"
echo ""
echo "1. ✅ Vendor status: 'approved' and is_active = true"
echo "2. ✅ Services enabled:"
echo "   - vendor_services.service_style = 'at_home' or 'tele'"
echo "   - vendor_services.is_enabled = true"
echo "   - vendor_services.publish_status = 'published'"
echo ""
echo "3. ✅ Solo configuration (ONE of these):"
echo "   - vendor_configuration = 'solo'"
echo "   - metadata->>'vendorConfiguration' = 'solo'"
echo "   - role.config->>'vendorConfiguration' = 'solo'"
echo "   - role.name LIKE '%_solo' or 'solo_%'"
echo ""
echo "4. ✅ Schedule configured (ONE of these):"
echo "   - vendor_availability_v2 table has entries for vendor_id"
echo "   - vendor_schedule_slots table has entries with is_enabled = true"
echo ""
echo "5. ✅ NOT excluded:"
echo "   - If vendor_configuration = 'solo', role name exclusion is skipped"
echo "   - Otherwise, role.name must NOT be in exclusion list"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}SQL Queries to Check Vendor Status${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${GREEN}1. Check vendor basic info:${NC}"
echo "SELECT id, business_name, role_id, vendor_configuration, status, is_active"
echo "FROM vendors"
echo "WHERE id = 'YOUR_VENDOR_ID';"
echo ""

echo -e "${GREEN}2. Check role config:${NC}"
echo "SELECT r.id, r.name, r.config->>'vendorConfiguration' as vendor_config"
echo "FROM vendors v"
echo "JOIN roles r ON v.role_id = r.id"
echo "WHERE v.id = 'YOUR_VENDOR_ID';"
echo ""

echo -e "${GREEN}3. Check services:${NC}"
echo "SELECT id, service_style, is_enabled, publish_status"
echo "FROM vendor_services"
echo "WHERE vendor_id = 'YOUR_VENDOR_ID'"
echo "  AND service_style IN ('at_home', 'tele');"
echo ""

echo -e "${GREEN}4. Check schedule (vendor_availability_v2):${NC}"
echo "SELECT COUNT(*) as availability_count"
echo "FROM vendor_availability_v2"
echo "WHERE vendor_id = 'YOUR_VENDOR_ID';"
echo ""

echo -e "${GREEN}5. Check schedule (vendor_schedule_slots):${NC}"
echo "SELECT COUNT(*) as schedule_count"
echo "FROM vendor_schedule_slots"
echo "WHERE vendor_id = 'YOUR_VENDOR_ID'"
echo "  AND is_enabled = true;"
echo ""

echo -e "${GREEN}6. Test the discovery query:${NC}"
echo "SELECT DISTINCT v.id, v.business_name, v.vendor_configuration"
echo "FROM vendors v"
echo "LEFT JOIN roles r ON v.role_id = r.id"
echo "INNER JOIN vendor_services vs ON vs.vendor_id = v.id"
echo "WHERE v.status = 'approved'"
echo "  AND v.is_active = true"
echo "  AND vs.service_style = 'at_home'"
echo "  AND vs.is_enabled = true"
echo "  AND vs.publish_status = 'published'"
echo "  AND (v.vendor_configuration = 'solo'"
echo "       OR EXISTS (SELECT 1 FROM roles r2 WHERE r2.id = v.role_id AND (r2.config->>'vendorConfiguration')::text = 'solo'))"
echo "  AND (EXISTS (SELECT 1 FROM vendor_availability_v2 va WHERE va.vendor_id = v.id)"
echo "       OR EXISTS (SELECT 1 FROM vendor_schedule_slots vss WHERE vss.vendor_id = v.id AND vss.is_enabled = true));"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Common Issues:${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "❌ Vendor not appearing? Check:"
echo "   1. Is vendor_configuration = 'solo' set?"
echo "   2. Are services published (publish_status = 'published')?"
echo "   3. Is schedule configured in vendor_availability_v2 or vendor_schedule_slots?"
echo "   4. Is vendor status = 'approved' and is_active = true?"
echo ""

echo -e "${GREEN}✅ The fix ensures vendors with vendor_configuration='solo' are included${NC}"
echo -e "${GREEN}   even if their role name is in the exclusion list!${NC}"
