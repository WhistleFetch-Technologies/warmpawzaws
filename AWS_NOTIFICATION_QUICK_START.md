# AWS Notification Setup - Quick Start Guide

**Quick reference for configuring AWS SNS and SES**

---

## 🚀 Quick Steps Summary

### 1. AWS SNS Setup (5 minutes)

**In AWS Console:**
1. Go to **SNS** → **Text messaging (SMS)** → **Text messaging preferences**
2. Click **Request sender ID** → Enter `WARMP-VX` → Submit
3. Wait for approval email (24-48 hours)

**In Admin Panel:**
1. Go to **Integrations** → **Cloud Integrations** → **Communication** tab
2. Enable **SNS Notifications**
3. Set **Sender ID:** `WARMP-VX`
4. Set **Region:** `ap-south-1`

---

### 2. AWS SES Setup (5 minutes)

**In AWS Console:**
1. Go to **SES** → **Verified identities** → **Create identity**
2. Select **Email address** → Enter `noreply@warmpawz.com`
3. Click verification link in email
4. Request production access (if in sandbox)

**In Admin Panel:**
1. Go to **Integrations** → **Cloud Integrations** → **Communication** tab
2. Enable **SES Email**
3. Set **Email Source Address:** `noreply@warmpawz.com`
4. Set **Region:** `ap-south-1`

---

### 3. IAM Credentials Setup (5 minutes)

**In AWS Console:**
1. Go to **IAM** → **Users** → **Create user**
2. Name: `warmpawz-sns-ses-user`
3. Attach policy (see JSON below)
4. Create access key → **Save both keys!**

**IAM Policy JSON:**
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "sns:Publish",
      "sns:GetSMSAttributes",
      "sns:SetSMSAttributes",
      "ses:SendEmail",
      "ses:SendRawEmail"
    ],
    "Resource": "*"
  }]
}
```

**In Admin Panel:**
1. Go to **Integrations** → **Cloud Integrations** → **Credentials** tab
2. Enter **Access Key ID**
3. Enter **Secret Access Key**
4. Set **Region:** `ap-south-1`
5. Click **Save**

---

## ✅ Verification Checklist

- [ ] Sender ID `WARMP-VX` requested in AWS SNS
- [ ] Email `noreply@warmpawz.com` verified in AWS SES
- [ ] IAM user created with SNS + SES permissions
- [ ] Access keys added to Admin Panel
- [ ] SNS enabled in Admin Panel with Sender ID
- [ ] SES enabled in Admin Panel with email address
- [ ] Test SMS sent successfully
- [ ] Test email sent successfully

---

## 🧪 Quick Test

**Test SMS:**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919611377119"}'
```

**Test Email:**
```bash
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "test",
    "recipientType": "customer",
    "recipientEmail": "your-email@example.com",
    "type": "system_announcement",
    "category": "system",
    "title": "Test",
    "message": "Test email",
    "channels": {"email": true, "sms": false, "inApp": false, "push": false},
    "priority": "high"
  }'
```

---

## ⚠️ Common Issues

| Issue | Solution |
|-------|----------|
| SMS not sending | Verify phone number (sandbox) or request production access |
| Email not sending | Verify email address in SES console |
| Access denied | Check IAM permissions and credentials |
| Sender ID not showing | Wait for approval (24-48 hours) |

---

**For detailed instructions, see:** `AWS_NOTIFICATION_SETUP_GUIDE.md`

