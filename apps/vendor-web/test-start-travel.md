# Start Travel Function Test Plan

## Test Scenarios

### 1. Normal Flow (Happy Path)
- **Setup**: Valid booking with id, valid vendorData with id
- **Expected**: API call to `/tracking/start`, success response with session, tracker opens

### 2. Missing Booking
- **Setup**: booking is null or undefined
- **Expected**: Error toast "Booking information is missing", no API call

### 3. Missing Booking ID
- **Setup**: booking exists but booking.id is undefined
- **Expected**: Error toast "Booking ID is missing", no API call

### 4. Missing Vendor Data
- **Setup**: effectiveVendorData and vendorData are both null
- **Expected**: Error toast "Vendor information is missing", no API call

### 5. Missing Vendor ID
- **Setup**: vendor exists but vendor.id is undefined
- **Expected**: Error toast "Vendor ID is missing", no API call

### 6. API Error - Invalid Response
- **Setup**: API returns success: true but session is missing
- **Expected**: Error toast "Invalid response from server", no tracker opens

### 7. API Error - Network Error
- **Setup**: API call fails with network error
- **Expected**: Error toast with error message, no tracker opens

### 8. API Error - Server Error
- **Setup**: API returns success: false with error message
- **Expected**: Error toast with server error message

## Manual Testing Steps

1. Open vendor dashboard
2. Click on a confirmed booking
3. Click "Start Travel" button
4. Verify:
   - Console logs show validation checks
   - API call is made to `/tracking/start`
   - Response is logged
   - Tracker modal opens if successful
   - Error messages are shown if validation fails

## Automated Test Script

See: `test-start-travel-function.ts`
