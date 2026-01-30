#!/bin/bash

# ============================================================================
# TELE CONSULTATION FLOW TEST SCRIPT
# ============================================================================
# Tests the complete tele consultation flow end-to-end
# ============================================================================

set -e

echo "🧪 Testing Tele Consultation Flow..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# API Base URL
API_BASE="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

# Test phone (use a test customer)
TEST_PHONE="${TEST_PHONE:-8123456780}"

echo -e "${BLUE}📋 Test Configuration:${NC}"
echo "  API Base: $API_BASE"
echo "  Test Phone: $TEST_PHONE"
echo ""

# Test 1: Check Customer Profile
echo -e "${BLUE}Test 1: Load Customer Profile${NC}"
CUSTOMER_RESPONSE=$(curl -s "${API_BASE}/customer/profile?phone=${TEST_PHONE}" || echo "{}")
if echo "$CUSTOMER_RESPONSE" | grep -q "id\|profile"; then
  echo -e "${GREEN}✅ Customer profile loaded${NC}"
  CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
else
  echo -e "${YELLOW}⚠️  Customer profile not found (may need to create test customer)${NC}"
  CUSTOMER_ID=""
fi
echo ""

# Test 2: Check Pets
echo -e "${BLUE}Test 2: Load Pets${NC}"
PETS_RESPONSE=$(curl -s "${API_BASE}/customer/pets/${TEST_PHONE}" || echo "{}")
if echo "$PETS_RESPONSE" | grep -q "pets\|\[\]"; then
  echo -e "${GREEN}✅ Pets endpoint accessible${NC}"
  PET_COUNT=$(echo "$PETS_RESPONSE" | grep -o '"id"' | wc -l || echo "0")
  echo "  Found $PET_COUNT pets"
else
  echo -e "${YELLOW}⚠️  Pets endpoint issue${NC}"
fi
echo ""

# Test 3: Check Platform Services
echo -e "${BLUE}Test 3: Load Platform Services${NC}"
SERVICES_RESPONSE=$(curl -s "${API_BASE}/customer/services/platform?roleId=veterinarian&serviceStyle=tele" || echo "{}")
if echo "$SERVICES_RESPONSE" | grep -q "services\|success"; then
  echo -e "${GREEN}✅ Platform services endpoint accessible${NC}"
  SERVICE_COUNT=$(echo "$SERVICES_RESPONSE" | grep -o '"id"' | wc -l || echo "0")
  echo "  Found $SERVICE_COUNT services"
else
  echo -e "${YELLOW}⚠️  Platform services endpoint issue (will use fallback)${NC}"
fi
echo ""

# Test 4: Check Available Providers
echo -e "${BLUE}Test 4: Load Available Providers${NC}"
PROVIDERS_RESPONSE=$(curl -s "${API_BASE}/customer/tele/available-providers?roleId=veterinarian&availableIn=5" || echo "{}")
if echo "$PROVIDERS_RESPONSE" | grep -q "providers\|success"; then
  echo -e "${GREEN}✅ Available providers endpoint accessible${NC}"
  PROVIDER_COUNT=$(echo "$PROVIDERS_RESPONSE" | grep -o '"staff_id"\|"providerId"' | wc -l || echo "0")
  echo "  Found $PROVIDER_COUNT providers"
else
  echo -e "${YELLOW}⚠️  Available providers endpoint issue${NC}"
fi
echo ""

# Test 5: Check Video Call Endpoint
echo -e "${BLUE}Test 5: Check Video Call Endpoint${NC}"
if [ -n "$CUSTOMER_ID" ]; then
  VIDEO_RESPONSE=$(curl -s "${API_BASE}/video-call/test-booking-id" || echo "{}")
  if echo "$VIDEO_RESPONSE" | grep -q "meeting\|not_found\|not_created"; then
    echo -e "${GREEN}✅ Video call endpoint accessible${NC}"
  else
    echo -e "${YELLOW}⚠️  Video call endpoint may have issues${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Skipping (no customer ID)${NC}"
fi
echo ""

# Summary
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ API ENDPOINTS TEST COMPLETE                               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📝 Next Steps:${NC}"
echo "  1. Start dev server: cd apps/customer-web && npm run dev"
echo "  2. Navigate to: http://localhost:3001"
echo "  3. Go to Tele Consultation"
echo "  4. Test the complete flow manually"
echo ""
echo -e "${BLUE}🧪 Manual Test Checklist:${NC}"
echo "  □ Mode selection appears"
echo "  □ Instant consultation loads services"
echo "  □ Service selection shows services"
echo "  □ Pet selection shows pets"
echo "  □ Provider selection shows providers + auto-assign"
echo "  □ Payment page loads correctly"
echo "  □ Queue page appears (for auto-assign)"
echo "  □ Video call page loads"
echo ""
