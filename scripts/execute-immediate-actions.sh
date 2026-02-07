#!/bin/bash

# Execute Immediate Actions - Solo Vendor Check
# This script helps you run the critical queries to find solo vendors

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}IMMEDIATE ACTIONS: Solo Vendor Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if DATABASE_URL is available
if [ -z "$DATABASE_URL" ]; then
  echo -e "${YELLOW}⚠️  DATABASE_URL not set${NC}"
  echo ""
  echo -e "${CYAN}To run database queries, you need:${NC}"
  echo "  1. Database connection string"
  echo "  2. Or access to your database client (pgAdmin, DBeaver, etc.)"
  echo ""
  echo -e "${CYAN}Option 1: Set DATABASE_URL environment variable${NC}"
  echo "  export DATABASE_URL='postgresql://user:password@host:port/database'"
  echo ""
  echo -e "${CYAN}Option 2: Use the SQL queries below in your database client${NC}"
  echo ""
else
  echo -e "${GREEN}✅ DATABASE_URL found${NC}"
  echo ""
fi

echo -e "${MAGENTA}════════════════════════════════════════${NC}"
echo -e "${MAGENTA}ACTION 1: Find All Solo Vendors${NC}"
echo -e "${MAGENTA}════════════════════════════════════════${NC}"
echo ""

cat << 'QUERY1'
-- Query to find all solo vendors
SELECT 
  v.id as vendor_id,
  v.business_name,
  v.owner_name,
  v.phone,
  v.vendor_configuration,
  v.status,
  v.is_active,
  r.name as role_name,
  r.config->>'vendorConfiguration' as role_vendor_config
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
WHERE v.status = 'approved' 
  AND v.is_active = true
  AND (
    v.vendor_configuration = 'solo'
    OR (v.metadata IS NOT NULL AND (v.metadata->>'vendorConfiguration')::text = 'solo')
    OR r.name LIKE '%_solo'
    OR r.name LIKE 'solo_%'
    OR EXISTS (
      SELECT 1 FROM roles r2 
      WHERE r2.id = v.role_id 
      AND (r2.config->>'vendorConfiguration')::text = 'solo'
    )
  )
ORDER BY v.business_name;
QUERY1

echo ""
echo -e "${CYAN}📋 Copy the query above and run it in your database${NC}"
echo ""

if [ -n "$DATABASE_URL" ]; then
  echo -e "${YELLOW}Running query via psql...${NC}"
  psql "$DATABASE_URL" -c "
    SELECT 
      v.id as vendor_id,
      v.business_name,
      v.owner_name,
      v.vendor_configuration,
      r.name as role_name
    FROM vendors v
    LEFT JOIN roles r ON v.role_id = r.id
    WHERE v.status = 'approved' 
      AND v.is_active = true
      AND (
        v.vendor_configuration = 'solo'
        OR r.name LIKE '%_solo'
        OR EXISTS (
          SELECT 1 FROM roles r2 
          WHERE r2.id = v.role_id 
          AND (r2.config->>'vendorConfiguration')::text = 'solo'
        )
      )
    ORDER BY v.business_name;
  " 2>/dev/null || echo -e "${YELLOW}⚠️  Could not execute query. Please run manually.${NC}"
  echo ""
fi

echo -e "${MAGENTA}════════════════════════════════════════${NC}"
echo -e "${MAGENTA}ACTION 2: Check Their Services${NC}"
echo -e "${MAGENTA}════════════════════════════════════════${NC}"
echo ""

cat << 'QUERY2'
-- Query to find solo vendors with at_home/tele services
SELECT 
  v.id as vendor_id,
  v.business_name,
  vs.id as service_id,
  vs.service_name,
  vs.service_style,
  vs.is_enabled,
  vs.publish_status,
  vs.price,
  vs.duration_minutes
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
INNER JOIN vendor_services vs ON vs.vendor_id = v.id
WHERE v.status = 'approved' 
  AND v.is_active = true
  AND vs.service_style IN ('at_home', 'tele')
  AND (
    v.vendor_configuration = 'solo'
    OR (v.metadata IS NOT NULL AND (v.metadata->>'vendorConfiguration')::text = 'solo')
    OR r.name LIKE '%_solo'
    OR EXISTS (
      SELECT 1 FROM roles r2 
      WHERE r2.id = v.role_id 
      AND (r2.config->>'vendorConfiguration')::text = 'solo'
    )
  )
ORDER BY v.business_name, vs.service_style, vs.service_name;
QUERY2

echo ""
echo -e "${CYAN}📋 Copy the query above and run it in your database${NC}"
echo ""

echo -e "${MAGENTA}════════════════════════════════════════${NC}"
echo -e "${MAGENTA}ACTION 3: Check Schedule Configuration${NC}"
echo -e "${MAGENTA}════════════════════════════════════════${NC}"
echo ""

