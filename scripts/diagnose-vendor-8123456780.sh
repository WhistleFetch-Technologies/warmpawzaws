#!/bin/bash

# Diagnostic script to trace why vendor 8123456780 is not appearing
# This traces through the exact query logic step by step

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

VENDOR_PHONE="8123456780"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}ROOT CAUSE ANALYSIS: Vendor $VENDOR_PHONE${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${CYAN}Step 1: Find Vendor by Phone${NC}"
echo "────────────────────────────────────────────────────────────"
cat << 'QUERY1'
-- Find vendor by phone
SELECT 
  v.id,
  v.business_name,
  v.owner_name,
  v.phone,
  v.status,
  v.is_active,
  v.vendor_configuration,
  v.role_id,
  v.metadata
FROM vendors v
WHERE v.phone = '8123456780';
QUERY1
echo ""
echo -e "${YELLOW}📋 Run this query to find the vendor${NC}"
echo ""

echo -e "${CYAN}Step 2: Check Role Configuration${NC}"
echo "────────────────────────────────────────────────────────────"
cat << 'QUERY2'
-- Check role config for vendorConfiguration
SELECT 
  r.id,
  r.name,
  r.display_name,
  r.config,
  r.config->>'vendorConfiguration' as vendor_config_from_role,
  r.config->'vendorTypes' as vendor_types_from_role
FROM vendors v
JOIN roles r ON v.role_id = r.id
WHERE v.phone = '8123456780';
QUERY2
echo ""
echo -e "${YELLOW}📋 Run this to see role config structure${NC}"
echo -e "${MAGENTA}Expected: role.name = 'vet_solo' AND config->>'vendorConfiguration' = 'solo'${NC}"
echo ""

echo -e "${CYAN}Step 3: Check Services (at_home and tele)${NC}"
echo "────────────────────────────────────────────────────────────"
cat << 'QUERY3'
-- Check services for this vendor
SELECT 
  vs.id,
  vs.service_name,
  vs.service_style,
  vs.is_enabled,
  vs.publish_status,
  vs.price,
  vs.duration_minutes
FROM vendors v
JOIN vendor_services vs ON vs.vendor_id = v.id
WHERE v.phone = '8123456780'
  AND vs.service_style IN ('at_home', 'tele')
ORDER BY vs.service_style, vs.service_name;
QUERY3
echo ""
echo -e "${YELLOW}📋 Run this to see services${NC}"
echo -e "${MAGENTA}Expected: is_enabled = true AND publish_status = 'published'${NC}"
echo ""

echo -e "${CYAN}Step 4: Check Schedule Configuration${NC}"
echo "────────────────────────────────────────────────────────────"
cat << 'QUERY4'
-- Check vendor_availability_v2
SELECT COUNT(*) as availability_count
FROM vendors v
JOIN vendor_availability_v2 va ON va.vendor_id = v.id
WHERE v.phone = '8123456780';

-- Check vendor_schedule_slots
SELECT COUNT(*) as schedule_slots_count
FROM vendors v
JOIN vendor_schedule_slots vss ON vss.vendor_id = v.id
WHERE v.phone = '8123456780'
  AND vss.is_enabled = true;
QUERY4
echo ""
echo -e "${YELLOW}📋 Run this to check schedule${NC}"
echo -e "${RED}⚠️  At least ONE must return > 0 (this is REQUIRED)${NC}"
echo ""

echo -e "${CYAN}Step 5: Test the EXACT Query Used by Service Discovery${NC}"
echo "────────────────────────────────────────────────────────────"
cat << 'QUERY5'
-- This is the EXACT query from service-discovery.ts for at_home/tele
-- Test it step by step to see where it fails

-- First, test if vendor passes solo check
SELECT 
  v.id,
  v.business_name,
  v.vendor_configuration,
  r.name as role_name,
  r.config->>'vendorConfiguration' as role_vendor_config,
  -- Check each condition
  CASE WHEN r.name LIKE '%_solo' THEN '✅' ELSE '❌' END as check_role_name_pattern,
  CASE WHEN v.vendor_configuration = 'solo' THEN '✅' ELSE '❌' END as check_vendor_config,
  CASE WHEN (v.metadata IS NOT NULL AND (v.metadata->>'vendorConfiguration')::text = 'solo') THEN '✅' ELSE '❌' END as check_metadata,
  CASE WHEN EXISTS (SELECT 1 FROM roles r2 WHERE r2.id = v.role_id AND (r2.config->>'vendorConfiguration')::text = 'solo') THEN '✅' ELSE '❌' END as check_role_config
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
WHERE v.phone = '8123456780'
  AND v.status = 'approved'
  AND v.is_active = true;
QUERY5
echo ""
echo -e "${YELLOW}📋 Run this to see which solo checks pass/fail${NC}"
echo ""

echo -e "${CYAN}Step 6: Test Complete Query with All Conditions${NC}"
echo "────────────────────────────────────────────────────────────"
cat << 'QUERY6'
-- Complete query test for at_home
SELECT 
  v.id,
  v.business_name,
  vs.service_style,
  vs.service_name,
  vs.is_enabled,
  vs.publish_status,
  -- Schedule check
  CASE 
    WHEN EXISTS (SELECT 1 FROM vendor_availability_v2 va WHERE va.vendor_id = v.id)
      OR EXISTS (SELECT 1 FROM vendor_schedule_slots vss WHERE vss.vendor_id = v.id AND vss.is_enabled = true)
    THEN '✅ Has Schedule'
    ELSE '❌ Missing Schedule'
  END as schedule_status,
  -- Overall result
  CASE 
    WHEN v.status = 'approved' 
      AND v.is_active = true
      AND vs.service_style = 'at_home'
      AND vs.is_enabled = true
      AND vs.publish_status = 'published'
      AND (
        (r.name LIKE '%_solo')
        OR (v.vendor_configuration = 'solo')
        OR (v.metadata IS NOT NULL AND (v.metadata->>'vendorConfiguration')::text = 'solo')
        OR EXISTS (SELECT 1 FROM roles r2 WHERE r2.id = v.role_id AND (r2.config->>'vendorConfiguration')::text = 'solo')
      )
      AND (
        (v.vendor_configuration = 'solo')
        OR (v.metadata IS NOT NULL AND (v.metadata->>'vendorConfiguration')::text = 'solo')
        OR EXISTS (SELECT 1 FROM roles r2 WHERE r2.id = v.role_id AND (r2.config->>'vendorConfiguration')::text = 'solo')
        OR r.name NOT IN ('vet_clinic', 'veterinarian', 'vet', 'Veterinarian')
      )
      AND (
        EXISTS (SELECT 1 FROM vendor_availability_v2 va WHERE va.vendor_id = v.id)
        OR EXISTS (SELECT 1 FROM vendor_schedule_slots vss WHERE vss.vendor_id = v.id AND vss.is_enabled = true)
      )
    THEN '✅ WOULD APPEAR'
    ELSE '❌ WOULD NOT APPEAR'
  END as discovery_result
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
INNER JOIN vendor_services vs ON vs.vendor_id = v.id
WHERE v.phone = '8123456780'
  AND vs.service_style = 'at_home';
QUERY6
echo ""
echo -e "${YELLOW}📋 Run this to see if vendor would appear${NC}"
echo ""

echo -e "${CYAN}Step 7: Test API Endpoint Directly${NC}"
echo "────────────────────────────────────────────────────────────"
API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

echo -e "${YELLOW}Testing at_home endpoint:${NC}"
curl -s "${API_BASE_URL}/customer/discover-services?category=vet&roleId=veterinarian&serviceStyle=at_home" | python3 -m json.tool 2>/dev/null | head -50 || echo "API call failed"
echo ""

echo -e "${YELLOW}Testing tele endpoint:${NC}"
curl -s "${API_BASE_URL}/customer/discover-services?category=vet&roleId=veterinarian&serviceStyle=tele" | python3 -m json.tool 2>/dev/null | head -50 || echo "API call failed"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Analysis Checklist${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "After running the queries above, check:"
echo ""
echo "1. ✅ Vendor exists with phone = '8123456780'?"
echo "2. ✅ vendor.status = 'approved' AND is_active = true?"
echo "3. ✅ role.name = 'vet_solo'?"
echo "4. ✅ role.config->>'vendorConfiguration' = 'solo'?"
echo "5. ✅ Services exist with service_style IN ('at_home', 'tele')?"
echo "6. ✅ Services have is_enabled = true AND publish_status = 'published'?"
echo "7. ✅ Schedule configured (vendor_availability_v2 OR vendor_schedule_slots)?"
echo "8. ✅ Query #6 shows '✅ WOULD APPEAR'?"
echo ""
echo -e "${RED}The first ❌ you find is the root cause!${NC}"
