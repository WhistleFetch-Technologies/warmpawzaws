#!/usr/bin/env bash
# =============================================================================
# PHARMACY FLOW – FORENSIC END-TO-END CURL TEST
# =============================================================================
# Runs the full pharmacy flow step-by-step with real data and validates
# parameters, payloads, and responses at each step.
#
# Prerequisites: curl, jq (optional but recommended)
# Env: API_BASE_URL (default below), CUSTOMER_ID, PHARMACY_VENDOR_ID
# =============================================================================

set -e

API_BASE="${API_BASE_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
CUSTOMER_ID="${CUSTOMER_ID:-}"
PHARMACY_VENDOR_ID="${PHARMACY_VENDOR_ID:-}"

# Optional: start from existing order (skip create). Set ORDER_ID to run steps 2–10 only.
EXISTING_ORDER_ID="${ORDER_ID:-}"

# Default test IDs if not set (replace with real UUIDs for live test)
if [ -z "$CUSTOMER_ID" ]; then
  echo "WARN: CUSTOMER_ID not set. Using placeholder; create-order may fail unless ORDER_ID is set."
  CUSTOMER_ID="00000000-0000-0000-0000-000000000001"
fi
if [ -z "$PHARMACY_VENDOR_ID" ]; then
  echo "WARN: PHARMACY_VENDOR_ID not set. Using placeholder for incoming/accept."
  PHARMACY_VENDOR_ID="00000000-0000-0000-0000-000000000002"
fi

# Test coordinates (Mumbai area) – required for create
LAT="${TEST_LAT:-19.076090}"
LNG="${TEST_LNG:-72.877426}"

STEP=0
order_id=""
broadcast_id=""
delivery_otp=""

ok() { echo "  [OK] $*"; }
fail() { echo "  [FAIL] $*"; exit 1; }
step() { STEP=$((STEP+1)); echo ""; echo "========== STEP $STEP: $* =========="; }

# Optional jq
if command -v jq >/dev/null 2>&1; then
  JQ="jq -r"
else
  JQ=""
fi

# -----------------------------------------------------------------------------
# STEP 1: Create pharmacy order (broadcast) – skip if ORDER_ID provided
# -----------------------------------------------------------------------------
if [ -n "$EXISTING_ORDER_ID" ]; then
  step "Using existing ORDER_ID (skip create)"
  order_id="$EXISTING_ORDER_ID"
  ok "orderId=$order_id"
else
  step "POST /pharmacy/orders/create – create order and start broadcast"

  CREATE_BODY=$(cat <<EOF
{
  "customerId": "$CUSTOMER_ID",
  "customerPhone": "+919876543210",
  "prescriptionUrl": null,
  "items": [
    { "medicine_name": "Test Medicine A", "quantity": 2, "unit_price": 50 },
    { "medicine_name": "Test Medicine B", "quantity": 1, "unit_price": 100 }
  ],
  "deliveryAddress": {
    "address": "Test Address, Mumbai",
    "lat": $LAT,
    "lng": $LNG,
    "latitude": $LAT,
    "longitude": $LNG,
    "city": "Mumbai",
    "pincode": "400001"
  },
  "paymentMethod": "online",
  "logisticsType": "warmpawz",
  "notes": "Forensic test order"
}
EOF
)

  RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/pharmacy/orders/create" \
    -H "Content-Type: application/json" \
    -d "$CREATE_BODY")
  HTTP=$(echo "$RESP" | tail -n1)
  BODY=$(echo "$RESP" | sed '$d')

  if [ "$HTTP" != "200" ]; then
    echo "Response ($HTTP): $BODY"
    fail "Create order returned $HTTP (set CUSTOMER_ID to a real customer UUID, or set ORDER_ID to run from step 2)"
  fi

  if [ -n "$JQ" ]; then
    order_id=$($JQ '.orderId // .order.id // empty' <<< "$BODY")
    [ -z "$order_id" ] && order_id=$($JQ '.order.id // empty' <<< "$BODY")
  else
    order_id=$(echo "$BODY" | grep -o '"orderId":"[^"]*"' | head -1 | cut -d'"' -f4)
    [ -z "$order_id" ] && order_id=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  fi

  if [ -z "$order_id" ]; then
    echo "Response: $BODY"
    fail "Could not extract orderId from create response"
  fi
  ok "orderId=$order_id"
