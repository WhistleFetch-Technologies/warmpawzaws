# 📱 AWS SNS SMS Configuration Guide for Jio (India)

This guide walks you through configuring AWS SNS for SMS delivery in India after registering your sender ID with Jio.

---

## ✅ Prerequisites Completed

- ✅ Registered sender ID/service with Jio
- ✅ Code implementation ready (`backend/lambda/src/endpoints/auth.ts`)
- ✅ Admin UI for configuration available

---

## 🚀 Next Steps

### **Step 1: Configure AWS SNS SMS Preferences (AWS Console)**

Since you're sending SMS to Indian numbers, you need to configure SMS preferences in AWS SNS:

1. **Log in to AWS Console**
   - Go to: https://console.aws.amazon.com/sns/
   - Select region: **ap-south-1** (Mumbai)

2. **Navigate to SMS Preferences**
   - Click on **"Text messaging (SMS)"** in the left sidebar
   - Click on **"SMS preferences"** or **"Account preferences"**

3. **Configure India-Specific Settings**
   - **Default message type**: Select **"Transactional"** (required for OTPs)
   - **Default sender ID**: Enter your **Jio-registered sender ID** (e.g., "WARMPZ" or "WARMPAWZ")
   - **Spending limit**: Set a monthly spending limit (recommended: $100-500 for testing)
   - **Delivery status logging**: Enable **CloudWatch Logs** for debugging

4. **Important for India:**
   - AWS SNS in India requires **DLT (Distributed Ledger Technology) registration**
   - Ensure your sender ID is registered with **TRAI DLT portal**
   - Your Jio registration should include DLT details

---

### **Step 2: Set Up IAM User with SNS Permissions**

1. **Create IAM User** (if not already created):
   ```bash
   # Via AWS CLI or Console
   # User should have these permissions:
   - sns:Publish
   - sns:GetSMSAttributes
   - sns:SetSMSAttributes
   ```

