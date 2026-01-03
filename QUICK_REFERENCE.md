# 🔧 QUICK REFERENCE - CRITICAL FIXES

## 🎯 WHAT CHANGED

### 1️⃣ Authentication Endpoints (FIXED)
```typescript
// ✅ NOW WORKS (all patterns)
POST /auth/otp/send          // Web pattern
POST /auth/send-otp          // Original pattern
POST /otp/generate           // Mobile pattern
POST /auth/otp/verify        // Web pattern
POST /auth/verify-otp        // Original pattern
POST /otp/verify             // Mobile pattern
```

**Response Now Includes:**
```json
{
  "verified": true,
  "phone": "9876543210",
  "userId": "cognito-sub-uuid",
  "accessToken": "eyJ...",
  "idToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresIn": 3600
}
```

---

### 2️⃣ Vendor Phone Check (NEW)
```typescript
// ✅ NEW ENDPOINT
GET /vendor/check-phone/:phone

// Response
{
  "exists": true,
  "vendorId": "uuid",
  "applicationId": "app-id",
  "status": "pending",
  "onboardingProgress": 75,
  "rejectionReason": null
}
```

---

### 3️⃣ Document Upload (CHANGED)
```typescript
// ❌ OLD (broken)
POST /upload/document
FormData: { file: File }

// ✅ NEW (S3 presigned URL)
// Step 1: Get presigned URL
POST /upload/presigned-url
{
  "fileName": "license.pdf",
  "fileType": "application/pdf",
  "folder": "vendor-documents"
}
// Response: { presignedUrl, publicUrl, fileKey }

// Step 2: Upload to S3
PUT <presignedUrl>
Body: File (raw)
Headers: { 'Content-Type': 'application/pdf' }

// Step 3: Save publicUrl in your data
```

---

### 4️⃣ Razorpay Webhook (SECURED)
```typescript
// ✅ NOW REQUIRES SIGNATURE
POST /payments/razorpay/webhook
Headers: {
  'X-Razorpay-Signature': '<hmac-sha256-signature>'
}

// ❌ Will return 401 if:
// - Signature missing
// - Signature invalid
// - RAZORPAY_WEBHOOK_SECRET not configured
```

---

### 5️⃣ CDK Deployment (FIXED)
```bash
# ✅ NOW COMPILES
cd infrastructure/cdk
npx tsc --noEmit --skipLibCheck

# ✅ NOW DEPLOYS
cdk synth
cdk deploy CognitoStack
cdk deploy LambdaStack
cdk deploy ApiGatewayStack
```

---

### 6️⃣ Cognito Integration (NEW)
```typescript
// ✅ NEW: User pools created on deploy
// Customer Pool: Phone-based login
// Vendor Pool: Phone + Email
// Admin Pool: Email + MFA

// ✅ Automatic user creation on OTP verify
// ✅ Returns JWT tokens
// ✅ Token refresh supported
```

---

## 🔑 ENVIRONMENT VARIABLES (REQUIRED)

```bash
# Backend Lambda
RAZORPAY_WEBHOOK_SECRET=whsec_...
COGNITO_USER_POOL_ID=ap-south-1_...
COGNITO_CLIENT_ID=...
COGNITO_PASSWORD_SECRET=...

# Frontend Apps
NEXT_PUBLIC_API_BASE_URL=https://api.warmpawz.com
NEXT_PUBLIC_COGNITO_USER_POOL_ID=...
NEXT_PUBLIC_COGNITO_CLIENT_ID=...
```

---

## 🧪 QUICK TESTS

### Test Authentication
```bash
curl -X POST https://api.warmpawz.com/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'
```

### Test Vendor Check
```bash
curl https://api.warmpawz.com/vendor/check-phone/9876543210
```

### Test Presigned URL
```bash
curl -X POST https://api.warmpawz.com/upload/presigned-url \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.pdf","fileType":"application/pdf","folder":"test"}'
```

### Test Webhook Security
```bash
# Should return 401
curl -X POST https://api.warmpawz.com/payments/razorpay/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"payment.captured"}'
```

---

## 🚨 BREAKING CHANGES

### 1. Authentication Response Changed
**Action:** Update frontend to use `accessToken` from response

### 2. Document Upload Method Changed
**Action:** Update mobile apps to use presigned URL flow

### 3. Webhook Requires Signature
**Action:** Configure webhook secret in Razorpay dashboard

---

## 📦 FILES TO REVIEW

### Backend
- `backend/lambda/src/endpoints/auth.ts` - Auth routing
- `backend/lambda/src/endpoints/vendor-onboarding.ts` - Phone check
- `backend/lambda/src/endpoints/payments.ts` - Webhook security
- `backend/lambda/src/utils/cognito-client.ts` - Cognito integration

### Infrastructure
- `infrastructure/cdk/lib/api-gateway-stack.ts` - API routes
- `infrastructure/cdk/lib/cognito-stack.ts` - User pools
- `infrastructure/cdk/lib/lambda-stack.ts` - Permissions

### Frontend
- `apps/vendor-web/components/vendor/VendorOnboardingFlow.tsx` - Upload flow

---

## 🎯 DEPLOYMENT ORDER

```bash
# 1. Set environment variables
export RAZORPAY_WEBHOOK_SECRET=...
export COGNITO_PASSWORD_SECRET=...

# 2. Deploy Cognito
cd infrastructure/cdk
cdk deploy CognitoStack

# 3. Copy Cognito IDs to .env

# 4. Deploy Lambda
cdk deploy LambdaStack

# 5. Deploy API Gateway
cdk deploy ApiGatewayStack

# 6. Configure Razorpay webhook
# https://dashboard.razorpay.com/app/webhooks

# 7. Deploy frontends with new API URL
```

---

## ❓ TROUBLESHOOTING

### "OTP endpoint not found"
→ Check you're using `/auth/otp/send` (not `/auth/send-otp` on frontend)

### "Document upload fails"
→ Use presigned URL flow (2-step process)

### "Webhook returns 401"
→ Set `RAZORPAY_WEBHOOK_SECRET` environment variable

### "CDK deploy fails"
→ Run `npm install` in `infrastructure/cdk`

### "Cognito errors"
→ Deploy `CognitoStack` first, then copy pool IDs

---

## 📞 HELP

- Deployment Guide: `CRITICAL_FIXES_DEPLOYMENT_GUIDE.md`
- Executive Summary: `CRITICAL_FIXES_EXECUTIVE_SUMMARY.md`
- Test Suite: `tests/critical-fixes-verification.test.ts`
- CloudWatch Logs: `/aws/lambda/warmpawz-api-handler`

---

**Quick Reference Card - Version 1.0**  
**Last Updated:** January 2, 2026

