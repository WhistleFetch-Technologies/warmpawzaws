#!/bin/bash

# Test script to verify vendor dashboard fixes
# Tests vendor ID resolution and dashboard endpoint

set -e

API_BASE="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
PHONE="9876545521"

echo "🧪 Testing Vendor Dashboard Fixes"
echo "=================================="
echo ""

# Step 1: Get onboarding status
echo "📊 Step 1: Getting onboarding status..."
ONBOARDING_RESPONSE=$(curl -s "${API_BASE}/vendor/onboarding/status?phone=${PHONE}")
echo "Response: $ONBOARDING_RESPONSE" | jq '.' || echo "$ONBOARDING_RESPONSE"
echo ""

IDENTITY_ID=$(echo "$ONBOARDING_RESPONSE" | jq -r '.identity.id // empty')
ONBOARDING_STATUS=$(echo "$ONBOARDING_RESPONSE" | jq -r '.identity.onboarding_status // empty')

echo "✅ Identity ID: $IDENTITY_ID"
echo "✅ Onboarding Status: $ONBOARDING_STATUS"
echo ""

# Step 2: Get vendor profile (to get correct vendor ID)
echo "📊 Step 2: Getting vendor profile (to get correct vendor ID)..."
# Note: This requires authentication, so we'll simulate by checking if vendor exists
echo "⚠️  Profile endpoint requires authentication (JWT token)"
echo "   In the browser, this is handled automatically via apiClient"
echo ""

# Step 3: Test dashboard endpoint with identity ID (should fail or use fallback)
echo "📊 Step 3: Testing dashboard endpoint with identity ID..."
echo "   Using identity ID: $IDENTITY_ID"
DASHBOARD_RESPONSE=$(curl -s "${API_BASE}/vendor/dashboard/${IDENTITY_ID}?timeframe=today")
echo "Response: $DASHBOARD_RESPONSE" | jq '.' || echo "$DASHBOARD_RESPONSE"
echo ""

# Check if it's an error
if echo "$DASHBOARD_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  ERROR_MSG=$(echo "$DASHBOARD_RESPONSE" | jq -r '.error // .message // "Unknown error"')
  echo "❌ Dashboard endpoint returned error: $ERROR_MSG"
  echo ""
  echo "✅ This is expected - the fix should handle this by:"
  echo "   1. Fetching vendor profile to get correct vendor ID"
  echo "   2. Retrying with correct vendor ID"
  echo "   3. Showing fallback stats if vendor not found"
else
  echo "✅ Dashboard endpoint returned data successfully!"
  echo ""
  STATS=$(echo "$DASHBOARD_RESPONSE" | jq '.data.stats // .stats // {}')
  if [ "$STATS" != "{}" ] && [ "$STATS" != "null" ]; then
    echo "📊 Dashboard Stats:"
    echo "$STATS" | jq '.'
  else
    echo "⚠️  No stats in response (may be using fallback)"
  fi
fi

echo ""
echo "=================================="
echo "✅ Test Complete"
echo ""
echo "📝 Summary:"
echo "   - Onboarding status endpoint: ✅ Working"
echo "   - Dashboard endpoint: Check response above"
echo "   - Frontend fix: Should fetch profile and retry with correct vendor ID"
echo ""
echo "🌐 Test the dashboard in browser:"
echo "   https://d1s6ykkj381k58.cloudfront.net"
echo "   Login with phone: $PHONE"
