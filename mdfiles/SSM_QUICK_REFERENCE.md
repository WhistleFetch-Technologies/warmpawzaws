# SSM Parameter Store - Quick Reference

**Quick start guide for SSM parameter management**

---

## 🚀 Quick Commands

### Verify Parameters
```bash
./scripts/verify-ssm-parameters.sh dev ap-south-1
```

### Setup Parameters (Interactive)
```bash
./scripts/setup-ssm-parameters.sh dev ap-south-1
```

### Manual Parameter Creation
```bash
aws ssm put-parameter \
  --name "/warmpawz/dev/db/host" \
  --value "your-value" \
  --type "String" \
  --region ap-south-1
```

---

## 📋 Required Parameters (14 Total)

### Critical (11)
- ✅ `/warmpawz/{stage}/db/host` (String)
- ✅ `/warmpawz/{stage}/db/port` (String)
- ✅ `/warmpawz/{stage}/db/name` (String)
- ✅ `/warmpawz/{stage}/db/user` (String)
- ✅ `/warmpawz/{stage}/db/password` (SecureString)
- ✅ `/warmpawz/{stage}/cognito/userPoolId` (String)
- ✅ `/warmpawz/{stage}/cognito/clientId` (String)
- ✅ `/warmpawz/{stage}/razorpay/keyId` (String)
- ✅ `/warmpawz/{stage}/razorpay/keySecret` (SecureString)
- ✅ `/warmpawz/{stage}/razorpay/webhookSecret` (SecureString)
- ✅ `/warmpawz/{stage}/sns/smsTopicArn` (String)
- ✅ `/warmpawz/{stage}/vpc/securityGroupId` (String)
- ✅ `/warmpawz/{stage}/vpc/subnetId1` (String)
- ✅ `/warmpawz/{stage}/vpc/subnetId2` (String)
- ✅ `/warmpawz/{stage}/cors/allowedOrigins` (String)

### Optional (2)
- ⚠️ `/warmpawz/{stage}/cloudfront/distributionId` (String)
- ⚠️ `/warmpawz/{stage}/features/uatMode` (String, default: false)

---

## ⚠️ What Breaks Without SSM?

### 🔴 Critical (System Broken)
- ❌ **Database params** → No data access
- ❌ **Cognito params** → No authentication
- ❌ **Razorpay params** → No payments
- ❌ **VPC params** → Network isolation

### 🟡 Important (Partial Failure)
- ⚠️ **SNS params** → SMS/OTP broken
- ⚠️ **CORS params** → Frontend blocked

---

## 🔄 CDK vs Serverless Framework

| Method | SSM Required? | Configuration Source |
|--------|--------------|---------------------|
| **CDK** | ❌ No | Stack props (direct references) |
| **Serverless Framework** | ✅ **YES** | SSM Parameter Store |

**If using Serverless Framework → SSM parameters are REQUIRED**

---

## 📖 Full Documentation

See `SSM_PARAMETER_COMPLETE_GUIDE.md` for:
- Detailed explanations
- Manual setup instructions
- Troubleshooting
- Enhancement recommendations

---

**Last Updated:** 2026-01-28
