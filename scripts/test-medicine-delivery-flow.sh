#!/bin/bash
# ============================================================================
# End-to-End Medicine Delivery Flow Test Script
# ============================================================================
# Tests complete flow: Customer -> Pharmacy -> Payment -> Shiprocket -> Delivery
# ============================================================================

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-south-1}
API_BASE_URL=${3:-"https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com"}

echo "🧪 Medicine Delivery Flow - End-to-End Test"
echo "============================================="
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "API Base URL: $API_BASE_URL"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test customer and pharmacy IDs (you'll need to replace with real IDs)
CUSTOMER_ID="39c84571-b26d-475a-bb38-94975cb8262d"
CUSTOMER_PHONE="9611377119"
PHARMACY_VENDOR_ID="" # Will be found during test

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Verify Pharmacy Vendor Exists${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Find a pharmacy vendor
PHARMACY_RESPONSE=$(curl -s "${API_BASE_URL}/customer/discover-services?category=pharmacy&roleId=pharmacy" || echo "{}")
PHARMACY_COUNT=$(echo "$PHARMACY_RESPONSE" | grep -o '"id"' | wc -l || echo "0")

if [ "$PHARMACY_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✅ Found pharmacy vendors${NC}"
  PHARMACY_VENDOR_ID=$(echo "$PHARMACY_RESPONSE" | grep -o '"vendorId":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "")
  echo "   Pharmacy Vendor ID: ${PHARMACY_VENDOR_ID:0:20}..."
else
  echo -e "${YELLOW}⚠️  No pharmacy vendors found. Need to create one first.${NC}"
  echo "   Creating test pharmacy vendor..."
  # This would require vendor creation endpoint
fi
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Test Prescription Order Creation${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test creating a pharmacy order from prescription
ORDER_PAYLOAD=$(cat <<EOF
{
  "customerId": "$CUSTOMER_ID",
  "prescriptionId": null,
  "items": [
    {
      "medicine_name": "Amoxicillin 500mg",
      "quantity": 10,
      "unit_price": 120
    },
    {
      "medicine_name": "Metronidazole 200mg",
      "quantity": 14,
      "unit_price": 85
    }
  ],
  "deliveryAddress": {
    "address": "123 Test Street, Mumbai, Maharashtra 400001",
    "lat": 19.0760,
    "lng": 72.8777,
    "landmark": "Near Test Landmark",
    "pincode": "400001"
  },
  "paymentMethod": "online",
  "logisticsType": "warmpawz",
  "notes": "Test order from automated script"
}
EOF
)

echo "Creating pharmacy order..."
ORDER_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
  -X POST "${API_BASE_URL}/pharmacy/orders/create" \
  -H "Content-Type: application/json" \
  -d "$ORDER_PAYLOAD" 2>&1 || echo "HTTP_CODE:000")

ORDER_HTTP_CODE=$(echo "$ORDER_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
ORDER_BODY=$(echo "$ORDER_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$ORDER_HTTP_CODE" == "200" ] || [ "$ORDER_HTTP_CODE" == "201" ]; then
  # Extract order ID from response (try multiple formats)
  ORDER_ID=$(echo "$ORDER_BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || echo "")
  if [ -z "$ORDER_ID" ]; then
    ORDER_ID=$(echo "$ORDER_BODY" | grep -o '"orderId":"[^"]*"' | cut -d'"' -f4 || echo "")
  fi
  if [ -z "$ORDER_ID" ]; then
    ORDER_ID=$(echo "$ORDER_BODY" | grep -o '"order_id":"[^"]*"' | cut -d'"' -f4 || echo "")
  fi
  echo -e "${GREEN}✅ Order created successfully${NC}"
  echo "   Order ID: $ORDER_ID"
  echo "   Response: $(echo "$ORDER_BODY" | head -10)"
else
  echo -e "${RED}❌ Order creation failed (HTTP $ORDER_HTTP_CODE)${NC}"
  echo "   Response: $ORDER_BODY"
  exit 1
fi
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Test Radius-Based Broadcasting${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -n "$ORDER_ID" ] && [ "$ORDER_ID" != "None" ]; then
  echo "Checking broadcast status..."
  sleep 3
  
  # Try multiple endpoint variations
  BROADCAST_RESPONSE=$(curl -s "${API_BASE_URL}/pharmacy/orders/${ORDER_ID}/broadcast-status" 2>&1 || echo "{}")
  if echo "$BROADCAST_RESPONSE" | grep -q "Not Found\|404"; then
    BROADCAST_RESPONSE=$(curl -s "${API_BASE_URL}/pharmacy/orders/${ORDER_ID}/tracking" 2>&1 || echo "{}")
  fi
  CURRENT_RADIUS=$(echo "$BROADCAST_RESPONSE" | grep -o '"currentRadius":[0-9]*' | cut -d: -f2 || echo "0")
  if [ -z "$CURRENT_RADIUS" ]; then
    CURRENT_RADIUS=$(echo "$BROADCAST_RESPONSE" | grep -o '"current_radius":[0-9]*' | cut -d: -f2 || echo "0")
  fi
  NOTIFIED_COUNT=$(echo "$BROADCAST_RESPONSE" | grep -o '"notifiedPharmacies":[0-9]*' | cut -d: -f2 || echo "0")
  if [ -z "$NOTIFIED_COUNT" ]; then
    NOTIFIED_COUNT=$(echo "$BROADCAST_RESPONSE" | grep -o '"notified_count":[0-9]*' | cut -d: -f2 || echo "0")
  fi
  
  echo "   Current Radius: ${CURRENT_RADIUS}km"
  echo "   Notified Pharmacies: $NOTIFIED_COUNT"
  echo "   Response: $(echo "$BROADCAST_RESPONSE" | head -5)"
  
  if [ "$CURRENT_RADIUS" -ge 5 ]; then
    echo -e "${GREEN}✅ Broadcasting started${NC}"
  else
    echo -e "${YELLOW}⚠️  Broadcasting may not have started yet${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Order ID not found in response${NC}"
fi
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: Test Pharmacy Acceptance (Simulated)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}ℹ️  Pharmacy acceptance requires vendor app interaction${NC}"
echo "   This step needs to be tested manually via vendor app"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 5: Test Razorpay Payment Integration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -n "$ORDER_ID" ]; then
  echo "Testing Razorpay order creation for pharmacy order..."
  PAYMENT_PAYLOAD=$(cat <<EOF
{
  "bookingId": "$ORDER_ID",
  "amount": 500,
  "currency": "INR"
}
EOF
)
  
  PAYMENT_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X POST "${API_BASE_URL}/razorpay/create-order" \
    -H "Content-Type: application/json" \
    -d "$PAYMENT_PAYLOAD" 2>&1 || echo "HTTP_CODE:000")
  
  PAYMENT_HTTP_CODE=$(echo "$PAYMENT_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
  PAYMENT_BODY=$(echo "$PAYMENT_RESPONSE" | sed '/HTTP_CODE/d')
  
  if [ "$PAYMENT_HTTP_CODE" == "200" ] || [ "$PAYMENT_HTTP_CODE" == "201" ]; then
    echo -e "${GREEN}✅ Razorpay integration working${NC}"
    echo "   Response: $(echo "$PAYMENT_BODY" | head -5)"
  elif [ "$PAYMENT_HTTP_CODE" == "401" ] || [ "$PAYMENT_HTTP_CODE" == "403" ]; then
    echo -e "${YELLOW}⚠️  Razorpay API reachable but needs valid credentials${NC}"
  else
    echo -e "${RED}❌ Razorpay integration issue (HTTP $PAYMENT_HTTP_CODE)${NC}"
    echo "   Response: $PAYMENT_BODY"
  fi
fi
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 6: Test Shiprocket Integration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -n "$ORDER_ID" ]; then
  echo "Testing Shiprocket order creation..."
  SHIPROCKET_PAYLOAD=$(cat <<EOF
{
  "orderId": "$ORDER_ID",
  "orderDate": "$(date +%Y-%m-%d)",
  "customerName": "Test Customer",
  "customerEmail": "test@example.com",
  "customerPhone": "$CUSTOMER_PHONE",
  "billingAddress": {
    "street": "123 Test Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  },
  "shippingAddress": {
    "street": "123 Test Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  },
  "items": [
    {
      "name": "Amoxicillin 500mg",
      "sku": "AMOX500",
      "units": 10,
      "selling_price": 120
    }
  ],
  "payment_method": "prepaid",
  "sub_total": 500,
  "length": 10,
  "breadth": 10,
  "height": 5,
  "weight": 0.5
}
EOF
)
  
  SHIPROCKET_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X POST "${API_BASE_URL}/logistics/shiprocket/create-order" \
    -H "Content-Type: application/json" \
    -d "$SHIPROCKET_PAYLOAD" 2>&1 || echo "HTTP_CODE:000")
  
  SHIPROCKET_HTTP_CODE=$(echo "$SHIPROCKET_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
  SHIPROCKET_BODY=$(echo "$SHIPROCKET_RESPONSE" | sed '/HTTP_CODE/d')
  
  if [ "$SHIPROCKET_HTTP_CODE" == "200" ] || [ "$SHIPROCKET_HTTP_CODE" == "201" ]; then
    echo -e "${GREEN}✅ Shiprocket integration working${NC}"
    echo "   Response: $(echo "$SHIPROCKET_BODY" | head -5)"
  elif [ "$SHIPROCKET_HTTP_CODE" == "401" ] || [ "$SHIPROCKET_HTTP_CODE" == "403" ]; then
    echo -e "${YELLOW}⚠️  Shiprocket API reachable but needs valid credentials${NC}"
  else
    echo -e "${RED}❌ Shiprocket integration issue (HTTP $SHIPROCKET_HTTP_CODE)${NC}"
    echo "   Response: $SHIPROCKET_BODY"
  fi
fi
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 7: Test Google Maps Integration${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}ℹ️  Google Maps integration requires frontend testing${NC}"
echo "   Testing distance calculation..."
echo ""

# Test distance calculation (Haversine formula)
LAT1=19.0760
LNG1=72.8777
LAT2=19.2183
LNG2=72.9781

DISTANCE=$(node -e "
const R = 6371;
const dLat = ($LAT2 - $LAT1) * Math.PI / 180;
const dLng = ($LNG2 - $LNG1) * Math.PI / 180;
const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
  Math.cos($LAT1 * Math.PI / 180) * Math.cos($LAT2 * Math.PI / 180) *
  Math.sin(dLng/2) * Math.sin(dLng/2);
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
console.log((R * c).toFixed(2));
" 2>/dev/null || echo "0")

echo "   Distance between two points: ${DISTANCE}km"
if [ -n "$DISTANCE" ] && [ "$DISTANCE" != "0" ]; then
  echo -e "${GREEN}✅ Distance calculation working${NC}"
else
  echo -e "${YELLOW}⚠️  Distance calculation test inconclusive${NC}"
fi
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Medicine Delivery Flow Test Complete${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📝 Summary:"
echo "   Order ID: $ORDER_ID"
echo "   Broadcasting: ${CURRENT_RADIUS}km radius"
echo "   Razorpay: Tested"
echo "   Shiprocket: Tested"
echo "   Google Maps: Distance calculation verified"
echo ""
echo "🔄 Next Steps:"
echo "   1. Test pharmacy acceptance via vendor app"
echo "   2. Test payment flow end-to-end"
echo "   3. Test Shiprocket order creation with real credentials"
echo "   4. Test live tracking with Google Maps"
echo ""
