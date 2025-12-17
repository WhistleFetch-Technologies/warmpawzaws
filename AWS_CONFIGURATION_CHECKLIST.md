# AWS Configuration Checklist for Notifications

**Date:** December 17, 2024  
**Purpose:** Ensure all AWS services are properly configured for email and SMS notifications

---

## ✅ Required AWS Configuration

### 1. AWS SNS (Simple Notification Service) - SMS

**Status:** ⚠️ **NEEDS CONFIGURATION**

**Required Settings:**
- [ ] **AWS Access Key ID** - IAM user with SNS permissions
- [ ] **AWS Secret Access Key** - Corresponding secret key
- [ ] **SNS Region** - `ap-south-1` (Mumbai) or your preferred region
- [ ] **SNS Enabled** - Toggle to `true` in Admin Panel
- [ ] **SMS Sender ID** - `WARMP-VX`, `WARMP-SX`, or `WARMP-NX` (must be registered in AWS SNS)

**Where to Configure:**
- Admin Panel > Integrations > AWS > Communication Tab > SNS Notifications

**AWS Console Steps:**
1. Go to AWS SNS Console
2. Navigate to "Text messaging (SMS)"
3. Request sender ID: `WARMP-VX` (or `WARMP-SX`, `WARMP-NX`)
4. Verify phone numbers for testing (if in sandbox mode)
5. Set up IAM user with `sns:Publish` permission

**IAM Policy Required:**
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

---

### 2. AWS SES (Simple Email Service) - Email

**Status:** ⚠️ **NEEDS CONFIGURATION**

**Required Settings:**
- [ ] **AWS Access Key ID** - IAM user with SES permissions (can be same as SNS)
- [ ] **AWS Secret Access Key** - Corresponding secret key
- [ ] **SES Region** - `ap-south-1` (Mumbai) or your preferred region
- [ ] **SES Enabled** - Toggle to `true` in Admin Panel
- [ ] **Email Source Address** - `noreply@warmpawz.com` (must be verified in AWS SES)

**Where to Configure:**
- Admin Panel > Integrations > AWS > Communication Tab > SES Email (if available)
- Or configure via code: `awsSettings.ses.emailSourceAddress = 'noreply@warmpawz.com'`

**AWS Console Steps:**
1. Go to AWS SES Console
2. Verify email address: `noreply@warmpawz.com`
3. If in sandbox mode, verify recipient email addresses for testing
4. Request production access (if needed)
5. Set up IAM user with `ses:SendEmail` and `ses:SendRawEmail` permissions

**IAM Policy Required:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 📋 Configuration Structure

The system expects AWS settings in this format:

```json
{
  "credentials": {
    "accessKeyId": "YOUR_ACCESS_KEY_ID",
    "secretAccessKey": "YOUR_SECRET_ACCESS_KEY",
    "region": "ap-south-1"
  },
  "sns": {
    "enabled": true,
    "region": "ap-south-1",
    "topicArn": "arn:aws:sns:ap-south-1:123456789012:your-topic",
    "senderId": "WARMP-VX",
    "businessListing": "WARMP-VX"
  },
  "ses": {
    "enabled": true,
    "region": "ap-south-1",
    "emailSourceAddress": "noreply@warmpawz.com"
  }
}
```

**Storage Location:**
- Primary: `admin:settings:aws` (KV store)
- Fallback: `platform:settings:aws` (KV store)

---

## 🔍 Missing Configuration Check

### Current Implementation Status:

✅ **Code Implementation:**
- SMS sending with sender ID support
- Email sending with source address
- OTP sending with sender ID
- Notification system integration

⚠️ **Configuration Required:**
1. **SMS Sender ID Registration:**
   - Register `WARMP-VX`, `WARMP-SX`, or `WARMP-NX` in AWS SNS
   - Note: Sender ID support varies by region (India supports it)

2. **Email Domain Verification:**
   - Verify `warmpawz.com` domain in AWS SES
   - Or verify `noreply@warmpawz.com` email address
   - Request production access if needed

3. **Admin UI Enhancement:**
   - Add SES configuration section in Admin Panel
   - Add SMS Sender ID field (already added in code)
   - Add Email Source Address field

---

## 🧪 Testing Configuration

### Test Script:
```bash
node test-notifications-comprehensive.js
```

### Manual Test Steps:

1. **Test OTP:**
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"phone": "+919611377119"}'
   ```

2. **Test Email:**
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/notifications/send \
     -H "Content-Type: application/json" \
     -d '{
       "recipientId": "test",
       "recipientType": "customer",
       "recipientEmail": "ketan.hirani@gmail.com",
       "type": "system_announcement",
       "category": "system",
       "title": "Test Email",
       "message": "Test message",
       "channels": {"email": true, "sms": false, "inApp": false, "push": false},
       "priority": "high"
     }'
   ```

3. **Test SMS:**
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/notifications/send \
     -H "Content-Type: application/json" \
     -d '{
       "recipientId": "test",
       "recipientType": "customer",
       "recipientPhone": "+919611377119",
       "type": "booking_confirmed",
       "category": "bookings",
       "title": "Test SMS",
       "message": "Test message",
       "channels": {"email": false, "sms": true, "inApp": false, "push": false},
       "priority": "high"
     }'
   ```

---

## ⚠️ Important Notes

1. **SMS Sender ID:**
   - Must be registered in AWS SNS before use
   - Format: `WARMP-VX`, `WARMP-SX`, `WARMP-NX` (6-11 alphanumeric characters)
   - India region supports sender ID
   - Some regions may not support sender ID (will fall back to long code)

2. **Email Source Address:**
   - Must be verified in AWS SES
   - Can be individual email (`noreply@warmpawz.com`) or domain (`@warmpawz.com`)
   - Sandbox mode: Only verified emails can receive
   - Production mode: Can send to any email

3. **SMS Sandbox Mode:**
   - If AWS SNS is in sandbox mode, only verified phone numbers can receive SMS
   - Request production access to send to any phone number

4. **Cost Considerations:**
   - AWS SNS: ~$0.00645 per SMS in India
   - AWS SES: First 62,000 emails/month free, then $0.10 per 1,000 emails

---

## 🚀 Next Steps

1. **Configure AWS SNS:**
   - [ ] Register sender ID in AWS SNS console
   - [ ] Add sender ID to Admin Panel configuration
   - [ ] Test OTP sending

2. **Configure AWS SES:**
   - [ ] Verify email address/domain in AWS SES
   - [ ] Add email source address to Admin Panel configuration
   - [ ] Test email sending

3. **Update Admin Panel:**
   - [ ] Add SES configuration section
   - [ ] Add SMS Sender ID field (already in code)
   - [ ] Add Email Source Address field

4. **Run Tests:**
   - [ ] Run comprehensive test script
   - [ ] Verify email delivery
   - [ ] Verify SMS delivery
   - [ ] Verify in-app notifications

---

**Configuration Status:** ⚠️ **REQUIRES ADMIN ACTION**

All code is ready. Please configure AWS SNS and SES in the Admin Panel and AWS Console.

