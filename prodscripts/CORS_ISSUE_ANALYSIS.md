# CORS Issue Analysis - Vendor Web Production

## Issue
CORS error when vendor-web (`https://d1y5ywletev82x.cloudfront.net`) makes requests to production API Gateway (`https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com`).

Error: `Access to fetch at 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/auth/send-otp' from origin 'https://d1y5ywletev82x.cloudfront.net' has been blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.`

## Investigation Results

### ✅ API Gateway CORS Configuration
The API Gateway CORS configuration is **CORRECT** and includes:
- `https://d1y5ywletev82x.cloudfront.net` ✅ (vendor-web CloudFront URL)
- `https://dg69gqp2frh39.cloudfront.net` ✅ (customer-web CloudFront URL)
- `https://dbr09zyoq9akb.cloudfront.net` ✅ (admin-web CloudFront URL)
- All required methods: POST, GET, OPTIONS, etc.
- All required headers: authorization, content-type, etc.
- AllowCredentials: true

### ❌ Problem Identified
**OPTIONS preflight requests are returning HTTP 500 (Internal Server Error)**

When testing the OPTIONS request:
```powershell
OPTIONS https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/auth/send-otp
Headers: Origin: https://d1y5ywletev82x.cloudfront.net
Result: HTTP 500 (but CORS headers ARE present)
```

**Root Cause:**
- API Gateway CORS is configured correctly
- CORS headers ARE being returned (`Access-Control-Allow-Origin: https://d1y5ywletev82x.cloudfront.net`)
- However, the OPTIONS request returns **500 status code**
- **Browsers reject preflight requests with non-2xx status codes**, even if CORS headers are present

### Lambda OPTIONS Handler
The Lambda code has OPTIONS handling that should return 200, but it's returning 500. Possible causes:
1. Lambda environment variable `ALLOWED_ORIGINS` might not be set in production
2. Lambda might be crashing before reaching the OPTIONS handler
3. Error in `getAllowedOriginsList()` or `getDefaultCorsOrigin()` functions

## Solution

### Option 1: Ensure Lambda Environment Variable is Set (Recommended)
The Lambda reads allowed origins from `process.env.ALLOWED_ORIGINS`. Ensure this is set in production:

```bash
aws lambda update-function-configuration \
  --function-name warmpawz-prod-lambda-api-handler \
  --region ap-south-1 \
  --environment "Variables={ALLOWED_ORIGINS=https://www.warmpawz.com,https://dbr09zyoq9akb.cloudfront.net,https://vendor.warmpawz.com,https://customer.warmpawz.com,https://admin.warmpawz.com,https://d1y5ywletev82x.cloudfront.net,https://dg69gqp2frh39.cloudfront.net}"
```

### Option 2: Let API Gateway Handle OPTIONS (Best Practice)
API Gateway should handle OPTIONS automatically when CORS is configured at the API level. However, the `ANY /{proxy+}` route is forwarding OPTIONS to Lambda.

**Consider adding a specific OPTIONS route** that returns 200 before the catch-all route, or ensure API Gateway handles it (may require route configuration changes).

### Option 3: Fix Lambda OPTIONS Handler
Ensure the Lambda OPTIONS handler:
1. Returns 200 status code (not 500)
2. Handles errors gracefully (already has try-catch)
3. Has correct environment variables set

## Verification Steps

1. **Check Lambda environment variables:**
   ```bash
   aws lambda get-function-configuration \
     --function-name warmpawz-prod-lambda-api-handler \
     --region ap-south-1 \
     --query 'Environment.Variables'
   ```

2. **Test OPTIONS request:**
   ```bash
   curl -X OPTIONS \
     "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/auth/send-otp" \
     -H "Origin: https://d1y5ywletev82x.cloudfront.net" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: content-type,authorization" \
     -v
   ```
   Should return **HTTP 200** (not 500)

3. **Check CloudWatch Logs:**
   Look for errors in Lambda logs when OPTIONS requests are made.

## Current Status
- ✅ API Gateway CORS configuration: **CORRECT**
- ✅ Vendor CloudFront URL in allowed origins: **YES**
- ❌ OPTIONS preflight returning 200: **NO** (returning 500)
- ❌ CORS working in browser: **NO** (blocked due to 500 status)

## Next Steps
1. Check and set Lambda `ALLOWED_ORIGINS` environment variable
2. Verify Lambda OPTIONS handler is working correctly
3. Test OPTIONS request returns 200
4. Verify CORS works in browser
