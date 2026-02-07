#!/bin/bash

# Test script for region seeding endpoints - AWS version
# This script tests against AWS API Gateway endpoint

AWS_API_ENDPOINT="${AWS_API_ENDPOINT:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
API_URL="${API_URL:-$AWS_API_ENDPOINT}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🧪 Region Seeding Endpoints Test Suite (AWS)            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Testing against AWS API Gateway"
echo "Endpoint: $API_URL"
echo ""

# Check AWS connectivity
echo "🔍 Checking AWS endpoint connectivity..."
if curl -s --connect-timeout 5 --max-time 10 "$API_URL/health" > /dev/null 2>&1; then
    echo "✅ AWS endpoint is accessible!"
    echo ""
else
    echo "❌ AWS endpoint is not accessible. Checking configuration..."
    echo ""
    # Try to get endpoint from AWS CLI
    echo "🔍 Getting API Gateway endpoint from AWS..."
    NEW_ENDPOINT=$(aws apigatewayv2 get-apis --region ap-south-1 --query 'Items[?Name==`warmpawz-dev-api`].ApiEndpoint' --output text 2>/dev/null)
    if [ ! -z "$NEW_ENDPOINT" ] && [ "$NEW_ENDPOINT" != "None" ]; then
        API_URL="$NEW_ENDPOINT"
        echo "✅ Found endpoint: $API_URL"
        echo ""
    else
        echo "❌ Cannot find API Gateway endpoint"
        echo "   Falling back to local server..."
        API_URL="http://localhost:3000"
        echo "   Testing local: $API_URL"
        echo ""
    fi
fi

# Test 1: Health check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Testing Health Check..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s --max-time 10 "$API_URL/health" 2>&1)
if echo "$RESPONSE" | grep -q "success\|status\|ok"; then
    echo "✅ Health check passed"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -10 || echo "$RESPONSE" | head -5
else
    echo "⚠️  Health check response: $RESPONSE"
fi
echo ""

# Test 2: Get regions (before seeding)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Testing GET /regions (before seeding)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s --max-time 10 "$API_URL/regions" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" \
  -H "Content-Type: application/json" 2>&1)

if echo "$RESPONSE" | grep -q "success\|regions"; then
    echo "✅ Request successful"
    REGIONS_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('total', len(data.get('regions', []))))" 2>/dev/null || echo "?")
    echo "   Current regions: $REGIONS_COUNT"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -25 || echo "$RESPONSE" | head -10
else
    echo "⚠️  Response: $RESPONSE"
fi
echo ""

# Test 3: Seed all regions
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Testing POST /admin/regions/seed-all..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s --max-time 30 -X POST "$API_URL/admin/regions/seed-all" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" \
  -d '{}' 2>&1)

if echo "$RESPONSE" | grep -q "success"; then
    echo "✅ Seeding request successful!"
    CREATED=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('stats', {}).get('created', '?'))" 2>/dev/null || echo "?")
    UPDATED=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('stats', {}).get('updated', '?'))" 2>/dev/null || echo "?")
    ERRORS=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); errors=data.get('stats', {}).get('errors', []); print(len(errors))" 2>/dev/null || echo "?")
    echo "   📊 Stats: Created=$CREATED, Updated=$UPDATED, Errors=$ERRORS"
    echo ""
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
else
    echo "⚠️  Seeding may have failed or requires authentication"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 4: Get regions (after seeding)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Testing GET /regions (after seeding)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sleep 2  # Wait a moment for database write
RESPONSE=$(curl -s --max-time 10 "$API_URL/regions" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" \
  -H "Content-Type: application/json" 2>&1)

if echo "$RESPONSE" | grep -q "success"; then
    REGIONS_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('total', len(data.get('regions', []))))" 2>/dev/null || echo "?")
    echo "✅ Request successful"
    echo "   Total regions: $REGIONS_COUNT"
    if [ "$REGIONS_COUNT" != "0" ] && [ "$REGIONS_COUNT" != "?" ]; then
        echo "   Region names:"
        echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); regions=data.get('regions', []); [print(f'     • {r.get(\"regionName\", \"Unknown\")} ({r.get(\"regionCode\", \"?\")}) - {\"✅ Active\" if r.get(\"isActive\") else \"❌ Inactive\"}') for r in regions[:10]]" 2>/dev/null || echo "     (Unable to parse)"
    fi
    echo ""
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -40 || echo "$RESPONSE" | head -15
else
    echo "⚠️  Response: $RESPONSE"
fi
echo ""

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    ✅ Testing Complete!                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "   • Endpoint: $API_URL"
echo "   • Tests completed: 4"
echo ""