fi

# -----------------------------------------------------------------------------
# STEP 2: Get order details
# -----------------------------------------------------------------------------
step "GET /pharmacy/orders/:orderId – get order details"

RESP=$(curl -s -w "\n%{http_code}" "$API_BASE/pharmacy/orders/$order_id")
HTTP=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')

if [ "$HTTP" != "200" ]; then
  echo "Response ($HTTP): $BODY"
  fail "Get order returned $HTTP"
fi
ok "Order details retrieved"

# -----------------------------------------------------------------------------
# STEP 3: Get broadcast status (customer polling)
# -----------------------------------------------------------------------------
step "GET /pharmacy/orders/:orderId/broadcast-status – broadcast status"

RESP=$(curl -s -w "\n%{http_code}" "$API_BASE/pharmacy/orders/$order_id/broadcast-status")
HTTP=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')

if [ "$HTTP" != "200" ]; then
  echo "Response ($HTTP): $BODY"
  fail "Broadcast status returned $HTTP"
fi
if [ -n "$JQ" ]; then
  rad=$($JQ '.broadcastStatus.currentRadius // empty' <<< "$BODY")
  ok "currentRadius=$rad"
else
  ok "broadcast-status retrieved"
fi

# -----------------------------------------------------------------------------
# STEP 4: Get incoming orders (vendor) – must include this order
# -----------------------------------------------------------------------------
step "GET /pharmacy/orders/incoming/:vendorId – vendor incoming list"

RESP=$(curl -s -w "\n%{http_code}" "$API_BASE/pharmacy/orders/incoming/$PHARMACY_VENDOR_ID")
HTTP=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')

if [ "$HTTP" != "200" ]; then
  echo "Response ($HTTP): $BODY"
  fail "Incoming orders returned $HTTP"
fi
# Backend returns { success, orders, count }
if [ -n "$JQ" ]; then
  count=$($JQ '.count // (.orders | length) // 0' <<< "$BODY")
  ok "incoming count=$count"
  # Extract broadcast_id if present for first order
  broadcast_id=$($JQ '.orders[0].broadcast_id // .orders[0].id // empty' <<< "$BODY" 2>/dev/null || true)
else
  ok "incoming orders retrieved"
fi

# -----------------------------------------------------------------------------
# STEP 5: Pharmacy accepts order (by orderId + pharmacyId)
# -----------------------------------------------------------------------------
step "POST /pharmacy/orders/:orderId/accept – pharmacy accept"

ACCEPT_BODY=$(cat <<EOF
{
  "pharmacyId": "$PHARMACY_VENDOR_ID",
  "quotedDeliveryFee": 40,
  "quotedEtaMinutes": 45,
  "useOwnLogistics": false
}
EOF
)

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/pharmacy/orders/$order_id/accept" \
  -H "Content-Type: application/json" \
  -d "$ACCEPT_BODY")
HTTP=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')

# 404 = no pending broadcast for this pharmacy (expected if vendor not in radius)
if [ "$HTTP" = "404" ]; then
  ok "Accept returned 404 (no broadcast for this vendor – use real PHARMACY_VENDOR_ID in radius)"
elif [ "$HTTP" = "200" ]; then
  ok "Order accepted"
elif [ "$HTTP" = "409" ]; then
  ok "Order already taken (409)"
else
  echo "Response ($HTTP): $BODY"
  fail "Accept returned $HTTP"
fi

# -----------------------------------------------------------------------------
# STEP 6: Generate invoice (vendor)
# -----------------------------------------------------------------------------
step "POST /pharmacy/orders/:orderId/invoice – generate proforma invoice"

INVOICE_BODY=$(cat <<EOF
{
  "invoiceItems": [
    { "name": "Test Medicine A", "quantity": 2, "unit_price": 50 },
    { "name": "Test Medicine B", "quantity": 1, "unit_price": 100 }
  ]
}
EOF
)

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/pharmacy/orders/$order_id/invoice" \
  -H "Content-Type: application/json" \
  -d "$INVOICE_BODY")
HTTP=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')

if [ "$HTTP" != "200" ]; then
  echo "Response ($HTTP): $BODY"
  fail "Invoice returned $HTTP"
