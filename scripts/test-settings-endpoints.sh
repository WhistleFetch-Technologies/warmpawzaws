#!/bin/bash

# Test script for vendor settings endpoints
# Usage: ./scripts/test-settings-endpoints.sh <API_BASE_URL> <VENDOR_ID> <AUTH_TOKEN>

set -e

API_BASE_URL="${1:-http://localhost:3000}"
VENDOR_ID="${2}"
AUTH_TOKEN="${3}"

if [ -z "$VENDOR_ID" ] || [ -z "$AUTH_TOKEN" ]; then
  echo "Usage: $0 <API_BASE_URL> <VENDOR_ID> <AUTH_TOKEN>"
  echo "Example: $0 https://api.example.com abc-123-def token123"
  exit 1
fi

echo "🧪 Testing Vendor Settings Endpoints"
echo "API Base URL: $API_BASE_URL"
echo "Vendor ID: $VENDOR_ID"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local description=$4
  
  echo -n "Testing: $description... "
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" -X GET \
      "$API_BASE_URL$endpoint" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json")
  else
    response=$(curl -s -w "\n%{http_code}" -X $method \
      "$API_BASE_URL$endpoint" \
      -H "Authorization: Bearer $AUTH_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  fi
  echo ""
}

# Test 1: Get bank account (should return null for new vendor)
test_endpoint "GET" "/vendor/$VENDOR_ID/bank-account" "" "Get bank account (should be null)"

# Test 2: Create bank account
test_endpoint "POST" "/vendor/$VENDOR_ID/bank-account" '{
  "account_holder_name": "Test Account Holder",
  "account_number": "123456789012",
  "ifsc_code": "HDFC0001234",
  "bank_name": "HDFC Bank",
  "branch_name": "Test Branch"
}' "Create bank account"

# Test 3: Get bank account (should return data)
test_endpoint "GET" "/vendor/$VENDOR_ID/bank-account" "" "Get bank account (should have data)"

# Test 4: Request verification
test_endpoint "POST" "/vendor/$VENDOR_ID/bank-account/verify" "" "Request bank account verification"

# Test 5: Get settings
test_endpoint "GET" "/vendor/$VENDOR_ID/settings" "" "Get vendor settings"

# Test 6: Update settings
test_endpoint "PUT" "/vendor/$VENDOR_ID/settings" '{
  "service_radius": 10.5,
  "emergency_contact": {
    "name": "Emergency Contact",
    "phone": "9876543210"
  },
  "max_dogs_per_walk": 3,
  "walk_durations": ["30", "60"]
}' "Update vendor settings"

# Test 7: Get settings (verify update)
test_endpoint "GET" "/vendor/$VENDOR_ID/settings" "" "Get vendor settings (verify update)"

echo -e "${GREEN}✅ All tests completed!${NC}"
