# Vendor Administration Testing & Verification Checklist

## Status: ⚠️ **NOT DEPLOYED YET**

All changes are currently **code-only** and have **NOT been deployed** to any environment. This document outlines what needs to be tested and verified.

---

## 1. Endpoint Verification

### ✅ Backend Endpoints That Exist

#### Vendor Onboarding Review (State Machine)
- **Endpoint**: `POST /admin/vendor/onboarding/:applicationId/review`
- **Location**: `backend/lambda/src/endpoints/vendor-onboarding.ts` (line 894)
- **Also in**: `backend/lambda/src/endpoints/vendor-onboarding-enhanced.ts` (line 874)
- **Actions**: `APPROVE`, `REQUEST_CLARIFICATION`, `REJECT`
- **Status**: ✅ Registered in handler

#### Frontend Compatibility Endpoints
- **Approve**: `POST /admin/vendor/application/:applicationId/approve`
- **Reject**: `POST /admin/vendor/application/:applicationId/reject`
- **Request Clarification**: `POST /admin/vendor/application/:applicationId/request-clarification`
- **Location**: `backend/lambda/src/endpoints/admin.ts` (lines 435-657)
- **Status**: ✅ Registered in handler

#### Vendor Statistics
- **Endpoint**: `GET /admin/vendors/stats`
- **Location**: `backend/lambda/src/endpoints/admin.ts` (line 366)
- **Status**: ✅ Registered in handler

#### Pending Applications
- **Endpoint**: `GET /admin/vendors/pending-applications-fixed`
- **Location**: `backend/lambda/src/endpoints/vendor-onboarding-fixes.ts` (line 297)
- **Status**: ✅ Registered in handler

#### Quality Alerts
- **Endpoint**: `GET /quality/alerts`
- **Location**: `backend/lambda/src/endpoints/admin-advanced.ts` (line 4795)
- **Status**: ✅ Registered in handler

---

## 2. Frontend Changes

### ✅ Components Modified

1. **`apps/admin-web/app/vendors/page.tsx`**
   - Now renders `AdminVendorManagement` instead of `AdminVendorsPage`
   - Status: ✅ Code updated

2. **`apps/admin-web/components/admin/AdminVendorManagement.tsx`**
   - Integrated `QualityAlertsPanel`
   - Fixed stats loading to handle varying API response shapes
   - Status: ✅ Code updated

3. **`apps/admin-web/components/admin/EnhancedPendingApplicationsTab.tsx`**
   - Updated `handleApprove` to use `/admin/vendor/onboarding/:appId/review` with fallback
   - Updated `handleRejectConfirm` to use `/admin/vendor/onboarding/:appId/review` with fallback
   - Updated `handleRequestInfoConfirm` to use `/admin/vendor/onboarding/:appId/review` with fallback
   - Status: ✅ Code updated

4. **`apps/admin-web/components/admin/ApplicationDetailModal.tsx`**
   - Updated all actions to use `/admin/vendor/onboarding/:appId/review` with fallback
   - Status: ✅ Code updated

5. **`apps/admin-web/components/admin/QualityAlertsPanel.tsx`**
   - New component to display quality alerts from `/quality/alerts`
   - Status: ✅ Code created

6. **`apps/admin-web/components/admin/layout/UnifiedAdminSidebar.tsx`**
   - Updated navigation to route `vendor-admin` to `/vendors`
   - Status: ✅ Code updated

---

## 3. Testing Checklist

### Pre-Deployment Testing

#### A. Backend Endpoint Testing

- [ ] **Test `/admin/vendor/onboarding/:applicationId/review`**
  ```bash
  # Test APPROVE
  curl -X POST https://<api-url>/admin/vendor/onboarding/<app-id>/review \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <admin-token>" \
    -d '{"action": "APPROVE", "admin_id": "admin-123", "comments": "Test approval"}'
  
  # Test REJECT
  curl -X POST https://<api-url>/admin/vendor/onboarding/<app-id>/review \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <admin-token>" \
    -d '{"action": "REJECT", "admin_id": "admin-123", "rejection_reason": "Test rejection"}'
  
  # Test REQUEST_CLARIFICATION
  curl -X POST https://<api-url>/admin/vendor/onboarding/<app-id>/review \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <admin-token>" \
    -d '{"action": "REQUEST_CLARIFICATION", "admin_id": "admin-123", "comments": "Need more info"}'
  ```

- [ ] **Test `/admin/vendor/application/:applicationId/approve`**
  ```bash
  curl -X POST https://<api-url>/admin/vendor/application/<app-id>/approve \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <admin-token>" \
    -d '{"reviewerName": "Admin", "notes": "Approved"}'
  ```

- [ ] **Test `/admin/vendors/stats`**
  ```bash
  curl -X GET https://<api-url>/admin/vendors/stats \
    -H "Authorization: Bearer <admin-token>"
  ```

- [ ] **Test `/admin/vendors/pending-applications-fixed`**
  ```bash
  curl -X GET https://<api-url>/admin/vendors/pending-applications-fixed \
    -H "Authorization: Bearer <admin-token>"
  ```

- [ ] **Test `/quality/alerts`**
  ```bash
  curl -X GET https://<api-url>/quality/alerts \
    -H "Authorization: Bearer <admin-token>"
  ```

