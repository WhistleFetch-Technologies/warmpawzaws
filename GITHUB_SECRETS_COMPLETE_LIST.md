# 🔐 Complete GitHub Secrets Checklist for Warmpawz CI/CD

## ✅ DOCUMENTED SECRETS (Already in CI/CD Workflows)

### Core AWS Secrets (Required for ALL Environments)
| Secret Name | Required | Usage | Documented |
|-------------|----------|-------|------------|
| `AWS_ACCESS_KEY_ID` | ✅ Yes | AWS authentication for Terraform & deployments | ✅ Yes |
| `AWS_SECRET_ACCESS_KEY` | ✅ Yes | AWS authentication | ✅ Yes |
| `AWS_REGION` | ✅ Yes | AWS region (default: us-east-1) | ✅ Yes |
| `AWS_ACCOUNT_ID` | ✅ Yes | AWS account identifier | ✅ Yes |

### Environment-Specific Secrets
| Secret Name | Required | Usage | Documented |
|-------------|----------|-------|------------|
| `DEV_OPENSEARCH_PASSWORD` | ⚠️ Optional | OpenSearch master password for dev | ✅ Yes |
| `STAGE_OPENSEARCH_PASSWORD` | ✅ Yes | OpenSearch master password for stage | ✅ Yes |
| `PROD_OPENSEARCH_PASSWORD` | ✅ Yes | OpenSearch master password for production | ✅ Yes |

### Notifications
| Secret Name | Required | Usage | Documented |
|-------------|----------|-------|------------|
| `SLACK_WEBHOOK_URL` | ⚠️ Optional | Slack notifications for deployments | ✅ Yes |
| `CODECOV_TOKEN` | ⚠️ Optional | Code coverage reporting | ✅ Yes |

---

## ❌ MISSING SECRETS (Found in Codebase but NOT in CI/CD Workflows)

### Payment Gateways (CRITICAL - Required for Runtime)
| Secret Name | Required | Usage | In Workflows | In Docs |
|-------------|----------|-------|--------------|---------|
| `RAZORPAY_KEY_ID` | ✅ Yes | Razorpay API authentication | ❌ No | ✅ Yes |
| `RAZORPAY_KEY_SECRET` | ✅ Yes | Razorpay API secret | ❌ No | ✅ Yes |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ Yes | Razorpay webhook signature verification | ❌ No | ❌ No |
| `STRIPE_SECRET_KEY` | ✅ Yes | Stripe API authentication | ❌ No | ✅ Yes |
| `STRIPE_PUBLISHABLE_KEY` | ✅ Yes | Stripe client-side key | ❌ No | ✅ Yes |
| `STRIPE_WEBHOOK_SECRET` | ✅ Yes | Stripe webhook signature verification | ❌ No | ❌ No |

### Logistics Partners
| Secret Name | Required | Usage | In Workflows | In Docs |
|-------------|----------|-------|--------------|---------|
| `SHIPROCKET_EMAIL` | ✅ Yes | Shiprocket authentication | ❌ No | ✅ Yes |
| `SHIPROCKET_PASSWORD` | ✅ Yes | Shiprocket authentication | ❌ No | ✅ Yes |
| `BORZO_API_KEY` | ⚠️ Optional | Borzo delivery API | ❌ No | ✅ Yes |
| `BORZO_API_SECRET` | ⚠️ Optional | Borzo delivery API | ❌ No | ✅ Yes |

### Google Services
| Secret Name | Required | Usage | In Workflows | In Docs |
|-------------|----------|-------|--------------|---------|
| `GOOGLE_MAPS_API_KEY` | ✅ Yes | Google Maps integration | ❌ No | ✅ Yes |

### Frontend Configuration (Public but Environment-Specific)
| Secret Name | Required | Usage | In Workflows | In Docs |
|-------------|----------|-------|--------------|---------|
| `NEXT_PUBLIC_RAZORPAY_KEY` | ✅ Yes | Razorpay public key for frontend | ❌ No | ❌ No |
| `NEXT_PUBLIC_API_BASE_URL` | ✅ Yes | API endpoint for frontend apps | ❌ No | ❌ No |

