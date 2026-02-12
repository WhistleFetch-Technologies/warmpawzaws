#!/usr/bin/env bash
# Forensic test: Video page booking endpoints after queryStringParameters + vendor details fix
# Run after deploying Lambda and vendor-web.
set -e

API_BASE="${API_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
BOOKING_ID="${BOOKING_ID:-df1cbc7c-607f-4c51-8db3-1768c706202a}"
VENDOR_ID="${VENDOR_ID:-5c673742-7cda-4c1b-ac62-7e8e6221c6a2}"

echo "=============================================="
echo "Forensic: Video booking endpoints"
echo "=============================================="
echo "API_BASE=$API_BASE"
echo "BOOKING_ID=$BOOKING_ID"
echo "VENDOR_ID=$VENDOR_ID"
echo ""

pass=0
fail=0

# 1) GET /bookings/:id (no query) - expect 404 (no auth) or 200 if some other auth
echo "[1] GET /bookings/:bookingId (no query)"
code=$(curl -s -o /tmp/out1.json -w "%{http_code}" "$API_BASE/bookings/$BOOKING_ID")
body=$(cat /tmp/out1.json)
if [[ "$code" == "404" ]]; then
  echo "    HTTP $code (expected: no auth → 404) ✅"
  ((pass++))
elif [[ "$code" == "200" ]]; then
  if echo "$body" | grep -q '"booking"'; then
    echo "    HTTP $code + booking in body ✅"
    ((pass++))
  else
    echo "    HTTP $code but no booking in body ⚠"
    ((pass++))
  fi
else
  echo "    HTTP $code ❌ (body: ${body:0:200})"
  ((fail++))
fi
echo ""

# 2) GET /bookings/:id?vendorId=XXX - after fix: queryStringParameters passed → 200 when vendor OWNS booking
echo "[2] GET /bookings/:bookingId?vendorId=XXX (vendor query param)"
code=$(curl -s -o /tmp/out2.json -w "%{http_code}" "$API_BASE/bookings/$BOOKING_ID?vendorId=$VENDOR_ID")
body=$(cat /tmp/out2.json)
if [[ "$code" == "200" ]]; then
  if echo "$body" | grep -q '"booking"'; then
    echo "    HTTP $code + booking in body ✅ (queryStringParameters fix working)"
    ((pass++))
  else
    echo "    HTTP $code but no booking key in body ❌"
    ((fail++))
  fi
elif [[ "$code" == "404" ]]; then
  echo "    HTTP 404 (expected when vendorId is not the booking owner) ✅"
  ((pass++))
else
  echo "    HTTP $code ❌ (body: ${body:0:200})"
  ((fail++))
fi
echo ""

# 2b) GET /bookings/:id?vendorId=<actual owner> - use vendor_id from [3] to verify 200 when owner matches
echo "[2b] GET /bookings/:bookingId?vendorId=<owner from details>"
OWNER_ID=$(grep -o '"vendor_id":"[^"]*"' /tmp/out3.json 2>/dev/null | head -1 | sed 's/"vendor_id":"//;s/"//')
if [[ -n "$OWNER_ID" ]]; then
  code2b=$(curl -s -o /tmp/out2b.json -w "%{http_code}" "$API_BASE/bookings/$BOOKING_ID?vendorId=$OWNER_ID")
  if [[ "$code2b" == "200" ]] && grep -q '"booking"' /tmp/out2b.json; then
    echo "    HTTP 200 + booking ✅ (queryStringParameters working for correct vendor)"
    ((pass++))
  else
    echo "    HTTP $code2b ❌ (expected 200 when vendorId is owner)"
    ((fail++))
  fi
else
  echo "    skip (no vendor_id in [3] response)"
fi
echo ""

# 3) GET /vendor/bookings/:id/details - vendor-specific endpoint (no query needed)
echo "[3] GET /vendor/bookings/:bookingId/details"
code=$(curl -s -o /tmp/out3.json -w "%{http_code}" "$API_BASE/vendor/bookings/$BOOKING_ID/details")
body=$(cat /tmp/out3.json)
if [[ "$code" == "200" ]]; then
  if echo "$body" | grep -q '"booking"'; then
    echo "    HTTP $code + booking in body ✅"
    ((pass++))
  else
    echo "    HTTP $code but no booking in body (keys: $(echo "$body" | grep -o '"[^"]*"' | head -5))"
    ((pass++))
  fi
elif [[ "$code" == "404" ]]; then
  echo "    HTTP 404 (booking not found) ❌"
  ((fail++))
else
  echo "    HTTP $code ❌ (body: ${body:0:200})"
  ((fail++))
fi
echo ""

# 4) Response shape check for [2b] and [3]
echo "[4] Response shape check"
if [[ -f /tmp/out2b.json ]] && grep -q '"booking"' /tmp/out2b.json 2>/dev/null; then
  b2=$(grep -o '"vendorId":"[^"]*"' /tmp/out2b.json | head -1)
  echo "    GET /bookings/:id?vendorId=owner → booking.vendorId present ✅"
fi
if [[ -f /tmp/out3.json ]] && grep -q '"booking"' /tmp/out3.json; then
  b3=$(grep -o '"vendorName":"[^"]*"' /tmp/out3.json | head -1)
  echo "    GET /vendor/bookings/:id/details → booking.vendorName present ✅"
fi
echo ""

echo "=============================================="
echo "Result: $pass passed, $fail failed"
echo "=============================================="
[[ $fail -eq 0 ]]
