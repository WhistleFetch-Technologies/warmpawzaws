#!/bin/bash
# Quick test of loyalty API endpoints

API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

echo "========================================="
echo "Quick Loyalty API Test"
echo "========================================="
echo ""

# Test 1: Get action rules
echo "1. Testing GET /admin/loyalty-action-rules"
RESPONSE=$(curl -s -X GET "$API_BASE_URL/admin/loyalty-action-rules" -H "Content-Type: application/json")
if echo "$RESPONSE" | grep -q "success.*true"; then
    echo "   ✅ Success"
    RULE_COUNT=$(echo "$RESPONSE" | grep -o '"rules"' | wc -l || echo "0")
    echo "   Found rules in response"
else
    echo "   ❌ Failed: $RESPONSE"
fi
echo ""

# Test 2: Create test rule
echo "2. Testing POST /admin/loyalty-action-rules"
UNIQUE_NAME="quick_test_$(date +%s)"
RESPONSE=$(curl -s -X POST "$API_BASE_URL/admin/loyalty-action-rules" \
  -H "Content-Type: application/json" \
  -d "{\"action_name\":\"$UNIQUE_NAME\",\"action_category\":\"loyalty\",\"user_type\":\"customer\",\"points_type\":\"fixed\",\"points_value\":100,\"frequency_type\":\"unlimited\",\"is_active\":true,\"priority\":100}")
if echo "$RESPONSE" | grep -q "success.*true"; then
    echo "   ✅ Rule created: $UNIQUE_NAME"
    RULE_ID=$(echo "$RESPONSE" | grep -o '"id"[^,}]*' | head -1 | cut -d'"' -f4)
    echo "   Rule ID: $RULE_ID"
else
    echo "   ❌ Failed: $RESPONSE"
fi
echo ""

# Test 3: Get segments
echo "3. Testing GET /admin/loyalty-segments"
RESPONSE=$(curl -s -X GET "$API_BASE_URL/admin/loyalty-segments" -H "Content-Type: application/json")
if echo "$RESPONSE" | grep -q "success.*true"; then
    echo "   ✅ Success"
else
    echo "   ⚠️  Response: $RESPONSE"
fi
echo ""

echo "========================================="
echo "Quick Test Complete"
echo "========================================="
