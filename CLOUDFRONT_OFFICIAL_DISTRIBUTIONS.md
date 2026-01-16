# Official CloudFront Distributions

## ⚠️ CRITICAL: These are the ONLY CloudFront distributions that should exist

**Date:** 2026-01-12  
**Status:** OFFICIAL - DO NOT CREATE NEW DISTRIBUTIONS

---

## Official Distribution IDs

### Admin Web
- **Distribution ID:** `E1WPXL8WBOWOE8`
- **Domain:** `dfof7mguaa0a5.cloudfront.net`
- **S3 Origin:** `warmpawz-dev-admin-frontend-ap-south-1.s3.ap-south-1.amazonaws.com`
- **Route53:** `dev.admin.warmpawz.com` → `dfof7mguaa0a5.cloudfront.net`

### Customer Web
- **Distribution ID:** `E2RDORGXSWJJ87`
- **Domain:** `d2aoyjj8ine0wk.cloudfront.net`
- **S3 Origin:** `warmpawz-dev-customer-frontend-ap-south-1.s3.ap-south-1.amazonaws.com`
- **Route53:** `dev.customer.warmpawz.com` → `d2aoyjj8ine0wk.cloudfront.net`

### Vendor Web
- **Distribution ID:** `E95171GX1I6HN`
- **Domain:** `d1s6ykkj381k58.cloudfront.net`
- **S3 Origin:** `warmpawz-dev-vendor-frontend-ap-south-1.s3.ap-south-1.amazonaws.com`
- **Route53:** `dev.vendor.warmpawz.com` → `d1s6ykkj381k58.cloudfront.net`

---

## GitHub Actions Secrets

Update these secrets in GitHub repository settings:

```
CLOUDFRONT_DIST_ID_ADMIN=E1WPXL8WBOWOE8
CLOUDFRONT_DIST_ID_VENDOR=E95171GX1I6HN
CLOUDFRONT_DIST_ID_CUSTOMER=E2RDORGXSWJJ87
```

---

## CORS Configuration

These are the ONLY CloudFront domains allowed in CORS:

```typescript
const allowedOrigins = [
  'https://dfof7mguaa0a5.cloudfront.net',  // Admin
  'https://d2aoyjj8ine0wk.cloudfront.net', // Customer
  'https://d1s6ykkj381k58.cloudfront.net', // Vendor
  // ... localhost and custom domains ...
];
```

---

## Terraform State

Terraform should reference these existing distributions. Do NOT create new distributions.

If Terraform tries to create new distributions, import the existing ones:

```bash
# Import existing distributions into Terraform state
terraform import 'module.cloudfront.aws_cloudfront_distribution.frontend["admin"]' E1WPXL8WBOWOE8
terraform import 'module.cloudfront.aws_cloudfront_distribution.frontend["customer"]' E2RDORGXSWJJ87
terraform import 'module.cloudfront.aws_cloudfront_distribution.frontend["vendor"]' E95171GX1I6HN
```

---

## Cleanup

All other CloudFront distributions pointing to the same S3 buckets are duplicates and should be disabled/deleted.

Run cleanup script:
```bash
./scripts/cleanup-duplicate-cloudfront.sh
```

---

## Route53 DNS Records

Ensure Route53 records point to the official CloudFront domains:

```bash
# Admin
dev.admin.warmpawz.com → dfof7mguaa0a5.cloudfront.net

# Customer
dev.customer.warmpawz.com → d2aoyjj8ine0wk.cloudfront.net

# Vendor
dev.vendor.warmpawz.com → d1s6ykkj381k58.cloudfront.net
```

---

**IMPORTANT:** 
- ❌ DO NOT create new CloudFront distributions
- ❌ DO NOT use any other CloudFront domains in CORS
- ✅ Always use these 3 official distributions
- ✅ Update GitHub Actions secrets with these IDs
- ✅ Run cleanup script to disable duplicates
