# Razorpay Configuration Error Fix

**Date**: 2026-01-23  
**Issue**: 500 Internal Server Error with "Payment gateway configuration error"  
**Status**: ✅ FIXED

## Problem

The `/razorpay/create-order` endpoint was returning a 500 error when Razorpay configuration was missing or invalid. The error was not being caught properly, causing unhandled exceptions.

## Root Cause

1. **Missing Error Handling**: The `CreateRazorpayOrderHandler` didn't catch errors from `getRazorpayConfig()`
2. **Unhandled Exceptions**: When Razorpay config was missing, the function threw an error that wasn't caught
3. **Poor Error Messages**: Generic 500 errors without clear indication of configuration issues

## Solution

### 1. Added Configuration Error Handling

**File**: `backend/lambda/src/endpoints/razorpay.ts`

- Wrapped `getRazorpayConfig()` in try-catch block
- Added specific error handling for configuration missing errors
- Returns proper HTTP status codes:
  - `503 Service Unavailable` for configuration issues (not 500)
  - `502 Bad Gateway` for Razorpay API errors
  - `400 Bad Request` for validation errors

### 2. Added Configuration Validation

- Validates config after loading to ensure `keyId` and `keySecret` are present
- Returns clear error messages indicating what's missing

### 3. Added Razorpay API Error Handling

- Catches Razorpay API errors (authentication, rate limits, etc.)
- Maps different error types to appropriate HTTP status codes
- Provides user-friendly error messages

### 4. Improved Endpoint Error Handling

- Enhanced error handling in the Hono endpoint wrapper
- Maps error codes to appropriate HTTP status codes
- Provides structured error responses

## Error Response Format

### Before (500 Error):
```json
{
  "error": "Payment gateway configuration error"
}
```

### After (503 Service Unavailable):
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_GATEWAY_NOT_CONFIGURED",
    "message": "Payment gateway is not configured. Please contact support or configure Razorpay in Platform Settings."
  }
}
```

## Error Codes

- `PAYMENT_GATEWAY_NOT_CONFIGURED` (503): Razorpay not configured at all
- `PAYMENT_GATEWAY_INCOMPLETE` (503): Configuration missing required fields
- `PAYMENT_GATEWAY_AUTH_ERROR` (503): Authentication failed with Razorpay
- `PAYMENT_GATEWAY_RATE_LIMIT` (503): Rate limit exceeded
- `PAYMENT_GATEWAY_ERROR` (502): Generic Razorpay API error
- `VALIDATION_ERROR` (400): Missing required fields
- `NOT_FOUND` (404): Booking not found

## Configuration Sources (in order)

1. **AWS Secrets Manager** (Primary)
   - Secret name: `razorpay`
   - Expected format: `{ keyId, keySecret, webhookSecret? }`

2. **Database** (Fallback 1)
   - Table: `platform_integrations`
   - Integration name: `razorpay`
   - Config stored in: `integration_config` column

3. **Environment Variables** (Fallback 2)
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET`

## Testing

To test the fix:

```bash
# Test with missing configuration (should return 503, not 500)
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/create-order" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":"test-id","amount":1000}'
```

**Expected Response** (if not configured):
- Status: `503 Service Unavailable`
- Error Code: `PAYMENT_GATEWAY_NOT_CONFIGURED`
- Clear message about configuration

## Deployment Status

✅ **Deployed**: `warmpawz-dev-api-handler`  
✅ **Region**: `ap-south-1`  
✅ **Status**: Active

## Next Steps

1. Configure Razorpay credentials in one of the supported sources:
   - AWS Secrets Manager (recommended)
   - Platform Settings UI
   - Environment variables

2. Verify configuration by checking the health endpoint or attempting to create an order

3. Monitor error logs to ensure proper error handling

## Summary

✅ **Fixed**: Razorpay configuration error handling  
✅ **Improved**: Error messages and status codes  
✅ **Deployed**: Changes are live in production

The endpoint now properly handles configuration errors and returns appropriate HTTP status codes instead of generic 500 errors.
