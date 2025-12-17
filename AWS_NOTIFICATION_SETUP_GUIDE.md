# AWS Notification Setup Guide - Step by Step

**Purpose:** Complete guide to configure AWS SNS (SMS) and AWS SES (Email) for Warmpawz notifications

**Date:** December 2024

---

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ AWS Account with admin access
- ✅ Access to AWS Console
- ✅ Admin Panel access in Warmpawz application
- ✅ Domain ownership verification for `warmpawz.com` (for SES)

---

## Part 1: Configure AWS SNS (SMS Notifications)

### Step 1: Register WARMP-VX Sender ID in AWS SNS Console

#### 1.1 Navigate to AWS SNS Console
1. Log in to [AWS Console](https://console.aws.amazon.com/)
2. Select your region (recommended: **ap-south-1** - Mumbai, India)
3. Search for "SNS" in the services search bar
4. Click on **Simple Notification Service (SNS)**

#### 1.2 Request Sender ID
1. In the SNS console, click on **Text messaging (SMS)** in the left sidebar
2. Click on **Text messaging preferences** (or **SMS preferences**)
3. Scroll down to the **Sender IDs** section
4. Click **Request sender ID** button
5. Fill in the form:
   - **Sender ID:** `WARMP-VX`
   - **Use case:** Select "Transactional" or "Marketing"
   - **Message sample:** 
     ```
     Your Warmpawz verification code is: 123456. Valid for 5 minutes.
     ```
   - **Website URL:** `https://warmpawz.com`
   - **Company name:** Warmpawz
6. Click **Submit request**
7. **Note:** Sender ID approval can take 24-48 hours. You'll receive an email when approved.

#### 1.3 Alternative: Use Short Code (If Sender ID Not Available)
If sender ID registration is not available in your region:
- Use a **Short Code** (if available in your region)
- Or use the default **Long Code** (phone number format)

#### 1.4 Verify Phone Numbers (Sandbox Mode)
If your AWS account is in **SMS Sandbox mode**:
1. Go to **Text messaging (SMS)** > **Phone numbers**
2. Click **Add phone number**
3. Enter your test phone number (with country code, e.g., +919611377119)
4. Click **Generate one-time password**
5. Enter the OTP received via SMS
6. **Note:** In sandbox mode, you can only send SMS to verified numbers. Request production access to send to any number.

---

### Step 2: Create IAM User for SNS Access

#### 2.1 Create IAM User
1. Navigate to **IAM** service in AWS Console
2. Click **Users** in the left sidebar
3. Click **Create user**
4. Enter username: `warmpawz-sns-ses-user` (or your preferred name)
5. Click **Next**

#### 2.2 Attach Permissions Policy
1. Select **Attach policies directly**
2. Click **Create policy**
3. Switch to **JSON** tab
4. Paste the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish",
        "sns:GetSMSAttributes",
        "sns:SetSMSAttributes",
        "sns:GetSMSSandboxAccountStatus",
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:GetSendQuota",
        "ses:GetSendStatistics"
      ],
      "Resource": "*"
    }
  ]
}
```

5. Click **Next**
6. Name the policy: `Warmpawz-Notification-Policy`
7. Click **Create policy**
8. Go back to the user creation page
9. Search for and select `Warmpawz-Notification-Policy`
10. Click **Next**
11. Review and click **Create user**

#### 2.3 Generate Access Keys
1. Click on the newly created user
2. Go to **Security credentials** tab
3. Scroll to **Access keys** section
4. Click **Create access key**
5. Select **Application running outside AWS**
6. Click **Next**
7. Add description: `Warmpawz Admin Panel Integration`
8. Click **Create access key**
9. **IMPORTANT:** Copy both:
   - **Access key ID** (e.g., `AKIAIOSFODNN7EXAMPLE`)
   - **Secret access key** (e.g., `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)
   - ⚠️ **You can only view the secret key once!** Save it securely.

---

### Step 3: Add IAM Credentials to Admin Panel

