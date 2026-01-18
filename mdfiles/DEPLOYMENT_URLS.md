# Deployment URLs - Dev Environment

## 🌐 Public URLs (Custom Domains - Route53)

These URLs are accessible via custom domains and require DNS propagation (1-5 minutes):

- **Admin Dashboard**: https://dev.admin.warmpawz.com
- **Vendor Portal**: https://dev.vendor.warmpawz.com
- **Customer App**: https://dev.customer.warmpawz.com
- **API Gateway**: https://dev.api.warmpawz.com (⚠️ Custom domain not configured yet)

## 🔗 Direct URLs (CloudFront - Always Accessible)

These URLs work immediately without DNS:

- **Admin Dashboard**: https://dfof7mguaa0a5.cloudfront.net
- **Vendor Portal**: https://d1s6ykkj381k58.cloudfront.net
- **Customer App**: https://d2aoyjj8ine0wk.cloudfront.net

## 🔌 API Gateway (Default Endpoint)

- **API Endpoint**: https://0sfvodkiee.execute-api.ap-south-1.amazonaws.com

Note: Multiple API Gateway endpoints exist. The active one should be retrieved from Terraform outputs.

## 📊 CloudFront Distribution IDs

- **Admin**: `E1WPXL8WBOWOE8`
- **Vendor**: `E95171GX1I6HN`
- **Customer**: `E2RDORGXSWJJ87`

## 🛠️ Scripts Available

1. **`scripts/get-and-test-urls.sh`** - Discover all URLs and run smoke tests
2. **`scripts/create-route53-records.sh`** - Setup Route53 DNS records
3. **`scripts/get-deployment-urls.sh`** - Get URLs from Terraform outputs
4. **`scripts/smoke-test-urls.sh`** - Test all deployment URLs

## ✅ Route53 Status

- ✅ `dev.admin.warmpawz.com` - **CONFIGURED**
- ✅ `dev.vendor.warmpawz.com` - **CONFIGURED**
- ✅ `dev.customer.warmpawz.com` - **CONFIGURED**
- ❌ `dev.api.warmpawz.com` - **NOT CONFIGURED** (API Gateway custom domain requires certificate validation)

## 📝 Notes

- DNS changes may take 1-5 minutes to propagate globally
- CloudFront distributions may take 5-15 minutes to fully deploy
- API Gateway custom domain requires ACM certificate validation in `us-east-1`
- Route53 hosted zone: `Z07857473SRNOUZ0V7594` (warmpawz.com)

