#!/bin/bash

# Direct test: Create order and verify points are awarded
# Uses existing buy_product rule and real customer/vendor if available

set +e

API_BASE_URL="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"

echo "========================================="
echo "Direct Loyalty Points Test"
echo "========================================="
echo ""

# Step 1: Get existing buy_product rule
echo "1. Getting buy_product rule..."
RULE_RESPONSE=$(curl -s -X GET "$API_BASE_URL/admin/loyalty-action-rules" -H "Content-Type: application/json")
RULE_ID=$(echo "$RULE_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
rules = data.get('rules', [])
rule = next((r for r in rules if r.get('action_name') == 'buy_product'), None)
if rule:
    print(rule.get('id', ''))
" 2>/dev/null)

if [ -z "$RULE_ID" ]; then
    echo "❌ buy_product rule not found"
    exit 1
fi

echo "✅ Found rule: $RULE_ID"

# Step 2: Get or create a test customer
echo ""
echo "2. Getting/Creating test customer..."
CUSTOMER_PHONE="+919999999999"
# Try to get customer by phone or create via auth
CUSTOMER_RESPONSE=$(curl -s -X GET "$API_BASE_URL/customer/by-phone?phone=$CUSTOMER_PHONE" -H "Content-Type: application/json" 2>&1)

CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('id', '') or data.get('customer', {}).get('id', ''))
except:
    print('')
" 2>/dev/null)

if [ -z "$CUSTOMER_ID" ]; then
    echo "⚠️  Customer not found. You may need to create one via UI first."
    echo "   Or use an existing customer ID"
    exit 1
fi

echo "✅ Using customer: $CUSTOMER_ID"

# Step 3: Get initial points
echo ""
echo "3. Getting initial points balance..."
INITIAL_RESPONSE=$(curl -s -X GET "$API_BASE_URL/customer/$CUSTOMER_ID/rewards/points" -H "Content-Type: application/json" 2>&1)
INITIAL_POINTS=$(echo "$INITIAL_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('points', 0) or data.get('total_points', 0))
except:
    print('0')
" 2>/dev/null || echo "0")

echo "Initial Points: $INITIAL_POINTS"

# Step 4: Create a simple order
echo ""
echo "4. Creating test order..."
# Get first vendor
VENDORS_RESPONSE=$(curl -s -X GET "$API_BASE_URL/admin/vendors" -H "Content-Type: application/json" 2>&1)
VENDOR_ID=$(echo "$VENDORS_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    vendors = data.get('vendors', []) or data.get('data', [])
    if vendors and len(vendors) > 0:
        print(vendors[0].get('id', ''))
except:
    print('')
" 2>/dev/null)

if [ -z "$VENDOR_ID" ]; then
    echo "⚠️  No vendors found. Creating order without vendor..."
    VENDOR_ID=""
fi

ORDER_DATA=$(cat <<EOF
{
  "customer_id": "$CUSTOMER_ID",
  "vendor_id": "$VENDOR_ID",
  "items": [
    {
      "product_id": "test-product-e2e",
      "name": "Test Product E2E",
      "quantity": 1,
      "price": 500
    }
  ],
  "payment_method": "test",
  "order_status": "completed"
}
EOF
)

ORDER_RESPONSE=$(curl -s -X POST "$API_BASE_URL/orders" -H "Content-Type: application/json" -d "$ORDER_DATA" 2>&1)
ORDER_ID=$(echo "$ORDER_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('order', {}).get('id', '') or data.get('id', ''))
except:
    print('')
" 2>/dev/null)

if [ -z "$ORDER_ID" ]; then
    echo "❌ Order creation failed"
    echo "Response: $ORDER_RESPONSE"
    exit 1
fi

echo "✅ Order created: $ORDER_ID"

# Step 5: Wait and check points
echo ""
echo "5. Waiting 5 seconds for points processing..."
sleep 5

FINAL_RESPONSE=$(curl -s -X GET "$API_BASE_URL/customer/$CUSTOMER_ID/rewards/points" -H "Content-Type: application/json" 2>&1)
FINAL_POINTS=$(echo "$FINAL_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('points', 0) or data.get('total_points', 0))
except:
    print('0')
" 2>/dev/null || echo "0")

POINTS_EARNED=$((FINAL_POINTS - INITIAL_POINTS))

echo ""
echo "========================================="
echo "TEST RESULTS"
echo "========================================="
echo "Initial Points: $INITIAL_POINTS"
echo "Final Points: $FINAL_POINTS"
echo "Points Earned: $POINTS_EARNED"
echo ""

if [ "$POINTS_EARNED" -gt 0 ]; then
    echo "✅ SUCCESS: Points were awarded!"
    echo "   Expected: ~50 points (10 per ₹100 × 5)"
    echo "   Got: $POINTS_EARNED points"
    exit 0
else
    echo "❌ FAILED: No points were awarded"
    echo "   Check:"
    echo "   1. Order was created successfully"
    echo "   2. buy_product rule exists and is active"
    echo "   3. Customer ID is correct"
    echo "   4. Order status is 'completed'"
    exit 1
fi
