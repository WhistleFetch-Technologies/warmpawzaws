#!/bin/bash

# ============================================================================
# TEST ENDPOINTS VIA API GATEWAY (CLOUDFRONT)
# ============================================================================
# Tests all Admin UI endpoints using curl and AWS CLI
# ============================================================================

set +e

API_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
API_ID="z0b3obweb6"
REGION="ap-south-1"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
TOTAL=0
PASSED=0
FAILED=0

echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   TESTING ENDPOINTS VIA API GATEWAY (CLOUDFRONT)         ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "API URL: ${BLUE}${API_URL}${NC}"
echo -e "API ID: ${BLUE}${API_ID}${NC}"
echo -e "Region: ${BLUE}${REGION}${NC}"
echo ""

# Function to test endpoint with curl
test_curl() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  TOTAL=$((TOTAL + 1))
  
  echo -n "  Testing ${CYAN}${method} ${endpoint}${NC} ... "
  
  if [ "$method" = "GET" ]; then
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}${endpoint}" 2>/dev/null || echo "000")
  else
    if [ -n "$data" ]; then
      http_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "${API_URL}${endpoint}" \
        -H "Content-Type: application/json" \
        -d "$data" 2>/dev/null || echo "000")
    else
      http_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "${API_URL}${endpoint}" \
        -H "Content-Type: application/json" \
        -d '{}' 2>/dev/null || echo "000")
    fi
  fi
  
  if [ "$http_code" = "200" ] || [ "$http_code" = "201" ] || [ "$http_code" = "204" ]; then
    echo -e "${GREEN}✅ PASS${NC} (${http_code})"
    PASSED=$((PASSED + 1))
    return 0
  elif [ "$http_code" = "404" ]; then
    echo -e "${RED}❌ FAIL${NC} (404)"
    FAILED=$((FAILED + 1))
    return 1
  else
    echo -e "${YELLOW}⚠️  ${http_code}${NC}"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

# Function to test endpoint with AWS CLI
test_aws_cli() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  echo -n "  Testing ${CYAN}${method} ${endpoint}${NC} (AWS CLI) ... "
  
  # Remove leading slash for API Gateway path
  path="${endpoint#/}"
  
  if [ "$method" = "GET" ]; then
    response=$(aws apigatewaymanagementapi post-to-connection \
      --api-id "$API_ID" \
      --connection-id "test" \
      --data "GET ${path}" \
      --region "$REGION" 2>&1)
  else
    # For POST/PUT/DELETE, use API Gateway test invoke
    response=$(aws apigateway test-invoke-method \
      --rest-api-id "$API_ID" \
      --resource-id "test" \
      --http-method "$method" \
      --path-with-query-string "$path" \
      --body "$data" \
      --region "$REGION" 2>&1)
  fi
  
  if echo "$response" | grep -q "status.*200\|200"; then
    echo -e "${GREEN}✅ PASS${NC}"
    return 0
  else
    echo -e "${YELLOW}⚠️  Check manually${NC}"
    return 1
  fi
}

echo -e "${BLUE}📊 Testing Core Endpoints${NC}"
echo "────────────────────────────────────────────────────────────"

# Test health endpoint
test_curl "GET" "/health" ""

# Test admin endpoints
test_curl "GET" "/admin/vendors/stats" ""
test_curl "GET" "/admin/vendors/all" ""

# Test new endpoints
echo ""
echo -e "${BLUE}⭐ Testing Newly Created Endpoints${NC}"
echo "────────────────────────────────────────────────────────────"

test_curl "GET" "/admin/enterprise/revenue/stats?range=30d" ""
test_curl "GET" "/admin/enterprise/customers" ""
test_curl "GET" "/admin/content/pages" ""
test_curl "GET" "/admin/pets/stats" ""
test_curl "GET" "/admin/pets/all" ""
test_curl "GET" "/admin/pets/breed-insights" ""
test_curl "GET" "/crm/tickets" ""
test_curl "GET" "/crm/agents" ""
test_curl "GET" "/admin/refunds" ""
test_curl "GET" "/admin/refunds/stats" ""
test_curl "GET" "/settlements" ""
test_curl "GET" "/settlements/summary" ""

# Test customer endpoints (newly registered)
echo ""
echo -e "${BLUE}👤 Testing Customer Endpoints (Newly Registered)${NC}"
echo "────────────────────────────────────────────────────────────"

test_curl "GET" "/customer/profile/9611377119" ""
test_curl "GET" "/customer/bookings/9611377119" ""

# Test service discovery
echo ""
echo -e "${BLUE}🔍 Testing Service Discovery${NC}"
echo "────────────────────────────────────────────────────────────"

test_curl "GET" "/services/discover" ""

# Test notifications
echo ""
echo -e "${BLUE}🔔 Testing Notifications${NC}"
echo "────────────────────────────────────────────────────────────"

test_curl "GET" "/notifications" ""

# Summary
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    TEST SUMMARY                          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total Tests: ${CYAN}${TOTAL}${NC}"
echo -e "${GREEN}✅ Passed: ${PASSED}${NC}"
echo -e "${RED}❌ Failed: ${FAILED}${NC}"

if [ $TOTAL -gt 0 ]; then
  success_rate=$(echo "scale=2; ($PASSED * 100) / $TOTAL" | bc)
  echo -e "Success Rate: ${CYAN}${success_rate}%${NC}"
fi

echo ""
echo -e "${BLUE}📋 Testing with AWS CLI (API Gateway)${NC}"
echo "────────────────────────────────────────────────────────────"
echo ""
echo "To test with AWS CLI, use:"
echo "  aws apigateway get-rest-apis --region $REGION"
echo "  aws apigateway get-resources --rest-api-id $API_ID --region $REGION"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Some tests failed. Review above.${NC}"
  exit 1
fi
