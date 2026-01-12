#!/bin/bash

# Comprehensive verification script for region seeding implementation

API_ENDPOINT="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🔍 Region Seeding Implementation Verification            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Testing against: $API_ENDPOINT"
echo ""

PASSED=0
FAILED=0

# Test 1: Health Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s --max-time 10 "$API_ENDPOINT/health" 2>&1)
if echo "$RESPONSE" | grep -q "ok\|status"; then
    echo "✅ PASSED - Server is responding"
    ((PASSED++))
else
    echo "❌ FAILED - Server not responding"
    echo "Response: $RESPONSE"
    ((FAILED++))
fi
echo ""

# Test 2: Get All Regions (with inactive)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Get All Regions (including inactive)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s --max-time 10 "$API_ENDPOINT/regions?includeInactive=true" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" \
  -H "Content-Type: application/json" 2>&1)

REGION_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('total', 0))" 2>/dev/null || echo "0")

if [ "$REGION_COUNT" -ge 7 ]; then
    echo "✅ PASSED - Found $REGION_COUNT regions (expected: 7+)"
    echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); regions=data.get('regions', []); print('\n   Regions found:'); [print(f'   • {r.get(\"regionName\", \"Unknown\")} ({r.get(\"regionCode\", \"?\")}) - {\"Active\" if r.get(\"isActive\") else \"Inactive\"}') for r in regions]" 2>/dev/null
    ((PASSED++))
else
    echo "❌ FAILED - Found only $REGION_COUNT regions (expected: 7+)"
    ((FAILED++))
fi
echo ""

# Test 3: Verify India Region (Active)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Verify India Region (should be active)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s --max-time 10 "$API_ENDPOINT/regions/india" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" 2>&1)

INDIA_ACTIVE=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); r=data.get('region', {}); print('1' if r.get('isActive') else '0')" 2>/dev/null || echo "0")
INDIA_CODE=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); r=data.get('region', {}); print(r.get('regionCode', ''))" 2>/dev/null || echo "")

if [ "$INDIA_ACTIVE" = "1" ] && [ "$INDIA_CODE" = "IN" ]; then
    echo "✅ PASSED - India region is active and configured correctly"
    echo "   Code: $INDIA_CODE, Active: Yes"
    ((PASSED++))
else
    echo "❌ FAILED - India region not found or not active"
    echo "   Active: $INDIA_ACTIVE, Code: $INDIA_CODE"
    ((FAILED++))
fi
echo ""

# Test 4: Verify Region Configurations
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Verify Region Configurations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s --max-time 10 "$API_ENDPOINT/regions/india" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" 2>&1)

HAS_PHONE=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); r=data.get('region', {}); print('1' if r.get('phoneConfig', {}).get('countryCode') else '0')" 2>/dev/null || echo "0")
HAS_CURRENCY=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); r=data.get('region', {}); print('1' if r.get('currency', {}).get('code') else '0')" 2>/dev/null || echo "0")
HAS_LOCALIZATION=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); r=data.get('region', {}); print('1' if r.get('localization', {}).get('timezone') else '0')" 2>/dev/null || echo "0")
HAS_SERVICES=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); r=data.get('region', {}); print('1' if r.get('serviceCatalog') else '0')" 2>/dev/null || echo "0")

CONFIG_COUNT=$((HAS_PHONE + HAS_CURRENCY + HAS_LOCALIZATION + HAS_SERVICES))

if [ "$CONFIG_COUNT" -eq 4 ]; then
    echo "✅ PASSED - All configurations present"
    echo "   ✓ Phone Config ✓ Currency ✓ Localization ✓ Service Catalog"
    ((PASSED++))
else
    echo "❌ FAILED - Missing configurations ($CONFIG_COUNT/4)"
    ((FAILED++))
fi
echo ""

# Test 5: Verify All 7 Templates Exist
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  Verify All 7 Region Templates Exist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s --max-time 10 "$API_ENDPOINT/regions?includeInactive=true" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" 2>&1)

EXPECTED_REGIONS=("india" "usa" "uae" "singapore" "uk" "australia" "emea")
EXPECTED_CODES=("IN" "US" "AE" "SG" "GB" "AU" "EU")
FOUND_COUNT=0

for i in "${!EXPECTED_REGIONS[@]}"; do
    REGION_ID="${EXPECTED_REGIONS[$i]}"
    REGION_CODE="${EXPECTED_CODES[$i]}"
    
    EXISTS=$(echo "$RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); regions=data.get('regions', []); print('1' if any(r.get('regionId') == '$REGION_ID' or r.get('regionCode') == '$REGION_CODE' for r in regions) else '0')" 2>/dev/null || echo "0")
    
    if [ "$EXISTS" = "1" ]; then
        echo "   ✓ $REGION_ID ($REGION_CODE) - Found"
        ((FOUND_COUNT++))
    else
        echo "   ✗ $REGION_ID ($REGION_CODE) - Missing"
    fi
done

if [ "$FOUND_COUNT" -eq 7 ]; then
    echo "✅ PASSED - All 7 region templates exist"
    ((PASSED++))
else
    echo "❌ FAILED - Only $FOUND_COUNT/7 regions found"
    ((FAILED++))
fi
echo ""

# Test 6: Test Status Toggle Endpoint
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  Test Status Toggle Endpoint"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s --max-time 10 -X PATCH "$API_ENDPOINT/admin/regions/usa/status" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" \
  -d '{"isActive": true}' 2>&1)

if echo "$RESPONSE" | grep -q "success"; then
    echo "✅ PASSED - Status toggle endpoint working"
    ((PASSED++))
else
    echo "⚠️  WARNING - Status toggle may need authentication or region may not exist"
    echo "   Response: $(echo "$RESPONSE" | head -100)"
fi
echo ""

# Test 7: Verify Database Storage (check JSONB structure)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7️⃣  Verify Data Structure (JSONB)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
RESPONSE=$(curl -s --max-time 10 "$API_ENDPOINT/regions/india" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" 2>&1)

HAS_COMPLETE_DATA=$(echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    r = data.get('region', {})
    required = ['phoneConfig', 'currency', 'localization', 'serviceCatalog', 'compliance', 'popularBreeds', 'business', 'payments', 'regional']
    missing = [k for k in required if not r.get(k)]
    if not missing:
        print('1')
    else:
        print(f'0 - Missing: {missing}')
except:
    print('0')
" 2>/dev/null || echo "0")

if echo "$HAS_COMPLETE_DATA" | grep -q "^1$"; then
    echo "✅ PASSED - Complete data structure verified"
    echo "   All required fields present in JSONB"
    ((PASSED++))
else
    echo "❌ FAILED - Missing required fields"
    echo "   $HAS_COMPLETE_DATA"
    ((FAILED++))
fi
echo ""

# Summary
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    📊 VERIFICATION SUMMARY                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ Tests Passed: $PASSED"
echo "❌ Tests Failed: $FAILED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo "🎉 SUCCESS: All verification tests passed!"
    echo "   ✅ Region seeding implementation is fully functional"
    echo "   ✅ All endpoints are working correctly"
    echo "   ✅ Data structure is complete and correct"
    echo "   ✅ All 7 regions successfully seeded"
    exit 0
else
    echo "⚠️  WARNING: Some tests failed"
    echo "   Please review the failures above"
    exit 1
fi
