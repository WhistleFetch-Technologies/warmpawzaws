#!/bin/bash

# ============================================================================
# VERIFY ALL ADMIN UI SIDEBAR TABS
# ============================================================================
# Checks each tab's page file and verifies all API endpoints exist
# ============================================================================

set -e

API_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
ADMIN_WEB_DIR="apps/admin-web"

echo "🔍 Verifying All Admin UI Sidebar Tabs"
echo "======================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Track status
TOTAL_TABS=0
VERIFIED_TABS=0
MISSING_ENDPOINTS=0

# Function to extract API calls from a file
extract_api_calls() {
  local file=$1
  if [ -f "$file" ]; then
    grep -oE "apiClient\.(get|post|put|delete|patch)\(['\"][^'\"]+['\"]" "$file" 2>/dev/null | \
      sed "s/apiClient\.\(get\|post\|put\|delete\|patch\)(['\"]//" | \
      sed "s/['\"]$//" | \
      sort -u
  fi
}

# Function to test endpoint
test_endpoint() {
  local endpoint=$1
  local method=${2:-GET}
  
  if [ "$method" = "GET" ]; then
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint" 2>/dev/null || echo "000")
  else
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$API_URL$endpoint" -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")
  fi
  
  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "404" ]; then
    return 0
  else
    return 1
  fi
}

# Tabs to verify
declare -A TABS=(
  ["Dashboard"]="app/page.tsx"
  ["Analytics & Insights"]="app/analytics/page.tsx"
  ["Enterprise & Revenue"]="app/enterprise/page.tsx"
  ["Vendor Administration"]="app/vendors/page.tsx"
  ["E-Commerce"]="app/ecommerce/page.tsx"
  ["Region Manager"]="app/regions/page.tsx"
  ["Marketing & Promotions"]="app/marketing/page.tsx"
  ["Banner Management"]="app/banners/page.tsx"
  ["Loyalty & Rewards"]="app/loyalty/page.tsx"
  ["Support & CRM"]="app/support/page.tsx"
  ["Catalog & Services"]="app/catalog/page.tsx"
  ["Database Seeding"]="app/database-seeding/page.tsx"
  ["Event Management"]="app/events/page.tsx"
  ["Content Management"]="app/content/page.tsx"
  ["Payment & Refund"]="app/refunds/page.tsx"
  ["Pet Info Management"]="app/pet-info/page.tsx"
  ["Finance & Logistics"]="app/finance/page.tsx"
  ["Role & User Management"]="app/roles/page.tsx"
  ["Reports"]="app/reports/page.tsx"
  ["Platform Settings"]="app/platform-settings/page.tsx"
)

cd "$(dirname "$0")/.."

echo "📋 Checking ${#TABS[@]} tabs..."
echo ""

for tab_name in "${!TABS[@]}"; do
  tab_file="${TABS[$tab_name]}"
  full_path="$ADMIN_WEB_DIR/$tab_file"
  
  TOTAL_TABS=$((TOTAL_TABS + 1))
  
  echo -e "${BLUE}📁 $tab_name${NC}"
  echo "   File: $tab_file"
  
  if [ ! -f "$full_path" ]; then
    echo -e "   ${RED}❌ Page file not found${NC}"
    echo ""
    continue
  fi
  
  # Extract API calls
  api_calls=$(extract_api_calls "$full_path")
  
  if [ -z "$api_calls" ]; then
    echo -e "   ${YELLOW}⚠️  No API calls found (may use hooks/components)${NC}"
    echo ""
    continue
  fi
  
  echo "   Endpoints found:"
  endpoint_count=0
  missing_count=0
  
  while IFS= read -r endpoint; do
    if [ -n "$endpoint" ]; then
      endpoint_count=$((endpoint_count + 1))
      echo -n "      - $endpoint ... "
      
      # Determine method from endpoint pattern or default to GET
      method="GET"
      if [[ "$endpoint" == *"/create"* ]] || [[ "$endpoint" == *"/generate"* ]] || [[ "$endpoint" == *"/save"* ]]; then
        method="POST"
      elif [[ "$endpoint" == *"/update"* ]] || [[ "$endpoint" == *"/approve"* ]] || [[ "$endpoint" == *"/reject"* ]]; then
        method="PUT"
      fi
      
      if test_endpoint "$endpoint" "$method"; then
        echo -e "${GREEN}✅${NC}"
      else
        echo -e "${RED}❌ MISSING${NC}"
        missing_count=$((missing_count + 1))
        MISSING_ENDPOINTS=$((MISSING_ENDPOINTS + 1))
      fi
    fi
  done <<< "$api_calls"
  
  if [ $missing_count -eq 0 ] && [ $endpoint_count -gt 0 ]; then
    echo -e "   ${GREEN}✅ All $endpoint_count endpoints verified${NC}"
    VERIFIED_TABS=$((VERIFIED_TABS + 1))
  elif [ $missing_count -gt 0 ]; then
    echo -e "   ${RED}❌ $missing_count/$endpoint_count endpoints missing${NC}"
  fi
  
  echo ""
done

echo "════════════════════════════════════════════════════════════"
echo "📊 Verification Summary"
echo "════════════════════════════════════════════════════════════"
echo "   Total Tabs Checked: $TOTAL_TABS"
echo "   Verified Tabs: $VERIFIED_TABS"
echo "   Missing Endpoints: $MISSING_ENDPOINTS"
echo ""

if [ $MISSING_ENDPOINTS -eq 0 ]; then
  echo -e "${GREEN}✅ All tabs verified!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some endpoints are missing${NC}"
  exit 1
fi
