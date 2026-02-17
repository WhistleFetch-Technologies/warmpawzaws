#!/usr/bin/env bash
# Prod: Real auth test — verify-otp-set-password with user-supplied OTP for phone 9611377119.
# 1) You trigger OTP (e.g. Reset password in admin UI for account with 9611377119).
# 2) Run: ADMIN_EMAIL=your@email.com OTP=XXXXXX NEW_PASSWORD=YourNewPass123! ./scripts/test-admin-otp-prod.sh
set -e
API_URL="${API_URL:-https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com}"
PHONE="${ADMIN_PHONE:-9611377119}"
EMAIL="${ADMIN_EMAIL:?Set ADMIN_EMAIL (admin account that has phone $PHONE)}"
OTP="${OTP:?Set OTP (e.g. from SMS after triggering reset/set-password)}"
NEW_PASSWORD="${NEW_PASSWORD:?Set NEW_PASSWORD (min 8 chars)}"

echo "=============================================="
echo "Prod: Verify OTP and set password (real auth)"
echo "API_URL=$API_URL  email=$EMAIL  phone=$PHONE"
echo "=============================================="

VERIFY_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/admin/users/verify-otp-set-password" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"phone\":\"$PHONE\",\"otp\":\"$OTP\",\"newPassword\":\"$NEW_PASSWORD\"}")
HTTP=$(echo "$VERIFY_RESP" | tail -n1)
BODY=$(echo "$VERIFY_RESP" | sed '$d')

if [ "$HTTP" = "200" ]; then
  echo "✅ Password set successfully. You can log in with email and password."
  echo "$BODY" | grep -o '"message":"[^"]*"' || true
else
  echo "❌ HTTP $HTTP"
  echo "$BODY"
  exit 1
fi
