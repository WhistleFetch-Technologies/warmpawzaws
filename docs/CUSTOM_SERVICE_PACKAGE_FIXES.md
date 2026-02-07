# Custom Service & Package Creation Fixes

## Issues Fixed
**Date:** January 25, 2026

## Problems Reported

### 1. Custom Service Creation Error
- **Error:** `POST /vendor/:vendorId/services/custom` returns 500 with "Route configuration error"
- **Root Cause:** Route conflict - `/vendor/:vendorId/services/:serviceStyle` was registered before `/vendor/:vendorId/services/custom`, causing "custom" to be matched as a serviceStyle parameter

### 2. Packages Endpoint Missing
- **Error:** `GET /vendor/:vendorId/packages` returns 404 "Not Found"
- **Root Cause:** Endpoint didn't exist - only `/vendor/packages` existed (query param based)

### 3. Services Not Loading in Package Creation
- **Issue:** Step 2 shows "Enable services first" even though center has enabled services
- **Root Cause:** Missing endpoint `/vendor/:vendorId/services/enabled` and query was too restrictive

### 4. UI Background Color Issues
- **Issue:** Modal lacks white background color
- **Issue:** Package listing cards lack white background

## Solutions Implemented

### 1. Fixed Route Conflict ✅
**File:** `backend/lambda/src/endpoints/vendor-services.ts`

**Change:** Moved `POST /vendor/:vendorId/services/custom` route registration to BEFORE `GET /vendor/:vendorId/services/:serviceStyle`

**Location:** Line 327 (moved from line 1380)

**Why:** In Hono, routes are matched in order. Specific routes must come before parameterized routes to avoid conflicts.

### 2. Added GET /vendor/:vendorId/packages Endpoint ✅
**File:** `backend/lambda/src/endpoints/packages.ts`

**Added:**
```typescript
app.get("/vendor/:vendorId/packages", async (c) => {
  // Returns all packages for a specific vendor
});
```

**Location:** After line 416

### 3. Added GET /vendor/:vendorId/services/enabled Endpoint ✅
**File:** `backend/lambda/src/endpoints/vendor-services.ts`

**Added:**
```typescript
app.get("/vendor/:vendorId/services/enabled", async (c) => {
  // Returns all enabled services for package creation
  // Shows services regardless of publish status
});
```

**Location:** Line 286 (before serviceStyle route)

**Query Fix:** Changed to show ALL enabled services, regardless of publish_status:
```sql
WHERE vs.vendor_id = $1
AND vs.is_enabled = true
-- Removed publish_status restriction
```

### 4. Fixed UI Background Colors ✅
**Files:**
- `apps/vendor-web/components/vendor/EnhancedPackageCreationModal.tsx`
- `apps/vendor-web/components/vendor/packages/CreatePackageFlow.tsx`

**Changes:**
- Added `bg-white` to `DialogContent` components
- Added `bg-white` to service cards in package creation
- Changed main container from `bg-gray-50` to `bg-white`

## API Endpoints

### POST /vendor/:vendorId/services/custom
**Status:** ✅ Fixed - Route now registered before parameterized routes

**Request:**
```json
{
  "serviceName": "string",
  "description": "string",
  "category": "string",
  "categoryName": "string", // Also accepted
  "subCategory": "string",
  "subCategoryName": "string", // Also accepted
  "serviceStyle": "at_home" | "at_center" | "tele",
  "price": number,
  "duration": number
}
```

**Response:**
```json
{
  "success": true,
  "service": { ... },
  "message": "Custom service submitted for admin approval",
  "publishStatus": "pending_approval"
}
```

### GET /vendor/:vendorId/packages
**Status:** ✅ Added

**Response:**
```json
{
  "success": true,
  "packages": [...],
  "total": number
}
```

### GET /vendor/:vendorId/services/enabled
**Status:** ✅ Added

**Response:**
```json
{
  "success": true,
  "services": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "category": "string",
      "price": number,
      "duration": number,
      "serviceStyle": "string"
    }
  ],
  "total": number
}
```

## UI Changes

### Custom Service Modal
- ✅ Added `bg-white` to DialogContent
- ✅ White background now visible

### Package Creation Flow
- ✅ Added `bg-white` to main container
- ✅ Added `bg-white` to service cards
- ✅ "No services available" card has white background

## Testing

### Test Custom Service Creation
1. Navigate to Services → Create Custom Service
2. Fill in service details
3. Submit
4. **Expected:** Service created successfully, no 500 error

### Test Package Creation
1. Navigate to Packages → Create Package
2. Fill Step 1 details
3. Go to Step 2
4. **Expected:** Enabled services should appear (not "Enable services first")

### Test Packages Listing
1. Navigate to Packages page
2. **Expected:** Packages should load (not 404)

## Deployment

**Status:** ✅ Deployed
- **Backend:** Deployed successfully (39s)
- **Function:** warmpawz-api-dev-api
- **API Endpoint:** https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com

## Files Changed

1. `backend/lambda/src/endpoints/vendor-services.ts`
   - Moved custom service route before serviceStyle route
   - Added `/vendor/:vendorId/services/enabled` endpoint
   - Fixed service query to show all enabled services

2. `backend/lambda/src/endpoints/packages.ts`
   - Added `/vendor/:vendorId/packages` endpoint

3. `apps/vendor-web/components/vendor/EnhancedPackageCreationModal.tsx`
   - Added `bg-white` to DialogContent

4. `apps/vendor-web/components/vendor/packages/CreatePackageFlow.tsx`
   - Added `bg-white` to main container and cards

## Status

✅ **ALL ISSUES FIXED AND DEPLOYED**

Custom service creation, package creation, and UI background colors are now working correctly.
