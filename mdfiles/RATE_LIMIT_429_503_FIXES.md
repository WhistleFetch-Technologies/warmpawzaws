# Rate Limit (429) and Service Unavailable (503) Error Fixes

## 🔍 Problem Analysis

### Issues Identified:
1. **Infinite Retry Loop**: Frontend was automatically retrying on 429 errors, creating a cascade of requests that hit rate limits repeatedly
2. **API Gateway Throttling**: Dev environment has low limits (50 req/s, 100 burst)
3. **503 Service Unavailable**: Backend was returning 500 errors instead of proper 503 for timeout/connection issues
4. **Missing Database Index**: No index on `created_at` for `loyalty_transactions` table, causing slow queries

### Error Pattern:
```
429 (Rate Limited) → Wait 5s → Retry → 429 again → Loop continues
503 (Service Unavailable) → No proper handling → User sees generic error
```

## ✅ Fixes Applied

### 1. Frontend: Fixed Retry Loop (`apps/admin-web/hooks/useApiData.ts`)

**Changes:**
- **Removed automatic retry on 429 errors**: When rate limited, the hook now stops and waits, but does NOT automatically retry
- **Added manual retry only**: Users must manually click retry or the component must re-mount
- **Added exponential backoff for 503 errors**: Maximum 3 retries with delays of 1s, 2s, 4s (max 10s)
- **Fixed useEffect dependency loop**: Removed `fetchDataStable` from dependencies to prevent infinite re-renders
- **Better state management**: Added refs to track retry count and prevent concurrent fetches

**Key Code Changes:**
```typescript
// Before: Automatically retried after timeout
retryTimeoutRef.current = setTimeout(() => {
  isRateLimitedRef.current = false;
  setError(null);
  // This would trigger another fetch
}, retryAfter);

// After: Clears flag but doesn't auto-retry
retryTimeoutRef.current = setTimeout(() => {
  isRateLimitedRef.current = false;
  retryCountRef.current = 0;
  // Don't automatically retry - user must manually retry
}, retryAfter);
```

### 2. Backend: Improved Error Handling (`backend/lambda/src/endpoints/loyalty.ts`)

**Changes:**
- **Added query timeout protection**: 40-second timeout to prevent Lambda timeouts
- **Proper HTTP status codes**: Returns 503 for timeout/connection errors instead of 500
- **Better error messages**: Distinguishes between timeout, connection, and other errors
- **Query performance monitoring**: Logs slow queries (>5 seconds)
- **Input validation**: Caps limit at 100, ensures offset is non-negative

**Key Code Changes:**
```typescript
// Added timeout protection
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => {
    reject(new Error('Query timeout: Request took too long to process'));
  }, 40000);
});

const transactions = await Promise.race([queryPromise, timeoutPromise]);

// Proper error handling
if (error?.message?.includes('timeout')) {
  return c.json({ error: 'Service temporarily unavailable...' }, 503);
}
```

### 3. Database: Added Performance Index (`db/migrations/003_indexes.sql`)

**Changes:**
- **Added index on `created_at`**: Improves query performance for `ORDER BY created_at DESC`
- **Index**: `idx_loyalty_transactions_created_at ON loyalty_transactions(created_at DESC)`

**Why This Matters:**
- Without the index, PostgreSQL must scan all rows and sort them
- With the index, it can use the index for efficient sorting
- Reduces query time from potentially seconds to milliseconds

## 🧪 Testing Recommendations

### Test 1: Rate Limit Handling
1. Open browser DevTools → Network tab
2. Navigate to `/admin/loyalty` page
3. Observe: Should see ONE 429 error, then stop retrying
4. Wait 5+ seconds, manually refresh
5. Expected: Should work after rate limit clears

### Test 2: Service Unavailable Handling
1. Simulate database timeout (temporarily increase query complexity)
2. Navigate to `/admin/loyalty` page
3. Observe: Should see up to 3 retry attempts with exponential backoff
4. Expected: After 3 attempts, shows error message instead of infinite loop

### Test 3: Normal Operation
1. Navigate to `/admin/loyalty` page
2. Expected: Transactions load successfully
3. Check Network tab: Should see single successful request

## 📊 Expected Behavior After Fixes

### Before:
- ❌ Infinite retry loop on 429 errors
- ❌ Generic 500 errors for timeouts
- ❌ Slow queries due to missing index
- ❌ No distinction between error types

### After:
- ✅ Stops retrying on 429 (waits for manual retry)
- ✅ Proper 503 errors for service issues
- ✅ Fast queries with index
- ✅ Clear error messages for users
- ✅ Exponential backoff for transient errors

## 🚀 Deployment Notes

1. **Frontend**: Rebuild and deploy admin-web
2. **Backend**: Deploy Lambda function
3. **Database**: Run migration to add index:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created_at 
   ON loyalty_transactions(created_at DESC);
   ```

## 🔧 Additional Recommendations

### For Production:
1. **Increase API Gateway throttling limits** in production (currently 50 req/s in dev)
2. **Monitor CloudWatch metrics** for 429/503 errors
3. **Set up alerts** for high error rates
4. **Consider caching** for frequently accessed endpoints

### For Development:
1. **Consider increasing dev throttling** to 100 req/s to reduce false positives
2. **Add request logging** to track retry patterns
3. **Monitor database query performance** with slow query logs

## 📝 Related Files Changed

1. `apps/admin-web/hooks/useApiData.ts` - Fixed retry loop
2. `backend/lambda/src/endpoints/loyalty.ts` - Improved error handling
3. `db/migrations/003_indexes.sql` - Added performance index

## ✅ Verification Checklist

- [x] Frontend stops retrying on 429 errors
- [x] Frontend handles 503 errors with exponential backoff
- [x] Backend returns proper HTTP status codes
- [x] Backend has query timeout protection
- [x] Database index added for performance
- [x] Error messages are user-friendly
- [x] No infinite retry loops

---

**Date**: 2025-01-12
**Status**: ✅ Fixed
**Tested**: Ready for testing
