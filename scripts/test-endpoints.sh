#!/bin/bash
set -euo pipefail

# Test script for Lambda endpoints
API_BASE="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
UAT_HEADERS="-H 'Content-Type: application/json' -H 'X-UAT-Mode: true' -H 'X-UAT-Token: uat-token-admin-123'"

echo "🧪 Testing Lambda Endpoints"
echo "================================"
echo ""

# Test 1: Get Roles (should return existing roles)
echo "1️⃣  Testing GET /admin/roles"
curl -s $UAT_HEADERS "$API_BASE/admin/roles" | jq '.success, .data | length' || echo "❌ Failed"
echo ""

# Test 2: Seed Roles
echo "2️⃣  Testing POST /admin/roles/seed"
curl -s -X POST $UAT_HEADERS "$API_BASE/admin/roles/seed" \
  -d '{}' | jq '.success, .message, .rolesCreated, .formsCreated, .catalogsCreated' || echo "❌ Failed"
echo ""

# Test 3: Verify Roles Count
echo "3️⃣  Verifying roles count (should be 20)"
ROLES_COUNT=$(curl -s $UAT_HEADERS "$API_BASE/admin/roles" | jq '.data | length' || echo "0")
echo "Roles found: $ROLES_COUNT"
if [ "$ROLES_COUNT" -ge 20 ]; then
  echo "✅ All 20 roles seeded successfully"
else
  echo "⚠️  Expected 20 roles, found $ROLES_COUNT"
fi
echo ""

# Test 4: Get Onboarding Form for Veterinarian
echo "4️⃣  Testing GET /admin/onboarding-fields/veterinarian"
curl -s $UAT_HEADERS "$API_BASE/admin/onboarding-fields/veterinarian" | jq '.success, .fields | length' || echo "❌ Failed"
echo ""

# Test 5: Get Public Onboarding Form
echo "5️⃣  Testing GET /onboarding-form/veterinarian (public endpoint)"
curl -s "$API_BASE/onboarding-form/veterinarian" | jq '.success, .sections | length' || echo "❌ Failed"
echo ""

# Test 6: Get Service Catalog for Veterinarian
echo "6️⃣  Testing GET /service-catalog/role/veterinarian"
curl -s "$API_BASE/service-catalog/role/veterinarian" | jq '.success, .data | length' || echo "❌ Failed"
echo ""

# Test 7: Verify Role Config Structure
echo "7️⃣  Testing GET /admin/roles/veterinarian (verify config structure)"
curl -s $UAT_HEADERS "$API_BASE/admin/roles/veterinarian" | jq '.data.config | {vendorTypes, serviceStyles, pricingControl}' || echo "❌ Failed"
echo ""

echo "✅ Endpoint testing complete!"

