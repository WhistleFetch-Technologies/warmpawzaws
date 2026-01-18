#!/bin/bash

echo "🧪 Testing Service Catalog Endpoints"
echo "======================================"
echo ""

# Get project URL and keys
PROJECT_URL=$(grep -oP 'SUPABASE_URL=\K[^"]+' .env.local 2>/dev/null || echo "")
ANON_KEY=$(grep -oP 'SUPABASE_ANON_KEY=\K[^"]+' .env.local 2>/dev/null || echo "")

if [ -z "$PROJECT_URL" ] || [ -z "$ANON_KEY" ]; then
  echo "⚠️  Could not find project URL or anon key in .env.local"
  echo "   Please set SUPABASE_URL and SUPABASE_ANON_KEY"
  exit 1
fi

FUNCTION_URL="${PROJECT_URL}/functions/v1/make-server-3dd53475"

echo "📍 Testing endpoints at: $FUNCTION_URL"
echo ""

# Test 1: Get service catalog (should return existing services)
echo "📋 Test 1: GET /admin/catalog/services"
echo "--------------------------------------"
RESPONSE=$(curl -s -X GET \
  "${FUNCTION_URL}/admin/catalog/services" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json")

if echo "$RESPONSE" | grep -q "services"; then
  COUNT=$(echo "$RESPONSE" | grep -o '"count":[0-9]*' | grep -o '[0-9]*' || echo "0")
  echo "✅ Success! Found $COUNT services"
else
  echo "❌ Failed or no services found"
  echo "Response: $RESPONSE"
fi
echo ""

# Test 2: Preview seed (should return preview without confirming)
echo "📦 Test 2: POST /admin/catalog/seed-all-services (preview)"
echo "-----------------------------------------------------------"
RESPONSE=$(curl -s -X POST \
  "${FUNCTION_URL}/admin/catalog/seed-all-services" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"confirm": false}')

if echo "$RESPONSE" | grep -q "preview"; then
  TOTAL=$(echo "$RESPONSE" | grep -o '"totalServices":[0-9]*' | grep -o '[0-9]*' || echo "0")
  echo "✅ Preview successful! Would seed $TOTAL services"
  echo "   (This is a preview - no changes made)"
else
  echo "⚠️  Preview response: $RESPONSE"
fi
echo ""

# Test 3: Preview price update (should return preview)
echo "💰 Test 3: POST /admin/catalog/update-realistic-prices (preview)"
echo "-----------------------------------------------------------------"
RESPONSE=$(curl -s -X POST \
  "${FUNCTION_URL}/admin/catalog/update-realistic-prices" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"confirm": false}')

if echo "$RESPONSE" | grep -q "preview"; then
  echo "✅ Price update preview successful!"
  echo "   (This is a preview - no changes made)"
else
  echo "⚠️  Preview response: $RESPONSE"
fi
echo ""

echo "✅ All tests completed!"
echo ""
echo "📝 Note: These were preview tests (confirm: false)"
echo "   To actually seed/update, set confirm: true in the request body"
