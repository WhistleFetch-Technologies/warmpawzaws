#!/usr/bin/env bash
set -euo pipefail

# ====== CONFIG (edit these) ======
# API base URL (same API that Customer app at d2aoyjj8ine0wk.cloudfront.net uses)
API_BASE="${API_BASE:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
LAT="${LAT:-12.9716}"
LNG="${LNG:-77.5946}"

# Use role names (not UUIDs)
ROLE_VET="${ROLE_VET:-veterinarian}"
ROLE_GROOMER="${ROLE_GROOMER:-pet_groomer}"

# Problem IDs must exist in problem_grid_mappings or specialization_master
PROBLEM_ID="${PROBLEM_ID:-general_consultation}"

# Vendor/service style
STYLE_CENTER="${STYLE_CENTER:-at_center}"
STYLE_HOME="${STYLE_HOME:-at_home}"

# ====== HELPERS ======
function hit() {
  local name="$1"
  local url="$2"
  echo ""
  echo "=== $name ==="
  echo "GET $url"
  curl -sS -w "\nHTTP_STATUS=%{http_code}\n" "$url"
}

# ====== TESTS ======

# 1) Discover-services (at_center)
hit "discover-services (at_center)" \
  "$API_BASE/customer/discover-services?serviceStyle=$STYLE_CENTER&roleId=$ROLE_VET&latitude=$LAT&longitude=$LNG"

# 2) services/by-style (requires style)
hit "services/by-style (at_center)" \
  "$API_BASE/customer/services/by-style?style=$STYLE_CENTER&roleId=$ROLE_GROOMER&latitude=$LAT&longitude=$LNG"

# 3) vendors/search (roleId must be role name)
hit "vendors/search (role + style)" \
  "$API_BASE/customer/vendors/search?roleId=$ROLE_VET&serviceStyle=$STYLE_CENTER&limit=10"

# 4) vendors/discover-by-problem (problem or problemId required)
hit "vendors/discover-by-problem" \
  "$API_BASE/customer/vendors/discover-by-problem?problemId=$PROBLEM_ID&roleId=$ROLE_VET&latitude=$LAT&longitude=$LNG"

# 5) services/by-problem (problemId required; lat/lng optional)
hit "services/by-problem (at_home)" \
  "$API_BASE/customer/services/by-problem?problemId=$PROBLEM_ID&serviceStyle=$STYLE_HOME&lat=$LAT&lng=$LNG"

# 6) pricing quote (implemented in Lambda; may 404 if API Gateway has no POST /customer/pricing/quote)
echo ""
echo "=== pricing/quote (404 if API Gateway route not configured) ==="
curl -sS -w "\nHTTP_STATUS=%{http_code}\n" \
  -X POST "$API_BASE/customer/pricing/quote" \
  -H "Content-Type: application/json" \
  -d '{"serviceId":"test-service","vendorId":"test-vendor","customerId":"test-customer","couponCode":"TEST10"}'

echo ""
echo "--- Done. Check HTTP_STATUS: 200 = OK, 400 = bad params, 404 = route missing, 500 = server error. ---"
