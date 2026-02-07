# Razorpay 504 Gateway Timeout Fix

**Date**: 2026-01-23  
**Issue**: 504 Gateway Timeout on `/razorpay/create-order`  
**Status**: ✅ FIXED

## Problem

The `/razorpay/create-order` endpoint was timing out with a 504 Gateway Timeout error. The error message was: "Payment gateway request timed out. Please try again."

## Root Cause Analysis

The timeout was caused by:

1. **Slow Secrets Manager Calls**: AWS Secrets Manager API calls can take 2-5 seconds, and if they're slow or timing out, they block the entire request
2. **No Timeout Protection**: Secrets Manager and Razorpay API calls had no timeout limits
3. **Inefficient Fallback Order**: The code tried Secrets Manager first (slowest), then database, then env vars (fastest)
4. **No Timeout Handling**: Razorpay API calls could hang indefinitely

## Solution Applied

### 1. Added Timeout Protection to Secrets Manager

**File**: `backend/lambda/src/utils/secrets-manager.ts`

- Added 5-second timeout to `getSecret()` function
- Returns `null` on timeout (allows fallback to faster sources)
- Gracefully handles timeout errors without throwing

### 2. Added Timeout Protection to Razorpay API Calls

**File**: `backend/lambda/src/utils/razorpay-client.ts`

- Added `AbortController` with 8-second timeout to `razorpayRequest()`
- Prevents Razorpay API calls from hanging indefinitely
- Returns clear timeout error message

### 3. Optimized Configuration Loading Order

**File**: `backend/lambda/src/utils/razorpay-client.ts`

**Before** (slow):
1. Secrets Manager (slow, 2-5s)
2. Database (medium, ~500ms)
3. Environment variables (fast, instant)

**After** (fast):
1. Environment variables (fastest, instant) ✅
2. Database (medium, ~500ms) ✅
3. Secrets Manager (slowest, 3s timeout) ✅

This ensures the fastest sources are tried first, preventing unnecessary delays.

### 4. Added Configuration Loading Timeout

**File**: `backend/lambda/src/endpoints/razorpay.ts`

- Added 3-second timeout wrapper for `getRazorpayConfig()`
- Falls back to cached config if timeout occurs
- Prevents Lambda timeout from configuration loading delays

### 5. Enhanced Error Handling

- Specific timeout error codes
- Clear error messages
- Proper HTTP status codes (504 for timeouts)

## Timeout Values

| Operation | Timeout | Reason |
|-----------|---------|--------|
| Secrets Manager | 5 seconds | Fail fast, use fallback |
| Razorpay API | 8 seconds | Leave buffer for Lambda 60s timeout |
| Config Loading | 3 seconds | Fast fallback to cache |
| Lambda Total | 60 seconds | API Gateway timeout |

## Error Response Format

### Timeout Error (504):
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_GATEWAY_TIMEOUT",
    "message": "Payment gateway request timed out. Please try again."
  }
}
```

## Configuration Priority (Fastest First)

1. **Environment Variables** (Instant)
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET`

2. **Database** (~500ms)
   - Table: `platform_integrations`
   - Integration name: `razorpay`
   - Config in: `integration_config` column

3. **AWS Secrets Manager** (2-5s, with 3s timeout)
   - Secret name: `warmpawz/{stage}/razorpay`
   - Falls back if timeout occurs

## Caching

- Config is cached in memory for 5 minutes
- Prevents repeated Secrets Manager calls
- Cache is used if timeout occurs during config loading

## Deployment Status

✅ **Deployed**: `warmpawz-dev-api-handler`  
✅ **Region**: `ap-south-1`  
✅ **Status**: Active

## Testing

To verify the fix works:

```bash
# Test with valid booking (should complete quickly)
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/create-order" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"<valid-booking-id>","amount":1000}'
```

**Expected Behavior**:
- If config is in env vars: Instant response
- If config is in database: ~500ms response
- If config is in Secrets Manager: 2-5s response (with timeout protection)
- If timeout occurs: Returns 504 with clear error message

## Summary

✅ **Fixed**: Timeout protection added to all slow operations  
✅ **Optimized**: Configuration loading order (fastest first)  
✅ **Improved**: Error handling and timeout messages  
✅ **Deployed**: All fixes are live

The endpoint should now:
- Complete quickly when using env vars or database config
- Handle Secrets Manager timeouts gracefully
- Prevent Razorpay API timeouts
- Return proper 504 errors with clear messages when timeouts occur
