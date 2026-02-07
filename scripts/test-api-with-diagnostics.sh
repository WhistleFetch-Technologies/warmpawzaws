#!/bin/bash

# Test API endpoints and extract diagnostic data for vendor 8123456780

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
echo -e "${BLUE}API Diagnostic Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${CYAN}Testing at_home endpoint...${NC}"
RESPONSE_ATHOME=$(curl -s "${API_BASE_URL}/customer/discover-services?category=vet&roleId=veterinarian&serviceStyle=at_home" 2>&1)

echo -e "${CYAN}Testing tele endpoint...${NC}"
RESPONSE_TELE=$(curl -s "${API_BASE_URL}/customer/discover-services?category=vet&roleId=veterinarian&serviceStyle=tele" 2>&1)

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}at_home Response:${NC}"
echo -e "${BLUE}========================================${NC}"
echo "$RESPONSE_ATHOME" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE_ATHOME"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}tele Response:${NC}"
echo -e "${BLUE}========================================${NC}"
echo "$RESPONSE_TELE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE_TELE"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Diagnostic Data Extraction${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Extract diagnostic data if present
if echo "$RESPONSE_ATHOME" | grep -q "_debug"; then
  echo -e "${GREEN}✅ Diagnostic data found in at_home response:${NC}"
  echo "$RESPONSE_ATHOME" | python3 -c "import sys, json; data=json.load(sys.stdin); print(json.dumps(data.get('_debug', {}), indent=2))" 2>/dev/null || echo "Could not parse"
else
  echo -e "${YELLOW}⚠️  No _debug field in at_home response${NC}"
fi

echo ""

if echo "$RESPONSE_TELE" | grep -q "_debug"; then
  echo -e "${GREEN}✅ Diagnostic data found in tele response:${NC}"
  echo "$RESPONSE_TELE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(json.dumps(data.get('_debug', {}), indent=2))" 2>/dev/null || echo "Could not parse"
else
  echo -e "${YELLOW}⚠️  No _debug field in tele response${NC}"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "The diagnostic data will show:"
echo "  - Vendor status (approved, active)"
echo "  - Role config structure (vendorConfiguration vs vendorTypes)"
echo "  - Service counts (at_home/tele)"
echo "  - Schedule counts (availability_v2, schedule_slots)"
echo "  - Whether vendor appears in query results"
echo ""
echo -e "${GREEN}Share the diagnostic data above to identify root cause!${NC}"
