#!/bin/bash

# Script to query and display solo vendors and their at_home/tele services
# This provides SQL queries and also attempts to use the API

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Solo Vendors & Services Query${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${CYAN}SQL Queries to Find Solo Vendors and Services:${NC}"
echo ""

echo -e "${YELLOW}1. Find ALL Solo Vendors:${NC}"
echo "────────────────────────────────────────────────────────────"
cat << 'EOF'
SELECT 
  v.id,
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
EOF
echo ""

echo -e "${YELLOW}2. Find Solo Vendors with at_home/tele Services:${NC}"
echo "────────────────────────────────────────────────────────────"
cat << 'EOF'
SELECT 
  v.id as vendor_id,
  v.business_name,
  v.owner_name,
  v.vendor_configuration,
  r.name as role_name,
  vs.id as service_id,
  vs.service_name,
  vs.service_style,
  vs.is_enabled,
  vs.publish_status,
  vs.price,
  vs.duration_minutes,
  vs.category,
  vs.sub_category
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
INNER JOIN vendor_services vs ON vs.vendor_id = v.id
WHERE v.status = 'approved' 
  AND v.is_active = true
  AND vs.service_style IN ('at_home', 'tele')
  AND vs.is_enabled = true
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
ORDER BY v.business_name, vs.service_style, vs.service_name;
EOF
echo ""

echo -e "${YELLOW}3. Count Services by Style for Solo Vendors:${NC}"
echo "────────────────────────────────────────────────────────────"
cat << 'EOF'
SELECT 
  v.id as vendor_id,
  v.business_name,
  COUNT(CASE WHEN vs.service_style = 'at_home' THEN 1 END) as at_home_count,
  COUNT(CASE WHEN vs.service_style = 'tele' THEN 1 END) as tele_count,
  COUNT(CASE WHEN vs.service_style = 'at_center' THEN 1 END) as at_center_count,
  COUNT(*) as total_services
FROM vendors v
LEFT JOIN roles r ON v.role_id = r.id
INNER JOIN vendor_services vs ON vs.vendor_id = v.id
WHERE v.status = 'approved' 
  AND v.is_active = true
  AND vs.is_enabled = true
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
GROUP BY v.id, v.business_name
ORDER BY v.business_name;
EOF
echo ""

echo -e "${YELLOW}4. Check Schedule Configuration for Solo Vendors:${NC}"
echo "────────────────────────────────────────────────────────────"
cat << 'EOF'
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
EOF
echo ""

echo -e "${YELLOW}5. Complete Solo Vendor Report (All Info):${NC}"
echo "────────────────────────────────────────────────────────────"
cat << 'EOF'
SELECT 
  v.id as vendor_id,
  v.business_name,
  v.owner_name,
  v.phone,
  v.vendor_configuration,
  r.name as role_name,
  r.config->>'vendorConfiguration' as role_vendor_config,
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
    OR r.name LIKE 'solo_%'
    OR EXISTS (
      SELECT 1 FROM roles r2 
      WHERE r2.id = v.role_id 
      AND (r2.config->>'vendorConfiguration')::text = 'solo'
    )
  )
GROUP BY v.id, v.business_name, v.owner_name, v.phone, v.vendor_configuration, r.name, r.config
ORDER BY discovery_status DESC, v.business_name;
EOF
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${CYAN}API-Based Discovery (Current State)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}Checking at_home services via API:${NC}"
RESPONSE=$(curl -s "${API_BASE_URL}/customer/discover-services?category=vet&roleId=veterinarian&serviceStyle=at_home" 2>&1)
if echo "$RESPONSE" | grep -q '"success":true'; then
  TOTAL=$(echo "$RESPONSE" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "0")
  echo -e "   Total providers found: ${GREEN}$TOTAL${NC}"
  if [ "$TOTAL" -gt 0 ]; then
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -100 || echo "$RESPONSE" | head -20
  fi
else
  echo -e "   ${YELLOW}No providers found or API error${NC}"
fi
echo ""

echo -e "${YELLOW}Checking tele services via API:${NC}"
RESPONSE=$(curl -s "${API_BASE_URL}/customer/discover-services?category=vet&roleId=veterinarian&serviceStyle=tele" 2>&1)
if echo "$RESPONSE" | grep -q '"success":true'; then
  TOTAL=$(echo "$RESPONSE" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "0")
  echo -e "   Total providers found: ${GREEN}$TOTAL${NC}"
  if [ "$TOTAL" -gt 0 ]; then
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -100 || echo "$RESPONSE" | head -20
  fi
else
  echo -e "   ${YELLOW}No providers found or API error${NC}"
fi
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "To get detailed information, run the SQL queries above in your database."
echo "The queries will show:"
echo "  1. All solo vendors"
echo "  2. Their at_home/tele services"
echo "  3. Service counts by style"
echo "  4. Schedule configuration status"
echo "  5. Complete readiness report"
echo ""
echo -e "${GREEN}✅ Use query #5 for the most comprehensive report${NC}"
