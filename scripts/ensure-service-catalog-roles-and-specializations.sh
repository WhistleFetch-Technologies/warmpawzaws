#!/bin/bash
# Ensures every service in service_catalog has:
# - applicable_roles (from category if missing)
# - valid service_style (aligned with role config)
# - at least one specialization (inferred from category/service nature, validated against specialization_master)
# Run after deploying Lambda. Uses POST /admin/service-catalog/ensure-roles-and-specializations.
# Optional: set API_BASE_URL and ADMIN_AUTH_HEADER if your API requires auth.
# UAT: ADMIN_AUTH_HEADER='Bearer uat-token-admin-warmpawz2025uat' (matches apps/admin-web/.env.local UAT).

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
if [ -z "$API_BASE_URL" ]; then
  if [ -f "$PROJECT_ROOT/config/urls.json" ]; then
    API_BASE=$(jq -r '.apiGatewayDefaultUrl // empty' "$PROJECT_ROOT/config/urls.json")
  fi
  API_BASE="${API_BASE:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
else
  API_BASE="${API_BASE_URL}"
fi
API_BASE="${API_BASE%/}"
URL="${API_BASE}/admin/service-catalog/ensure-roles-and-specializations"

echo "Calling POST $URL ..."
if [ -n "$ADMIN_AUTH_HEADER" ]; then
  RESP=$(curl -s -w "\n%{http_code}" -X POST "$URL" -H "Content-Type: application/json" -H "Authorization: $ADMIN_AUTH_HEADER" -d '{}')
else
  RESP=$(curl -s -w "\n%{http_code}" -X POST "$URL" -H "Content-Type: application/json" -d '{}')
fi
HTTP=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | sed '$d')
echo "$BODY" | head -20
if [ "$HTTP" = "200" ]; then
  echo "OK (HTTP $HTTP). Check total/updated in response above."
  exit 0
fi
if [ "$HTTP" = "401" ]; then
  echo "HTTP 401: Admin API requires authentication. Set ADMIN_AUTH_HEADER (e.g. Bearer <token>) and re-run."
  echo "Example: ADMIN_AUTH_HEADER='Bearer YOUR_TOKEN' $0"
  exit 1
fi
echo "HTTP $HTTP"
exit 1
