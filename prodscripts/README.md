# Production Deployment Scripts

This folder contains scripts for deploying directly to **PRODUCTION** environment without triggering CI/CD pipelines.

⚠️ **WARNING**: These scripts deploy to PRODUCTION. Use with extreme caution!

## Available Scripts

### 1. `deploy-admin-web-prod.sh`
Deploys the admin-web application to production.

**Usage:**
```bash
./prodscripts/deploy-admin-web-prod.sh [--deploy-only]
```

**Options:**
- `--deploy-only`: Skip build step, use existing `dist` directory

**What it does:**
1. Builds the admin-web app (unless `--deploy-only` is used)
2. Injects `runtime-config.js` with production API endpoint
3. Syncs files to S3 bucket: `warmpawz-prod-admin-frontend-ap-south-1`
4. Invalidates CloudFront cache
5. Deploys to: `https://dbr09zyoq9akb.cloudfront.net`

---

### 2. `deploy-vendor-web-prod.sh`
Deploys the vendor-web application to production.

**Usage:**
```bash
./prodscripts/deploy-vendor-web-prod.sh [--deploy-only]
```

**Options:**
- `--deploy-only`: Skip build step, use existing `dist` directory

**What it does:**
1. Builds the vendor-web app (unless `--deploy-only` is used)
2. Injects `runtime-config.js` with production API endpoint
3. Syncs files to S3 bucket: `warmpawz-prod-vendor-frontend-ap-south-1`
4. Invalidates CloudFront cache
5. Deploys to: `https://d1y5ywletev82x.cloudfront.net`

---

### 3. `deploy-customer-web-prod.sh`
Deploys the customer-web application to production.

**Usage:**
```bash
./prodscripts/deploy-customer-web-prod.sh [--deploy-only]
```

**Options:**
- `--deploy-only`: Skip build step, use existing `dist` directory

**What it does:**
1. Builds the customer-web app (unless `--deploy-only` is used)
2. Injects `runtime-config.js` with production API endpoint
3. Syncs files to S3 bucket: `warmpawz-prod-customer-frontend-ap-south-1`
4. Invalidates CloudFront cache
5. Deploys to: `https://dg69gqp2frh39.cloudfront.net`

---

### 4. `update-runtime-config-prod.sh`
Quick fix script to update only the `runtime-config.js` file in all production S3 buckets without a full deployment.

**Usage:**
```bash
./prodscripts/update-runtime-config-prod.sh
```

**What it does:**
1. Updates `runtime-config.js` in all three production S3 buckets
2. Invalidates CloudFront cache for `/runtime-config.js` only
3. No build required - fastest way to update API endpoint

**Use case:** When you need to change the API endpoint without redeploying the entire application.

---

## Production Configuration

These scripts use the following production resources (retrieved from AWS CLI):

### S3 Buckets
- **Admin**: `warmpawz-prod-admin-frontend-ap-south-1`
- **Vendor**: `warmpawz-prod-vendor-frontend-ap-south-1`
- **Customer**: `warmpawz-prod-customer-frontend-ap-south-1`

### CloudFront Distribution IDs
- **Admin**: `E2NHO6UUI5UIHW`
- **Vendor**: `E3JDHOY1XIFOWE`
- **Customer**: `E2F29N49KVOOBP`

### CloudFront URLs
- **Admin**: `https://dbr09zyoq9akb.cloudfront.net`
- **Vendor**: `https://d1y5ywletev82x.cloudfront.net`
- **Customer**: `https://dg69gqp2frh39.cloudfront.net`

### API Gateway Endpoint
- **Production API**: `https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com`

---

## Prerequisites

1. **AWS CLI** configured with production credentials
2. **Bash** shell (Linux/Mac/Git Bash on Windows)
3. **Node.js** and `npm` installed
4. **Terraform** (optional, for getting API endpoint from Terraform outputs)

---

## Safety Features

All scripts include:
- ✅ **Confirmation prompt** before deploying to production
- ✅ **Error handling** with clear error messages
- ✅ **Validation** of AWS resources before deployment
- ✅ **Detailed logging** of all operations

---

## Example Usage

### Deploy Admin Web to Production
```bash
# Full build and deploy
./prodscripts/deploy-admin-web-prod.sh

# Deploy only (skip build, use existing dist)
./prodscripts/deploy-admin-web-prod.sh --deploy-only
```

### Quick API Endpoint Update
```bash
# Update runtime-config.js in all production buckets
./prodscripts/update-runtime-config-prod.sh
```

### Deploy All Apps
```bash
./prodscripts/deploy-admin-web-prod.sh
./prodscripts/deploy-vendor-web-prod.sh
./prodscripts/deploy-customer-web-prod.sh
```

---

## Notes

- ⏰ CloudFront cache invalidation takes 5-15 minutes to fully propagate
- 🔄 Use `--deploy-only` flag if you've already built locally and just need to deploy
- 📝 All scripts require typing 'yes' to confirm production deployment
- 🚨 These scripts bypass CI/CD - use only for hotfixes or urgent updates

---

## Troubleshooting

### "S3 bucket not found" error
- Verify AWS credentials have access to production S3 buckets
- Check bucket names match the configuration

### "CloudFront invalidation failed"
- Files are still uploaded to S3, but cache may not be invalidated
- You can manually invalidate via AWS Console or CLI

### "API Gateway endpoint not found"
- Script will try to get from Terraform outputs first
- Falls back to AWS CLI query
- Verify `warmpawz-prod-api` exists in your AWS account

---

## Last Updated

Production configuration retrieved from AWS on: 2026-02-09