### Mobile Build Secrets (ALREADY IN SEPARATE WORKFLOWS)
| Secret Name | Required | Usage | In Workflows | In Docs |
|-------------|----------|-------|--------------|---------|
| `IOS_CERTIFICATE_BASE64` | ✅ Yes (iOS) | iOS code signing certificate | ✅ Yes | ❌ No |
| `IOS_CERTIFICATE_PASSWORD` | ✅ Yes (iOS) | Certificate password | ✅ Yes | ❌ No |
| `IOS_PROVISIONING_PROFILE_BASE64` | ✅ Yes (iOS) | iOS provisioning profile | ✅ Yes | ❌ No |
| `IOS_PROVISIONING_PROFILE_VENDOR_BASE64` | ✅ Yes (iOS) | Vendor app provisioning | ✅ Yes | ❌ No |
| `IOS_KEYCHAIN_PASSWORD` | ✅ Yes (iOS) | Keychain password | ✅ Yes | ❌ No |
| `ANDROID_KEYSTORE_BASE64` | ✅ Yes (Android) | Android signing keystore | ✅ Yes | ❌ No |
| `ANDROID_KEYSTORE_PASSWORD` | ✅ Yes (Android) | Keystore password | ✅ Yes | ❌ No |
| `ANDROID_KEY_ALIAS` | ✅ Yes (Android) | Key alias | ✅ Yes | ❌ No |
| `ANDROID_KEY_PASSWORD` | ✅ Yes (Android) | Key password | ✅ Yes | ❌ No |

---

## 📊 SUMMARY

### Total Secrets Count
- **Documented in CI/CD workflows**: 8 secrets
- **Found in codebase but MISSING from workflows**: 13 secrets
- **Mobile-specific (separate workflows)**: 9 secrets
- **Total Required**: 30+ secrets

### Critical Missing Secrets (Must Add)
These are used in runtime but NOT passed through CI/CD:

1. ✅ **RAZORPAY_KEY_ID** - Used in razorpay-settlements.ts
2. ✅ **RAZORPAY_KEY_SECRET** - Used in razorpay-settlements.ts
3. ⚠️ **RAZORPAY_WEBHOOK_SECRET** - Used for webhook verification (SECURITY RISK)
4. ✅ **STRIPE_SECRET_KEY** - Used for Stripe payments
5. ⚠️ **STRIPE_WEBHOOK_SECRET** - Used for webhook verification (SECURITY RISK)
6. ✅ **GOOGLE_MAPS_API_KEY** - Used for location services
7. ✅ **NEXT_PUBLIC_RAZORPAY_KEY** - Used in frontend BookingFlow.tsx
8. ✅ **NEXT_PUBLIC_API_BASE_URL** - Used in all frontend apps

---

## 📝 RECOMMENDED ACTIONS

### 1. Add Missing Secrets to GitHub Repository

Go to: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets with appropriate values:

```bash
# Payment Gateways
RAZORPAY_KEY_ID=rzp_test_... (dev) / rzp_live_... (prod)
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
STRIPE_SECRET_KEY=sk_test_... (dev) / sk_live_... (prod)
STRIPE_PUBLISHABLE_KEY=pk_test_... / pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Logistics
SHIPROCKET_EMAIL=...
SHIPROCKET_PASSWORD=...
BORZO_API_KEY=...
BORZO_API_SECRET=...

# Google Services
GOOGLE_MAPS_API_KEY=...

# Frontend (Environment-specific)
NEXT_PUBLIC_RAZORPAY_KEY_DEV=rzp_test_...
NEXT_PUBLIC_RAZORPAY_KEY_STAGE=rzp_test_...
NEXT_PUBLIC_RAZORPAY_KEY_PROD=rzp_live_...

NEXT_PUBLIC_API_BASE_URL_DEV=https://dev.api.warmpawz.com
NEXT_PUBLIC_API_BASE_URL_STAGE=https://stage.api.warmpawz.com
NEXT_PUBLIC_API_BASE_URL_PROD=https://api.warmpawz.com
```

### 2. Update CI/CD Workflows

The workflows need to be updated to pass these secrets to:
- **AWS Secrets Manager** (for runtime use by Lambdas)
- **Frontend build process** (NEXT_PUBLIC_* variables)
- **Readiness checks** (to test external integrations)

### 3. Use AWS Secrets Manager for Runtime

All runtime secrets should be stored in AWS Secrets Manager and accessed by Lambda functions:

```bash
# Already handled by Terraform
warmpawz/dev/razorpay
warmpawz/dev/stripe
warmpawz/dev/shiprocket
warmpawz/dev/google-maps

# Same for stage and prod
```

### 4. Environment-Specific Strategy

**Development:**
- Use test/sandbox credentials
- Webhook secrets are optional
- NEXT_PUBLIC_API_BASE_URL = dev endpoint

