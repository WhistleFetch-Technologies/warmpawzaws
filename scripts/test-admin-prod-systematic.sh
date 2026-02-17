#!/usr/bin/env bash
# =============================================================================
# PROD: Systematic admin flow — create user (OTP) → set password → reset (OTP) → set again
# Uses: ketanh@warmpawz.com, 9611377119. All steps via curl.
# =============================================================================
# Prereq: You need an existing prod admin to create the new user.
#   Set EITHER:
#     PROD_ADMIN_TOKEN=<Bearer token>
#   OR:
#     PROD_ADMIN_EMAIL=existing@warmpawz.com PROD_ADMIN_PASSWORD=existingpass
# =============================================================================
set -e
API_URL="${API_URL:-https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com}"
NEW_EMAIL="${NEW_ADMIN_EMAIL:-ketanh@warmpawz.com}"
NEW_PHONE="${NEW_ADMIN_PHONE:-9611377119}"
PASSWORD1="${NEW_PASSWORD_FIRST:-TempPass123!}"   # Set after first OTP
PASSWORD2="${NEW_PASSWORD_SECOND:-ProdPass456!}"  # Set after reset OTP

# Resolve admin token (for creating user and, optionally, triggering reset for another user)
get_prod_admin_token() {
  if [ -n "$PROD_ADMIN_TOKEN" ]; then
    echo "$PROD_ADMIN_TOKEN"
    return
  fi
  if [ -z "$PROD_ADMIN_EMAIL" ] || [ -z "$PROD_ADMIN_PASSWORD" ]; then
    echo "Set PROD_ADMIN_TOKEN or (PROD_ADMIN_EMAIL + PROD_ADMIN_PASSWORD) to create the new user." >&2
    return 1
  fi
  local resp
  resp=$(curl -s -X POST "$API_URL/admin/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$PROD_ADMIN_EMAIL\",\"password\":\"$PROD_ADMIN_PASSWORD\"}")
  local tok
  local tmpf
  tmpf=$(mktemp)
  echo "$resp" > "$tmpf"
  if command -v node >/dev/null 2>&1; then
    tok=$(node -e "try{const j=JSON.parse(require('fs').readFileSync('$tmpf','utf8')); const t=(j.token&&j.token.access_token)||j.access_token; console.log(t||'');}catch(e){console.log('');}")
  else
    tok=$(grep -o '"access_token"[[:space:]]*:[[:space:]]*"[^"]*"' "$tmpf" | head -1 | sed 's/.*:"\([^"]*\)".*/\1/')
  fi
  rm -f "$tmpf"
  if [ -z "$tok" ]; then
    echo "$resp" | head -5
    echo "Could not get access_token from login." >&2
    return 1
  fi
  echo "$tok"
}

echo "=============================================="
echo "PROD systematic test: $NEW_EMAIL / $NEW_PHONE"
echo "API_URL=$API_URL"
echo "=============================================="

# --- Step 1: Get prod admin token (to create new user) ---
echo ""
echo "[Step 0] Getting prod admin token..."
ADMIN_TOKEN=$(get_prod_admin_token) || exit 1
echo "✅ Got admin token"

# --- Step 1: Create new admin user (sends OTP to NEW_PHONE) ---
echo ""
echo "[Step 1] Creating admin user: $NEW_EMAIL, phone $NEW_PHONE (OTP will be sent to phone)..."
CREATE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/admin/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"email\":\"$NEW_EMAIL\",\"name\":\"Ketan\",\"phone\":\"$NEW_PHONE\"}")
HTTP_CREATE=$(echo "$CREATE_RESP" | tail -n1)
BODY_CREATE=$(echo "$CREATE_RESP" | sed '$d')

if [ "$HTTP_CREATE" = "409" ]; then
  echo "⚠️  User $NEW_EMAIL already exists. Proceeding to set-password flow (use OTP you receive for set-password or reset)."
elif [ "$HTTP_CREATE" != "200" ]; then
  echo "❌ Create failed: HTTP $HTTP_CREATE"
  echo "$BODY_CREATE"
  exit 1
else
  echo "✅ User created. OTP sent to $NEW_PHONE for first-time set password."
fi

echo ""
echo "=============================================="
echo "→ WAIT: Check phone $NEW_PHONE for OTP (set-password)."
echo "→ Then run:"
echo "   OTP=<6-digit> ./scripts/test-admin-prod-set-password.sh"
echo "   (or use full env below)"
echo "=============================================="
echo ""
echo "Full command for Step 2 (set password with first OTP):"
echo "  ADMIN_EMAIL=$NEW_EMAIL ADMIN_PHONE=$NEW_PHONE OTP=<YOUR_OTP> NEW_PASSWORD=$PASSWORD1 ./scripts/test-admin-otp-prod.sh"
echo ""
echo "After that, we'll do reset-password (you'll get a second OTP) and set again."
echo ""