#### B. Frontend UI Testing

- [ ] **Navigate to `/vendors`**
  - [ ] Verify `AdminVendorManagement` component loads
  - [ ] Verify sidebar navigation works
  - [ ] Verify stats cards display correctly

- [ ] **Test Applications Tab**
  - [ ] Verify pending applications load
  - [ ] Click "View Details" on an application
  - [ ] Verify `ApplicationDetailModal` opens
  - [ ] Test "Approve" action
  - [ ] Test "Reject" action
  - [ ] Test "Request Clarification" action
  - [ ] Verify application status updates after action

- [ ] **Test Quality Alerts Panel**
  - [ ] Verify quality alerts panel displays
  - [ ] Verify alerts load from `/quality/alerts`
  - [ ] Verify alerts show vendor information correctly

- [ ] **Test Navigation**
  - [ ] Click "Vendor Administration" in sidebar
  - [ ] Verify it navigates to `/vendors`
  - [ ] Verify active state is correct

#### C. Integration Testing

- [ ] **End-to-End Approval Flow**
  1. Vendor submits application
  2. Admin views application in `/vendors`
  3. Admin clicks "Approve"
  4. Verify application status changes to "APPROVED"
  5. Verify vendor receives notification
  6. Verify vendor can access dashboard

- [ ] **End-to-End Rejection Flow**
  1. Admin views application
  2. Admin clicks "Reject" and provides reason
  3. Verify application status changes to "REJECTED"
  4. Verify vendor receives notification

- [ ] **End-to-End Clarification Flow**
  1. Admin views application
  2. Admin clicks "Request Clarification" and provides notes
  3. Verify application status changes to "CLARIFICATION_REQUIRED"
  4. Verify vendor can edit and resubmit application

---

## 4. Deployment Steps

### Backend Deployment

1. **Build Lambda**
   ```bash
   cd backend/lambda
   npm run build
   ```

2. **Deploy with Serverless**
   ```bash
   cd backend/lambda
   serverless deploy --stage dev  # or prod
   ```

3. **Verify Deployment**
   - Check CloudWatch logs
   - Verify API Gateway routes are registered
   - Test endpoints with curl/Postman

### Frontend Deployment

1. **Build Admin Web**
   ```bash
   cd apps/admin-web
   npm run build
   ```

2. **Deploy to CloudFront** (or your hosting platform)
   - Upload build artifacts
   - Invalidate CloudFront cache

3. **Verify Deployment**
   - Navigate to `/vendors` in production
   - Verify all components load
   - Test key actions

---

## 5. Known Issues & Fixes

### ✅ Fixed Issues

1. **Stats Loading**: Fixed `AdminVendorManagement` to handle varying API response shapes
   - Changed: `setStats(statsData.stats)` → `setStats(statsData.stats ?? statsData.data ?? statsData)`

2. **Navigation**: Fixed sidebar to route `vendor-admin` to `/vendors`

3. **Endpoint Mismatch**: Frontend now uses correct endpoints with fallback to compatibility endpoints

### ✅ Fixed Issues

1. **Admin Authentication**: ✅ Fixed - Now uses `getAdminId()` utility to extract admin ID from JWT token or user info
   - Location: `EnhancedPendingApplicationsTab.tsx`, `ApplicationDetailModal.tsx`
   - Implementation: Added `getAdminId()` function in `cognito-auth.ts` that:
     - First tries to get from user info
     - Then decodes JWT token to extract `sub` claim
     - Falls back to localStorage `adminId`
     - Finally falls back to 'admin' if nothing is available

2. **Error Handling**: Some error messages use `alert()` - consider using toast notifications
   - Location: Multiple components

3. **Loading States**: Some actions don't show loading indicators
   - Consider adding loading spinners

---

## 6. Verification Commands

### Check Endpoint Registration

```bash
# Check if endpoints are registered in handler
grep -r "registerVendorOnboardingEndpoints\|registerAdminEndpoints\|registerAdminAdvancedEndpoints" backend/lambda/src/handler/index.ts
```

### Check Frontend Imports

```bash
# Verify all components are exported
grep -r "export.*QualityAlertsPanel\|export.*AdminVendorManagement" apps/admin-web/components/admin/
```

### Check API Client Usage

```bash
# Verify API calls match backend endpoints
grep -r "/admin/vendor\|/quality/alerts\|/admin/vendors/stats" apps/admin-web/components/admin/
```

---

## 7. Next Steps

1. **Deploy Backend** (if not already deployed)
   - Build and deploy Lambda functions
   - Verify endpoints are accessible

2. **Deploy Frontend** (if not already deployed)
   - Build admin-web
   - Deploy to hosting/CDN

3. **Run Tests**
   - Execute all items in Testing Checklist
   - Document any failures

4. **Fix Issues**
   - Address any bugs found during testing
   - Update this document with findings

5. **Monitor**
   - Check CloudWatch logs for errors
   - Monitor API Gateway metrics
   - Check user feedback

---

## Summary

- ✅ **Code Changes**: Complete
- ⚠️ **Deployment**: Not done
- ⚠️ **Testing**: Not done
- ⚠️ **Verification**: Pending

**Action Required**: Deploy backend and frontend, then run the testing checklist above.
