#!/bin/bash
# ============================================================================
# Test Endpoints After Database Migration
# ============================================================================
# Tests all endpoints after problem_grid_mappings table is created
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

API_BASE="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
VET_ROLE_ID="072548c8-84a9-4165-a9ec-0387c8c76a0e"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Testing Endpoints After Migration                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Test 1: Problem-based vendor discovery
echo -e "${BLUE}Test 1: Problem-Based Vendor Discovery${NC}"
echo "────────────────────────────────────────────────────────────"
RESPONSE=$(curl -s "${API_BASE}/customer/vendors/by-problem?problemGridId=health-checkup&roleId=${VET_ROLE_ID}")

if echo "$RESPONSE" | grep -q "vendors\|success\|error"; then
    if echo "$RESPONSE" | grep -q "\"error\""; then
        ERROR_MSG=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | head -1)
        if echo "$ERROR_MSG" | grep -q "problem_grid_mappings"; then
            echo -e "${RED}❌ Table still missing: $ERROR_MSG${NC}"
        else
            echo -e "${YELLOW}⚠️  API Error: $ERROR_MSG${NC}"
        fi
    else
        VENDOR_COUNT=$(echo "$RESPONSE" | grep -o '"vendors":\[' | wc -l || echo "0")
        echo -e "${GREEN}✅ Endpoint working${NC}"
        echo "   Response preview:"
        echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -30 || echo "$RESPONSE" | head -20
    fi
else
    echo -e "${RED}❌ Unexpected response${NC}"
    echo "$RESPONSE" | head -10
fi
echo ""

# Test 2: Check for specialists
echo -e "${BLUE}Test 2: Specialists Data${NC}"
echo "────────────────────────────────────────────────────────────"
SPECIALISTS=$(echo "$RESPONSE" | grep -o '"specialists":\[' | wc -l || echo "0")
if [ "$SPECIALISTS" -gt 0 ] || echo "$RESPONSE" | grep -q '"specialists"'; then
    echo -e "${GREEN}✅ Specialists array found in response${NC}"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | grep -A 10 '"specialists"' | head -15 || echo "   (Check full response)"
else
    echo -e "${YELLOW}⚠️  No specialists in response (may be normal if vendors have no staff)${NC}"
fi
echo ""

# Test 3: Check for schedule data
echo -e "${BLUE}Test 3: Schedule Availability${NC}"
echo "────────────────────────────────────────────────────────────"
if echo "$RESPONSE" | grep -q "isAvailableToday\|nextAvailable"; then
    echo -e "${GREEN}✅ Schedule data found in response${NC}"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | grep -E "(isAvailableToday|nextAvailable|availableServiceStyles)" | head -5 || echo "   (Check full response)"
else
    echo -e "${YELLOW}⚠️  No schedule data in response${NC}"
fi
echo ""

# Test 4: Test different problems
echo -e "${BLUE}Test 4: Test Multiple Problems${NC}"
echo "────────────────────────────────────────────────────────────"
PROBLEMS=("health-checkup" "vaccination" "surgery" "emergency" "dermatology")
for problem in "${PROBLEMS[@]}"; do
    echo -n "  Testing $problem... "
    TEST_RESPONSE=$(curl -s "${API_BASE}/customer/vendors/by-problem?problemGridId=${problem}&roleId=${VET_ROLE_ID}")
    if echo "$TEST_RESPONSE" | grep -q "vendors\|success"; then
        if echo "$TEST_RESPONSE" | grep -q "\"error\""; then
            echo -e "${RED}❌ Error${NC}"
        else
            echo -e "${GREEN}✅ OK${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  No response${NC}"
    fi
done
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    TEST SUMMARY                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Problem-based discovery endpoint tested${NC}"
echo -e "${GREEN}✅ Specialists data checked${NC}"
echo -e "${GREEN}✅ Schedule availability checked${NC}"
echo ""
echo -e "${BLUE}Next: Test in browser at https://d2aoyjj8ine0wk.cloudfront.net${NC}"
echo ""
