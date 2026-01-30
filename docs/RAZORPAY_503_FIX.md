# Razorpay 503 Service Unavailable - Root Cause & Fix

## Problem

`POST /razorpay/create-order` returns `503 Service Unavailable` with response:
```json
{"message":"Service Unavailable"}
```

## Root Cause Analysis

### Issue 1: BaseHandler.error() Signature Mismatch
- **Problem**: `CreateRazorpayOrderHandler` extends `BaseHandler` (not `BaseHandlerEnhanced`)
- **BaseHandler.error()** signature: `error(message: string, statusCode: number)` - only 2 parameters
- **Code was calling**: `this.error(message, statusCode, code)` - 3 parameters
- **Result**: The `code` parameter was ignored, and error responses had wrong format

### Issue 2: Response Format Mismatch
- **BaseHandler returns**: `{ error: "message" }` (string)
- **Hono wrapper expected**: `{ error: { code: "...", message: "..." } }` (object)
- **Result**: Error parsing failed, generic error returned

### Issue 3: Timeout Too Aggressive
- **Problem**: Config loading timeout was 3 seconds, too short
- **Impact**: Legitimate Secrets Manager calls timing out
- **With VPC endpoints**: Should be faster, but 3s still too aggressive

### Issue 4: Error Handling in Catch Block
- **Problem**: Generic catch block returned `{"message": "..."}` format
- **Expected**: `{ success: false, error: { code, message } }` format

## Fixes Applied

### 1. Fixed Error Response Format
Changed all `this.error()` calls to return proper format:
```typescript
return {
  statusCode: 503,
  body: JSON.stringify({
    success: false,
    error: {
      code: 'PAYMENT_GATEWAY_NOT_CONFIGURED',
      message: 'Payment gateway is not configured...'
    }
  })
};
```

### 2. Fixed Hono Wrapper Error Parsing
Updated to handle both BaseHandler (string error) and BaseHandlerEnhanced (object error) formats:
```typescript
if (typeof responseBody.error === 'string') {
  // BaseHandler format - infer code from message
  errorCode = inferErrorCode(responseBody.error);
} else if (typeof responseBody.error === 'object') {
  // BaseHandlerEnhanced format
  errorCode = responseBody.error.code;
}
```

### 3. Increased Timeout
- Config loading timeout: 3s → 5s
- Secrets Manager timeout: 3s → 5s
- Reason: VPC endpoints should make this fast, but need buffer for cold starts

### 4. Enhanced Error Logging
Added detailed error logging to help diagnose issues:
```typescript
console.error('[RAZORPAY-CREATE-ORDER] Configuration error:', {
  message: error.message,
  name: error.name,
  stack: error.stack
});
```

## Files Changed

1. `backend/lambda/src/endpoints/razorpay.ts`
   - Fixed all error responses to use proper format
   - Fixed Hono wrapper error parsing
   - Enhanced error logging

2. `backend/lambda/src/utils/razorpay-client.ts`
   - Increased Secrets Manager timeout from 3s to 5s

## Testing

After fix, test:
1. ✅ Valid request with configured Razorpay → Should return 200 with order
2. ✅ Unconfigured Razorpay → Should return 503 with proper error format
3. ✅ Network timeout → Should return 504 with proper error format
4. ✅ Invalid credentials → Should return 503 with auth error

## Expected Error Responses

### 503 - Not Configured
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_GATEWAY_NOT_CONFIGURED",
    "message": "Payment gateway is not configured. Please contact support or configure Razorpay in Platform Settings."
  }
}
```

### 504 - Timeout
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_GATEWAY_CONFIG_TIMEOUT",
    "message": "Payment gateway configuration request timed out. Please try again."
  }
}
```

### 503 - Config Error
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_GATEWAY_CONFIG_ERROR",
    "message": "Payment gateway configuration error. Please contact support."
  }
}
```

## Next Steps

1. Deploy the fix
2. Test with real Razorpay credentials
3. Monitor CloudWatch logs for any remaining issues
4. Verify error messages are user-friendly
