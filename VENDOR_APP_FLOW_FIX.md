# Vendor App Flow Fix - Root Cause Analysis and Fix

## Date: 2026-01-14

## Problem Statement
Approved vendor (phone: 9876545521) was seeing the "Choose Your Role" screen instead of the dashboard after login. The user reported that the UI replacement has broken the complete flow from login to dashboard.

## Root Cause Analysis

### Primary Issue: API Response Structure Mismatch
The `/vendor/onboarding/status` API endpoint returns:
```json
{
  "success": true,
  "data": {
    "identity": {...},
    "application": {...},
    "role": {...}
  }
}
```

But the code in `VendorApp.tsx` was checking:
```typescript
if (response && response.identity) {
  const { identity, application, role } = response;
```

Since `response.identity` is `undefined` (it's actually in `response.data.identity`), the condition always fails, causing:
1. Status never gets set to 'active' for APPROVED vendors
2. Status defaults to 'new'
3. VendorRoleSelection screen is shown instead of dashboard

### Secondary Issues
1. Error handling didn't properly handle APPROVED/ACTIVATED status from localStorage
2. Same pattern issue in `DynamicVendorOnboardingForm.tsx`

## Fixes Implemented

### 1. Fixed API Response Structure in VendorApp.tsx
**File**: `apps/vendor-web/components/vendor/VendorApp.tsx`
**Change**: Updated to extract data from `response.data` instead of `response` directly:
```typescript
const responseData = response?.data || response; // Support both structures for backward compatibility
if (responseData && responseData.identity) {
  const { identity, application, role } = responseData;
```

### 2. Fixed API Response Structure in DynamicVendorOnboardingForm.tsx
**File**: `apps/vendor-web/components/vendor/DynamicVendorOnboardingForm.tsx`
**Change**: Updated to extract identity from `response.data.identity`:
```typescript
const identityData = identityResponse?.data?.identity || identityResponse?.identity;
if (identityData?.id) {
  vendorId = identityData.id;
}
```

### 3. Improved Error Handling in VendorApp.tsx
**File**: `apps/vendor-web/components/vendor/VendorApp.tsx`
**Change**: Enhanced error handling to properly handle APPROVED/ACTIVATED status from localStorage:
```typescript
// ✅ FIX: Fallback to stored data on error, but prioritize APPROVED/ACTIVATED status
const storedStatus = localStorage.getItem('vendorApplicationStatus');
if (storedStatus === 'APPROVED' || storedStatus === 'ACTIVATED') {
  setStatus('active');
  // ... load vendor data from localStorage
}
```

## Complete Flow Verification

### Authentication Flow
1. User logs in at `/auth` → `VendorAuth` component
2. OTP verification → `apiClient.post('/auth/verify-otp')`
3. Response includes `onboardingStatus` → stored in `localStorage.vendorApplicationStatus`
4. `onAuthSuccess` callback → routes to `/` (home) for APPROVED/ACTIVATED vendors

### VendorApp Flow (Home Page)
1. `apps/vendor-web/app/page.tsx` loads → renders `VendorApp` component
2. `VendorApp.checkVendorStatus()` runs:
   - Checks localStorage for `vendorApplicationStatus`
   - If APPROVED/ACTIVATED → sets status to 'active' immediately
   - Fetches from API → `apiClient.get('/vendor/onboarding/status')`
   - **FIX**: Extracts data from `response.data` (not `response` directly)
   - Maps onboarding status to frontend status
   - For APPROVED/ACTIVATED → sets status to 'active'
3. Render logic:
   - If `status === 'active'` → shows `VendorLandingPage` (dashboard)
   - If `status === 'new'` → shows `VendorRoleSelection` ❌ (This was the bug)

### VendorLandingPage Flow
1. Receives `initialVendorData` from `VendorApp`
2. Checks localStorage for APPROVED/ACTIVATED status (fast-path)
3. If APPROVED/ACTIVATED → sets status to 'active' immediately
4. Renders `VendorDashboardScreen` for active vendors

## Schema and Parameter Requirements

### Database Schema
- `vendor_identity` table: stores `onboarding_status` (APPROVED, ACTIVATED, UNDER_REVIEW, etc.)
- `vendors` table: stores vendor profile data (created after approval)
- `vendor_applications` table: stores application data

### API Endpoints
- `/vendor/onboarding/status?phone={phone}`: Returns `{success: true, data: {identity, application, role}}`
- `/vendor/profile`: Returns `{success: true, vendor: {...}}` (for APPROVED vendors)
- `/vendor/dashboard/:vendorId`: Returns dashboard data (requires vendor.id from vendors table)

### State Management
- `localStorage.vendorApplicationStatus`: Stores onboarding status (APPROVED, ACTIVATED, etc.)
- `localStorage.vendorData`: Stores vendor profile data (JSON string)
- `localStorage.vendorId`: Stores vendor ID from vendors table
- `localStorage.vendorPhone`: Stores phone number
- `localStorage.authToken`: Stores authentication token

### Status Mapping
- `APPROVED` → `'active'` (frontend status)
- `ACTIVATED` → `'active'` (frontend status)
- `UNDER_REVIEW` → `'pending'` (frontend status)
- `REJECTED` → `'rejected'` (frontend status)
- `CLARIFICATION_REQUIRED` → `'clarification'` (frontend status)
- `FORM_PENDING` / `ROLE_PENDING` → `'new'` (frontend status)
- `INIT` → `'new'` (frontend status)

## Testing Checklist

- [x] Fix API response structure parsing
- [x] Fix error handling for APPROVED/ACTIVATED status
- [ ] Test login flow with APPROVED vendor (9876545521)
- [ ] Verify dashboard loads directly (not role selection)
- [ ] Verify dashboard shows correct data (stats, schedule)
- [ ] Test error handling when API fails (should use localStorage)
- [ ] Test other statuses (UNDER_REVIEW, REJECTED, CLARIFICATION_REQUIRED)
- [ ] Verify UI components load (not placeholders)

## Next Steps

1. Build and test the fix locally
2. Deploy to AWS (S3 + CloudFront)
3. Test with real vendor (9876545521)
4. Verify complete flow from login to dashboard
5. Check all UI components load correctly (not placeholders)
