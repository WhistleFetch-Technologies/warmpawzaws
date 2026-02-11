# SMS Production Readiness Checklist

## Enable Option A: SMS via DB credentials (recommended)

SMS is sent using **credentials stored in Admin → AWS settings** (not the Lambda role). Do one of the following.

### 1. Using Admin UI (easiest)

1. Log in to **Admin Web** (prod).
2. Go to **Platform Settings** → **Integrations** → **AWS** (or the AWS integrations section).
3. Unlock / edit (use the passcode if prompted).
4. Set:
   - **Credentials:** Access Key ID and Secret Access Key of an IAM user that has `SNS:Publish` (e.g. `warmpawz-sms-sender`).
   - **SNS:** Turn **ON** (enabled).
   - **SNS Region:** `ap-south-1`.
   - **SMS Sender / Origination Number:** `WARMPZ`.
5. Save. The Lambda will use these credentials for all OTP and booking SMS.

### 2. Using AWS CLI (all four steps)

Run the enable script (creates IAM user, policy, access key, and seeds DB):

```bash
ENVIRONMENT=prod AWS_REGION=ap-south-1 ./scripts/enable-sms-option-a.sh
```

This does:

1. **Step 1:** Create IAM user `warmpawz-sms-sender` (skips if exists).
2. **Step 2:** Attach inline policy `SNS-Publish-SMS` (SNS:Publish).
3. **Step 3:** Create access key for the user (or use existing keys from env; see below).
4. **Step 4:** Seed `admin:settings:aws` in RDS with credentials and SNS enabled (requires Node and RDS/Secrets Manager access).

If the IAM user already has two access keys, either delete one with `aws iam delete-access-key --user-name warmpawz-sms-sender --access-key-id <ID>`, or pass existing keys and skip creating a new one:

```bash
ENVIRONMENT=prod \
SMS_AWS_ACCESS_KEY_ID=<existing_key> \
SMS_AWS_SECRET_ACCESS_KEY=<existing_secret> \
./scripts/enable-sms-option-a.sh
```

Prod RDS secret is set by default in the seed script (`warmpawz-prod-rds-master-20260207201049162400000001`). To override: `SMS_DB_SECRET_ID=<id>`.

### 3. Using the seed script only (step 4 by hand)

If you already have IAM credentials and only need to seed the DB:

```bash
ENVIRONMENT=prod \
SMS_AWS_ACCESS_KEY_ID=<IAM_ACCESS_KEY> \
SMS_AWS_SECRET_ACCESS_KEY=<IAM_SECRET_KEY> \
node scripts/seed-sms-aws-settings.js --enable
```

Requires the prod RDS cluster and Secrets Manager secret to be accessible from your machine.

### 4. IAM user for SMS

Use a dedicated IAM user (e.g. `warmpawz-sms-sender`) with an inline or managed policy that allows:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sns:Publish",
      "Resource": "*"
    }
  ]
}
```

Create access keys for that user and put them in Admin AWS settings (or in the seed script env vars).

---

## Completed via AWS CLI & Code

| Item | Status |
|------|--------|
| IAM user `warmpawz-sms-sender` | ✅ Created |
| SNS publish policy attached | ✅ |
| SNS attributes: DefaultSMSType=Transactional, DefaultSenderID=WARMPZ | ✅ Set |
| auth-enhanced.ts: Entity ID + Template ID in Publish | ✅ |
| admin:settings:aws: entityId, templateId in sns config | ✅ |
| seed-sms-aws-settings.js: full DLT config | ✅ |
| test-sms-send.js: India DLT attributes | ✅ |
| admin POST/GET /admin/settings/aws persists | ✅ |
| UAT_MODE: dev=true, prod=false | ✅ Terraform |

## Why OTP SMS Didn’t Arrive (SNS Sandbox)

**Current status:** `IsInSandbox: true` and **no phone numbers are verified** in the sandbox.

In sandbox mode, SNS **only delivers SMS to numbers you have added and verified**. Until you do one of the following, **no OTP will be delivered** to any number (e.g. 9611377119).

### Option A: Verify your test number in Sandbox (quick test)

1. **AWS Console** → **SNS** → **Text messaging (SMS)** → **Sandbox destination**.
2. Click **Add phone number**.
3. Enter **+919611377119** (or the number to receive OTP).
4. AWS sends a **verification code** to that number. If you can receive that code (e.g. on another device or via a different channel), enter it to verify.
5. After verification, OTP from Warmpawz will be delivered to that number.

**CLI (add number, verification still required in Console):**

```bash
aws sns create-sms-sandbox-phone-number --phone-number "+919611377119" --language-code en-US --region ap-south-1
# Then check the phone for AWS verification code and verify in Console:
# SNS → Sandbox destination → select number → Verify
```

### Option B: Request production access (disable sandbox, deliver to any number)

**This is the only way to disable sandbox.** It cannot be done via Console or CLI; AWS Support must approve.

1. **AWS Console** → **Support** (top-right) → **Create case**.
2. **Category:** Choose **Service limit increase**.
3. **Limit type:** Search for and select **SNS Text Messaging** (or **SMS**).
4. **Requests:** Add a request:
   - **Region:** Asia Pacific (Mumbai) / ap-south-1 (if asked).
   - **Limit:** Request **Production SMS access** or **Moving account out of SMS Sandbox**.
   - **Use case:** e.g. “Transactional SMS for our app: login OTP and booking notifications to Indian mobile numbers. We are DLT registered (Entity ID, Sender ID WARMPZ, templates approved with Jio). Need production access to deliver to all customers.”
5. **Submit.** AWS typically responds within 24–48 hours. After approval:
   - Sandbox is effectively disabled; you can send to any number (subject to DLT/carrier).
   - OTP and all notification SMS will deliver without verifying each number.
   - Sender ID **WARMPZ** and message format will be as defined in your DLT registration (once production + DLT are fully active).

### After production: what to expect when testing

Once production SMS is enabled and DLT is in effect:

- **Header:** Messages should show from **WARMPZ** (or your registered sender) instead of a numeric short code like 59039465.
- **Format:** Exactly as in your Jio-approved templates (OTP, Booking Confirmation, Rescheduled, Cancelled). No change needed in code; we already send the exact text and template IDs.
- **Testing:** Use the same flows: `POST /auth/send-otp`, create/reschedule/cancel a booking, or `POST /sms/send-sample-templates` with `{"phone":"9611377119"}` to verify all four templates and header.

---

## Manual Steps Required (AWS Support)

### 1. Preregister Sender ID for India (Required for delivery)

Without this, SNS uses ILDO routes and SMS may not deliver or may show random sender IDs.

1. Go to: https://docs.aws.amazon.com/sns/latest/dg/channels-sms-senderid-india.html
2. Follow "Request a sender ID" – open an AWS Support case
3. Provide:
   - Entity ID (PE): `1201176605406673276`
   - Sender ID: `WARMPZ`
   - Template IDs and sample content from Jio True Connect

### 2. SMS Monthly Spend Limit Increase (if MonthlySpendLimit=1)

Current limit $1 allows ~20–50 SMS. For production:

1. AWS Console → Support → Create case
2. Service: SNS | Limit: SMS Monthly Spend Limit
3. Request e.g. $50–100 for production

### 3. Rotate Exposed Credentials

If credentials were printed in a shared terminal, rotate them:

```bash
# Delete old key
aws iam delete-access-key --user-name warmpawz-sms-sender --access-key-id <OLD_KEY_ID>