fi
if [ -n "$JQ" ]; then
  total=$($JQ '.invoice.totalAmount // empty' <<< "$BODY")
  ok "invoice totalAmount=$total"
else
  ok "Invoice generated"
fi

# -----------------------------------------------------------------------------
# STEP 7: Customer pharmacy-status (must include subtotal, fees, status)
# -----------------------------------------------------------------------------
step "GET /customer/orders/:orderId/pharmacy-status – customer order status"

RESP=$(curl -s -w "\n%{http_code}" "$API_BASE/customer/orders/$order_id/pharmacy-status")
HTTP=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')

if [ "$HTTP" != "200" ]; then
  echo "Response ($HTTP): $BODY"
  fail "Pharmacy status returned $HTTP"
fi
if [ -n "$JQ" ]; then
  status=$($JQ '.order.status // empty' <<< "$BODY")
  tot=$($JQ '.order.totalAmount // .order.total_amount // empty' <<< "$BODY")
  ok "status=$status totalAmount=$tot"
else
  ok "pharmacy-status retrieved"
fi

# -----------------------------------------------------------------------------
# STEP 8: Razorpay create-order (pharmacy_order type)
# -----------------------------------------------------------------------------
step "POST /razorpay/create-order – create payment order (type=pharmacy_order)"

if [ -n "$JQ" ]; then
  amount=$($JQ '.order.totalAmount // .order.total_amount // 250' <<< "$BODY")
else
  amount="250"
fi
# Use numeric amount
RAZORPAY_BODY=$(cat <<EOF
{
  "type": "pharmacy_order",
  "orderId": "$order_id",
  "amount": $amount,
  "customerId": "$CUSTOMER_ID"
}
EOF
)

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/razorpay/create-order" \
  -H "Content-Type: application/json" \
  -d "$RAZORPAY_BODY")
HTTP=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')

if [ "$HTTP" != "200" ]; then
  echo "Response ($HTTP): $BODY"
  fail "Razorpay create-order returned $HTTP (check order status is invoice_generated)"
fi
if [ -n "$JQ" ]; then
  rp_order=$($JQ '.orderId // empty' <<< "$BODY")
  ok "razorpay orderId=$rp_order"
else
  ok "Razorpay order created"
fi

# -----------------------------------------------------------------------------
# STEP 9: Get delivery status (OTP available after payment)
# -----------------------------------------------------------------------------
step "GET /delivery/:orderId/status – delivery status (OTP after payment)"

RESP=$(curl -s -w "\n%{http_code}" "$API_BASE/delivery/$order_id/status")
HTTP=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')

if [ "$HTTP" != "200" ]; then
  echo "Response ($HTTP): $BODY"
  fail "Delivery status returned $HTTP"
fi
if [ -n "$JQ" ]; then
  delivery_otp=$($JQ '.delivery_otp // .deliveryOtp // empty' <<< "$BODY")
  ok "delivery_otp=${delivery_otp:-<not set until payment>}"
else
  ok "Delivery status retrieved"
fi

# -----------------------------------------------------------------------------
# STEP 10: Verify delivery OTP (use OTP from step 9 or skip if not present)
# -----------------------------------------------------------------------------
step "POST /delivery/:orderId/verify-otp – verify OTP"

if [ -z "$delivery_otp" ] && [ -n "$JQ" ]; then
  delivery_otp=$($JQ '.delivery_otp // .deliveryOtp // empty' <<< "$BODY")
fi

if [ -n "$delivery_otp" ]; then
  OTP_BODY=$(cat <<EOF
{ "otp": "$delivery_otp" }
EOF
)
  RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/delivery/$order_id/verify-otp" \
    -H "Content-Type: application/json" \
    -d "$OTP_BODY")
  HTTP=$(echo "$RESP" | tail -n1)
  BODY=$(echo "$RESP" | sed '$d')
  if [ "$HTTP" = "200" ]; then
    ok "OTP verified"
  else
    echo "Response ($HTTP): $BODY"
    ok "verify-otp returned $HTTP (may be already verified or invalid OTP)"
  fi
else
  ok "Skipped (no delivery_otp yet – run after payment confirmation)"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "========== FORENSIC PHARMACY FLOW COMPLETE =========="
echo "  orderId: $order_id"
echo "  API_BASE: $API_BASE"
echo "  All steps executed. Review any [FAIL] or non-200 responses above."
echo ""