#### 3.1 Access Admin Panel
1. Log in to your Warmpawz Admin Panel
2. Navigate to **Integrations** (or **Settings** > **Integrations**)
3. Click on **Cloud Integrations** or **AWS Configuration**

#### 3.2 Configure Global IAM Credentials
1. Click on the **Credentials** tab
2. Enter the following:
   - **AWS Access Key ID:** Paste the Access Key ID from Step 2.3
   - **AWS Secret Access Key:** Paste the Secret Access Key from Step 2.3
   - **Region:** `ap-south-1` (or your preferred region)
3. Click **Save** or **Update**

#### 3.3 Configure SNS Settings
1. Click on the **Communication** tab
2. Find **SNS Notifications** section
3. Toggle **SNS Notifications** to **Enabled**
4. Fill in the fields:
   - **Topic ARN:** (Optional - leave empty if not using topics)
   - **Region:** `ap-south-1` (should match your IAM region)
   - **Sender ID / Business Listing:** `WARMP-VX`
5. Click **Save**

#### 3.4 Test SNS Configuration
1. Look for a **Test Connection** button (if available)
2. Or test by sending an OTP:
   - Go to customer login
   - Enter a phone number
   - Request OTP
   - Check if SMS is received

---

## Part 2: Configure AWS SES (Email Notifications)

### Step 4: Verify Email Address in AWS SES Console

#### 4.1 Navigate to AWS SES Console
1. In AWS Console, search for "SES"
2. Click on **Simple Email Service (SES)**
3. Select your region (recommended: **ap-south-1** - Mumbai, India)
   - ⚠️ **Important:** SES is region-specific. Choose the same region as your SNS.

#### 4.2 Verify Email Address
1. In the SES console, click **Verified identities** in the left sidebar
2. Click **Create identity**
3. Select **Email address**
4. Enter email address: `noreply@warmpawz.com`
5. Click **Create identity**

#### 4.3 Verify Email via Email Confirmation
1. Check the inbox for `noreply@warmpawz.com`
2. You should receive an email from AWS SES with subject: **Amazon SES Address Verification Request**
3. Click the verification link in the email
4. You'll be redirected to AWS confirming verification
5. Return to SES console - status should show **Verified**

#### 4.4 Alternative: Verify Domain (Recommended for Production)
For better deliverability, verify the entire domain:

1. In SES console, click **Create identity**
2. Select **Domain**
3. Enter domain: `warmpawz.com`
4. Click **Create identity**
5. AWS will provide DNS records to add:
   - **CNAME records** for domain verification
   - **TXT record** for DKIM signing
6. Add these records to your domain's DNS settings
7. Wait for DNS propagation (can take up to 48 hours)
8. Once verified, you can send from any email address on `@warmpawz.com`

#### 4.5 Request Production Access (If in Sandbox Mode)
If your AWS account is in **SES Sandbox mode**:

1. In SES console, click **Account dashboard**
2. Check **Sending statistics** - if it shows "Sandbox", you need production access
3. Click **Request production access**
4. Fill out the form:
   - **Mail Type:** Select "Transactional"
   - **Website URL:** `https://warmpawz.com`
   - **Use case description:**
     ```
     We use AWS SES to send transactional emails for our pet care platform:
     - OTP verification codes
     - Booking confirmations
     - Vendor onboarding notifications
     - Payment receipts
     - Service completion notifications
     ```
   - **Expected sending volume:** Enter your estimated monthly emails
   - **Compliance:** Answer questions about email compliance
5. Click **Submit**
6. **Note:** Production access approval can take 24-48 hours

---

### Step 5: Add SES Configuration to Admin Panel

#### 5.1 Configure SES Settings
1. In Admin Panel, go to **Integrations** > **Cloud Integrations**
2. Click on the **Communication** tab
3. Find **SES Email** section
4. Toggle **SES Email** to **Enabled**
5. Fill in the fields:
   - **Region:** `ap-south-1` (must match your SES region)
   - **Email Source Address:** `noreply@warmpawz.com`