**Stage:**
- Use test/sandbox credentials
- Test webhook verification
- NEXT_PUBLIC_API_BASE_URL = stage endpoint

**Production:**
- Use live credentials
- Webhook verification MANDATORY
- NEXT_PUBLIC_API_BASE_URL = production endpoint

---

## 🔒 SECURITY NOTES

1. **Webhook Secrets are CRITICAL** - Without them, webhooks can be spoofed
2. **Never expose secret keys in frontend** - Only NEXT_PUBLIC_* variables
3. **Rotate secrets every 90 days**
4. **Use different credentials per environment**
5. **Store production secrets ONLY in AWS Secrets Manager**
6. **GitHub Secrets are for CI/CD only** - Runtime uses AWS Secrets Manager

---

## 📋 COMPLETE SETUP CHECKLIST

### GitHub Repository Secrets (30 total)
- [ ] AWS_ACCESS_KEY_ID
- [ ] AWS_SECRET_ACCESS_KEY
- [ ] AWS_REGION
- [ ] AWS_ACCOUNT_ID
- [ ] DEV_OPENSEARCH_PASSWORD (optional)
- [ ] STAGE_OPENSEARCH_PASSWORD
- [ ] PROD_OPENSEARCH_PASSWORD
- [ ] RAZORPAY_KEY_ID
- [ ] RAZORPAY_KEY_SECRET
- [ ] RAZORPAY_WEBHOOK_SECRET ⚠️ NEW
- [ ] STRIPE_SECRET_KEY
- [ ] STRIPE_PUBLISHABLE_KEY
- [ ] STRIPE_WEBHOOK_SECRET ⚠️ NEW
- [ ] SHIPROCKET_EMAIL
- [ ] SHIPROCKET_PASSWORD
- [ ] BORZO_API_KEY (optional)
- [ ] BORZO_API_SECRET (optional)
- [ ] GOOGLE_MAPS_API_KEY
- [ ] NEXT_PUBLIC_RAZORPAY_KEY_DEV ⚠️ NEW
- [ ] NEXT_PUBLIC_RAZORPAY_KEY_STAGE ⚠️ NEW
- [ ] NEXT_PUBLIC_RAZORPAY_KEY_PROD ⚠️ NEW
- [ ] NEXT_PUBLIC_API_BASE_URL_DEV ⚠️ NEW
- [ ] NEXT_PUBLIC_API_BASE_URL_STAGE ⚠️ NEW
- [ ] NEXT_PUBLIC_API_BASE_URL_PROD ⚠️ NEW
- [ ] SLACK_WEBHOOK_URL (optional)
- [ ] CODECOV_TOKEN (optional)
- [ ] IOS_CERTIFICATE_BASE64 (mobile)
- [ ] IOS_CERTIFICATE_PASSWORD (mobile)
- [ ] IOS_PROVISIONING_PROFILE_BASE64 (mobile)
- [ ] IOS_PROVISIONING_PROFILE_VENDOR_BASE64 (mobile)
- [ ] IOS_KEYCHAIN_PASSWORD (mobile)
- [ ] ANDROID_KEYSTORE_BASE64 (mobile)
- [ ] ANDROID_KEYSTORE_PASSWORD (mobile)
- [ ] ANDROID_KEY_ALIAS (mobile)
- [ ] ANDROID_KEY_PASSWORD (mobile)

### AWS Secrets Manager (per environment)
- [ ] warmpawz/dev/razorpay
- [ ] warmpawz/dev/stripe
- [ ] warmpawz/dev/shiprocket
- [ ] warmpawz/dev/google-maps
- [ ] warmpawz/stage/razorpay
- [ ] warmpawz/stage/stripe
- [ ] warmpawz/stage/shiprocket
- [ ] warmpawz/stage/google-maps
- [ ] warmpawz/prod/razorpay
- [ ] warmpawz/prod/stripe
- [ ] warmpawz/prod/shiprocket
- [ ] warmpawz/prod/google-maps

---

## 🚨 CRITICAL SECURITY GAPS IDENTIFIED

1. **Webhook secrets missing** - Allows webhook spoofing attacks
2. **Frontend public keys not environment-specific** - Hardcoded in code
3. **No secret rotation strategy** - Should rotate every 90 days
4. **Runtime secrets need AWS Secrets Manager integration** - Currently using env vars

---

**Status**: ⚠️ **13 CRITICAL SECRETS MISSING FROM CI/CD WORKFLOWS**

Update workflows to include these secrets for complete deployment automation!

