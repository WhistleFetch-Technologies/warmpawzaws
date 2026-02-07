#!/bin/bash

# ============================================================================
# CORS FIX VERIFICATION SCRIPT
# ============================================================================
# Tests that OPTIONS preflight requests return 200 OK with proper CORS headers
# ============================================================================

set -e

API_BASE="${API_ENDPOINT:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
ORIGIN="${ORIGIN:-https://dfof7mguaa0a5.cloudfront.net}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 Testing CORS Fix${NC}"
echo "===================================="
echo "API Base: $API_BASE"
echo "Origin: $ORIGIN"
echo ""

# Test endpoints that were failing
ENDPOINTS=(
  "/admin/service-catalog?groupBy=subcategory"
  "/admin/catalog/categories"
  "/admin/catalog/stats"
  "/admin/roles"
  "/service-catalog/categories"
)

PASSED=0
FAILED=0

test_cors_preflight() {
  local endpoint=$1
  local full_url="${API_BASE}${endpoint}"
  
  echo -e "${BLUE}Testing OPTIONS ${endpoint}${NC}"
  
  # Make OPTIONS request
  response=$(curl -s -w "\n%{http_code}\n%{header_json}" \
    -X OPTIONS \
    -H "Origin: ${ORIGIN}" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: authorization,content-type,x-api-key,x-uat-mode,x-uat-token" \
    "${full_url}" 2>&1)
  
  # Extract HTTP status code (second to last line)
  http_code=$(echo "$response" | tail -n 2 | head -n 1)
  body=$(echo "$response" | sed '$d' | sed '$d')
  
  # Check if status is 200 (not 204)
  if [ "$http_code" = "200" ]; then
    echo -e "  ${GREEN}✓ Status: $http_code OK${NC}"
    
    # Check for CORS headers in response
    cors_headers=$(curl -s -I -X OPTIONS \
      -H "Origin: ${ORIGIN}" \
      -H "Access-Control-Request-Method: GET" \
      -H "Access-Control-Request-Headers: authorization,content-type" \
      "${full_url}" 2>&1)
    
    if echo "$cors_headers" | grep -qi "access-control-allow-origin"; then
      echo -e "  ${GREEN}✓ CORS headers present${NC}"
      
      # Extract and show CORS headers
      echo "$cors_headers" | grep -i "access-control" | sed 's/^/    /'
      
      ((PASSED++))
      echo -e "  ${GREEN}✅ PASS${NC}\n"
      return 0
    else
      echo -e "  ${RED}✗ CORS headers missing${NC}"
      ((FAILED++))
      echo -e "  ${RED}❌ FAIL${NC}\n"
      return 1
    fi
  elif [ "$http_code" = "204" ]; then
    echo -e "  ${YELLOW}⚠ Status: $http_code (should be 200)${NC}"
    echo -e "  ${YELLOW}⚠ Lambda may not be updated yet${NC}"
    ((FAILED++))
    echo -e "  ${RED}❌ FAIL${NC}\n"
    return 1
  else
    echo -e "  ${RED}✗ Status: $http_code (expected 200)${NC}"
    echo -e "  ${RED}Response: $body${NC}" | head -5
    ((FAILED++))
    echo -e "  ${RED}❌ FAIL${NC}\n"
    return 1
  fi
}

# Test each endpoint
for endpoint in "${ENDPOINTS[@]}"; do
  test_cors_preflight "$endpoint"
done

# Summary
echo "===================================="
echo -e "${BLUE}Summary:${NC}"
echo -e "  ${GREEN}Passed: $PASSED${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
  echo -e "\n${GREEN}✅ All CORS preflight tests passed!${NC}"
  echo -e "${GREEN}The CORS fix is working correctly.${NC}"
  exit 0
else
  echo -e "\n${RED}❌ Some tests failed.${NC}"
  echo -e "${YELLOW}Make sure the Lambda function has been deployed with the latest changes.${NC}"
  exit 1
fi
