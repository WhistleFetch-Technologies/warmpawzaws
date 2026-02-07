# Vendor UI Investigation Report

## Issue Summary
User reports seeing placeholder UI in vendor dashboard and onboarding journey. The newly copied UI from React Native app is not reflecting properly.

## Root Causes Identified

### 1. **VendorId Mismatch (CRITICAL)**
**Location**: `apps/vendor-web/components/vendor/VendorApp.tsx:90`

**Problem**:
```typescript
id: identity.vendor_id || identity.id,
```
- For APPROVED vendors, `identity.vendor_id` may be null/undefined
- Falls back to `identity.id` (identity table ID)
- Backend endpoint `/vendor/dashboard/:vendorId` expects `vendor.id` from `vendors` table
- This causes "Vendor not found" error, leading to fallback placeholder UI

**Evidence**:
- Test results show: identity.id = `fd6c9fb2-bca1-495d-9c9b-af0f824f711d`
- Dashboard endpoint requires vendor.id from `vendors` table
- When wrong ID is passed, API returns error, component shows fallback stats (all zeros)

### 2. **API Response Structure Mismatch**
**Location**: `apps/vendor-web/components/vendor/dashboard/VendorDashboardScreen.tsx:68-76`

**Problem**:
- Backend returns: `{ success: true, data: { stats, bookings, vendor, ... } }`
- Frontend expects: `dashboardResponse.data.stats` and `dashboardResponse.data.bookings`
- However, backend returns `bookings` as raw booking objects, not formatted as `ScheduleItem[]`
- Frontend expects `ScheduleItem` with: `id`, `bookingId`, `time`, `customerName`, `serviceName`, `status`, `price`
- Mismatch causes schedule to not display properly

### 3. **Placeholder Components (NOT A BUG - BY DESIGN)**
Many capability components show "coming soon" placeholders:
- `VendorTeleConsultationFlow.tsx` - "Teleconsultation functionality coming soon"
- `ResortManagementDashboard.tsx` - "Resort management dashboard coming soon"
- `VetSpecializedServicesManager.tsx` - "Vet specialized services management coming soon"
- `VendorPaymentSettings.tsx` - "Payment settings functionality coming soon"
- Many others...

**Status**: These are intentional placeholders for features not yet implemented.

### 4. **Onboarding Flow - Business Type Selector Showing Incorrectly**
**Location**: `apps/vendor-web/components/vendor/onboarding/EnhancedVendorOnboarding.tsx`

**Problem**:
- APPROVED vendors were seeing business type selector instead of dashboard
- Fixed in previous commit, but may still occur if status detection fails

## Solutions

### Fix 1: Get Correct Vendor ID from Profile Endpoint
Instead of using `identity.vendor_id || identity.id`, we should:
1. Call `/vendor/profile` endpoint after getting onboarding status
2. Use the `vendor.id` from profile response
3. Store this in vendorData and localStorage

### Fix 2: Handle API Response Structure Correctly
1. Transform backend booking response to match `ScheduleItem` interface
2. Map booking fields: `id`, `booking_id`, `booking_date + booking_time`, `customer_name`, `service_name`, `status`, `total_amount`

### Fix 3: Better Error Handling
1. Show proper error messages instead of silent fallbacks
2. Log errors to help debug issues
3. Provide retry mechanism

## Impact Assessment

### Breaking Changes Risk: LOW
- Changes are isolated to vendor ID resolution
- API endpoint structure remains the same
- Only affects APPROVED vendors who have vendor records

### Affected Components:
- `VendorApp.tsx` - Vendor ID resolution
- `VendorDashboardScreen.tsx` - API response handling
- `VendorLandingPage.tsx` - Vendor ID passing

## Test Plan

1. Test with APPROVED vendor (phone: 9876545521)
2. Verify correct vendor ID is fetched and used
3. Verify dashboard loads with real data
4. Verify schedule items display correctly
5. Verify no placeholder UI shows for working features
