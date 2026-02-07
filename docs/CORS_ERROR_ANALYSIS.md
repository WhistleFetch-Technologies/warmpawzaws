# CORS Error Analysis & Solutions

## Understanding the Errors

### 1. **CORS Preflight Error**
```
Access to fetch at 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/...' 
from origin 'https://d2aoyjj8ine0wk.cloudfront.net' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

**What this means:**
- The browser sends an **OPTIONS** request (preflight) before the actual request
- The preflight request is **not returning HTTP 200 OK**
- The browser blocks the actual request because the preflight failed

**Why preflight happens:**
- Browser automatically sends OPTIONS when:
  - Request uses custom headers (like `Authorization`, `Content-Type: application/json`)
  - Request method is not GET/HEAD/POST with simple content types
  - Request includes credentials

### 2. **Failed to Load Resource (net::ERR_FAILED)**
```
Failed to load resource: net::ERR_FAILED
```
This is a **consequence** of the CORS error - the browser blocks the request entirely.

### 3. **500 Server Error**
```
Failed to load resource: the server responded with a status of 500
```
This is a **separate backend issue** - the server is returning an error for the notifications endpoint.

---

## Root Cause Analysis

### Issue 1: CORS Preflight Not Returning 200 OK

**Problem:** API Gateway HTTP API might be:
1. **Not forwarding OPTIONS requests to Lambda** - API Gateway handles CORS at the gateway level
2. **Returning non-200 status** - If API Gateway CORS is misconfigured, it might return 403/404 for OPTIONS
3. **Lambda handler not receiving OPTIONS** - If API Gateway intercepts OPTIONS, Lambda never sees them

### Issue 2: API Gateway CORS Configuration

Looking at `serverless.yml`:
```yaml
# Note: CORS is handled by Lambda handler to ensure proper OPTIONS handling
# If API Gateway CORS is configured, it may handle OPTIONS automatically
```

**The problem:** If API Gateway has CORS configured, it handles OPTIONS **before** Lambda, but if misconfigured, it returns an error status.

---

## Solutions

### Solution 1: Configure API Gateway CORS Properly (Recommended)

API Gateway HTTP API should handle CORS at the gateway level. You need to:

1. **Check API Gateway CORS settings** in AWS Console:
   - Go to API Gateway → Your API (`z0b3obweb6`)
   - Check CORS configuration
   - Ensure it allows:
     - Origin: `https://d2aoyjj8ine0wk.cloudfront.net`
     - Methods: `GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD`
     - Headers: `authorization, content-type, x-api-key, x-uat-mode, x-uat-token`
     - Credentials: `true`

2. **If CORS is not configured**, add it via Terraform/CloudFormation or AWS Console

3. **If CORS is misconfigured**, update it to include:
   - All CloudFront origins
   - All required headers
   - Credentials enabled

### Solution 2: Ensure Lambda Handles OPTIONS (Fallback)

The Lambda handler already has OPTIONS handling (lines 597-649 in `handler/index.ts`), but it only works if:
- API Gateway forwards OPTIONS requests to Lambda
- API Gateway doesn't have CORS configured (or CORS is disabled)

**Current handler code:**
```typescript
if (httpMethod === 'OPTIONS') {
  // Returns 200 OK with CORS headers
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS,HEAD',
      'Access-Control-Allow-Headers': allowedHeaders,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    },
  };
}
```

### Solution 3: Fix API Gateway Configuration

**Option A: Disable API Gateway CORS (Let Lambda Handle It)**
- Remove CORS configuration from API Gateway
- Let Lambda handle all OPTIONS requests

**Option B: Fix API Gateway CORS**
- Configure CORS properly in API Gateway
- Ensure it returns 200 OK for OPTIONS
- Include all required origins and headers

---

## Immediate Action Items

### 1. Check API Gateway CORS Configuration

Run this command to check current CORS settings:
```bash
aws apigatewayv2 get-api --api-id z0b3obweb6 --region ap-south-1
```

Or check in AWS Console:
- API Gateway → HTTP APIs → `z0b3obweb6`
- Check CORS configuration

### 2. Test OPTIONS Request Directly

```bash
curl -X OPTIONS \
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/platform?roleId=veterinarian&serviceStyle=tele' \
  -H 'Origin: https://d2aoyjj8ine0wk.cloudfront.net' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization,content-type' \
  -v
```

**Expected response:**
- Status: `200 OK`
- Headers: `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, etc.

**If you get 403/404/500:**
- API Gateway CORS is misconfigured
- Or OPTIONS requests are not reaching Lambda

### 3. Check CloudWatch Logs

Look for OPTIONS requests in Lambda logs:
```bash
aws logs tail /aws/lambda/warmpawz-api --follow --region ap-south-1
```

If you don't see OPTIONS requests:
- API Gateway is handling them (and failing)
- Need to fix API Gateway CORS

If you see OPTIONS requests:
- Lambda is receiving them
- Check if Lambda is returning 200 OK

---

## Fixing the 500 Error (Separate Issue)

The notifications endpoint is returning 500:
```
/customer/notifications/9611377119?limit=10
```

**This is a backend bug** - check:
1. Lambda logs for the error
2. Database connection issues
3. Missing environment variables
4. Exception handling in the notifications endpoint

---

## Recommended Fix Strategy

### Step 1: Verify API Gateway CORS
```bash
# Check if CORS is configured
aws apigatewayv2 get-api --api-id z0b3obweb6 --region ap-south-1 | grep -i cors
```

### Step 2: If CORS is NOT configured, add it:
```bash
# Add CORS configuration via AWS CLI
aws apigatewayv2 update-api \
  --api-id z0b3obweb6 \
  --region ap-south-1 \
  --cors-configuration AllowOrigins="https://d2aoyjj8ine0wk.cloudfront.net,https://dfof7mguaa0a5.cloudfront.net,https://d1s6ykkj381k58.cloudfront.net",AllowMethods="GET,POST,PUT,DELETE,OPTIONS,PATCH,HEAD",AllowHeaders="authorization,content-type,x-api-key,x-uat-mode,x-uat-token",AllowCredentials=true,MaxAge=86400
```

### Step 3: If CORS IS configured but wrong, update it:
- Go to AWS Console → API Gateway
- Edit CORS configuration
- Add missing origins/headers
- Save and deploy

### Step 4: Test the fix
```bash
# Test OPTIONS request
curl -X OPTIONS \
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/platform?roleId=veterinarian&serviceStyle=tele' \
  -H 'Origin: https://d2aoyjj8ine0wk.cloudfront.net' \
  -H 'Access-Control-Request-Method: GET' \
  -v

# Should return 200 OK with CORS headers
```

---

## Summary

**The CORS error occurs because:**
1. Browser sends OPTIONS preflight request
2. API Gateway or Lambda returns non-200 status for OPTIONS
3. Browser blocks the actual request

**The fix:**
1. Configure API Gateway CORS properly (recommended)
2. OR ensure Lambda handles OPTIONS correctly (if API Gateway CORS is disabled)
3. Fix the 500 error on notifications endpoint separately

**Priority:**
1. **High:** Fix CORS (blocks all API requests)
2. **Medium:** Fix 500 error on notifications (affects one endpoint)
