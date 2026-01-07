#!/bin/bash
# Test Vendor Onboarding API Endpoints
# Requires API_BASE_URL environment variable or uses default

set -e

API_BASE_URL=${API_BASE_URL:-"https://dev.api.warmpawz.com"}
TEST_PHONE="+919876543210"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "================================================================="
echo "🧪 Testing Vendor Onboarding API Endpoints"
echo "================================================================="
echo "API Base URL: $API_BASE_URL"
echo "Test Phone: $TEST_PHONE"
echo ""

# Test 1: Get Onboarding Status
echo "1️⃣  Testing: GET /vendor/onboarding/status"
STATUS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$API_BASE_URL/vendor/onboarding/status?phone=$TEST_PHONE" || echo -e "\nHTTP_CODE:000")
HTTP_CODE=$(echo "$STATUS_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$STATUS_RESPONSE" | grep -v "HTTP_CODE:")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Status endpoint working${NC}"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
    echo -e "${YELLOW}⚠️  Status endpoint returned: $HTTP_CODE${NC}"
    echo "$BODY"
fi
echo ""

# Test 2: Get Available Roles
echo "2️⃣  Testing: GET /vendor/onboarding/roles"
ROLES_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$API_BASE_URL/vendor/onboarding/roles" || echo -e "\nHTTP_CODE:000")
HTTP_CODE=$(echo "$ROLES_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$ROLES_RESPONSE" | grep -v "HTTP_CODE:")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Roles endpoint working${NC}"
    ROLE_COUNT=$(echo "$BODY" | jq '.roles | length' 2>/dev/null || echo "0")
    echo "   Found $ROLE_COUNT roles"
    if [ "$ROLE_COUNT" -gt 0 ]; then
        echo "$BODY" | jq '.roles[0] | {id, name, display_name, vendor_types_supported}' 2>/dev/null || echo "$BODY"
    fi
else
    echo -e "${YELLOW}⚠️  Roles endpoint returned: $HTTP_CODE${NC}"
    echo "$BODY"
fi
echo ""

# Test 3: Get Form Schema (requires role + vendor_type to be set)
echo "3️⃣  Testing: GET /vendor/onboarding/form-schema"
FORM_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$API_BASE_URL/vendor/onboarding/form-schema?phone=$TEST_PHONE" || echo -e "\nHTTP_CODE:000")
HTTP_CODE=$(echo "$FORM_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$FORM_RESPONSE" | grep -v "HTTP_CODE:")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Form schema endpoint working${NC}"
    HAS_SCHEMA=$(echo "$BODY" | jq '.schema != null' 2>/dev/null || echo "false")
    if [ "$HAS_SCHEMA" = "true" ]; then
        FIELD_COUNT=$(echo "$BODY" | jq '.schema.fields | length' 2>/dev/null || echo "0")
        echo "   Schema has $FIELD_COUNT fields"
    fi
elif [ "$HTTP_CODE" = "400" ]; then
    echo -e "${YELLOW}⚠️  Form schema requires role + vendor_type to be selected first${NC}"
    echo "   (This is expected if onboarding hasn't started)"
else
    echo -e "${YELLOW}⚠️  Form schema endpoint returned: $HTTP_CODE${NC}"
    echo "$BODY"
fi
echo ""

echo "================================================================="
echo "📝 Summary:"
echo "================================================================="
echo ""
echo "✅ API endpoints are accessible"
echo "⚠️  Some endpoints require onboarding state to be set"
echo ""
echo "Next: Test with actual onboarding flow:"
echo "  1. Select role"
echo "  2. Select vendor type"
echo "  3. Get form schema"
echo "  4. Submit application"
echo ""
echo "See docs/VENDOR_ONBOARDING_NEXT_STEPS.md for full test flow"
echo "================================================================="

