# Next Steps: CloudFront Cleanup & CORS Fix

## ✅ Completed

1. **CORS Configuration Updated**
   - ✅ Lambda handler updated to use ONLY official CloudFront domains
   - ✅ Terraform CORS configuration updated
   - ✅ All 3 locations in Lambda handler updated

2. **Official CloudFront Distributions Documented**
   - ✅ Created `CLOUDFRONT_OFFICIAL_DISTRIBUTIONS.md`
   - ✅ Distribution IDs documented:
     - Admin: `E1WPXL8WBOWOE8` → `dfof7mguaa0a5.cloudfront.net`
     - Customer: `E2RDORGXSWJJ87` → `d2aoyjj8ine0wk.cloudfront.net`
     - Vendor: `E95171GX1I6HN` → `d1s6ykkj381k58.cloudfront.net`

3. **GitHub Actions Updated**
   - ✅ `dev.yml` workflow updated to use official distribution IDs
   - ✅ `code-deploy.yml` already uses secrets (needs secret update)

4. **Cleanup Script Created**
   - ✅ `scripts/cleanup-duplicate-cloudfront.sh` created

---

## 🔧 Action Items

### 1. Update GitHub Secrets

**Go to:** GitHub Repository → Settings → Secrets and variables → Actions

**Update these secrets:**
```
CLOUDFRONT_DIST_ID_ADMIN=E1WPXL8WBOWOE8
CLOUDFRONT_DIST_ID_VENDOR=E95171GX1I6HN
CLOUDFRONT_DIST_ID_CUSTOMER=E2RDORGXSWJJ87
```

### 2. Verify Route53 DNS Records

**Check Route53 records point to official CloudFront domains:**

```bash
# Admin
dev.admin.warmpawz.com → dfof7mguaa0a5.cloudfront.net

# Customer  
dev.customer.warmpawz.com → d2aoyjj8ine0wk.cloudfront.net

# Vendor
dev.vendor.warmpawz.com → d1s6ykkj381k58.cloudfront.net
```

**If records are incorrect, update them:**
```bash
# Use the Route53 update script or AWS Console
./scripts/setup-route53-records.sh
```

### 3. Deploy Updated Lambda Handler

**Build and deploy the Lambda with updated CORS:**

```bash
cd backend/lambda
npm run build
# Deploy using your standard deployment process
```

**Verify CORS is working:**
- Test requests from `https://dfof7mguaa0a5.cloudfront.net`
- Check browser console - no CORS errors
- Verify OPTIONS preflight returns 204

### 4. Run CloudFront Cleanup Script

**Disable duplicate CloudFront distributions:**

```bash
./scripts/cleanup-duplicate-cloudfront.sh
```

**This will:**
- Identify all duplicate distributions
- Disable them (they'll stop serving traffic)
- Keep only the 3 official distributions active

**Note:** After 15+ days, you can manually delete disabled distributions from AWS Console.

### 5. Update Terraform State (If Needed)

**If Terraform tries to create new CloudFront distributions, import existing ones:**

```bash
cd infra/envs/dev

# Import existing distributions
terraform import 'module.cloudfront.aws_cloudfront_distribution.frontend["admin"]' E1WPXL8WBOWOE8
terraform import 'module.cloudfront.aws_cloudfront_distribution.frontend["customer"]' E2RDORGXSWJJ87
terraform import 'module.cloudfront.aws_cloudfront_distribution.frontend["vendor"]' E95171GX1I6HN

# Verify
terraform plan
```

**If Terraform shows it wants to create new distributions:**
- The module might be creating instead of referencing
- Consider updating the module to use data sources for existing distributions
- Or ensure lifecycle rules prevent creation

### 6. Verify S3 Bucket Policies

**Ensure S3 bucket policies only allow the 3 official CloudFront distributions:**

```bash
# Check Admin bucket policy
aws s3api get-bucket-policy --bucket warmpawz-dev-admin-frontend-ap-south-1 --region ap-south-1

# Should only have ARNs for:
# - arn:aws:cloudfront::057442119249:distribution/E1WPXL8WBOWOE8
```

**If other distributions are in the policy, update it to only include the 3 official ones.**

### 7. Test Everything

**After all changes, test:**

1. **CloudFront URLs:**
   ```bash
   curl -I https://dfof7mguaa0a5.cloudfront.net
   curl -I https://d2aoyjj8ine0wk.cloudfront.net
   curl -I https://d1s6ykkj381k58.cloudfront.net
   ```

2. **Custom Domain URLs:**
   ```bash
   curl -I https://dev.admin.warmpawz.com
   curl -I https://dev.customer.warmpawz.com
   curl -I https://dev.vendor.warmpawz.com
   ```

3. **CORS from Frontend:**
   - Open browser console
   - Navigate to admin dashboard
   - Check for CORS errors
   - Verify API requests work

4. **API Endpoints:**
   - Test analytics endpoints
   - Test catalog endpoints
   - Test all admin endpoints

---

## 📋 Checklist

- [ ] Update GitHub Secrets with official distribution IDs
- [ ] Verify Route53 DNS records point to correct CloudFront domains
- [ ] Deploy updated Lambda handler with CORS fix
- [ ] Run CloudFront cleanup script to disable duplicates
- [ ] Update S3 bucket policies to only allow official distributions
- [ ] Import existing CloudFront distributions into Terraform (if needed)
- [ ] Test CloudFront URLs
- [ ] Test custom domain URLs
- [ ] Test CORS from frontend
- [ ] Test API endpoints
- [ ] Monitor for 500 errors (should not occur)

---

## 🚨 Important Notes

1. **DO NOT create new CloudFront distributions** - Use only the 3 official ones
2. **DO NOT use any other CloudFront domains in CORS** - Only the 3 official domains
3. **Terraform should reference existing distributions** - Not create new ones
4. **Route53 records must point to official domains** - Verify DNS is correct
5. **S3 bucket policies should only allow official distributions** - Clean up policies

---

## 📚 Reference Documents

- `CLOUDFRONT_OFFICIAL_DISTRIBUTIONS.md` - Official distribution IDs and domains
- `CORS_FIX_SUMMARY.md` - CORS fix details
- `scripts/cleanup-duplicate-cloudfront.sh` - Cleanup script

---

**Status:** Ready for execution  
**Priority:** High  
**Estimated Time:** 30-60 minutes
