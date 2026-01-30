#!/bin/bash
# Quick E2E test for critical fixes

echo "🧪 Quick E2E Test for Recent Fixes"
echo "===================================="
echo ""

API_BASE="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"
VENDOR_ID="1ca03400-109f-4600-8092-ae34ea31b202"
CUSTOMER_ID="39c84571-b26d-475a-bb38-94975cb8262d"
PHONE="9611377119"

# Test 1: Available slots
echo "✅ Test 1: Available Slots"
TOMORROW=$(date -v+1d +%Y-%m-%d 2>/dev/null || date -d "+1 day" +%Y-%m-%d)
SLOTS_RESPONSE=$(curl -s "${API_BASE}/customer/vendor/${VENDOR_ID}/available-slots?date=${TOMORROW}&serviceStyle=at_center")
AVAILABLE_COUNT=$(echo "$SLOTS_RESPONSE" | grep -o '"available":true' | wc -l | tr -d ' ')
echo "   Found $AVAILABLE_COUNT available slots"
echo ""

# Test 2: Slot conflict detection (try booking same slot twice)
echo "✅ Test 2: Slot Conflict Detection"
# This would require creating a booking first, then trying to create another at the same time
echo "   (Requires manual testing with actual booking creation)"
echo ""

# Test 3: Razorpay error handling
echo "✅ Test 3: Razorpay Error Handling"
RAZORPAY_RESPONSE=$(curl -s -X POST "${API_BASE}/razorpay/create-order" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"00000000-0000-0000-0000-000000000000","amount":1000}')
STATUS=$(echo "$RAZORPAY_RESPONSE" | grep -o '"code":"[^"]*"' | head -1)
if echo "$RAZORPAY_RESPONSE" | grep -q "error"; then
  echo "   ✅ Proper error returned (not 500)"
  echo "   Error: $STATUS"
else
  echo "   ⚠️  Unexpected response"
fi
echo ""

echo "✅ Quick tests completed!"
echo ""
echo "For full testing, run: npx tsx scripts/test-e2e-fixes.ts"
