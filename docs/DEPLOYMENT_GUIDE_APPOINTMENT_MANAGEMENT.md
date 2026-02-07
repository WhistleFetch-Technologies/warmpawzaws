# Deployment Guide - Unified Appointment Management

**Date**: 2025-01-28  
**Components**: Backend Endpoints, Vendor Web, Customer Web

---

## Overview

This guide provides instructions for deploying the unified appointment management system components. Each component can be deployed independently or all together.

---

## Components

1. **Backend Endpoints** - Lambda functions for appointment management APIs
2. **Vendor Web Component** - UniversalAppointmentManagement component
3. **Customer Web Component** - StaffSelectionStep component

---

## Deployment Scripts

### Individual Component Scripts

#### 1. Deploy Backend Endpoints
```bash
./scripts/deploy-appointment-endpoints.sh
```

**What it does:**
- Verifies backend endpoint files exist
- Deploys Lambda functions via CDK
- Registers all appointment management endpoints

**Endpoints deployed:**
- `GET /staff/:staffId/appointments`
- `PUT /staff/:staffId/appointments/:bookingId/accept`
- `PUT /staff/:staffId/appointments/:bookingId/reject`
- `PUT /staff/:staffId/appointments/:bookingId/start`
- `PUT /staff/:staffId/appointments/:bookingId/complete`
- `GET /vendor/bookings/:vendorId`
- `GET /vendor/:vendorId/staff`
- `POST /bookings/create` (with staff_id support)

---

#### 2. Deploy Vendor Web Component
```bash
./scripts/deploy-unified-appointment-management.sh
```

**What it does:**
- Verifies UniversalAppointmentManagement component exists
- Builds vendor-web application
- Injects runtime configuration
- Uploads to S3
- Invalidates CloudFront cache

**Component location:**
- `apps/vendor-web/components/shared/UniversalAppointmentManagement.tsx`

**Deployment targets:**
- S3 Bucket: `warmpawz-dev-vendor-frontend-ap-south-1`
- CloudFront Distribution: Auto-detected

---

#### 3. Deploy Customer Web Component
```bash
./scripts/deploy-staff-selection.sh
```

**What it does:**
- Verifies StaffSelectionStep component exists
- Builds customer-web application
- Injects runtime configuration
- Uploads to S3
- Invalidates CloudFront cache

**Component location:**
- `apps/customer-web/components/customer/shared/StaffSelectionStep.tsx`

**Deployment targets:**
- S3 Bucket: `warmpawz-dev-customer-frontend-ap-south-1`
- CloudFront Distribution: Auto-detected

---

### Deploy All Components

```bash
./scripts/deploy-all-appointment-components.sh
```

**What it does:**
- Deploys all three components in sequence:
  1. Backend endpoints
  2. Vendor web component
  3. Customer web component

**Recommended for:**
- Initial deployment
- Full system updates
- After major changes

---

## Prerequisites

### AWS CLI Configuration
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Verify region
aws configure get region
```

### Required AWS Permissions
- S3: Read/Write access to frontend buckets
- CloudFront: Create invalidation
- Lambda: Deploy functions
- API Gateway: Update routes
- CDK: Deploy infrastructure

### Environment Setup
```bash
# Install dependencies
npm install

# Build backend (if needed)
cd backend/lambda
npm install
npm run build
```

---

## Deployment Steps

### Option 1: Deploy All Components (Recommended)

```bash
# Make scripts executable (if not already)
chmod +x scripts/deploy-*.sh

# Deploy all components
./scripts/deploy-all-appointment-components.sh
```

### Option 2: Deploy Components Individually

```bash
# 1. Deploy backend endpoints
./scripts/deploy-appointment-endpoints.sh

# 2. Deploy vendor web component
./scripts/deploy-unified-appointment-management.sh

# 3. Deploy customer web component
./scripts/deploy-staff-selection.sh
```

---

## Verification

### Verify Backend Endpoints

```bash
# Test staff appointments endpoint
curl -X GET "https://YOUR_API_ENDPOINT/staff/STAFF_ID/appointments" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test vendor bookings endpoint
curl -X GET "https://YOUR_API_ENDPOINT/vendor/bookings/VENDOR_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Verify Frontend Components

1. **Vendor Web:**
   - Navigate to vendor dashboard
   - Click on "Bookings" or "Appointment Management"
   - Verify UniversalAppointmentManagement component loads

2. **Customer Web:**
   - Start a center booking flow
   - Verify StaffSelectionStep appears
   - Select a staff member
   - Complete booking

---

## Troubleshooting

### Backend Deployment Issues

**Issue**: CDK not found
```bash
# Install CDK globally
npm install -g aws-cdk

# Or use npx
npx cdk deploy
```

**Issue**: Lambda deployment fails
```bash
# Check Lambda function exists
aws lambda list-functions --query "Functions[?contains(FunctionName, 'appointment')]"

# Check CloudWatch logs
aws logs tail /aws/lambda/YOUR_FUNCTION_NAME --follow
```

### Frontend Deployment Issues

**Issue**: Build fails
```bash
# Clean and rebuild
cd apps/vendor-web  # or customer-web
rm -rf .next dist node_modules/.cache
npm install
npm run build
```

**Issue**: S3 upload fails
```bash
# Check bucket exists
aws s3 ls s3://warmpawz-dev-vendor-frontend-ap-south-1

# Check permissions
aws s3api get-bucket-policy --bucket warmpawz-dev-vendor-frontend-ap-south-1
```

**Issue**: CloudFront cache not invalidating
```bash
# Manually invalidate
aws cloudfront create-invalidation \
  --distribution-id YOUR_DIST_ID \
  --paths "/*"
```

---

## Rollback

### Rollback Frontend

```bash
# Restore from previous deployment
aws s3 sync s3://BACKUP_BUCKET/ s3://warmpawz-dev-vendor-frontend-ap-south-1/ --delete

# Invalidate CloudFront
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### Rollback Backend

```bash
# Deploy previous Lambda version
aws lambda update-function-code \
  --function-name YOUR_FUNCTION_NAME \
  --zip-file fileb://previous-version.zip
```

---

## Post-Deployment Checklist

- [ ] Backend endpoints accessible
- [ ] Vendor web component loads correctly
- [ ] Customer web component loads correctly
- [ ] Staff selection works in booking flow
- [ ] Appointment management actions work (accept/reject/start/complete)
- [ ] OTP verification works
- [ ] GPS tracking works for at_home services
- [ ] Chat integration works
- [ ] Teleconsultation integration works

---

## Monitoring

### CloudWatch Logs

```bash
# View Lambda logs
aws logs tail /aws/lambda/YOUR_FUNCTION_NAME --follow

# View API Gateway logs
aws logs tail /aws/apigateway/YOUR_API_NAME --follow
```

### CloudFront Metrics

```bash
# View CloudFront distribution metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=YOUR_DIST_ID \
  --start-time 2025-01-28T00:00:00Z \
  --end-time 2025-01-28T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

---

## Support

For issues during deployment:
1. Check CloudWatch logs
2. Verify AWS credentials and permissions
3. Check component files exist
4. Verify build succeeds locally
5. Check network connectivity

---

## Summary

✅ **Backend Endpoints**: `deploy-appointment-endpoints.sh`  
✅ **Vendor Web**: `deploy-unified-appointment-management.sh`  
✅ **Customer Web**: `deploy-staff-selection.sh`  
✅ **All Components**: `deploy-all-appointment-components.sh`

All scripts are executable and ready to use!
