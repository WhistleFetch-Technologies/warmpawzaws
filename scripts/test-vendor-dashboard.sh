#!/bin/bash

# Test Vendor Dashboard Endpoints for phone 9876545521
# This script tests the vendor dashboard API endpoints

API_BASE_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
PHONE="9876545521"

echo "=========================================="
echo "Testing Vendor Dashboard Endpoints"
echo "Phone: $PHONE"
echo "API Base URL: $API_BASE_URL"
echo "=========================================="
echo ""

# Step 1: Get vendor onboarding status to find vendor ID
echo "1. Getting vendor onboarding status..."
ONBOARDING_RESPONSE=$(curl -s -X GET "${API_BASE_URL}/vendor/onboarding/status?phone=${PHONE}" \
  -H "Content-Type: application/json")

echo "Onboarding Status Response:"
echo "$ONBOARDING_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$ONBOARDING_RESPONSE"
echo ""

# Extract identity ID
IDENTITY_ID=$(echo "$ONBOARDING_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('data', {}).get('identity', {}).get('id', ''))" 2>/dev/null)

if [ -z "$IDENTITY_ID" ]; then
  echo "❌ Failed to get identity ID"
  exit 1
fi

echo "✅ Identity ID: $IDENTITY_ID"
echo ""

# Step 2: Test vendor dashboard endpoint (using identity ID as vendor ID)
echo "2. Testing vendor dashboard endpoint..."
echo "   Endpoint: GET /vendor/dashboard/${IDENTITY_ID}?timeframe=today"
echo ""

DASHBOARD_RESPONSE=$(curl -s -X GET "${API_BASE_URL}/vendor/dashboard/${IDENTITY_ID}?timeframe=today" \
  -H "Content-Type: application/json")

echo "Dashboard Response:"
echo "$DASHBOARD_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$DASHBOARD_RESPONSE"
echo ""

# Check if response is successful
if echo "$DASHBOARD_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); exit(0 if data.get('success') else 1)" 2>/dev/null; then
  echo "✅ Dashboard endpoint returned success"
  
  # Extract key stats
  STATS=$(echo "$DASHBOARD_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps(data.get('data', {}).get('stats', {}), indent=2))" 2>/dev/null)
  if [ ! -z "$STATS" ]; then
    echo ""
    echo "Dashboard Stats:"
    echo "$STATS"
  fi
else
  echo "❌ Dashboard endpoint returned error"
  ERROR_MSG=$(echo "$DASHBOARD_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('error', 'Unknown error'))" 2>/dev/null)
  echo "Error: $ERROR_MSG"
fi

echo ""
echo "=========================================="
echo "Test Complete"
echo "=========================================="
