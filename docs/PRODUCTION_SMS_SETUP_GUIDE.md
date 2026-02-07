# Production SMS Setup Guide – Step by Step

This guide takes you from zero to real SMS OTP in production using **AWS SNS** (no Jio API needed). Everything is traced from the code and architecture.

---

## 1. How It Works (Plain English)

1. User enters phone → app calls `POST /auth/send-otp`
2. Backend generates OTP (123456 in dev, random in prod)
3. **UAT mode ON** (dev): skips SMS, returns success, user uses 123456
4. **UAT mode OFF** (prod): sends real SMS via AWS SNS → user gets OTP on phone
5. User enters OTP → `POST /auth/verify-otp` → session created

---

## 2. What the Code Expects

### Settings key

Auth expects AWS/SNS settings in `platform_settings` under:

- **Key:** `admin:settings:aws`
- **Structure:**
  ```json
  {
    "credentials": {
      "accessKeyId": "...",
      "secretAccessKey": "...",
      "region": "ap-south-1"
    },
    "sns": {
      "enabled": true,
      "region": "ap-south-1",
      "smsOriginationNumber": "WARMPZ"
    }
  }
  ```

### SMS sending method

- **auth-enhanced.ts** (used for `/auth/send-otp`):
  - Currently uses `snsTopicArn` and publishes to a topic
  - SNS topics do not send SMS to phones directly
- **auth.ts** (not wired in):
  - Uses `PublishCommand` with `PhoneNumber` (correct for SMS)

So the live auth flow uses topic-based SNS, which will not send SMS to a phone. This needs to be fixed to use direct phone publish.

---

## 3. Critical Gaps in the Current Setup

| # | Issue | Impact |
|---|-------|--------|
| 1 | `POST /admin/settings/aws` does not persist settings | Admin UI “Save” does nothing |
| 2 | Auth uses SNS topic instead of direct phone publish | SMS never goes to phone |
| 3 | Auth expects `admin:settings:aws`; admin UI saves elsewhere | Auth cannot read saved config |
| 4 | GET `/admin/settings/aws` returns rows by `aws_%`, `sns_%`; auth expects one JSON blob | Structure mismatch |

---

## 4. AWS SNS – India / DLT Basics

For India:

1. **Sender ID**: Max 6 chars, e.g. `WARMPZ`
2. **DLT**: DLT registration (TRAI) is required
3. **Templates**: Some channels need exact template match; AWS SNS in India can use its own sender/template model
4. **Region**: Use `ap-south-1`

If you manage templates in AWS SNS (as you prefer), you still need the right IAM and SNS configuration. Jio/Trueconnect is mainly for DLT; AWS SNS is the delivery channel here.

---

## 5. Step-by-Step Setup

### Step 5.1: Create IAM user for SMS

