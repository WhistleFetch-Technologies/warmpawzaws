# SMS Production Readiness Checklist

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