6. Click **Save**

#### 5.2 Verify IAM Credentials (Same as Step 3.2)
- The IAM credentials you added in Step 3.2 are used for both SNS and SES
- No need to add separate credentials
- Just ensure the IAM user has both SNS and SES permissions (which we added in Step 2.2)

#### 5.3 Test SES Configuration
1. Look for a **Test Email** button (if available)
2. Or test by triggering a notification:
   - Create a test booking
   - Check if confirmation email is received
   - Or use the notification test endpoint

---

## Part 3: Verification & Testing

### Step 6: Verify Complete Configuration

#### 6.1 Check Admin Panel Settings
Verify all settings are saved correctly:

**Credentials Tab:**
- ✅ AWS Access Key ID: (should be filled)
- ✅ AWS Secret Access Key: (should be filled)
- ✅ Region: `ap-south-1`

**Communication Tab - SNS:**
- ✅ SNS Enabled: `ON`
- ✅ Region: `ap-south-1`
- ✅ Sender ID: `WARMP-VX`

**Communication Tab - SES:**
- ✅ SES Enabled: `ON`
- ✅ Region: `ap-south-1`
- ✅ Email Source Address: `noreply@warmpawz.com`

#### 6.2 Test SMS (SNS)
1. **Test OTP:**
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"phone": "+919611377119"}'
   ```
   - Replace `YOUR_PROJECT` with your Supabase project ID
   - Replace phone number with a verified number (if in sandbox)

2. **Expected Result:**
   - SMS received with OTP
   - Sender ID shows as `WARMP-VX`

#### 6.3 Test Email (SES)
1. **Test Email Notification:**
   ```bash
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/make-server-3dd53475/notifications/send \
     -H "Content-Type: application/json" \
     -d '{
       "recipientId": "test",
       "recipientType": "customer",
       "recipientEmail": "your-email@example.com",
       "type": "system_announcement",
       "category": "system",
       "title": "Test Email",
       "message": "This is a test email from Warmpawz",
       "channels": {"email": true, "sms": false, "inApp": false, "push": false},
       "priority": "high"
     }'
   ```

2. **Expected Result:**
   - Email received in inbox
   - From address: `noreply@warmpawz.com`
   - Check spam folder if not in inbox

---

## 🔧 Troubleshooting

### Issue: SNS SMS Not Sending

**Possible Causes:**
1. **Sandbox Mode:** Only verified numbers can receive SMS
   - **Solution:** Verify your phone number or request production access

2. **Sender ID Not Approved:** Registration still pending
   - **Solution:** Wait for approval email from AWS (24-48 hours)

3. **Incorrect Region:** SNS region doesn't match IAM region
   - **Solution:** Ensure all regions are set to `ap-south-1` (or your chosen region)

4. **Invalid Credentials:** IAM keys incorrect
   - **Solution:** Regenerate access keys and update in Admin Panel

5. **Insufficient Permissions:** IAM user missing SNS permissions
   - **Solution:** Verify IAM policy includes `sns:Publish` permission

### Issue: SES Email Not Sending

**Possible Causes:**
1. **Email Not Verified:** `noreply@warmpawz.com` not verified
   - **Solution:** Check SES console, verify email address

2. **Sandbox Mode:** Can only send to verified emails
   - **Solution:** Verify recipient email or request production access

3. **Incorrect Region:** SES region doesn't match IAM region
   - **Solution:** Ensure SES region matches IAM region

4. **Invalid Credentials:** IAM keys incorrect
   - **Solution:** Regenerate access keys and update in Admin Panel

5. **Insufficient Permissions:** IAM user missing SES permissions
   - **Solution:** Verify IAM policy includes `ses:SendEmail` permission

6. **Email in Spam:** Email delivered but marked as spam
   - **Solution:** 
     - Verify domain (not just email) for better deliverability
     - Set up SPF, DKIM, and DMARC records
     - Warm up your sending domain gradually

### Issue: "Access Denied" Errors

**Solution:**
1. Check IAM user has correct permissions
2. Verify access keys are correct
3. Ensure region matches across all services
4. Check IAM policy JSON syntax is correct

### Issue: Sender ID Not Showing in SMS

**Solution:**
1. Wait for Sender ID approval (24-48 hours)
2. Verify Sender ID is approved in SNS console
3. Check if your region supports Sender IDs (India supports it)
4. Some carriers may not display Sender ID - this is normal

---

## 📊 Cost Considerations

### AWS SNS (SMS) Pricing
- **India:** ~₹0.50 per SMS (~$0.00645)
- **US:** ~$0.00645 per SMS
- **Other regions:** Varies by country

### AWS SES (Email) Pricing
- **First 62,000 emails/month:** FREE (if sent from EC2)
- **After free tier:** $0.10 per 1,000 emails
- **Data transfer:** Free up to 1GB/month

### Cost Optimization Tips
1. Use SES for emails (cheaper than SNS for long messages)
2. Use SNS only for OTP and critical SMS
3. Batch notifications when possible
4. Monitor usage in AWS Cost Explorer

---

## ✅ Checklist

Use this checklist to ensure everything is configured:

### AWS SNS Configuration
- [ ] Sender ID `WARMP-VX` requested in AWS SNS Console
- [ ] Sender ID approved (check email from AWS)
- [ ] IAM user created with SNS permissions
- [ ] Access keys generated and saved securely
- [ ] Phone numbers verified (if in sandbox mode)
- [ ] Production access requested (if needed)

### AWS SES Configuration
- [ ] Email `noreply@warmpawz.com` verified in AWS SES Console
- [ ] Domain `warmpawz.com` verified (optional but recommended)
- [ ] Production access requested (if in sandbox mode)
- [ ] IAM user has SES permissions (same user as SNS)

### Admin Panel Configuration
- [ ] IAM Access Key ID added to Admin Panel
- [ ] IAM Secret Access Key added to Admin Panel
- [ ] Region set to `ap-south-1` (or your chosen region)
- [ ] SNS enabled and configured
- [ ] SNS Sender ID set to `WARMP-VX`
- [ ] SES enabled and configured
- [ ] SES Email Source Address set to `noreply@warmpawz.com`

### Testing
- [ ] SMS test successful (OTP received)
- [ ] Email test successful (email received)
- [ ] Sender ID appears in SMS (if supported)
- [ ] Email from address shows `noreply@warmpawz.com`

---

## 📞 Support

If you encounter issues:

1. **Check AWS Console:**
   - SNS: Check SMS delivery logs
   - SES: Check sending statistics and bounce/complaint rates

2. **Check Application Logs:**
   - Supabase Edge Function logs
   - Look for AWS SDK errors

3. **Verify Configuration:**
   - Re-check all settings in Admin Panel
   - Verify IAM permissions
   - Confirm email/phone verification status

4. **AWS Support:**
   - AWS Support Center for account issues
   - AWS SES Support for email deliverability issues
   - AWS SNS Support for SMS delivery issues

---

## 🎯 Quick Reference

### IAM Policy (Combined SNS + SES)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sns:Publish",
        "sns:GetSMSAttributes",
        "sns:SetSMSAttributes",
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "*"
    }
  ]
}
```

### Admin Panel Settings Structure
```json
{
  "credentials": {
    "accessKeyId": "AKIA...",
    "secretAccessKey": "...",
    "region": "ap-south-1"
  },
  "sns": {
    "enabled": true,
    "region": "ap-south-1",
    "senderId": "WARMP-VX"
  },
  "ses": {
    "enabled": true,
    "region": "ap-south-1",
    "emailSourceAddress": "noreply@warmpawz.com"
  }
}
```

---

**Guide Last Updated:** December 2024  
**Status:** ✅ Complete Setup Guide

