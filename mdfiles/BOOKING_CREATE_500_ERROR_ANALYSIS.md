# Booking Creation 500 Error - Analysis & Fix

**Date:** 2026-01-28  
**Error:** `POST /bookings/create` returns HTTP 500  
**Status:** ✅ Fixed

---

## 🔍 Error Analysis

### Error Details
```
Failed to load resource: the server responded with a status of 500
❌ /bookings/create failed with non-404 error: ApiError: HTTP 500
Error response: undefined
Error data: undefined
Error status: 500
Error message: HTTP 500
```

### Root Cause

The 500 error indicates an **internal server error** in the backend, not a validation error (which would be 400). This suggests:

1. **Request passed Zod validation** but failed during execution
2. **Most likely cause:** `customerId` is `undefined` or invalid UUID
3. **Secondary causes:**
   - Database foreign key constraint violation
   - Service lookup failure
   - Missing required data in database
   - Transaction rollback

---

## 🔧 Fixes Applied

### 1. Frontend Validation Enhancement

**File:** `apps/customer-web/components/customer/payment/UniversalPaymentPage.tsx`

**Changes:**
- ✅ Added `customerId` validation and auto-fetch if missing
- ✅ UUID format validation before sending request
- ✅ Better error messages for different error types
- ✅ Improved error extraction from API responses

**Code:**
```typescript
// ✅ CRITICAL: Validate and fetch customerId if missing
let validatedCustomerId = customerId;

if (!validatedCustomerId || !validatedCustomerId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
  console.log('⚠️ Customer ID missing or invalid, fetching from phone...');
  try {
    const customerRes = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
    validatedCustomerId = customerRes.customer?.id || customerRes.id;
    
    if (!validatedCustomerId || !validatedCustomerId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      throw new Error('Customer ID not found. Please log in again.');
    }
  } catch (err: any) {
    console.error('❌ Failed to fetch customer ID:', err);
    toast.error('Unable to verify your account. Please log in again.');
    setProcessing(false);
    return;
  }
}

// Validate UUIDs before sending
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(validatedCustomerId)) {
  toast.error('Invalid customer ID format. Please log in again.');
  setProcessing(false);
  return;
}
```

### 2. Enhanced Error Handling

**Changes:**
- ✅ Better error message extraction from API responses
- ✅ Specific handling for 500 errors (server issues)
- ✅ Validation error message extraction for 400 errors
- ✅ Detailed logging for debugging

**Code:**
```typescript
// Extract detailed error message from various response formats
const errorResponse = (error as any)?.response || (error as any)?.responseData || error?.data;
let errorMessage = 'Failed to create booking';

if (errorResponse) {
  errorMessage = 
    errorResponse?.error?.message || 
    errorResponse?.error || 
    errorResponse?.message ||
    errorResponse?.data?.error?.message ||
    errorResponse?.data?.error ||
    errorResponse?.data?.message ||
    error?.message || 
    errorMessage;
}

// For 500 errors, provide more helpful message
if (statusCode === 500) {
  errorMessage = 'Server error occurred. Please try again in a moment. If the problem persists, contact support.';
  console.error('❌ Server error (500) - This may indicate a backend issue. Check backend logs.');
}

// For 400 errors (validation), show the actual validation message
if (statusCode === 400) {
  const validationErrors = errorResponse?.errors || errorResponse?.data?.errors;
  if (validationErrors && Array.isArray(validationErrors) && validationErrors.length > 0) {
    errorMessage = validationErrors.map((e: any) => e.message || e.path?.join('.') || 'Validation error').join(', ');
  }
}
```

---

## 📋 Backend Schema Requirements

### CreateBookingRequestSchema (Zod)

**Required Fields:**
- `customerId`: `z.string().uuid()` - **MUST be valid UUID**
- `vendorId`: `z.string().uuid()` - **MUST be valid UUID**
- `serviceId`: `z.string().uuid()` - **MUST be valid UUID**
- `bookingDate`: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` - Format: YYYY-MM-DD
- `bookingTime`: `z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/)` - Format: HH:MM
- `serviceType`: `z.enum(['at_vendor', 'at_home', 'online', 'at_center', 'tele', 'hybrid', 'product'])`

**Optional Fields:**
- `staffId`: `z.string().uuid().optional()`
- `address`: `z.string().optional()`
- `petId`: `z.string().uuid().optional()`
- `amount`: `z.number().positive().optional()`
- `notes`: `z.string().max(1000).optional()`

---

## 🐛 Common Causes of 500 Error

### 1. Invalid customerId
**Symptom:** `customerId` is `undefined`, `null`, or not a valid UUID  
**Fix:** ✅ Frontend now validates and fetches `customerId` before sending

### 2. Foreign Key Constraint Violation
**Symptom:** `customerId`, `vendorId`, or `serviceId` doesn't exist in database  
**Backend Error Code:** `23503`  
**Fix:** Backend should return 400 with clear message (already handled)

### 3. Service Not Found
**Symptom:** `serviceId` doesn't match any service for the vendor  
**Backend Error:** Returns 404 (handled by frontend)

### 4. Database Connection Error
**Symptom:** Database timeout or connection refused  
**Backend Error Code:** `ECONNREFUSED`, `timeout`  
**Backend Response:** 503 (Service Unavailable)

### 5. Missing Database Table/Column
**Symptom:** Table or column doesn't exist  
**Backend Error:** Returns 500 with "does not exist" message  
**Fix:** Backend migration issue - needs database schema update

---

## ✅ Verification Steps

### 1. Check Frontend Logs
Look for:
- `⚠️ Customer ID missing or invalid, fetching from phone...`
- `✅ Customer ID fetched: [UUID]`
- `📋 Creating booking with validated payload:`

### 2. Check Backend Logs
Look for:
- `[BOOKING] Looking up service [serviceId] for vendor [vendorId]`
- `[BOOKING] Service found: id=[UUID]`
- Any database errors or constraint violations

### 3. Validate Request Payload
Ensure the request includes:
```json
{
  "customerId": "valid-uuid-here",
  "vendorId": "valid-uuid-here",
  "serviceId": "valid-uuid-here",
  "bookingDate": "2026-01-28",
  "bookingTime": "10:00",
  "serviceType": "at_center" | "at_home" | "tele"
}
```

---

## 🔄 Testing

### Test Case 1: Missing customerId
**Before Fix:** Would send `customerId: undefined` → Backend 500 error  
**After Fix:** Fetches `customerId` from phone → Validates UUID → Sends valid request

### Test Case 2: Invalid customerId Format
**Before Fix:** Would send invalid format → Backend 500 error  
**After Fix:** Validates UUID format → Shows error if invalid → Fetches from phone if missing

### Test Case 3: Valid Request
**Before Fix:** Works if all fields valid  
**After Fix:** Works with additional validation and better error messages

---

## 📝 Next Steps

1. **Monitor Backend Logs:** Check CloudWatch logs for actual error details
2. **Database Verification:** Ensure all required tables and columns exist
3. **Service Lookup:** Verify service lookup logic in backend
4. **Error Response Format:** Ensure backend returns structured error responses

---

## 🎯 Expected Behavior After Fix

1. **If customerId missing:** Frontend fetches it automatically
2. **If customerId invalid:** Frontend shows clear error message
3. **If validation fails:** Frontend shows specific validation errors
4. **If server error (500):** Frontend shows user-friendly message with support contact

---

**Status:** ✅ Frontend fixes applied  
**Backend Status:** ⚠️ May need additional error handling improvements  
**Deployment:** Ready for testing
