#!/bin/bash
# ============================================================================
# Forensic test: GET /config/roles and GET /config/roles/:roleId
# ============================================================================
# Run after deploying backend. Validates API contract and DB-backed capabilities.
# Usage: ./scripts/forensic-test-config-roles.sh [API_BASE_URL]
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
API_BASE="${1:-}"

if [ -z "$API_BASE" ]; then
  if [ -f "$PROJECT_ROOT/config/urls.json" ] && command -v jq &>/dev/null; then
    API_BASE=$(jq -r '.apiGatewayDefaultUrl // empty' "$PROJECT_ROOT/config/urls.json")
  fi
fi
if [ -z "$API_BASE" ] || [ "$API_BASE" = "null" ]; then
  echo "Usage: $0 <API_BASE_URL>"
  echo "  Or set config/urls.json apiGatewayDefaultUrl"
  exit 1
fi

API_BASE="${API_BASE%/}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0

run_test() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected_status="$4"
  local expect_body_has="$5"
  local expect_body_not="$6"
  local url="${API_BASE}${path}"
  local status
  local body

  echo -e "${BLUE}[TEST] $name${NC}"
  body=$(curl -s -w "\n%{http_code}" -X "$method" "$url")
  status=$(echo "$body" | tail -n1)
  body=$(echo "$body" | sed '$d')

  if [ "$status" != "$expected_status" ]; then
    echo -e "  ${RED}FAIL${NC} Expected HTTP $expected_status, got $status"
    echo "  Response: ${body:0:200}..."
    FAIL=$((FAIL + 1))
    return 1
  fi
  if [ -n "$expect_body_has" ] && ! echo "$body" | grep -q "$expect_body_has"; then
    echo -e "  ${RED}FAIL${NC} Response body should contain: $expect_body_has"
    echo "  Response: ${body:0:300}..."
    FAIL=$((FAIL + 1))
    return 1
  fi
  if [ -n "$expect_body_not" ] && echo "$body" | grep -q "$expect_body_not"; then
    echo -e "  ${RED}FAIL${NC} Response body should NOT contain: $expect_body_not"
    FAIL=$((FAIL + 1))
    return 1
  fi
  echo -e "  ${GREEN}PASS${NC}"
  PASS=$((PASS + 1))
  return 0
}

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Forensic test: /config/roles API (DB-backed, contract)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo "  API Base: $API_BASE"
echo ""

# --- 1. GET /config/roles (list) ---
run_test "GET /config/roles returns 200" "GET" "/config/roles" "200" "success" ""
run_test "GET /config/roles returns roles array" "GET" "/config/roles" "200" "roles" ""
run_test "GET /config/roles returns total" "GET" "/config/roles" "200" "total" ""

# --- 2. Get first role id from list for by-id test ---
LIST_RESPONSE=$(curl -s "${API_BASE}/config/roles")
FIRST_ROLE_ID=""
if command -v jq &>/dev/null; then
  FIRST_ROLE_ID=$(echo "$LIST_RESPONSE" | jq -r '.roles[0].id // empty')
fi
if [ -z "$FIRST_ROLE_ID" ] || [ "$FIRST_ROLE_ID" = "null" ]; then
  echo -e "${YELLOW}[SKIP] Cannot extract role id from list (jq or empty roles)${NC}"
else
  # --- 3. GET /config/roles/:id by UUID (from DB) ---
  run_test "GET /config/roles/:id (valid UUID) returns 200" "GET" "/config/roles/$FIRST_ROLE_ID" "200" "success" ""
  run_test "GET /config/roles/:id returns capabilities array" "GET" "/config/roles/$FIRST_ROLE_ID" "200" "capabilities" ""
  run_test "GET /config/roles/:id returns roleId" "GET" "/config/roles/$FIRST_ROLE_ID" "200" "roleId" ""
fi

# --- 4. GET /config/roles/:id by role name (fallback) ---
run_test "GET /config/roles/groomer_solo (by name) returns 200" "GET" "/config/roles/groomer_solo" "200" "success" ""
run_test "GET /config/roles/groomer_solo returns capabilities" "GET" "/config/roles/groomer_solo" "200" "capabilities" ""

# --- 5. GET /config/roles/:id invalid UUID → 404 ---
run_test "GET /config/roles/invalid-uuid returns 404" "GET" "/config/roles/00000000-0000-0000-0000-000000000000" "404" "Role not found" ""
run_test "GET /config/roles/nonexistent-name returns 404" "GET" "/config/roles/nonexistent_role_xyz" "404" "Role not found" ""

# --- 6. Optional: UUID with braces (normalization) ---
if [ -n "$FIRST_ROLE_ID" ] && [ "$FIRST_ROLE_ID" != "null" ]; then
  BRACE_ID="{${FIRST_ROLE_ID}}"
  run_test "GET /config/roles/{uuid} (braces) returns 200" "GET" "/config/roles/${BRACE_ID}" "200" "success" ""
fi

# --- Summary ---
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  ${GREEN}PASS: $PASS${NC}  ${RED}FAIL: $FAIL${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