2. **Create Access Keys**:
   - Go to IAM → Users → Your User → Security Credentials
   - Create new Access Key
   - **Save both Access Key ID and Secret Access Key** (you'll need these)

---

### **Step 3: Configure in Admin Panel**

1. **Access Admin Panel**:
   - Navigate to: `/admin/platform-settings/integrations` or `/admin/settings/aws`
   - Click **"Enable Edit Mode"**
   - Enter passcode: `Warmpawz2025`

2. **Configure AWS Credentials**:
   - **AWS Access Key ID**: Enter your IAM user's access key
   - **AWS Secret Access Key**: Enter your IAM user's secret key
   - **Default Region**: `ap-south-1`

3. **Enable SNS**:
   - Toggle **"Amazon SNS - SMS & Email"** to **ON**
   - **SMS Origination Number**: Enter your Jio-registered sender ID
     - Format: `WARMPZ` or `WARMPAWZ` (6 characters max for sender ID)
     - OR if you have a phone number: `+91XXXXXXXXXX`
   - **Region**: `ap-south-1`
   - **Email Source Address**: (optional) `noreply@warmpawz.com`

4. **Save Settings**:
   - Click **"Save All Changes"**

---

### **Step 4: Code Enhancement (Already Updated)**

✅ **Code has been updated** to include sender ID from settings when available.

**Note**: The sender ID is primarily configured at the AWS SNS account level (Step 1). The code enhancement ensures it's also included in message attributes if configured in your admin panel, providing additional flexibility.

**Important**: For India, AWS SNS uses the **account-level default sender ID** configured in SNS preferences. The message attribute approach is a fallback and may not be supported in all regions. Ensure your sender ID is set in AWS SNS console (Step 1) for reliable delivery.

---

### **Step 5: Test SMS Sending**

1. **Test via API**:
   ```bash
   curl -X POST https://your-api-url/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"phone": "+91XXXXXXXXXX"}'
   ```

2. **Check CloudWatch Logs**:
   - Go to CloudWatch → Log Groups
   - Look for Lambda function logs
   - Check for SNS publish success/failure

3. **Monitor SNS Metrics**:
   - Go to SNS → Text messaging (SMS) → Metrics
   - Check:
     - `NumberOfMessagesSent`
     - `NumberOfMessagesFailed`
     - `PriceInUSD`

---

## 🔧 Troubleshooting

### **Issue: SMS Not Delivered**

**Possible Causes:**
1. **Sender ID not registered with DLT**
   - Solution: Complete DLT registration with TRAI
   - Link: https://www.dltconnect.in/

2. **Incorrect phone number format**
   - Ensure format: `+91XXXXXXXXXX` (with country code)
   - Remove spaces, dashes, parentheses

3. **SNS spending limit reached**
   - Check: SNS → SMS preferences → Spending limit
   - Increase limit or check billing

4. **Account in sandbox mode**
   - AWS SNS starts in sandbox mode
   - Request production access: SNS → SMS preferences → Request production access

**Debug Steps:**
```bash
# Check SNS attributes
aws sns get-sms-attributes --region ap-south-1

# Check delivery status (if CloudWatch logging enabled)
aws logs tail /aws/lambda/your-function-name --follow
```

---

### **Issue: "InvalidParameterException"**

**Error**: `Invalid parameter: MessageAttributes`

**Solution**: Ensure message attributes are properly formatted:
```typescript
MessageAttributes: {
  'AWS.SNS.SMS.SMSType': {
    DataType: 'String',
    StringValue: 'Transactional', // or 'Promotional'
  },
}
```

---

### **Issue: "OptedOutException"**

**Error**: User has opted out of SMS

**Solution**: 
- User needs to opt back in via AWS SNS console
- Or handle gracefully in your code:
```typescript
try {
  await snsClient.send(...);
} catch (error) {
  if (error.name === 'OptedOutException') {
    console.warn('User opted out of SMS');
    // Handle gracefully
  }
}
```

---

## 📋 India-Specific Requirements

### **DLT Registration (Mandatory)**

1. **Register on TRAI DLT Portal**:
   - Website: https://www.dltconnect.in/
   - Register your entity
   - Register your sender ID
   - Get DLT template ID

2. **Link DLT with AWS SNS**:
   - AWS SNS automatically uses DLT registration
   - Ensure sender ID matches exactly

### **Sender ID Rules for India**

- **Alphanumeric Sender ID**: Max 6 characters
  - Examples: `WARMPZ`, `WARMPAWZ`
  - Must be registered with DLT

- **Numeric Sender ID**: 10 digits
  - Format: `+91XXXXXXXXXX`
  - Must be registered with telecom provider (Jio)

---

## 🔐 Security Best Practices

1. **Never commit AWS credentials to Git**
   - Use AWS Secrets Manager or Parameter Store
   - Store in database (encrypted) via admin panel

2. **Use IAM Roles (Recommended for Lambda)**
   - Instead of access keys, use IAM roles
   - Attach role to Lambda function

3. **Set Spending Limits**
   - Configure monthly spending limits in SNS
   - Set up CloudWatch alarms for unusual activity

4. **Monitor Usage**
   - Set up CloudWatch dashboards
   - Alert on failed deliveries

---

## 📊 Monitoring & Analytics

### **CloudWatch Metrics to Monitor**

1. **NumberOfMessagesSent**: Total SMS sent
2. **NumberOfMessagesFailed**: Failed deliveries
3. **PriceInUSD**: Cost tracking
4. **DeliverySuccessRate**: Success percentage

### **Set Up Alarms**

```bash
# Example: Alert if failure rate > 10%
aws cloudwatch put-metric-alarm \
  --alarm-name sns-sms-high-failure-rate \
  --alarm-description "Alert when SMS failure rate exceeds 10%" \
  --metric-name NumberOfMessagesFailed \
  --namespace AWS/SNS \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

---

## 💰 Cost Optimization

### **SMS Pricing in India (ap-south-1)**

- **Transactional SMS**: ~₹0.20-0.50 per SMS
- **Promotional SMS**: ~₹0.10-0.30 per SMS
- **International SMS**: Higher rates

### **Cost-Saving Tips**

1. **Use Transactional type only for OTPs** (required)
2. **Batch notifications** when possible
3. **Set spending limits** to prevent overages
4. **Monitor and optimize** message content length

---

## ✅ Checklist

- [ ] Registered sender ID with Jio
- [ ] Registered with TRAI DLT portal
- [ ] Configured AWS SNS SMS preferences
- [ ] Created IAM user with SNS permissions
- [ ] Configured AWS credentials in admin panel
- [ ] Enabled SNS in admin panel
- [ ] Set SMS origination number/sender ID
- [ ] Tested SMS sending
- [ ] Set up CloudWatch monitoring
- [ ] Configured spending limits
- [ ] Set up failure alerts

---

## 📞 Support Resources

- **AWS SNS Documentation**: https://docs.aws.amazon.com/sns/latest/dg/sms.html
- **India SMS Guidelines**: https://docs.aws.amazon.com/sns/latest/dg/sms_publish-to-phone.html
- **DLT Portal**: https://www.dltconnect.in/
- **AWS Support**: https://console.aws.amazon.com/support/

---

## 🎯 Quick Start Commands

```bash
# Test SMS sending via AWS CLI
aws sns publish \
  --phone-number "+91XXXXXXXXXX" \
  --message "Test message from Warmpawz" \
  --message-attributes '{
    "AWS.SNS.SMS.SMSType": {
      "DataType": "String",
      "StringValue": "Transactional"
    }
  }' \
  --region ap-south-1

# Check SMS attributes
aws sns get-sms-attributes --region ap-south-1

# Set default sender ID
aws sns set-sms-attributes \
  --attributes '{
    "DefaultSenderID": "WARMPZ"
  }' \
  --region ap-south-1
```

---

**Last Updated**: January 2025  
**Version**: 1.0.0

