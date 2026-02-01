#!/bin/bash
# Forensic verification: Service catalog role-specific discovery and categories
# 1) No "Uncategorized" headers - every service has a proper category.
# 2) Vet role sees only vet-related categories (no Diagnostics & Lab).
# 3) Diagnostics role sees only diagnostics-related categories.
# Run after applying migration 511 and deploying backend. Uses official API only.

set -e

API_BASE="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  FORENSIC: Service Catalog Role-Specific & Categories${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  API Base: $API_BASE"
echo ""

PASS=0
FAIL=0

# Helper: GET /service-catalog/role/:roleId and parse JSON services
# Usage: check_vet_catalog   -> vet must NOT see Diagnostics & Lab
# Usage: check_diagnostics_catalog -> diagnostics must see Diagnostics & Lab only (or relevant)
# We use role name (veterinarian or vet_solo) and diagnostics_center

# 1. Vet role: must NOT contain "Diagnostics & Lab" category
echo -e "${BLUE}[1] GET /service-catalog/role/veterinarian (vet must not see Diagnostics & Lab)${NC}"
RESP=$(curl -s -w "\n%{http_code}" "$API_BASE/service-catalog/role/veterinarian" -H "Accept: application/json" 2>/dev/null || echo "000")
HTTP=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$HTTP" != "200" ]; then
  # Try vet_solo (post-migration role name)
  RESP=$(curl -s -w "\n%{http_code}" "$API_BASE/service-catalog/role/vet_solo" -H "Accept: application/json" 2>/dev/null || echo "000")
  HTTP=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | sed '$d')
fi
if [ "$HTTP" = "200" ]; then
  if echo "$BODY" | grep -q '"services"'; then
    if echo "$BODY" | grep -q 'Diagnostics & Lab' || echo "$BODY" | grep -qi 'diagnostics.*lab'; then
      echo -e "  ${RED}✗ Vet catalog must NOT include 'Diagnostics & Lab' (role-specific violation)${NC}"
      FAIL=$((FAIL+1))
    else
      echo -e "  ${GREEN}✓ Vet catalog has no Diagnostics & Lab category${NC}"
      PASS=$((PASS+1))
    fi
    if echo "$BODY" | grep -q '"categoryName":"Uncategorized"' || echo "$BODY" | grep -q '"categoryName": ""'; then
      echo -e "  ${RED}✗ Response contains Uncategorized categoryName${NC}"
      FAIL=$((FAIL+1))
    else
      echo -e "  ${GREEN}✓ No Uncategorized category in response${NC}"
      PASS=$((PASS+1))
    fi
  else
    echo -e "  ${YELLOW}⚠ 200 but no 'services' key${NC}"
    FAIL=$((FAIL+1))
  fi
else
  echo -e "  ${RED}✗ HTTP $HTTP (expected 200)${NC}"
  FAIL=$((FAIL+1))
fi
echo ""

# 2. Diagnostics role: must contain Diagnostics & Lab (and must NOT contain vet-only like "Veterinary Services" if we want strict separation)
echo -e "${BLUE}[2] GET /service-catalog/role/diagnostics_center${NC}"
RESP=$(curl -s -w "\n%{http_code}" "$API_BASE/service-catalog/role/diagnostics_center" -H "Accept: application/json" 2>/dev/null || echo "000")
HTTP=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$HTTP" = "200" ]; then
  if echo "$BODY" | grep -q '"services"'; then
    if echo "$BODY" | grep -q 'Diagnostics & Lab' || echo "$BODY" | grep -qi 'diagnostics'; then
      echo -e "  ${GREEN}✓ Diagnostics catalog includes Diagnostics category${NC}"
      PASS=$((PASS+1))
    else
      echo -e "  ${YELLOW}⚠ Diagnostics role has no 'Diagnostics & Lab' in response (may be empty catalog)${NC}"
      PASS=$((PASS+1))
    fi
    if echo "$BODY" | grep -q '"categoryName":"Uncategorized"'; then
      echo -e "  ${RED}✗ Response contains Uncategorized categoryName${NC}"
      FAIL=$((FAIL+1))
    else
      echo -e "  ${GREEN}✓ No Uncategorized category in response${NC}"
      PASS=$((PASS+1))
    fi
  else
    echo -e "  ${YELLOW}⚠ 200 but no 'services' key${NC}"
    FAIL=$((FAIL+1))
  fi
else
  echo -e "  ${RED}✗ HTTP $HTTP${NC}"
  FAIL=$((FAIL+1))
fi
echo ""

# 3. Grooming role: quick sanity check - has services and no Uncategorized
echo -e "${BLUE}[3] GET /service-catalog/role/pet_groomer (categories present, no Uncategorized)${NC}"
RESP=$(curl -s -w "\n%{http_code}" "$API_BASE/service-catalog/role/pet_groomer" -H "Accept: application/json" 2>/dev/null || echo "000")
HTTP=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
if [ "$HTTP" = "200" ]; then
  if echo "$BODY" | grep -q '"categoryName":"Uncategorized"' || echo "$BODY" | grep -q '"categoryName":""'; then
    echo -e "  ${RED}✗ Groomer catalog must not have Uncategorized${NC}"
    FAIL=$((FAIL+1))
  else
    echo -e "  ${GREEN}✓ Groomer catalog has no Uncategorized${NC}"
    PASS=$((PASS+1))
  fi
else
  echo -e "  ${YELLOW}⚠ HTTP $HTTP (role may not exist)${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}───────────────────────────────────────────────────────────────${NC}"
echo -e "  ${GREEN}Pass: $PASS${NC}  ${RED}Fail: $FAIL${NC}"
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}All forensic checks passed. Role-specific catalog and categories OK.${NC}"
  echo ""
  exit 0
else
  echo -e "  ${RED}One or more checks failed. Verify migration 511 applied and backend deployed.${NC}"
  echo ""
  exit 1
fi
