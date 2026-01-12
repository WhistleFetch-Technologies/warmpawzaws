#!/bin/bash

# Enhanced test script for region seeding endpoints
# This script checks if the server is running and provides helpful guidance

API_URL="${API_URL:-http://localhost:3000}"
BACKEND_DIR="${BACKEND_DIR:-backend/lambda}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🧪 Region Seeding Endpoints Test Suite                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check if server is running
echo "🔍 Checking if server is running on $API_URL..."
if curl -s --connect-timeout 3 "$API_URL/health" > /dev/null 2>&1; then
    echo "✅ Server is running!"
    echo ""
else
    echo "❌ Server is not running on $API_URL"
    echo ""
    echo "📋 To start the server, run in a separate terminal:"
    echo "   cd $BACKEND_DIR"
    echo "   npm run start:local"
    echo ""
    echo "   Or if you don't have the backend directory structure:"
    echo "   Make sure your API is running on port 3000"
    echo ""
    read -p "Press Enter to continue anyway (tests will fail if server is not running)..." -r
    echo ""
fi

# Test 1: Health check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Testing Health Check..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s --max-time 5 "$API_URL/health" 2>&1)
if echo "$RESPONSE" | grep -q "success\|status"; then
    echo "✅ Health check passed"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -10 || echo "$RESPONSE" | head -5
else
    echo "❌ Health check failed - Server may not be running"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 2: Get regions (before seeding)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Testing GET /regions (before seeding)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s --max-time 5 "$API_URL/regions" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" 2>&1)

if echo "$RESPONSE" | grep -q "success\|regions"; then
    echo "✅ Request successful"
    REGIONS_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('total', len(data.get('regions', []))))" 2>/dev/null || echo "?")
    echo "   Current regions: $REGIONS_COUNT"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -20 || echo "$RESPONSE" | head -10
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
    echo "✅ Seeding request successful"
    CREATED=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('stats', {}).get('created', '?'))" 2>/dev/null || echo "?")
    UPDATED=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('stats', {}).get('updated', '?'))" 2>/dev/null || echo "?")
    echo "   Created: $CREATED, Updated: $UPDATED"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
else
    echo "⚠️  Seeding may have failed or server not available"
    echo "Response: $RESPONSE"
fi
echo ""

# Test 4: Get regions (after seeding)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Testing GET /regions (after seeding)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s --max-time 5 "$API_URL/regions" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" 2>&1)

if echo "$RESPONSE" | grep -q "success"; then
    REGIONS_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('total', len(data.get('regions', []))))" 2>/dev/null || echo "?")
    echo "✅ Request successful"
    echo "   Total regions: $REGIONS_COUNT"
    if [ "$REGIONS_COUNT" != "0" ] && [ "$REGIONS_COUNT" != "?" ]; then
        echo "   Region names:"
        echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); regions=data.get('regions', []); [print(f'     - {r.get(\"regionName\", \"Unknown\")} ({r.get(\"regionCode\", \"?\")})') for r in regions[:7]]" 2>/dev/null || echo "     (Unable to parse)"
    fi
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -30 || echo "$RESPONSE" | head -15
else
    echo "⚠️  Response: $RESPONSE"
fi
echo ""

# Test 5: Get specific region (India)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  Testing GET /regions/india..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s --max-time 5 "$API_URL/regions/india" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" 2>&1)

if echo "$RESPONSE" | grep -q "success"; then
    echo "✅ Request successful"
    REGION_NAME=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('region', {}).get('regionName', 'Unknown'))" 2>/dev/null || echo "Unknown")
    echo "   Region: $REGION_NAME"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -40 || echo "$RESPONSE" | head -20
else
    echo "⚠️  Response: $RESPONSE"
fi
echo ""

# Test 6: Toggle status (USA)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  Testing PATCH /admin/regions/usa/status..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s --max-time 5 -X PATCH "$API_URL/admin/regions/usa/status" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" \
  -d '{"isActive": true}' 2>&1)

if echo "$RESPONSE" | grep -q "success"; then
    echo "✅ Status update successful"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
else
    echo "⚠️  Response: $RESPONSE"
    echo "   (This is expected if USA region doesn't exist yet)"
fi
echo ""

# Summary
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    ✅ Testing Complete!                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Summary:"
echo "   • Health check: $(curl -s --max-time 3 "$API_URL/health" > /dev/null 2>&1 && echo "✅ Passed" || echo "❌ Failed")"
echo "   • Endpoints tested: 6"
echo ""
echo "💡 Tips:"
echo "   • If tests failed, make sure the backend server is running"
echo "   • Check server logs for detailed error messages"
echo "   • Verify database connection if seeding fails"
echo ""
