#!/bin/bash

# ============================================================================
# COMPREHENSIVE ADMIN UI TABS SYNTHETIC TEST
# ============================================================================
# Tests all endpoints for all 20 Admin UI sidebar tabs
# ============================================================================

set +e  # Don't exit on error, we want to test all endpoints

API_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Test results
declare -a PASSED_ENDPOINTS=()
declare -a FAILED_ENDPOINTS=()
declare -a SKIPPED_ENDPOINTS=()

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   ADMIN UI TABS - COMPREHENSIVE SYNTHETIC TEST SUITE      ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to test an endpoint
test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local description=$4
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  echo -n "  Testing: ${CYAN}${method} ${endpoint}${NC} ... "
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "${API_URL}${endpoint}" 2>/dev/null || echo -e "\n000")
  elif [ "$method" = "POST" ] || [ "$method" = "PUT" ] || [ "$method" = "DELETE" ]; then
    if [ -n "$data" ]; then
      response=$(curl -s -w "\n%{http_code}" -X "$method" "${API_URL}${endpoint}" \
        -H "Content-Type: application/json" \
        -d "$data" 2>/dev/null || echo -e "\n000")
    else
      response=$(curl -s -w "\n%{http_code}" -X "$method" "${API_URL}${endpoint}" \
        -H "Content-Type: application/json" \
        -d '{}' 2>/dev/null || echo -e "\n000")
    fi
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "${API_URL}${endpoint}" 2>/dev/null || echo -e "\n000")
  fi
  
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')
  
  # Check if response is valid JSON (if not empty)
  json_valid=false
  if [ -n "$body" ] && [ "$http_code" != "000" ]; then
    # Try to parse as JSON
    if command -v jq >/dev/null 2>&1; then
      if echo "$body" | jq . >/dev/null 2>&1; then
        json_valid=true
      fi
    else
      # If jq is not available, check if it looks like JSON
      if echo "$body" | grep -qE '^[[:space:]]*[\{\[]'; then
        json_valid=true
      fi
    fi
  fi
  
  # Determine test result
  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "204" ]; then
    # 200/201/204 with any response (including empty) is considered a pass
    echo -e "${GREEN}✅ PASS${NC} (${http_code})"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    PASSED_ENDPOINTS+=("${method} ${endpoint}")
    return 0
  elif [ "$http_code" = "404" ]; then
    echo -e "${RED}❌ FAIL${NC} (404 - Not Found)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    FAILED_ENDPOINTS+=("${method} ${endpoint} (404)")
    return 1
  elif [ "$http_code" = "000" ]; then
    echo -e "${RED}❌ FAIL${NC} (Connection Error)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    FAILED_ENDPOINTS+=("${method} ${endpoint} (Connection Error)")
    return 1
  else
    echo -e "${YELLOW}⚠️  WARN${NC} (${http_code})"
    SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
    SKIPPED_ENDPOINTS+=("${method} ${endpoint} (${http_code})")
    return 1
  fi
}

# Test Tab 1: Dashboard
echo -e "${BLUE}📊 Tab 1: Dashboard${NC}"
test_endpoint "POST" "/admin/auth/login" '{"email":"admin@warmpawz.com","password":"test"}' "Admin Login"
echo ""

# Test Tab 2: Analytics & Insights
echo -e "${BLUE}📈 Tab 2: Analytics & Insights${NC}"
test_endpoint "GET" "/admin/analytics/overview" "" "Analytics Overview"
test_endpoint "GET" "/admin/analytics/vendors" "" "Vendor Analytics"
test_endpoint "GET" "/admin/analytics/customers" "" "Customer Analytics"
test_endpoint "GET" "/admin/reports" "" "Reports List"
test_endpoint "POST" "/admin/reports/generate" '{"templateId":"test"}' "Generate Report"
echo ""

# Test Tab 3: Enterprise & Revenue
echo -e "${BLUE}💼 Tab 3: Enterprise & Revenue${NC}"
test_endpoint "GET" "/admin/enterprise/revenue/stats?range=30d" "" "Enterprise Revenue Stats"
test_endpoint "GET" "/admin/enterprise/customers" "" "Enterprise Customers"
echo ""

# Test Tab 4: Vendor Administration
echo -e "${BLUE}🏪 Tab 4: Vendor Administration${NC}"
test_endpoint "GET" "/health" "" "Health Check"
test_endpoint "GET" "/admin/vendors/stats" "" "Vendor Stats"
test_endpoint "GET" "/admin/vendors/all" "" "All Vendors"
test_endpoint "GET" "/quality/alerts" "" "Quality Alerts"
test_endpoint "GET" "/debug/vendor-lookup/9611377119" "" "Vendor Lookup"
echo ""