# Create new key
aws iam create-access-key --user-name warmpawz-sms-sender

# Re-seed DB with new credentials
ENVIRONMENT=dev SMS_AWS_ACCESS_KEY_ID=<new> SMS_AWS_SECRET_ACCESS_KEY=<new> node scripts/seed-sms-aws-settings.js --enable
```

## Test Commands

```bash
# Ad-hoc test (no Lambda/DB)
SMS_AWS_ACCESS_KEY_ID=xxx SMS_AWS_SECRET_ACCESS_KEY=yyy node scripts/test-sms-send.js 9611377119

# Full setup
./scripts/setup-sms-iam-and-sns.sh
ENVIRONMENT=dev SMS_AWS_ACCESS_KEY_ID=xxx SMS_AWS_SECRET_ACCESS_KEY=yyy node scripts/seed-sms-aws-settings.js --enable
```

## Jio DLT Reference

| Template | Template ID | Message |
|----------|-------------|---------|
| Login OTP | 1207177028377787269 | Warmpawz: Your OTP for logging in is {#number#}. Do not share this OTP with anyone. |
| Booking Confirmed | 1207177035174777582 | Warmpawz Booking: Your booking with {#alphanumeric#} for {#alphanumeric#} at {#alphanumeric#} is confirmed... |
| Booking Rescheduled | 1207177035515118051 | Warmpawz Rescheduling: Your booking with {#alphanumeric#} has been rescheduled to {#alphanumeric#}... |
| Booking Cancelled | 1207177035326314961 | Warmpawz Cancellation: Your booking with {#alphanumeric#} scheduled for {#alphanumeric#} has been cancelled... |

Entity ID (PE): `1201176605406673276`  
Header: `WARMPZ`

### Sender showing as 59039465 instead of WARMPZ

We set `AWS.SNS.SMS.SenderID` to `WARMPZ` on every send. If you still see a numeric sender (e.g. 59039465):

- **Sandbox:** In SMS Sandbox, AWS may use a default numeric origin; WARMPZ may appear only after production access.
- **India DLT / End User Messaging:** Some regions require the Sender ID to be linked in AWS (e.g. Pinpoint / End User Messaging). Open an AWS Support case and ask to use your registered DLT Sender ID **WARMPZ** for SNS SMS in India.

### Send all 4 template samples to a phone

```bash
curl -X POST https://YOUR_API_URL/sms/send-sample-templates \
  -H "Content-Type: application/json" \
  -d '{"phone":"9611377119"}'
```

Sends, in order with 2s delay: Login OTP, Booking Confirmation, Booking Rescheduled, Booking Cancelled (with sample data).

**If you get 403 / "not authorized to perform SNS:Publish":**  
SMS sending uses either (1) **credentials from Admin → AWS settings** (`admin:settings:aws` with `sns.enabled` and IAM credentials that have `SNS:Publish`), or (2) the **Lambda execution role**. Ensure one of these has SNS permission: either configure AWS settings in the admin dashboard (credentials of an IAM user with SNS:Publish), or attach a policy like the following to the Lambda role:

```json
{
  "Effect": "Allow",
  "Action": "sns:Publish",
  "Resource": "*"
}
```
