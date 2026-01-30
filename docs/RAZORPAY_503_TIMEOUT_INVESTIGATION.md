# Razorpay 503 Timeout - Deep Investigation & Next Steps

## Problem Summary

`POST /razorpay/create-order` consistently times out at **exactly 30 seconds** with `503 Service Unavailable`, despite implementing an async pattern that should return in < 1 second.

## Root Cause Analysis

### Confirmed Issues

1. **API Gateway HTTP API 30-Second Hard Limit**
   - ✅ Confirmed: Integration timeout is set to 30000ms (30s)
   - ✅ Confirmed: This is a hard limit that cannot be increased for HTTP APIs
   - ✅ Lambda timeout is 60s, but irrelevant if API Gateway times out first

2. **Request Not Completing**
   - Even with ultra-minimal code (no DB, no network, just validation + return), request times out
   - Suggests the issue is **before** our handler code runs

### Possible Causes

1. **Hono Middleware/Routing Delay**
   - CORS middleware
   - Request tracking middleware
   - Route matching overhead

2. **Request Body Parsing**
   - `c.req.json()` might be hanging
   - Even with timeout protection, it still times out

3. **API Gateway Integration Issue**
   - Lambda function might not be receiving the request
   - Integration might be misconfigured

4. **Cold Start Issues**
   - VPC cold starts can take 5-10 seconds
   - Combined with other delays, might exceed 30s

## Implemented Solutions (All Attempted)

### ✅ Solution 1: Async Pattern
- **Status**: Implemented
- **Changes**: Endpoint returns immediately, queues job to SQS
- **Result**: Still times out (suggests issue is before handler)

### ✅ Solution 2: Ultra-Minimal Handler
- **Status**: Implemented
- **Changes**: Bypassed BaseHandler, direct Hono implementation
- **Result**: Still times out

### ✅ Solution 3: Pre-parsed Body
- **Status**: Implemented
- **Changes**: Use `c.env.parsedBody` instead of parsing
- **Result**: Still times out

### ✅ Solution 4: Hono Fetch Timeout
- **Status**: Implemented
- **Changes**: Added 25s timeout wrapper around `app.fetch()`
- **Result**: Still times out

## Current Implementation

### Endpoint: `POST /razorpay/create-order`
```typescript
app.post('/razorpay/create-order', async (c) => {
  // Ultra-minimal: validation only, no DB/network calls
  const requestBody = c.env.parsedBody || {};
  // Quick validation
  // Generate paymentId
  // Queue to SQS (fire-and-forget)
  // Return 202 immediately
});
```

### Expected Behavior
- Should return in < 500ms
- Returns `202 Accepted` with `status: 'processing'`
- Background job processes order creation

### Actual Behavior
- Times out at exactly 30 seconds
- Returns `503 Service Unavailable`

## Diagnostic Steps Needed

### Step 1: Verify Lambda is Being Invoked
```bash
# Check CloudWatch logs for handler entry
aws logs filter-log-events \
  --log-group-name /aws/lambda/warmpawz-dev-api-handler \
  --start-time $(($(date +%s) - 300)) \
  --filter-pattern "Handler entry" \
  --region ap-south-1
```

**Expected**: Should see "Handler entry" logs
**If missing**: Lambda not being invoked (API Gateway integration issue)

### Step 2: Check Hono Routing
```bash
# Test minimal endpoint
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/razorpay/test"
```

**Expected**: `200 OK` with test response
**If 404**: Routing issue

### Step 3: Check Middleware Performance
- Review CORS middleware
- Check request tracking middleware
- Verify no blocking operations

### Step 4: Test Direct Lambda Invocation
```bash
# Invoke Lambda directly (bypass API Gateway)
aws lambda invoke \
  --function-name warmpawz-dev-api-handler \
  --payload '{"requestContext":{"http":{"method":"POST","path":"/razorpay/create-order"},"requestId":"test"},"body":"{\"bookingId\":\"516768d9-e975-466c-98c8-fa2414f7d136\",\"amount\":2049}"}' \
  --region ap-south-1 \
  response.json
```

**Expected**: Fast response (< 1s)
**If slow**: Issue is in Lambda code
**If fast**: Issue is in API Gateway integration

### Step 5: Check API Gateway Integration
```bash
# Get integration details
aws apigatewayv2 get-integrations \
  --api-id z0b3obweb6 \
  --region ap-south-1
```

**Check**:
- Integration type (should be `AWS_PROXY`)
- Integration URI (should point to Lambda)
- Timeout settings

## Recommended Next Steps

### Immediate Actions

1. **Test Direct Lambda Invocation**
   - Bypass API Gateway to isolate the issue
   - If Lambda is fast, issue is API Gateway
   - If Lambda is slow, issue is in code

2. **Check CloudWatch Logs**
   - Verify handler is being called
   - Check for errors before handler execution
   - Look for timeout messages

3. **Review API Gateway Integration**
   - Verify integration is correctly configured
   - Check for any integration-level timeouts
   - Verify Lambda permissions

### Alternative Solutions

#### Option A: Switch to REST API
- REST APIs can have timeout increased beyond 30s
- Requires infrastructure changes
- More complex setup

#### Option B: Use API Gateway Direct Integration
- Bypass Lambda for initial response
- Use Lambda only for async processing
- Complex but avoids timeout

#### Option C: Use Step Functions
- Orchestrate async processing
- Better error handling
- More AWS-native approach

## Files Modified

1. `backend/lambda/src/endpoints/razorpay.ts`
   - Async pattern implementation
   - Ultra-minimal handler
   - Status endpoint

2. `backend/lambda/src/handler/index.ts`
   - Added Hono fetch timeout wrapper

3. `backend/lambda/serverless.yml`
   - Increased Lambda timeout to 60s

## Current Status

- ✅ Async pattern code implemented
- ✅ Status endpoint created
- ✅ SQS queue processor ready
- ⚠️ Endpoint still timing out (likely pre-handler issue)
- 🔍 Need to diagnose where request is hanging

## Next Investigation

1. Run direct Lambda invocation test
2. Check CloudWatch logs for handler entry
3. Review API Gateway integration configuration
4. Test with minimal endpoint to verify routing

---

**Date**: 2026-01-23
**Status**: Implementation complete, but endpoint still timing out
**Next Step**: Diagnose pre-handler delay (API Gateway, middleware, or routing)
