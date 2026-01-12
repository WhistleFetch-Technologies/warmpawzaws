#!/bin/bash
# Test script for catalog endpoints
# Usage: ./scripts/test-catalog-endpoints.sh

set -euo pipefail

API_BASE="${API_ENDPOINT:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
UAT_HEADERS=(-H "Content-Type: application/json" -H "X-UAT-Mode: true" -H "X-UAT-Token: uat-token-admin-123")

echo "🧪 Testing Catalog & Role Endpoints"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Test 1: Get Roles
echo -e "${BLUE}1️⃣  Testing GET /admin/roles${NC}"
ROLES_RESPONSE=$(curl -s "${UAT_HEADERS[@]}" "$API_BASE/admin/roles")
if echo "$ROLES_RESPONSE" | grep -q '"success".*true' 2>/dev/null; then
  if command -v jq > /dev/null 2>&1; then
    ROLES_COUNT=$(echo "$ROLES_RESPONSE" | jq '.data | length')
    echo -e "${GREEN}✅ Roles endpoint works. Found $ROLES_COUNT roles${NC}"
  else
    echo -e "${GREEN}✅ Roles endpoint works${NC}"
    echo "$ROLES_RESPONSE" | head -20
  fi
else
  echo -e "${RED}❌ Roles endpoint failed${NC}"
  echo "$ROLES_RESPONSE" | head -10
fi
echo ""

# Test 2: Seed Roles
echo -e "${BLUE}2️⃣  Testing POST /admin/roles/seed${NC}"
SEED_RESPONSE=$(curl -s -X POST "${UAT_HEADERS[@]}" "$API_BASE/admin/roles/seed" -d '{}')
if echo "$SEED_RESPONSE" | grep -q '"success".*true' 2>/dev/null; then
  if command -v jq > /dev/null 2>&1; then
    echo "$SEED_RESPONSE" | jq '{success, message, rolesCreated, formsCreated, catalogsCreated}'
  else
    echo "$SEED_RESPONSE" | grep -E '(success|message|rolesCreated|formsCreated|catalogsCreated)' | head -10
  fi
  echo -e "${GREEN}✅ Seeding successful${NC}"
else
  echo -e "${RED}❌ Seeding failed:${NC}"
  echo "$SEED_RESPONSE" | head -20
fi
echo ""

# Test 3: Verify Role Config
echo -e "${BLUE}3️⃣  Testing GET /admin/roles/veterinarian (verify config)${NC}"
ROLE_RESPONSE=$(curl -s "${UAT_HEADERS[@]}" "$API_BASE/admin/roles/veterinarian")
if echo "$ROLE_RESPONSE" | grep -q '"config"' 2>/dev/null; then
  if command -v jq > /dev/null 2>&1; then
    echo "$ROLE_RESPONSE" | jq '.data | {name, display_name, config: {vendorTypes, serviceStyles, pricingControl, icon}}'
  else
    echo "$ROLE_RESPONSE" | grep -E '(name|display_name|vendorTypes|serviceStyles|pricingControl|icon)' | head -15
  fi
  echo -e "${GREEN}✅ Role config structure correct${NC}"
else
  echo -e "${YELLOW}⚠️  Role config missing or incorrect structure${NC}"
  echo "$ROLE_RESPONSE" | head -20
fi
echo ""

# Test 4: Get Onboarding Form
echo -e "${BLUE}4️⃣  Testing GET /admin/onboarding-fields/veterinarian${NC}"
FORM_RESPONSE=$(curl -s "${UAT_HEADERS[@]}" "$API_BASE/admin/onboarding-fields/veterinarian")
if echo "$FORM_RESPONSE" | grep -q '"success".*true' 2>/dev/null; then
  if command -v jq > /dev/null 2>&1; then
    FIELD_COUNT=$(echo "$FORM_RESPONSE" | jq '.fields | length')
    echo -e "${GREEN}✅ Onboarding form endpoint works. Found $FIELD_COUNT fields${NC}"
  else
    echo -e "${GREEN}✅ Onboarding form endpoint works${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Onboarding form may not be seeded yet${NC}"
  echo "$FORM_RESPONSE" | head -10
fi
echo ""

# Test 5: Get Public Onboarding Form
echo -e "${BLUE}5️⃣  Testing GET /onboarding-form/veterinarian (public)${NC}"
PUBLIC_FORM=$(curl -s "$API_BASE/onboarding-form/veterinarian")
if echo "$PUBLIC_FORM" | grep -q '"success".*true' 2>/dev/null; then
  if command -v jq > /dev/null 2>&1; then
    SECTIONS_COUNT=$(echo "$PUBLIC_FORM" | jq '.sections | length')
    echo -e "${GREEN}✅ Public form endpoint works. Found $SECTIONS_COUNT sections${NC}"
  else
    echo -e "${GREEN}✅ Public form endpoint works${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Public form may not be available${NC}"
  echo "$PUBLIC_FORM" | head -10
fi
echo ""

# Test 6: Get Service Catalog
echo -e "${BLUE}6️⃣  Testing GET /service-catalog/role/veterinarian${NC}"
CATALOG_RESPONSE=$(curl -s "$API_BASE/service-catalog/role/veterinarian")
if echo "$CATALOG_RESPONSE" | grep -q '"success".*true' 2>/dev/null; then
  if command -v jq > /dev/null 2>&1; then
    CATALOG_COUNT=$(echo "$CATALOG_RESPONSE" | jq '.data | length')
    echo -e "${GREEN}✅ Service catalog endpoint works. Found $CATALOG_COUNT services${NC}"
  else
    echo -e "${GREEN}✅ Service catalog endpoint works${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Service catalog may not be seeded yet${NC}"
  echo "$CATALOG_RESPONSE" | head -10
fi
echo ""

echo -e "${GREEN}✅ Testing complete!${NC}"

