# Deployment Scripts Summary - Unified Appointment Management

**Date**: 2025-01-28  
**Status**: ✅ Ready for Deployment

---

## Available Deployment Scripts

### 1. Individual Component Scripts

#### `deploy-appointment-endpoints.sh`
**Purpose**: Deploy backend Lambda endpoints for appointment management

**Location**: `scripts/deploy-appointment-endpoints.sh`

**Deploys**:
- Staff appointments endpoints
- Vendor bookings endpoints
- Staff discovery endpoint
- Booking creation with staff_id support

**Usage**:
```bash
./scripts/deploy-appointment-endpoints.sh
```

---

#### `deploy-unified-appointment-management.sh`
**Purpose**: Deploy UniversalAppointmentManagement component to vendor-web

**Location**: `scripts/deploy-unified-appointment-management.sh`

**Deploys**:
- UniversalAppointmentManagement component
- Vendor web application
- Runtime configuration injection

**Targets**:
- S3: `warmpawz-dev-vendor-frontend-ap-south-1`
- CloudFront: Auto-detected

**Usage**:
```bash
./scripts/deploy-unified-appointment-management.sh
```

---

#### `deploy-staff-selection.sh`
**Purpose**: Deploy StaffSelectionStep component to customer-web

**Location**: `scripts/deploy-staff-selection.sh`

**Deploys**:
- StaffSelectionStep component
- Customer web application
- Runtime configuration injection

**Targets**:
- S3: `warmpawz-dev-customer-frontend-ap-south-1`
- CloudFront: Auto-detected

**Usage**:
```bash
./scripts/deploy-staff-selection.sh
```

---

### 2. Combined Deployment Script

#### `deploy-all-appointment-components.sh`
**Purpose**: Deploy all appointment management components in sequence

**Location**: `scripts/deploy-all-appointment-components.sh`

**Deploys** (in order):
1. Backend endpoints
2. Vendor web component
3. Customer web component

**Usage**:
```bash
./scripts/deploy-all-appointment-components.sh
```

**Recommended for**:
- Initial deployment
- Full system updates
- After major changes

---

## Quick Start

### Deploy All Components (Recommended)
```bash
./scripts/deploy-all-appointment-components.sh
```

### Deploy Components Individually
```bash
# Backend only
./scripts/deploy-appointment-endpoints.sh

# Vendor web only
./scripts/deploy-unified-appointment-management.sh

# Customer web only
./scripts/deploy-staff-selection.sh
```

---

## Script Features

### All Scripts Include:
- ✅ Component/file verification
- ✅ Build process
- ✅ Runtime configuration injection
- ✅ S3 deployment
- ✅ CloudFront cache invalidation
- ✅ Error handling
- ✅ Colored output for clarity
- ✅ Deployment summary

### Backend Script Includes:
- ✅ Endpoint file verification
- ✅ CDK deployment
- ✅ Lambda function deployment
- ✅ API Gateway route registration

### Frontend Scripts Include:
- ✅ Component verification
- ✅ Build with cleanup
- ✅ Runtime config injection
- ✅ S3 sync with proper cache headers
- ✅ CloudFront invalidation

---

## Prerequisites

### Required Tools
- AWS CLI configured
- Node.js and npm
- CDK CLI (for backend)
- Appropriate AWS permissions

### Required Permissions
- S3: Read/Write
- CloudFront: Create invalidation
- Lambda: Deploy functions
- API Gateway: Update routes
- CDK: Deploy infrastructure

---

## Verification

After deployment, verify:

1. **Backend Endpoints**:
   ```bash
   curl -X GET "https://YOUR_API/staff/STAFF_ID/appointments"
   ```

2. **Vendor Web**:
   - Navigate to vendor dashboard
   - Check appointment management loads

3. **Customer Web**:
   - Start center booking
   - Verify staff selection appears

---

## Troubleshooting

See `docs/DEPLOYMENT_GUIDE_APPOINTMENT_MANAGEMENT.md` for detailed troubleshooting.

---

## Files Created

✅ `scripts/deploy-appointment-endpoints.sh`  
✅ `scripts/deploy-unified-appointment-management.sh`  
✅ `scripts/deploy-staff-selection.sh`  
✅ `scripts/deploy-all-appointment-components.sh`  
✅ `docs/DEPLOYMENT_GUIDE_APPOINTMENT_MANAGEMENT.md`

All scripts are executable and ready to use!

---

## Next Steps

1. Review deployment scripts
2. Verify AWS credentials
3. Run deployment
4. Verify deployment
5. Test functionality

---

**Status**: ✅ **READY FOR DEPLOYMENT**
