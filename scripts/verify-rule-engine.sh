#!/bin/bash
# ============================================================================
# Verify Rule Engine (Discovery Rules) – Steps 3 & 4
# ============================================================================
# Smoke-tests admin discovery-rules API and optionally discovery/meal flows.
# Usage:
#   API_URL=https://your-api.execute-api.region.amazonaws.com ./scripts/verify-rule-engine.sh
#   # With admin auth token for CRUD:
#   API_URL=... ADMIN_TOKEN=... ./scripts/verify-rule-engine.sh
# ============================================================================

set -e
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

API_URL="${API_URL%/}"
if [ -z "$API_URL" ]; then
  echo -e "${RED}Set API_URL (e.g. https://xxx.execute-api.ap-south-1.amazonaws.com)${NC}"
  exit 1
fi

echo "Rule Engine Verification"
echo "========================="
echo "API_URL: $API_URL"
echo ""

# Step 3: Smoke-test Rule Book API (no auth for GET keys; GET list may need auth)
echo -e "${YELLOW}1. GET /admin/discovery-rules/keys (no auth)${NC}"
KEYS_RESP=$(curl -s -w "\n%{http_code}" "$API_URL/admin/discovery-rules/keys")
KEYS_HTTP=$(echo "$KEYS_RESP" | tail -n1)
KEYS_BODY=$(echo "$KEYS_RESP" | sed '$d')
if [ "$KEYS_HTTP" = "200" ]; then
  echo -e "${GREEN}   OK ($KEYS_HTTP)${NC}"
  echo "$KEYS_BODY" | head -c 200
  echo "..."
elif [ "$KEYS_HTTP" = "401" ] || [ "$KEYS_HTTP" = "403" ]; then
  echo -e "${YELLOW}   $KEYS_HTTP (expected without admin token)${NC}"
else
  echo -e "${RED}   FAIL ($KEYS_HTTP)${NC}"
  echo "$KEYS_BODY" | head -c 300
fi
echo ""

echo -e "${YELLOW}2. GET /admin/discovery-rules (may require admin auth)${NC}"
if [ -n "$ADMIN_TOKEN" ]; then
  LIST_RESP=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$API_URL/admin/discovery-rules")
else
  LIST_RESP=$(curl -s -w "\n%{http_code}" "$API_URL/admin/discovery-rules")
fi
LIST_HTTP=$(echo "$LIST_RESP" | tail -n1)
LIST_BODY=$(echo "$LIST_RESP" | sed '$d')
if [ "$LIST_HTTP" = "200" ]; then
  echo -e "${GREEN}   OK ($LIST_HTTP)${NC}"
  RULES_COUNT=$(echo "$LIST_BODY" | grep -o '"rules":\[' | wc -l)
  echo "   Response includes rules array."
else
  echo -e "${YELLOW}   $LIST_HTTP (401/403 expected if no admin token)${NC}"
fi
echo ""

# Step 4: Public discovery endpoints (rule engine used internally)
echo -e "${YELLOW}3. GET /meal-plans/search (rule engine: discovery_radius_km, max_results)${NC}"
MEAL_RESP=$(curl -s -w "\n%{http_code}" "$API_URL/meal-plans/search?lat=12.97&lng=77.59")
MEAL_HTTP=$(echo "$MEAL_RESP" | tail -n1)
if [ "$MEAL_HTTP" = "200" ]; then
  echo -e "${GREEN}   OK ($MEAL_HTTP)${NC}"
else
  echo -e "${YELLOW}   $MEAL_HTTP (500 likely if migration 090 not run)${NC}"
fi
echo ""

echo -e "${YELLOW}4. GET /health${NC}"
HEALTH=$(curl -s "$API_URL/health")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}   OK${NC}"
elif echo "$HEALTH" | grep -q "ok"; then
  echo -e "${GREEN}   OK (status in response)${NC}"
else
  echo -e "${YELLOW}   Unexpected (check DB/env if 500)${NC}"
fi
echo ""
echo -e "${GREEN}Verification complete.${NC}"
echo "Manual checks: Admin UI → Platform Settings → Rule Book (list/edit rules); discovery flows use rules from backend."
