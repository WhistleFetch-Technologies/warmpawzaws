# CORS Fix Summary

## Root Cause Analysis

**Problem:** CORS errors blocking requests from Admin CloudFront distribution
```
Access to fetch at 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/analytics/categories?period=7d' 
from origin 'https://d3ksurrsmyzszq.cloudfront.net' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Root Cause:**
- The Lambda handler had **OLD CloudFront domains** in its CORS allowed origins:
  - Admin: `dfof7mguaa0a5.cloudfront.net` (OLD)
  - Vendor: `d1s6ykkj381k58.cloudfront.net` (OLD)
  - Customer: `d2aoyjj8ine0wk.cloudfront.net` (OLD)

- But the **ACTIVE CloudFront domains** are:
  - Admin: `d3ksurrsmyzszq.cloudfront.net` (ACTIVE) ⚠️ **MISSING**
  - Vendor: `d20mk9l733hbwo.cloudfront.net` (ACTIVE) ⚠️ **MISSING**
  - Customer: `d1myri3b4uq26g.cloudfront.net` (ACTIVE) ⚠️ **MISSING**

- Requests from the active CloudFront domain were being rejected because it wasn't in the allowed origins list.

## Fix Applied

### 1. Lambda Handler CORS Configuration (3 locations updated)

**File:** `backend/lambda/src/handler/index.ts`

**Updated locations:**
1. **CORS Middleware Configuration** (line ~134)
2. **OPTIONS Preflight Handler** (line ~350)
3. **Response CORS Headers** (line ~455)

**Changes:**
- ✅ Added ACTIVE CloudFront domains to the top of the allowed origins list
- ✅ Kept LEGACY CloudFront domains for backward compatibility
- ✅ All three locations now use the same updated list

**New allowed origins:**
```typescript
const allowedOrigins = [
  // ACTIVE - Current deployment
  'https://d3ksurrsmyzszq.cloudfront.net',      // Admin (ACTIVE)
  'https://d20mk9l733hbwo.cloudfront.net',       // Vendor (ACTIVE)
  'https://d1myri3b4uq26g.cloudfront.net',      // Customer (ACTIVE)
  
  // LEGACY - Backward compatibility
  'https://dfof7mguaa0a5.cloudfront.net',       // Admin (LEGACY)
  'https://d1s6ykkj381k58.cloudfront.net',       // Vendor (LEGACY)
  'https://d2aoyjj8ine0wk.cloudfront.net',      // Customer (LEGACY)
  
  // ... localhost and custom domains ...
];
```

### 2. Terraform CORS Configuration

**File:** `infra/envs/dev/main.tf`

**Updated:** `cors_allowed_origins` local variable (line ~76)

**Changes:**
- ✅ Added ACTIVE CloudFront domains
- ✅ Kept LEGACY CloudFront domains for backward compatibility
- ✅ Added comments to distinguish ACTIVE vs LEGACY domains

**Note:** Since the API Gateway is immutable (`existing_api_gateway_id = "z0b3obweb6"`), Terraform cannot modify its CORS configuration directly. However, the Lambda handler now properly handles CORS for all requests, including preflight OPTIONS requests.

## Why This Fix is Safe

1. **Backward Compatible:** 
   - Old CloudFront domains are still in the list
   - Existing deployments won't break

2. **No Breaking Changes:**
   - Only ADDED new domains, didn't remove any
   - All existing functionality preserved

3. **Lambda Handles CORS:**
   - Lambda handler processes OPTIONS requests before API Gateway
   - CORS headers are added to all responses
   - No dependency on API Gateway CORS configuration

4. **Tested Pattern:**
   - Same CORS handling pattern already working for other domains
   - Just extended to include new CloudFront domains

## Deployment Steps

1. **Build Lambda:**
   ```bash
   cd backend/lambda
   npm run build
   ```

2. **Deploy Lambda:**
   ```bash
   # Deploy using your standard deployment process
   # The Lambda handler will now include the new CloudFront domains
   ```

3. **Verify CORS:**
   - Test requests from `https://d3ksurrsmyzszq.cloudfront.net`
   - Check browser console for CORS errors
   - Verify OPTIONS preflight requests return 204 with proper headers

## Testing Checklist

- [ ] Admin analytics endpoints work from CloudFront
- [ ] Vendor endpoints work from CloudFront
- [ ] Customer endpoints work from CloudFront
- [ ] OPTIONS preflight requests return 204
- [ ] CORS headers present in all responses
- [ ] No 500 errors (previous issue)
- [ ] Legacy CloudFront domains still work

## Files Modified

1. `backend/lambda/src/handler/index.ts` - Updated CORS allowed origins (3 locations)
2. `infra/envs/dev/main.tf` - Updated Terraform CORS configuration

## Next Steps

1. Deploy the updated Lambda handler
2. Test CORS from the active CloudFront domains
3. Monitor for any 500 errors (should not occur with this fix)
4. Consider cleaning up legacy CloudFront distributions if no longer needed

---

**Fix Date:** 2026-01-12  
**Status:** ✅ Ready for deployment  
**Risk Level:** Low (only additions, no removals)