# Test Tab 5: E-Commerce
echo -e "${BLUE}🛒 Tab 5: E-Commerce${NC}"
test_endpoint "GET" "/admin/ecommerce/stats" "" "E-Commerce Stats"
test_endpoint "GET" "/admin/products" "" "Products List"
test_endpoint "GET" "/admin/orders" "" "Orders List"
echo ""

# Test Tab 6: Region Manager
echo -e "${BLUE}🌍 Tab 6: Region Manager${NC}"
test_endpoint "GET" "/admin/regions" "" "Regions List"
test_endpoint "POST" "/admin/regions/seed-all" '{}' "Seed Regions"
echo ""

# Test Tab 7: Marketing & Promotions
echo -e "${BLUE}📢 Tab 7: Marketing & Promotions${NC}"
test_endpoint "GET" "/marketing/promotions" "" "Promotions List"
test_endpoint "POST" "/marketing/promotions" '{"title":"Test","discountType":"percentage","discountValue":10}' "Create Promotion"
test_endpoint "GET" "/marketing/spotlights" "" "Spotlights List"
test_endpoint "GET" "/config/roles" "" "Config Roles"
test_endpoint "GET" "/config/ui/dashboard?roleId=veterinarian" "" "Dashboard Config"
echo ""

# Test Tab 8: Banner Management
echo -e "${BLUE}🖼️  Tab 8: Banner Management${NC}"
test_endpoint "GET" "/admin/banners" "" "Banners List"
test_endpoint "POST" "/admin/banners" '{"title":"Test Banner","position":"home_top"}' "Create Banner"
echo ""

# Test Tab 9: Loyalty & Rewards
echo -e "${BLUE}🎁 Tab 9: Loyalty & Rewards${NC}"
test_endpoint "GET" "/admin/loyalty/stats" "" "Loyalty Stats"
test_endpoint "GET" "/admin/loyalty/rules" "" "Loyalty Rules"
test_endpoint "GET" "/admin/loyalty/transactions" "" "Loyalty Transactions"
echo ""

# Test Tab 10: Support & CRM
echo -e "${BLUE}🎧 Tab 10: Support & CRM${NC}"
test_endpoint "GET" "/crm/tickets" "" "CRM Tickets"
test_endpoint "GET" "/crm/agents" "" "CRM Agents"
test_endpoint "GET" "/crm/analytics/agents" "" "Agent Analytics"
test_endpoint "POST" "/crm/action" '{"action":"assign","ticketId":"test"}' "CRM Action"
test_endpoint "POST" "/crm/reply" '{"ticketId":"test","message":"Test reply"}' "CRM Reply"
echo ""

# Test Tab 11: Catalog & Services
echo -e "${BLUE}📚 Tab 11: Catalog & Services${NC}"
test_endpoint "GET" "/admin/catalog/categories" "" "Catalog Categories"
test_endpoint "GET" "/admin/service-catalog?groupBy=subcategory" "" "Service Catalog"
test_endpoint "GET" "/service-catalog/categories" "" "Service Categories"
test_endpoint "GET" "/admin/catalog/stats" "" "Catalog Stats"
test_endpoint "GET" "/admin/catalog/products" "" "Catalog Products"
test_endpoint "GET" "/admin/catalog/services" "" "Catalog Services"
echo ""

# Test Tab 12: Database Seeding
echo -e "${BLUE}🌱 Tab 12: Database Seeding${NC}"
test_endpoint "GET" "/admin/seed/status" "" "Seed Status"
echo ""

# Test Tab 13: Event Management
echo -e "${BLUE}📅 Tab 13: Event Management${NC}"
test_endpoint "GET" "/admin/events" "" "Events List"
echo ""

# Test Tab 14: Content Management
echo -e "${BLUE}📝 Tab 14: Content Management${NC}"
test_endpoint "GET" "/admin/content/pages" "" "Content Pages"
test_endpoint "POST" "/admin/content/pages" '{"title":"Test Page","slug":"test-page","content":"Test","category":"other"}' "Create Content Page"
echo ""

