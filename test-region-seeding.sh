#!/bin/bash

# Test script for region seeding endpoints

API_URL="${API_URL:-http://localhost:3000}"

echo "🧪 Testing Region Seeding Endpoints"
echo "API URL: $API_URL"
echo ""

# Test 1: Get regions (before seeding)
echo "1️⃣  Testing GET /regions (before seeding)..."
RESPONSE=$(curl -s "$API_URL/regions" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Test 2: Seed all regions
echo "2️⃣  Testing POST /admin/regions/seed-all..."
RESPONSE=$(curl -s -X POST "$API_URL/admin/regions/seed-all" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" \
  -d '{}')
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Test 3: Get regions (after seeding)
echo "3️⃣  Testing GET /regions (after seeding)..."
RESPONSE=$(curl -s "$API_URL/regions" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Test 4: Get specific region (India)
echo "4️⃣  Testing GET /regions/india..."
RESPONSE=$(curl -s "$API_URL/regions/india" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123")
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Test 5: Toggle status (USA)
echo "5️⃣  Testing PATCH /admin/regions/usa/status..."
RESPONSE=$(curl -s -X PATCH "$API_URL/admin/regions/usa/status" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin-123" \
  -d '{"isActive": true}')
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

echo "✅ Testing complete!"
