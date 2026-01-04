# 🔐 GitHub Secrets Configuration

## ✅ Configured Secrets (18 total)

### **AWS Credentials:**
- ✅ `AWS_ACCESS_KEY_ID` - AWS access key (Last updated: 2026-01-03)
- ✅ `AWS_SECRET_ACCESS_KEY` - AWS secret key (Last updated: 2026-01-03)
- ✅ `AWS_ACCOUNT_ID` - AWS account ID (Last updated: 2026-01-03)
- ✅ `AWS_REGION` - AWS region (Last updated: 2026-01-03)

### **Payment Integration:**
- ✅ `RAZORPAY_KEY_ID` - Razorpay API key ID (Last updated: 2026-01-03)
- ✅ `RAZORPAY_KEY_SECRET` - Razorpay API key secret (Last updated: 2026-01-03)

### **Third-Party Services:**
- ✅ `GOOGLE_MAPS_API_KEY` - Google Maps API key (Last updated: 2026-01-03)
- ✅ `SHIPROCKET_EMAIL` - Shiprocket account email (Last updated: 2026-01-03)
- ✅ `SHIPROCKET_PASSWORD` - Shiprocket account password (Last updated: 2026-01-03)

### **OpenSearch/Elasticsearch:**
- ✅ `DEV_OPENSEARCH_PASSWORD` - Dev environment OpenSearch password (Last updated: 2026-01-03)
- ✅ `STAGE_OPENSEARCH_PASSWORD` - Stage environment OpenSearch password (Last updated: 2026-01-03)
- ✅ `PROD_OPENSEARCH_PASSWORD` - Prod environment OpenSearch password (Last updated: 2026-01-03)

### **Frontend Environment Variables:**
- ✅ `NEXT_PUBLIC_API_BASE_URL_DEV` - Dev API base URL (Last updated: 2026-01-03)
- ✅ `NEXT_PUBLIC_API_BASE_URL_STAGE` - Stage API base URL (Last updated: 2026-01-03)
- ✅ `NEXT_PUBLIC_API_BASE_URL_PROD` - Prod API base URL (Last updated: 2026-01-03)
- ✅ `NEXT_PUBLIC_RAZORPAY_KEY_DEV` - Dev Razorpay public key (Last updated: 2026-01-03)
- ✅ `NEXT_PUBLIC_RAZORPAY_KEY_STAGE` - Stage Razorpay public key (Last updated: 2026-01-03)
- ✅ `NEXT_PUBLIC_RAZORPAY_KEY_PROD` - Prod Razorpay public key (Last updated: 2026-01-03)

---

## 📋 Secrets Used in Dev Workflow

### **Required for Dev Deployment:**
1. ✅ `AWS_ACCESS_KEY_ID` - AWS authentication
2. ✅ `AWS_SECRET_ACCESS_KEY` - AWS authentication
3. ✅ `RAZORPAY_KEY_ID` - Payment integration
4. ✅ `RAZORPAY_KEY_SECRET` - Payment integration
5. ✅ `GOOGLE_MAPS_API_KEY` - Maps integration
6. ✅ `SHIPROCKET_EMAIL` - Shipping integration
7. ✅ `SHIPROCKET_PASSWORD` - Shipping integration
8. ✅ `DEV_OPENSEARCH_PASSWORD` - OpenSearch (if enabled)

### **Used in Frontend Builds:**
- ✅ `GOOGLE_MAPS_API_KEY` - Maps API key
- ⚠️ `DEV_COGNITO_USER_POOL_ID` - **NOT CONFIGURED** (referenced but missing)
- ⚠️ `DEV_COGNITO_CLIENT_ID` - **NOT CONFIGURED** (referenced but missing)

---

## ⚠️ Missing Secrets (Will be available after first deployment)

The following secrets are referenced in the workflow but **NOT configured yet**:

1. ⚠️ `DEV_COGNITO_USER_POOL_ID` - Used in frontend builds (Vite env var)
2. ⚠️ `DEV_COGNITO_CLIENT_ID` - Used in frontend builds (Vite env var)

**Note:** 
- These will be **automatically available** after Terraform creates the Cognito resources
- They can be fetched from Terraform outputs after first deployment:
  ```bash
  terraform output -raw cognito_user_pool_id
  terraform output -raw cognito_admin_client_id  # or vendor/customer client IDs
  ```
- **For now:** Frontend builds may fail or use placeholder values
- **After first deployment:** Add these secrets from Terraform outputs

---

## 🔧 How to Add/Update Secrets

### **Using GitHub CLI:**
```bash
# Set a secret
gh secret set SECRET_NAME --repo ketan0103/warmpawzaws

# Or with value directly
gh secret set SECRET_NAME --body "secret-value" --repo ketan0103/warmpawzaws
```

### **Using GitHub Web UI:**
1. Go to: https://github.com/ketan0103/warmpawzaws/settings/secrets/actions
2. Click "New repository secret"
3. Enter name and value
4. Click "Add secret"

---

## 📝 Secret Values Reference

### **AWS Credentials:**
- **Access Key ID:** `AKIAQK4TGNEFLQJLXMMI`
- **Secret Access Key:** `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`
- **Region:** `ap-south-1`
- **Account ID:** `057442119249`

### **Razorpay:**
- **Key ID:** `rzp_test_Rnp57suJH3wzUl`
- **Key Secret:** `rplcWAxtmVfvXI9uydFt7YkH`

### **Google Maps:**
- **API Key:** `AIzaSyC6iwRfS_r1zRtjiGyLjgueZ_rDV_l7yo0`

### **Shiprocket:**
- **Email:** `ketanh@warmpawz.com`
- **Password:** `znoMnd9FknttRuXCq$d@eKfQj1M8oXGj.`

### **OpenSearch:**
- **Dev Password:** `WarmpawzDev2024Aa1!`

---

## ✅ Verification

All required secrets for dev deployment are configured:
- ✅ AWS credentials
- ✅ Payment integration
- ✅ Third-party services
- ✅ OpenSearch password

**Status:** Ready for deployment ✅

---

**Last Updated:** 2026-01-04
**Repository:** ketan0103/warmpawzaws