cat << 'QUERY3'
-- Query to check schedule configuration
SELECT 
  v.id as vendor_id,
  v.business_name,
  COALESCE(va_count.count, 0) as vendor_availability_count,
  COALESCE(vss_count.count, 0) as vendor_schedule_slots_count,
  CASE 
    WHEN COALESCE(va_count.count, 0) > 0 OR COALESCE(vss_count.count, 0) > 0 
    THEN '✅ Has Schedule'
    ELSE '❌ Missing Schedule'
  END as schedule_status
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
LEFT JOIN (
  SELECT vendor_id, COUNT(*) as count
  FROM vendor_availability_v2
  GROUP BY vendor_id
) va_count ON va_count.vendor_id = v.id
LEFT JOIN (
  SELECT vendor_id, COUNT(*) as count
  FROM vendor_schedule_slots
  WHERE is_enabled = true
  GROUP BY vendor_id
) vss_count ON vss_count.vendor_id = v.id
WHERE v.status = 'approved' 
  AND v.is_active = true
  AND (
    v.vendor_configuration = 'solo'
    OR r.name LIKE '%_solo'
    OR EXISTS (
      SELECT 1 FROM roles r2 
      WHERE r2.id = v.role_id 
      AND (r2.config->>'vendorConfiguration')::text = 'solo'
    )
  )
ORDER BY v.business_name;
QUERY3

echo ""
echo -e "${CYAN}📋 Copy the query above and run it in your database${NC}"
echo ""

echo -e "${MAGENTA}════════════════════════════════════════${NC}"
echo -e "${MAGENTA}ACTION 4: Complete Readiness Report${NC}"
echo -e "${MAGENTA}════════════════════════════════════════${NC}"
echo ""

cat << 'QUERY4'
-- Complete readiness report (MOST IMPORTANT)
SELECT 
  v.id as vendor_id,
  v.business_name,
  v.owner_name,
  v.vendor_configuration,
  r.name as role_name,
  -- Service counts
  COUNT(DISTINCT CASE WHEN vs.service_style = 'at_home' AND vs.is_enabled = true AND vs.publish_status = 'published' THEN vs.id END) as at_home_published,
  COUNT(DISTINCT CASE WHEN vs.service_style = 'tele' AND vs.is_enabled = true AND vs.publish_status = 'published' THEN vs.id END) as tele_published,
  -- Schedule status
  CASE 
    WHEN EXISTS (SELECT 1 FROM vendor_availability_v2 va WHERE va.vendor_id = v.id)
      OR EXISTS (SELECT 1 FROM vendor_schedule_slots vss WHERE vss.vendor_id = v.id AND vss.is_enabled = true)
    THEN '✅'
    ELSE '❌'
  END as has_schedule,
  -- Overall status
  CASE 
    WHEN COUNT(DISTINCT CASE WHEN vs.service_style IN ('at_home', 'tele') AND vs.is_enabled = true AND vs.publish_status = 'published' THEN vs.id END) > 0
      AND (EXISTS (SELECT 1 FROM vendor_availability_v2 va WHERE va.vendor_id = v.id)
           OR EXISTS (SELECT 1 FROM vendor_schedule_slots vss WHERE vss.vendor_id = v.id AND vss.is_enabled = true))
    THEN '✅ Ready'
    ELSE '⚠️  Not Ready'
  END as discovery_status
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
LEFT JOIN vendor_services vs ON vs.vendor_id = v.id
WHERE v.status = 'approved' 
  AND v.is_active = true
  AND (
    v.vendor_configuration = 'solo'
    OR (v.metadata IS NOT NULL AND (v.metadata->>'vendorConfiguration')::text = 'solo')
    OR r.name LIKE '%_solo'
    OR EXISTS (
      SELECT 1 FROM roles r2 
      WHERE r2.id = v.role_id 
      AND (r2.config->>'vendorConfiguration')::text = 'solo'
    )
  )
GROUP BY v.id, v.business_name, v.owner_name, v.vendor_configuration, r.name, r.config
ORDER BY discovery_status DESC, v.business_name;
QUERY4

echo ""
echo -e "${GREEN}✅ This is the MOST IMPORTANT query - run this first!${NC}"
echo -e "${CYAN}📋 Copy the query above and run it in your database${NC}"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Quick API Status Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

echo -e "${CYAN}Checking current API status...${NC}"
echo ""

# Check at_home
RESPONSE=$(curl -s "${API_BASE_URL}/customer/discover-services?category=vet&roleId=veterinarian&serviceStyle=at_home" 2>&1)
if echo "$RESPONSE" | grep -q '"success":true'; then
  TOTAL=$(echo "$RESPONSE" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "0")
  echo -e "${YELLOW}at_home services:${NC} ${GREEN}$TOTAL providers${NC}"
else
  echo -e "${YELLOW}at_home services:${NC} ${RED}API error${NC}"
fi

# Check tele
RESPONSE=$(curl -s "${API_BASE_URL}/customer/discover-services?category=vet&roleId=veterinarian&serviceStyle=tele" 2>&1)
if echo "$RESPONSE" | grep -q '"success":true'; then
  TOTAL=$(echo "$RESPONSE" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "0")
  echo -e "${YELLOW}tele services:${NC} ${GREEN}$TOTAL providers${NC}"
else
  echo -e "${YELLOW}tele services:${NC} ${RED}API error${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo "  1. Run Query #4 (Complete Readiness Report) in your database"
echo "  2. Review the results - look for vendors with ⚠️ Not Ready"
echo "  3. Check what's missing:"
echo "     - Services not published? → Run: UPDATE vendor_services SET publish_status='published'"
echo "     - Missing schedule? → Configure via vendor dashboard"
echo "     - vendor_configuration not set? → Run: UPDATE vendors SET vendor_configuration='solo'"
echo "  4. After fixes, test again with: ./scripts/test-solo-vendor-fix.sh"
echo ""
echo -e "${GREEN}✅ Code fix is complete - now verify vendor configurations!${NC}"
