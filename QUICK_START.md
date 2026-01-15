# ⚡ Quick Start - Test Walker & Seller Onboarding on AWS

**Deploy and test in 3 steps!**

---

## 🚀 3 Steps to Deploy & Test

### Step 1: Deploy Lambda (Backend) ⏱️ ~2 minutes

```bash
./scripts/deploy-lambda-direct.sh
```

**What it does:**
- Builds Lambda function with updated vendor onboarding endpoints
- Uploads to AWS Lambda: `warmpawz-dev-api-handler`
- Includes role-specific fields for Walker & Seller

**Expected output:**
```
✅ Lambda built successfully
✅ Lambda updated successfully
```

---

### Step 2: Deploy Customer Web ⏱️ ~3 minutes

```bash
./scripts/deploy-customer-web.sh
```

**What it does:**
- Builds customer-web Next.js app
- Uploads to S3: `warmpawz-dev-customer-frontend-ap-south-1`
- Invalidates CloudFront cache
- Provides CloudFront URL for testing

**Expected output:**
```
✅ Build completed successfully
✅ Deployment completed successfully
🌐 Customer Web URL: https://[cloudfront-url]
```

---

### Step 3: Deploy Admin Web ⏱️ ~3 minutes

```bash
./scripts/deploy-admin-web.sh
```

**What it does:**
- Builds admin-web Next.js app
- Uploads to S3: `warmpawz-dev-admin-frontend-ap-south-1`
- Invalidates CloudFront cache
- Provides CloudFront URL for testing

**Expected output:**
```
✅ Build completed successfully
✅ Deployment completed successfully
🌐 Admin Web URL: https://dfof7mguaa0a5.cloudfront.net
```

---

## 🧪 Test After Deployment

### Test Walker Onboarding:
1. Open customer web URL (from Step 2)
2. Navigate to vendor registration
3. Enter phone: `+91-9876543210`
4. Select role: **Walker**
5. **Verify:** 10 role-specific fields appear ✅
   - GPS Tracking, Service Radius, Max Dogs
   - Walk Durations (multiselect), Experience, Dog Sizes
   - Emergency contact, 2 file uploads

### Test Seller Onboarding:
1. Use different phone: `+91-9876543211`
2. Select role: **Seller** or **E-commerce**
3. **Verify:** 9 role-specific fields appear ✅
   - Business Type, Product Categories (multiselect)
   - Shipping Options, Shipping Radius, Inventory
   - Return Policy, Payment Methods, Product Catalog

---

## 🎯 Quick Deploy All (Alternative)

If you want to deploy everything at once:

```bash
./scripts/deploy-all.sh dev
```

This deploys:
- ✅ Lambda (backend)
- ✅ Customer Web
- ✅ Admin Web
- ✅ Vendor Web (if included)

**Note:** This takes longer (~10 minutes) but ensures everything is in sync.

---

## ✅ Success Checklist

After deployment, verify:

- [ ] Lambda deployed successfully
- [ ] Customer web accessible
- [ ] Admin web accessible
- [ ] Walker fields appear (10 fields)
- [ ] Seller fields appear (9 fields)
- [ ] Multiselect works (chips appear)
- [ ] Form submission succeeds

---

## 🔍 Verify Deployment

### Check Lambda:
```bash
aws lambda get-function --function-name warmpawz-dev-api-handler --region ap-south-1 --query 'Configuration.LastModified'
```

### Check API Endpoint:
```bash
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/vendor/onboarding/form-schema?roleId=walker" | jq '.fields[] | select(.name | contains("gps"))'
```

### Get Deployment URLs:
```bash
./scripts/get-deployment-urls.sh
```

---

## 🐛 Troubleshooting

### Lambda deployment fails?
- Check AWS credentials: `aws sts get-caller-identity`
- Verify function exists: `aws lambda list-functions --region ap-south-1`
- Check build: `cd backend/lambda && npm run build`

### Customer/Admin web deployment fails?
- Check S3 bucket exists: `aws s3 ls | grep customer-frontend`
- Verify CloudFront distribution: `aws cloudfront list-distributions`
- Check build: `cd apps/customer-web && npm run build`

### Fields don't appear after deployment?
- Wait 2-3 minutes for CloudFront cache invalidation
- Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
- Check browser console for API errors
- Verify Lambda has latest code

---

## 📚 Additional Scripts

### Deploy Vendor Web (if needed):
```bash
./scripts/deploy-vendor-web.sh
```

### Verify Deployment:
```bash
./scripts/verify-deployment.sh
```

### Get All URLs:
```bash
./scripts/get-deployment-urls.sh
```

---

## 🎯 That's It!

**3 commands to deploy everything:**
1. `./scripts/deploy-lambda-direct.sh`
2. `./scripts/deploy-customer-web.sh`
3. `./scripts/deploy-admin-web.sh`

**Then test in browser!** 🚀

---

## 📝 Quick Reference

| Component | Script | S3 Bucket | CloudFront |
|-----------|--------|-----------|------------|
| Lambda | `deploy-lambda-direct.sh` | N/A | N/A |
| Customer Web | `deploy-customer-web.sh` | `warmpawz-dev-customer-frontend-ap-south-1` | Auto-detected |
| Admin Web | `deploy-admin-web.sh` | `warmpawz-dev-admin-frontend-ap-south-1` | `E1WPXL8WBOWOE8` |
| Vendor Web | `deploy-vendor-web.sh` | `warmpawz-dev-vendor-frontend-ap-south-1` | Auto-detected |

---

**Ready to deploy?** Run Step 1! 🚀
