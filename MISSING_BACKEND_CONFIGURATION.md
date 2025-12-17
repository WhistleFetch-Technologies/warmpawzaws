# Missing Backend Configuration for Notifications

**Date:** December 17, 2024  
**Status:** ⚠️ **REQUIRES ADMIN CONFIGURATION**

---

## 🔴 CRITICAL: Required AWS Configuration

### 1. AWS SNS Configuration (SMS)

**What's Missing:**
- [ ] **AWS Access Key ID** - IAM user credentials
- [ ] **AWS Secret Access Key** - IAM user credentials
- [ ] **SNS Enabled** - Toggle to `true` in Admin Panel
- [ ] **SNS Region** - Set to `ap-south-1` (or your region)
- [ ] **SMS Sender ID** - Register `WARMP-VX` (or `WARMP-SX`, `WARMP-NX`) in AWS SNS

**Where to Configure:**
1. **Admin Panel:** Admin > Integrations > AWS > Communication Tab > SNS Notifications
2. **AWS Console:** 
   - Go to AWS SNS Console
   - Navigate to "Text messaging (SMS)"
   - Request sender ID: `WARMP-VX`
   - Verify phone numbers (if in sandbox mode)

**Code Status:** ✅ **READY**
- SMS sending with sender ID support implemented
- OTP sending with sender ID support implemented
- Configuration path: `admin:settings:aws.sns.senderId`

---

### 2. AWS SES Configuration (Email)

**What's Missing:**
- [ ] **AWS Access Key ID** - IAM user credentials (can be same as SNS)
- [ ] **AWS Secret Access Key** - IAM user credentials
- [ ] **SES Enabled** - Toggle to `true` in Admin Panel
- [ ] **SES Region** - Set to `ap-south-1` (or your region)
- [ ] **Email Source Address** - Verify `noreply@warmpawz.com` in AWS SES

**Where to Configure:**
1. **Admin Panel:** Admin > Integrations > AWS > Communication Tab > SES Email (✅ **NOW AVAILABLE**)
2. **AWS Console:**
   - Go to AWS SES Console
   - Verify email address: `noreply@warmpawz.com`
   - Or verify domain: `warmpawz.com` (recommended)
   - Request production access (if needed)

**Code Status:** ✅ **READY**
- Email sending implemented
- Email source address configuration added to Admin Panel
- Configuration path: `admin:settings:aws.ses.emailSourceAddress`

---

## 📋 Configuration Structure

The system expects this structure in `admin:settings:aws`:

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

---

## ✅ What's Already Implemented

### Code Implementation:
- ✅ SMS sending with sender ID support (`WARMP-VX`, `WARMP-SX`, `WARMP-NX`)
- ✅ Email sending with source address (`noreply@warmpawz.com`)
- ✅ OTP sending with sender ID
- ✅ Notification system integration
- ✅ Admin Panel UI for SES configuration (just added)
- ✅ Admin Panel UI for SMS Sender ID (just added)
- ✅ Configuration path fallback (`admin:settings:aws` → `platform:settings:aws`)

### Test Scripts:
- ✅ `test-notifications.sh` - Bash test script
- ✅ `test-notifications-comprehensive.js` - Node.js test script

---

## 🚨 Action Items for You

### Immediate Actions Required:

1. **Configure AWS SNS:**
   ```
   - Go to AWS SNS Console
   - Request sender ID: WARMP-VX
   - Get IAM credentials with SNS permissions
   - Add to Admin Panel > Integrations > AWS > SNS
   ```

2. **Configure AWS SES:**
   ```
   - Go to AWS SES Console
   - Verify email: noreply@warmpawz.com
   - Or verify domain: warmpawz.com
   - Get IAM credentials with SES permissions
   - Add to Admin Panel > Integrations > AWS > SES
   ```

3. **Update Admin Panel Settings:**
   ```
   - Enable SNS: true
   - Set SNS Region: ap-south-1
   - Set SMS Sender ID: WARMP-VX
   - Enable SES: true
   - Set SES Region: ap-south-1
   - Set Email Source: noreply@warmpawz.com
   ```

4. **Run Test Script:**
   ```bash
   ./test-notifications.sh
   ```

---

## 📝 IAM Policy Requirements

### For SNS (SMS):
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

### For SES (Email):
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

**Note:** You can use the same IAM user for both SNS and SES.

---

## 🧪 Testing Instructions

### 1. Test OTP:
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919611377119"}'
```

### 2. Test Email:
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

### 3. Test SMS:
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
    "message": "Test message from WARMP-VX",
    "channels": {"email": false, "sms": true, "inApp": false, "push": false},
    "priority": "high"
  }'
```

### 4. Run Full Test Suite:
```bash
./test-notifications.sh
```

---

## ⚠️ Important Notes

1. **SMS Sender ID:**
   - Must be registered in AWS SNS before use
   - Format: `WARMP-VX`, `WARMP-SX`, `WARMP-NX` (6-11 alphanumeric)
   - India region supports sender ID
   - Some regions may not support sender ID (will fall back to long code)

2. **Email Source Address:**
   - Must be verified in AWS SES before sending
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

## ✅ Summary

**Code Status:** ✅ **100% COMPLETE**
- All notification code implemented
- SMS sender ID support added
- Email source address support added
- Admin Panel UI updated
- Test scripts created

**Configuration Status:** ⚠️ **REQUIRES YOUR ACTION**
- AWS SNS credentials needed
- AWS SES credentials needed
- Sender ID registration needed
- Email verification needed

**Next Step:** Configure AWS services in Admin Panel and AWS Console, then run test script.

---

**All code is ready. Please configure AWS SNS and SES!** 🚀

