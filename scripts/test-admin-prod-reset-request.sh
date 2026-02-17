#!/usr/bin/env bash
# PROD: Login as admin with email+password, then trigger reset-password (OTP sent to that admin's phone).
# Usage: ADMIN_EMAIL=ketanh@warmpawz.com CURRENT_PASSWORD=TempPass123! ./scripts/test-admin-prod-reset-request.sh
set -e
API_URL="${API_URL:-https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com}"
ADMIN_EMAIL="${ADMIN_EMAIL:?Set ADMIN_EMAIL}"
CURRENT_PASSWORD="${CURRENT_PASSWORD:?Set CURRENT_PASSWORD (current password for this admin)}"

echo "=============================================="
echo "PROD: Login + request password-reset OTP"
echo "email=$ADMIN_EMAIL"
echo "=============================================="

# Login to get token
LOGIN_RESP=$(curl -s -X POST "$API_URL/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$CURRENT_PASSWORD\"}")
TMPF=$(mktemp)
echo "$LOGIN_RESP" > "$TMPF"
TOK=""
if command -v node >/dev/null 2>&1; then
  TOK=$(node -e "try{const j=JSON.parse(require('fs').readFileSync('$TMPF','utf8')); const t=(j.token&&j.token.access_token)||j.access_token; console.log(t||'');}catch(e){console.log('');}")
fi
[ -z "$TOK" ] && TOK=$(grep -o '"access_token"[[:space:]]*:[[:space:]]*"[^"]*"' "$TMPF" | head -1 | sed 's/.*:"\([^"]*\)".*/\1/')
rm -f "$TMPF"

if [ -z "$TOK" ]; then
  echo "❌ Login failed. Response:"
  echo "$LOGIN_RESP" | head -20
  exit 1
fi
echo "✅ Logged in"

# Request reset (self) — OTP sent to this admin's phone
RESET_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/admin/users/reset-password-request" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOK" \
  -d "{}")
HTTP=$(echo "$RESET_RESP" | tail -n1)
BODY=$(echo "$RESET_RESP" | sed '$d')

if [ "$HTTP" = "200" ]; then
  echo "✅ Reset OTP sent to this admin's phone. Use that OTP with:"
  echo "   ADMIN_EMAIL=$ADMIN_EMAIL OTP=<6-digit> NEW_PASSWORD=<new> ./scripts/test-admin-otp-prod.sh"
else
  echo "❌ HTTP $HTTP"
  echo "$BODY"
  exit 1
fi