1. AWS Console → IAM → Users → Create user
2. Name: `warmpawz-sms-sender`
3. Attach policy (or inline policy):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "sns:Publish",
           "sns:GetSMSAttributes",
           "sns:SetSMSAttributes"
         ],
         "Resource": "*"
       }
     ]
   }
   ```
4. Create Access Key (CLI) and store:
   - Access Key ID
   - Secret Access Key

---

### Step 5.2: Configure SNS for India (AWS Console)

1. AWS Console → SNS → Text messaging (SMS) → SMS preferences  
2. Set:
   - Default message type: **Transactional**
   - Default sender ID: **WARMPZ**
   - Spending limit: e.g. $100
3. If available, request production access for India
4. Enable delivery status logging (CloudWatch) for debugging

---

### Step 5.3: Insert settings into database

Because `POST /admin/settings/aws` does not persist, you must insert directly:

```sql
-- Run against your RDS/Postgres (dev or prod)
INSERT INTO platform_settings (setting_key, setting_value, setting_type, created_at, updated_at)
VALUES (
  'admin:settings:aws',
  '{
    "credentials": {
      "accessKeyId": "YOUR_ACCESS_KEY_ID",
      "secretAccessKey": "YOUR_SECRET_ACCESS_KEY",
      "region": "ap-south-1"
    },
    "sns": {
      "enabled": true,
      "region": "ap-south-1",
      "smsOriginationNumber": "WARMPZ"
    }
  }'::jsonb,
  'object',
  NOW(),
  NOW()
)
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();
```

Replace `YOUR_ACCESS_KEY_ID` and `YOUR_SECRET_ACCESS_KEY`.

---

### Step 5.4: Set UAT_MODE for each environment

- **Dev**: `UAT_MODE=true` → OTP 123456, no SMS
- **Prod**: `UAT_MODE=false` (or unset) → real OTP, real SMS

In Terraform:

- Dev (`infra/envs/dev/main.tf`): already has `UAT_MODE = "true"`
- Prod (`infra/envs/prod/main.tf`): add `UAT_MODE = "false"` in Lambda env vars

If you deploy with `deploy-lambda-direct.sh`, you must ensure prod Lambda has `UAT_MODE=false` (env vars or config).

---

### Step 5.5: Test (Dev, UAT mode)

1. In dev (UAT mode ON), call:
   ```bash
   curl -X POST https://YOUR_API/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"phone":"+919876543210"}'
   ```
2. Expected: `{ "success": true, "data": { "message": "OTP sent successfully" } }`
3. Use OTP `123456` to verify.

---

### Step 5.6: Test (Prod or staging with UAT off)

1. Set `UAT_MODE=false` for that Lambda
2. Ensure `admin:settings:aws` is in DB with valid credentials
3. Call same `POST /auth/send-otp`
4. Check phone for real OTP
5. Check CloudWatch logs for `[AUTH] Production Mode: SMS sent to ...`

---

## 6. Code Changes Needed (Summary)

To make production SMS reliable:

1. **auth-enhanced.ts**: Replace topic-based SNS with direct `PublishCommand` to `PhoneNumber` (same pattern as `auth.ts`).
2. **admin-advanced.ts** `POST /admin/settings/aws`: Actually persist the body into `platform_settings` under `admin:settings:aws`.
3. **GET /admin/settings/aws**: Return a single consolidated config (e.g. from `admin:settings:aws`) so Admin UI and auth use the same structure.

---

## 7. Future Flexibility

- **Single SMS service**: Centralize in `backend/lambda/src/lib/services/sms-service.ts` and call it from auth, bookings, etc.
- **Template management**: Add `sms_templates` or similar in `platform_settings` for different flows (login, booking, etc.).
- **Multi-provider**: Abstract behind an interface (e.g. `sendSMS(phone, templateId, vars)`) so you can add Jio API or others later without changing callers.
- **Secrets**: Move AWS credentials to Secrets Manager and read them in Lambda instead of storing in `platform_settings`.

---

## 8. Quick Checklist

- [ ] IAM user with SNS permissions
- [ ] Access Key ID + Secret stored safely
- [ ] SNS SMS preferences set (Transactional, sender ID WARMPZ)
- [ ] `admin:settings:aws` row in `platform_settings` (via SQL)
- [ ] Dev: `UAT_MODE=true`
- [ ] Prod: `UAT_MODE=false`
- [ ] Auth code fixed to use direct `PhoneNumber` publish
- [ ] Admin settings endpoints fixed to persist and return `admin:settings:aws`
- [ ] Test send-otp in dev (123456) and prod (real SMS)

---

## 9. File Reference

| File | Purpose |
|------|---------|
| `backend/lambda/src/endpoints/auth-enhanced.ts` | OTP send + UAT mode + SMS call |
| `backend/lambda/src/endpoints/auth.ts` | Alternative auth with direct SMS (currently unused) |
| `backend/lambda/src/endpoints/admin-advanced.ts` | GET/POST `/admin/settings/aws` (POST does not save) |
| `infra/envs/dev/main.tf` | UAT_MODE for dev |
| `infra/envs/prod/main.tf` | Prod env (no UAT_MODE set) |
| `config/sms-templates-jio.json` | Jio template definitions (optional if using SNS only) |

---

## 10. What You Need to Provide

1. **IAM Access Key** – Access Key ID and Secret Access Key for the SNS user
2. **Database access** – Ability to run the SQL above on dev/prod DB
3. **Production Lambda** – Function name and how `UAT_MODE` is set (Terraform vs deploy script)

Once you confirm these, the next step is to implement the three code changes (auth SMS method, POST save, GET structure) and then run the checklist end-to-end.
