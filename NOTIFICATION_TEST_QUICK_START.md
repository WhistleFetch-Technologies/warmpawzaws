# Notification Test - Quick Start Guide

**Date:** December 17, 2024  
**Purpose:** Quick reference for testing notifications

---

## ✅ Code Implementation Status

**All code is complete and ready!** The following features are implemented:

- ✅ SMS notifications with sender ID (`WARMP-VX`, `WARMP-SX`, `WARMP-NX`)
- ✅ Email notifications with source address (`noreply@warmpawz.com`)
- ✅ OTP sending with sender ID
- ✅ In-app notifications
- ✅ Admin Panel UI for SES configuration
- ✅ Admin Panel UI for SMS Sender ID

---

## ⚠️ Required Backend Configuration

### 1. AWS SNS (SMS) - REQUIRED

**In AWS Console:**
1. Go to AWS SNS Console
2. Navigate to "Text messaging (SMS)"
3. Request sender ID: `WARMP-VX` (or `WARMP-SX`, `WARMP-NX`)
4. Verify phone numbers for testing (if in sandbox mode)
5. Create IAM user with `sns:Publish` permission

**In Admin Panel:**
1. Go to Admin > Integrations > AWS > Communication Tab
2. Enable "SNS Notifications"
3. Set Region: `ap-south-1`
4. Set Sender ID: `WARMP-VX`
5. Add AWS Access Key ID and Secret Access Key

---

### 2. AWS SES (Email) - REQUIRED

**In AWS Console:**
1. Go to AWS SES Console
2. Verify email address: `noreply@warmpawz.com`
   - Or verify domain: `warmpawz.com` (recommended)
3. Request production access (if needed)
4. Create IAM user with `ses:SendEmail` permission

**In Admin Panel:**
1. Go to Admin > Integrations > AWS > Communication Tab
2. Enable "SES Email"
3. Set Region: `ap-south-1`
4. Set Email Source Address: `noreply@warmpawz.com`
5. Add AWS Access Key ID and Secret Access Key (can be same as SNS)

---

## 🧪 Running Tests

### Option 1: Bash Script (Recommended)
```bash
./test-notifications.sh
```

### Option 2: Node.js Script
```bash
node test-notifications-comprehensive.js
```

### Option 3: Manual Testing

**Test OTP:**
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
    "recipientEmail": "ketan.hirani@gmail.com",
    "type": "system_announcement",
    "category": "system",
    "title": "Test Email",
    "message": "Test message",
    "channels": {"email": true, "sms": false, "inApp": false, "push": false},
    "priority": "high"
  }'
```

**Test SMS:**
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

---

## 📋 Test Checklist

After configuring AWS:

- [ ] Run `./test-notifications.sh`
- [ ] Check email inbox: `ketan.hirani@gmail.com`
- [ ] Check SMS on: `+919611377119`
- [ ] Check SMS on: `+918296414048`
- [ ] Verify SMS shows sender ID: `WARMP-VX`
- [ ] Verify email shows from: `noreply@warmpawz.com`
- [ ] Check in-app notifications in customer/vendor apps
- [ ] Verify AWS SNS console shows SMS delivery
- [ ] Verify AWS SES console shows email delivery

---

## 🔍 What to Check

### If SMS Fails:
1. Check AWS SNS is enabled in Admin Panel
2. Check sender ID is registered in AWS SNS
3. Check phone numbers are verified (if in sandbox mode)
4. Check IAM credentials have SNS permissions
5. Check AWS SNS console for error messages

### If Email Fails:
1. Check AWS SES is enabled in Admin Panel
2. Check email address is verified in AWS SES
3. Check IAM credentials have SES permissions
4. Check AWS SES console for error messages
5. Check spam folder

### If In-App Notifications Fail:
1. Check notification endpoint is accessible
2. Check recipient ID exists
3. Check notification is created in KV store
4. Check frontend polling service is running

---

## 📊 Expected Results

### Successful Test:
- ✅ OTP received on both phones with sender ID `WARMP-VX`
- ✅ Email received at `ketan.hirani@gmail.com` from `noreply@warmpawz.com`
- ✅ SMS received on both phones with sender ID `WARMP-VX`
- ✅ In-app notifications visible in apps
- ✅ All HTTP responses: 200 OK

### If Tests Fail:
- Check AWS configuration
- Check IAM permissions
- Check AWS service status
- Review error logs in AWS console

---

## 🚀 Quick Configuration Steps

1. **AWS SNS:**
   - Register sender ID: `WARMP-VX`
   - Get IAM credentials
   - Add to Admin Panel > Integrations > AWS > SNS

2. **AWS SES:**
   - Verify email: `noreply@warmpawz.com`
   - Get IAM credentials (can be same as SNS)
   - Add to Admin Panel > Integrations > AWS > SES

3. **Run Tests:**
   ```bash
   ./test-notifications.sh
   ```

4. **Verify:**
   - Check email inbox
   - Check SMS on phones
   - Check in-app notifications

---

**All code is ready. Just configure AWS and test!** 🎯

