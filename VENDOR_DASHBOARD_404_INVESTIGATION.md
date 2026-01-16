# Vendor Dashboard 404 Investigation

## Date: 2026-01-14

## Problem Statement
The vendor dashboard is showing 404 errors and placeholder data. The dashboard is using the identity ID instead of a vendor ID from the `vendors` table.

## Root Cause Analysis

### Primary Issue: Missing Vendor Record in `vendors` Table

**Error Logs:**
```
[VendorDashboardScreen] Loading dashboard data for vendor: fd6c9fb2-bca1-495d-9c9b-af0f824f711d
GET /vendor/dashboard/fd6c9fb2-bca1-495d-9c9b-af0f824f711d?timeframe=today 404 (Not Found)
GET /vendor/profile 404 (Not Found)
GET /vendor/notifications/fd6c9fb2-bca1-495d-9c9b-af0f824f711d?limit=10 404 (Not Found)
```

**Issue Details:**
1. **Vendor Identity Status:**
   - Identity ID: `fd6c9fb2-bca1-495d-9c9b-af0f824f711d` (from `vendor_identity` table)
   - Vendor ID (from identity): **NOT SET**
   - Onboarding Status: **APPROVED**
   - Application Status: **APPROVED**

2. **Expected Behavior:**
   - For APPROVED vendors, there should be a record in the `vendors` table
   - The `vendor_identity.vendor_id` field should point to the `vendors.id`
   - The `/vendor/dashboard/:vendorId` endpoint expects a vendor ID from the `vendors` table

3. **Current Behavior:**
   - The code falls back to using `identity.id` (identity ID) when `/vendor/profile` fails
   - The dashboard endpoint doesn't accept identity IDs - it queries the `vendors` table
   - Result: 404 errors because the vendor record doesn't exist

### API Endpoint Requirements

**`/vendor/dashboard/:vendorId` Endpoint:**
- **Expects**: Vendor ID from `vendors` table
- **Queries**: `vendors` table using the `vendorId` parameter
- **Returns**: 404 if vendor not found in `vendors` table

**`/vendor/profile` Endpoint:**
- **Expects**: JWT token with phone/userId
- **Queries**: `vendors` table (and `vendor_identity` table)
- **Returns**: 404 if vendor not found in `vendors` table

### Code Flow

1. **VendorApp.tsx** (`checkVendorStatus`):
   - Fetches onboarding status → Gets identity ID
   - Tries to fetch `/vendor/profile` to get vendor ID from `vendors` table
   - **Fails**: `/vendor/profile` returns 404 (vendor doesn't exist)
   - **Falls back**: Uses `identity.id` (identity ID) instead

2. **VendorLandingPage.tsx**:
   - Receives `vendorId={vendorData?.id || session.vendorId || ''}`
   - Passes identity ID to `VendorDashboardScreen`

3. **VendorDashboardScreen.tsx** (`loadDashboardData`):
   - Tries `/vendor/dashboard/${vendorId}` with identity ID
   - **Fails**: 404 (vendor doesn't exist in `vendors` table)
   - Tries `/vendor/profile` as fallback
   - **Fails**: 404 (vendor doesn't exist in `vendors` table)
   - Shows placeholder/empty data

## Next Steps

1. **Investigate Backend**: Check if vendor records are created when applications are approved
2. **Check Database**: Verify if vendor record exists in `vendors` table for this identity
3. **Fix Options**:
   - Option A: Ensure vendor record is created when application is approved
   - Option B: Handle the case where vendor record doesn't exist (show onboarding/activation screen)
   - Option C: Use a different endpoint that works with identity IDs (if available)

## Testing

- **Vendor Phone**: 9876545521
- **Identity ID**: fd6c9fb2-bca1-495d-9c9b-af0f824f711d
- **Status**: APPROVED
- **Vendor ID**: NOT SET (should be set after approval)
