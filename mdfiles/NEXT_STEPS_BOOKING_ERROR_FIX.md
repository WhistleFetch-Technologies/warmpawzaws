# Next Steps: Booking Creation 500 Error Fix

**Date:** 2026-01-28  
**Status:** ✅ Frontend & Backend Fixes Applied

---

## ✅ What's Been Fixed

### Frontend (`apps/customer-web`)
1. ✅ **CustomerId Validation:** Auto-fetches and validates `customerId` before sending
2. ✅ **UUID Validation:** Validates all UUIDs before API call
3. ✅ **Enhanced Error Handling:** Better error messages for different error types
4. ✅ **Error Extraction:** Improved error message extraction from API responses

### Backend (`backend/lambda`)
1. ✅ **Enhanced Logging:** Detailed request/error logging with requestId
2. ✅ **Better Error Responses:** Structured error responses with context
3. ✅ **Validation Logging:** Logs validation failures with received data
4. ✅ **Error Context:** Full error context in logs for debugging

---

## 🚀 Deployment Steps

### Step 1: Deploy Frontend Changes
```bash
cd apps/customer-web
npm run build
# Deploy using your deployment script
./scripts/deploy-customer-web.sh
```

### Step 2: Deploy Backend Changes
```bash
cd backend/lambda
npm run build
# Deploy Lambda function
serverless deploy
# Or use your deployment method
```

---

## 🧪 Testing Steps

### Test 1: Valid Booking Creation
1. Navigate to booking flow
2. Fill in all required fields
3. Submit booking
4. **Expected:** Booking created successfully

### Test 2: Missing CustomerId
1. Clear customerId from session/localStorage
2. Try to create booking
3. **Expected:** Frontend fetches customerId automatically, booking succeeds

### Test 3: Invalid CustomerId Format
1. Manually set invalid customerId
2. Try to create booking
3. **Expected:** Frontend shows error: "Invalid customer ID format. Please log in again."

### Test 4: Validation Error (400)
1. Send request with missing required field
2. **Expected:** Backend returns 400 with validation errors, frontend shows specific error

### Test 5: Server Error (500)
1. If 500 error still occurs, check CloudWatch logs
2. **Expected:** Detailed error logs with requestId for tracking

---

## 📊 Monitoring & Debugging

### CloudWatch Log Queries

#### Find All Booking Creation Errors
```
fields @timestamp, @message
| filter @message like /BOOKING\/CREATE.*Error/
| sort @timestamp desc
```

#### Find Validation Errors
```
fields @timestamp, @message, requestId
| filter @message like /Validation failed/
| sort @timestamp desc
```

#### Find 500 Errors with Context
```
fields @timestamp, @message, requestId
| filter @message like /Unexpected error/
| sort @timestamp desc
```

#### Track Specific Request
```
fields @timestamp, @message
| filter requestId = "your-request-id-here"
| sort @timestamp asc
```

### Check Logs for Common Issues

1. **Missing customerId:**
   - Look for: `customerId: 'MISSING'` in `[BOOKING/CREATE] Request received` logs

2. **Invalid UUID format:**
   - Look for: Validation errors with `Invalid customer ID format`

3. **Foreign key constraint:**
   - Look for: `Foreign key constraint error` in logs
   - Check if customer/vendor/service exists in database

4. **Service not found:**
   - Look for: `Service not found` logs
   - Verify service exists for the vendor

---

## 🔍 Troubleshooting Guide

### Issue: Still Getting 500 Error

#### Step 1: Check Frontend Console
- Open browser DevTools → Console
- Look for error logs starting with `❌`
- Check if `customerId` was fetched successfully

#### Step 2: Check CloudWatch Logs
1. Go to AWS CloudWatch → Log Groups
2. Find your Lambda function's log group
3. Search for `[BOOKING/CREATE]` logs
4. Look for the `requestId` from the error

#### Step 3: Verify Request Payload
In CloudWatch logs, check:
- `hasCustomerId: true/false`
- `hasVendorId: true/false`
- `hasServiceId: true/false`

#### Step 4: Check Database
If foreign key constraint error:
```sql
-- Check if customer exists
SELECT id FROM customers WHERE id = 'customer-id-here';

-- Check if vendor exists
SELECT id FROM vendors WHERE id = 'vendor-id-here';

-- Check if service exists
SELECT id, service_id FROM vendor_services WHERE service_id = 'service-id-here' AND vendor_id = 'vendor-id-here';
```

### Issue: Validation Errors (400)

#### Check Validation Error Details
In CloudWatch logs, look for:
```json
{
  "errors": [
    {
      "path": ["customerId"],
      "message": "Invalid customer ID format"
    }
  ]
}
```

#### Fix:
- Ensure all UUIDs are valid format
- Ensure all required fields are present
- Check date/time formats match schema

### Issue: Service Not Found (404)

#### Check Service Lookup Logs
Look for logs like:
- `[BOOKING] Looking up service...`
- `[BOOKING] Service not found...`

#### Fix:
- Verify service exists in `vendor_services` table
- Check `publish_status = 'published'`
- Verify `is_enabled = true` or `NULL`

---

## 📝 Verification Checklist

- [ ] Frontend changes deployed
- [ ] Backend changes deployed
- [ ] Tested valid booking creation
- [ ] Tested missing customerId scenario
- [ ] Tested invalid customerId scenario
- [ ] Checked CloudWatch logs for errors
- [ ] Verified error messages are user-friendly
- [ ] Confirmed requestId tracking works

---

## 🎯 Expected Outcomes

### Before Fix
- ❌ 500 error with generic message
- ❌ No way to debug the issue
- ❌ Poor user experience

### After Fix
- ✅ Clear error messages
- ✅ Automatic customerId fetching
- ✅ Detailed logs for debugging
- ✅ RequestId tracking
- ✅ Better user experience

---

## 📞 Support

If issues persist after deployment:

1. **Collect Information:**
   - RequestId from error response
   - Timestamp of error
   - User phone number (if applicable)
   - Service/Vendor IDs

2. **Check Logs:**
   - Use CloudWatch queries above
   - Look for the specific requestId

3. **Common Issues:**
   - Database connection issues → Check RDS status
   - Missing tables/columns → Run migrations
   - Invalid data → Check validation logs

---

## 🔄 Rollback Plan

If issues occur after deployment:

### Frontend Rollback
```bash
# Revert to previous deployment
git checkout <previous-commit>
cd apps/customer-web
npm run build
./scripts/deploy-customer-web.sh
```

### Backend Rollback
```bash
# Revert to previous deployment
git checkout <previous-commit>
cd backend/lambda
npm run build
serverless deploy
```

---

**Status:** ✅ Ready for Deployment  
**Next Action:** Deploy changes and test
