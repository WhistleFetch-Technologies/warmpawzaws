# CORS Fix for localhost:3003 - Production API Gateway

## Issue
CORS error when accessing production API Gateway (`mss9sa4y01`) from `http://localhost:3003`:
```
Access to fetch at 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/admin/auth/login' 
from origin 'http://localhost:3003' has been blocked by CORS policy
```

## Root Cause
1. **API Gateway CORS** - `localhost:3003` was missing from allowed origins
2. **Lambda ALLOWED_ORIGINS** - Only included `localhost:3002`, missing `3000`, `3001`, and `3003`
3. **API Gateway Deployment** - CORS changes require a new deployment to take effect

## Fixes Applied

### 1. ✅ API Gateway CORS Configuration
Updated production API Gateway (`mss9sa4y01`) to include all localhost ports:

```bash
aws apigatewayv2 update-api \
  --api-id mss9sa4y01 \
  --region ap-south-1 \
  --cors-configuration file://temp-cors-config.json
```

**Allowed Origins Now Include:**
- `http://localhost:3000`
- `http://localhost:3001`
- `http://localhost:3002`
- `http://localhost:3003` ✅ (Added)
- All production CloudFront URLs
- All production custom domains

### 2. ✅ Lambda ALLOWED_ORIGINS Environment Variable
Updated Lambda function `warmpawz-prod-api-handler`:

```bash
aws lambda update-function-configuration \
  --function-name warmpawz-prod-api-handler \
  --region ap-south-1 \
  --environment file://temp-lambda-env.json
```

**ALLOWED_ORIGINS Now Includes:**
- `http://localhost:3000` ✅ (Added)
- `http://localhost:3001` ✅ (Added)
- `http://localhost:3002` (Already present)
- `http://localhost:3003` ✅ (Added)
- All production origins

### 3. ✅ API Gateway Deployment
Created new deployment to activate CORS changes:

```bash
aws apigatewayv2 create-deployment \
  --api-id mss9sa4y01 \
  --region ap-south-1 \
  --stage-name '$default' \
  --description 'Update CORS configuration for localhost:3003'
```

**Deployment ID:** `gg27nt`

### 4. ✅ Terraform Configuration Updated
Updated infrastructure code to persist the fix:

**File: `infra/envs/prod/main.tf`**
- Updated Lambda `ALLOWED_ORIGINS` to include all localhost ports

**File: `infra/envs/prod/api-gateway-cors.json`**
- Updated to include all localhost ports

## Verification

### OPTIONS Preflight Request
```bash
curl -X OPTIONS \
  -H "Origin: http://localhost:3003" \
  -H "Access-Control-Request-Method: POST" \
  https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/admin/auth/login
```

**Result:** ✅ HTTP 200 OK
**CORS Headers:**
- `access-control-allow-origin: http://localhost:3003` ✅
- `access-control-allow-methods: DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT` ✅
- `access-control-allow-headers: authorization,content-type,x-api-key,...` ✅
- `access-control-allow-credentials: true` ✅

### POST Request
```bash
curl -X POST \
  -H "Origin: http://localhost:3003" \
  -H "Content-Type: application/json" \
  https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/admin/auth/login
```

**Result:** ✅ Includes CORS headers in response

## Current Configuration

### API Gateway CORS Origins
- `http://localhost:3000` ✅
- `http://localhost:3001` ✅
- `http://localhost:3002` ✅
- `http://localhost:3003` ✅
- `https://admin.warmpawz.com`
- `https://vendor.warmpawz.com`
- `https://customer.warmpawz.com`
- `https://www.warmpawz.com`
- `https://dbr09zyoq9akb.cloudfront.net`
- `https://dg69gqp2frh39.cloudfront.net`
- `https://d1y5ywletev82x.cloudfront.net`

### Lambda ALLOWED_ORIGINS
Same as above - all localhost ports and production origins.

## Testing

Use the test script:
```bash
./scripts/test-cors-prod.sh http://localhost:3003
```

## Notes

- ✅ CORS is now fully configured for all localhost ports
- ✅ Changes are persisted in Terraform configuration
- ✅ API Gateway deployment is active
- ✅ Lambda environment variables updated
- ✅ No breaking changes - all existing origins still allowed

## Date Fixed
2026-02-16
