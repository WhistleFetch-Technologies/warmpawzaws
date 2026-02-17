# Prod systematic test: ketanh@warmpawz.com / 9611377119 (curl)

Flow: **Create user** → you get OTP → **Set password** → **Reset password** → you get OTP → **Set password again** → **Login** to verify.

---

## Prerequisite

You need **one existing prod admin** (email + password) to create the new user. That admin must have permission `admin:users:create`.

---

## Step 1: Create new admin user (sends first OTP)

**Option A – use script (needs existing prod admin):**

```bash
# Set existing prod admin so we can create ketanh@warmpawz.com
export PROD_ADMIN_EMAIL=existing@warmpawz.com
export PROD_ADMIN_PASSWORD=existing_password

./scripts/test-admin-prod-systematic.sh
```

**Option B – curl only (you have a Bearer token):**

```bash
API_URL="https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com"
# Set YOUR_PROD_ADMIN_TOKEN to a valid Bearer token (from login or UI)
curl -s -X POST "$API_URL/admin/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $YOUR_PROD_ADMIN_TOKEN" \
  -d '{"email":"ketanh@warmpawz.com","name":"Ketan","phone":"9611377119"}'
```

→ **OTP is sent to 9611377119** (set-password).  
→ **You:** Note the 6-digit OTP.

---

## Step 2: Set password (first time) with OTP

```bash
ADMIN_EMAIL=ketanh@warmpawz.com \
ADMIN_PHONE=9611377119 \
OTP=<YOUR_6_DIGIT_OTP> \
NEW_PASSWORD=TempPass123! \
./scripts/test-admin-otp-prod.sh
```

**Equivalent curl:**

```bash
curl -s -X POST "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/admin/users/verify-otp-set-password" \
  -H "Content-Type: application/json" \
  -d '{"email":"ketanh@warmpawz.com","phone":"9611377119","otp":"<OTP>","newPassword":"TempPass123!"}'
```

---

## Step 3: Trigger “forgot password” (sends second OTP)

Login as ketanh and call reset-password-request (self). Script:

```bash
ADMIN_EMAIL=ketanh@warmpawz.com \
CURRENT_PASSWORD=TempPass123! \
./scripts/test-admin-prod-reset-request.sh
```

→ **Second OTP is sent to 9611377119**.  
→ **You:** Note the new 6-digit OTP.

---

## Step 4: Set password again (reset flow) with second OTP

```bash
ADMIN_EMAIL=ketanh@warmpawz.com \
ADMIN_PHONE=9611377119 \
OTP=<SECOND_6_DIGIT_OTP> \
NEW_PASSWORD=ProdPass456! \
./scripts/test-admin-otp-prod.sh
```

---

## Step 5: Verify login with new password

```bash
curl -s -X POST "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ketanh@warmpawz.com","password":"ProdPass456!"}'
```

Expect `"success":true` and a `token` object with `access_token`.

---

## Summary

| Step | Action | Who gets OTP | You provide |
|------|--------|--------------|-------------|
| 1 | Create user (curl or script) | 9611377119 | Existing prod admin credentials or token |
| 2 | verify-otp-set-password | — | First OTP |
| 3 | reset-password-request (as ketanh) | 9611377119 | — |
| 4 | verify-otp-set-password | — | Second OTP |
| 5 | login | — | — |

All requests go to **prod API**: `https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com`.
