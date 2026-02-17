#!/usr/bin/env bash
# Dev: Confirm UAT_MODE is ON and OTP 123456 works for admin set-password.
# Uses dev API + UAT token: create admin with phone 9611377119, then verify with OTP 123456.
set -e
API_URL="${API_URL:-https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com}"
UAT_TOKEN="uat-token-admin-$(date +%s)"
EMAIL="otp-test-dev-$(date +%s)@test.com"
# Use a dev-only 10-digit phone (9 + first 9 of timestamp) to avoid rate limit on real numbers
PHONE="9$(date +%s | cut -c1-9)"
OTP="123456"
NEW_PASSWORD="TestPass123!"

echo "=============================================="
echo "Dev: UAT OTP test (expect OTP 123456 when UAT_MODE=true)"
echo "API_URL=$API_URL"
echo "=============================================="

# 1) Create admin user (requires UAT token with admin:users:create)
echo "[1] Creating admin user (email=$EMAIL, phone=$PHONE)..."
CREATE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/admin/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $UAT_TOKEN" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: $UAT_TOKEN" \
  -d "{\"email\":\"$EMAIL\",\"name\":\"OTP Test Dev\",\"phone\":\"$PHONE\"}")
HTTP_CREATE=$(echo "$CREATE_RESP" | tail -n1)
BODY_CREATE=$(echo "$CREATE_RESP" | sed '$d')

if [ "$HTTP_CREATE" != "200" ]; then
  echo "Create failed: HTTP $HTTP_CREATE"
  echo "$BODY_CREATE" | head -20
  echo ""
  echo "Note: If DB says 'admins does not exist', run migration 563 on dev DB. UAT OTP logic: when Lambda env UAT_MODE=true, generateOTP() returns 123456 (see admin-users.ts)."
  exit 1
fi
echo "✅ Admin user created"

# 2) Verify OTP and set password (public endpoint) — use 123456 (dev UAT)
echo "[2] Verifying OTP 123456 and setting password..."
VERIFY_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/admin/users/verify-otp-set-password" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"phone\":\"$PHONE\",\"otp\":\"$OTP\",\"newPassword\":\"$NEW_PASSWORD\"}")
HTTP_VERIFY=$(echo "$VERIFY_RESP" | tail -n1)
BODY_VERIFY=$(echo "$VERIFY_RESP" | sed '$d')

if [ "$HTTP_VERIFY" = "200" ]; then
  echo "✅ UAT OTP 123456 accepted — dev is using UAT_MODE (OTP 123456 for testing)"
  echo "   Message: $(echo "$BODY_VERIFY" | grep -o '"message":"[^"]*"' || true)"
else
  echo "❌ Verify failed: HTTP $HTTP_VERIFY"
  echo "$BODY_VERIFY"
  echo ""
  echo "If 400 Invalid/expired OTP: dev Lambda may not have UAT_MODE=true (so real OTP was sent to phone, not 123456)."
  exit 1
fi
echo "=============================================="