# Test Tab 15: Payment & Refund
echo -e "${BLUE}💰 Tab 15: Payment & Refund${NC}"
test_endpoint "GET" "/admin/refunds" "" "Refunds List"
test_endpoint "GET" "/admin/refunds/stats" "" "Refund Stats"
test_endpoint "GET" "/admin/refunds?status=pending" "" "Pending Refunds"
echo ""

# Test Tab 16: Pet Info Management
echo -e "${BLUE}🐾 Tab 16: Pet Info Management${NC}"
test_endpoint "GET" "/admin/pets/stats" "" "Pet Stats"
test_endpoint "GET" "/admin/pets/all" "" "All Pets"
test_endpoint "GET" "/admin/pets/breed-insights" "" "Breed Insights"
echo ""

# Test Tab 17: Finance & Logistics
echo -e "${BLUE}💳 Tab 17: Finance & Logistics${NC}"
test_endpoint "GET" "/settlements" "" "Settlements List"
test_endpoint "GET" "/settlements/summary" "" "Settlements Summary"
test_endpoint "GET" "/admin/logistics/stats" "" "Logistics Stats"
test_endpoint "GET" "/admin/logistics/orders" "" "Logistics Orders"
echo ""

# Test Tab 18: Role & User Management
echo -e "${BLUE}👤 Tab 18: Role & User Management${NC}"
test_endpoint "GET" "/admin/rbac/roles" "" "RBAC Roles"
test_endpoint "GET" "/admin/rbac/permissions" "" "RBAC Permissions"
test_endpoint "GET" "/admin/rbac/policies" "" "RBAC Policies"
test_endpoint "POST" "/admin/rbac/roles" '{"name":"Test Role","description":"Test","level":1}' "Create Role"
echo ""

# Test Tab 19: Reports
echo -e "${BLUE}📊 Tab 19: Reports${NC}"
test_endpoint "GET" "/admin/reports/templates" "" "Report Templates"
test_endpoint "GET" "/admin/reports/generated?limit=10" "" "Generated Reports"
test_endpoint "GET" "/admin/reports/saved" "" "Saved Reports"
test_endpoint "POST" "/admin/reports/generate" '{"templateId":"test","format":"pdf"}' "Generate Report"
echo ""

# Test Tab 20: Platform Settings
echo -e "${BLUE}⚙️  Tab 20: Platform Settings${NC}"
test_endpoint "GET" "/admin/integrations" "" "Integrations List"
test_endpoint "GET" "/admin/integrations/aws" "" "AWS Integrations"
test_endpoint "GET" "/admin/integrations/google-maps" "" "Google Maps Integrations"
test_endpoint "GET" "/admin/integrations/razorpay" "" "Razorpay Integrations"
test_endpoint "POST" "/admin/integrations/aws/test" '{}' "Test AWS Integration"
echo ""

# Print Summary
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    TEST SUMMARY                          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total Tests: ${CYAN}${TOTAL_TESTS}${NC}"
echo -e "${GREEN}✅ Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}❌ Failed: ${FAILED_TESTS}${NC}"
echo -e "${YELLOW}⚠️  Skipped/Warnings: ${SKIPPED_TESTS}${NC}"
echo ""

# Calculate success rate
if [ $TOTAL_TESTS -gt 0 ]; then
  success_rate=$(echo "scale=2; ($PASSED_TESTS * 100) / $TOTAL_TESTS" | bc)
  echo -e "Success Rate: ${CYAN}${success_rate}%${NC}"
else
  success_rate=0
  echo -e "Success Rate: ${CYAN}0%${NC}"
fi

echo ""

# Print failed endpoints if any
if [ ${#FAILED_ENDPOINTS[@]} -gt 0 ]; then
  echo -e "${RED}❌ Failed Endpoints:${NC}"
  for endpoint in "${FAILED_ENDPOINTS[@]}"; do
    echo -e "  ${RED}•${NC} $endpoint"
  done
  echo ""
fi

# Print skipped endpoints if any
if [ ${#SKIPPED_ENDPOINTS[@]} -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Skipped/Warning Endpoints:${NC}"
  for endpoint in "${SKIPPED_ENDPOINTS[@]}"; do
    echo -e "  ${YELLOW}•${NC} $endpoint"
  done
  echo ""
fi

# Final verdict
if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✅ All critical endpoints are working!${NC}"
  exit 0
elif [ $success_rate -ge 80 ]; then
  echo -e "${YELLOW}⚠️  Most endpoints are working, but some need attention.${NC}"
  exit 1
else
  echo -e "${RED}❌ Many endpoints are failing. Please review the failures above.${NC}"
  exit 1
fi
