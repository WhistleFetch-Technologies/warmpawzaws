# Production 503 Service Unavailable - Root Cause Analysis

## Date: 2026-02-09

## Error
```
GET https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/health
Response: {"message":"Service Unavailable"}
Status: 503
```

---

## 🔴 CRITICAL FINDINGS

### Issue 1: MASSIVE INVOCATION SPIKE ⚠️⚠️⚠️

**Metrics (Last 30 minutes):**
- **28,751 invocations** in a 5-minute period (14:58)
- **17,611 invocations** in another 5-minute period (14:48)
- **24,351 invocations** in another 5-minute period (14:53)

**This is causing:**
- All concurrent executions to be consumed
- New requests being throttled
- 503 Service Unavailable responses

### Issue 2: CONCURRENT EXECUTIONS HITTING LIMIT

**Metrics:**
- Maximum concurrent executions: **100** (hitting the reserved concurrency limit)
- Reserved concurrency: **100** (from Terraform config)
- **Status:** All 100 slots are occupied, new requests are throttled

### Issue 3: LAMBDA TIMEOUTS

**Multiple timeouts detected:**
- Duration: **30,000 ms** (exactly at timeout limit)
- Status: `timeout`
- Multiple requests timing out simultaneously

### Issue 4: CODE BUG - TypeError

**Error:**
```
TypeError: Cannot read properties of undefined (reading 'entries')
at createApiGatewayEvent28 (/var/task/handler.js:200454:45)
```

**Affected endpoints:**
- `/admin/hsn-codes`
- `/admin/tax-categories`
- Multiple other admin endpoints

**Root cause:** `req.headers.entries()` is being called when `req.headers` is undefined or not a Headers object.

### Issue 5: IAM PERMISSION MISSING

**Error:**
```
AccessDenied: User: arn:aws:sts::057442119249:assumed-role/warmpawz-prod-lambda-20260207112636730400000002/warmpawz-prod-api-handler 
is not authorized to perform: cloudwatch:PutMetricData
```

Lambda role doesn't have permission to publish CloudWatch metrics.

---

## Root Cause Summary

**Primary Issue:** **Concurrent execution exhaustion**
- Massive invocation spike (28k+ requests in 5 minutes)
- All 100 reserved concurrent executions are occupied
- New requests are throttled → 503 Service Unavailable

**Secondary Issues:**
1. Code bug causing errors (TypeError with headers.entries)
2. Lambda timeouts (30s limit being hit)
3. Missing IAM permissions for CloudWatch

---

## Immediate Actions Required

### Action 1: Investigate Invocation Spike

**Check what's causing 28k+ invocations:**
```bash
# Check recent invocations by endpoint
aws logs filter-log-events \
  --log-group-name /aws/lambda/warmpawz-prod-api-handler \
  --start-time $(date -u -d '10 minutes ago' +%s)000 \
  --region ap-south-1 \
  --max-items 100 \
  --query 'events[*].message' \
  --output text | grep -oP 'path":"[^"]+' | sort | uniq -c | sort -rn
```

**Possible causes:**
- Infinite retry loop
- Health check endpoint being called excessively
- Bot/crawler hitting the API
- Frontend making too many requests

### Action 2: Increase Reserved Concurrency (Temporary)

**Current:** 100  
**Recommended:** 200-500 (depending on traffic)

```bash
aws lambda put-function-concurrency \
  --function-name warmpawz-prod-api-handler \
  --reserved-concurrent-executions 200 \
  --region ap-south-1
```

**Warning:** This is a temporary fix. Need to find root cause of invocation spike.

### Action 3: Fix Code Bug

**File:** Multiple files with `createApiGatewayEvent` function

**Issue:** Calling `req.headers.entries()` when headers might be undefined

**Fix:** Add null check before calling `.entries()`

### Action 4: Add CloudWatch Permissions

**Add to Lambda role:**
```json
{
  "Effect": "Allow",
  "Action": [
    "cloudwatch:PutMetricData"
  ],
  "Resource": "*"
}
```

---

## Detailed Analysis

### Invocation Pattern

| Time Period | Invocations | Concurrent Executions |
|-------------|-------------|----------------------|
| 14:33-14:38 | 26 | 9 |
| 14:38-14:43 | 27 | 9 |
| 14:43-14:48 | 25 | 6 |
| 14:48-14:53 | **17,611** | **40** |
| 14:53-14:58 | **24,351** | **17** |
| 14:58-15:03 | **28,751** | **100** |

**Analysis:**
- Normal traffic: ~25-30 invocations per 5 minutes
- Spike started at 14:48
- Peak at 14:58 with 28,751 invocations
- Concurrent executions maxed out at 100

### Error Pattern

**TypeError occurrences:**
- Multiple endpoints affected
- All related to `createApiGatewayEvent` function
- Error: `Cannot read properties of undefined (reading 'entries')`

**Timeout occurrences:**
- Multiple requests timing out at exactly 30 seconds
- Suggests database queries or external API calls are slow
- VPC cold starts may contribute

---

## Solutions

### Solution 1: Fix Code Bug (CRITICAL)

**Files to fix:**
- `backend/lambda/src/endpoints/admin-comprehensive.ts`
- `backend/lambda/src/endpoints/location-sharing.ts`
- `backend/lambda/src/endpoints/vendor-security.ts`
- Any other files with `createApiGatewayEvent` that uses `.entries()`

**Fix pattern:**
```typescript
function createApiGatewayEvent(req: any): any {
  const headers: Record<string, string> = {};
  
  // ✅ FIX: Check if headers exists and has entries method
  if (req.headers) {
    if (req.headers.entries && typeof req.headers.entries === 'function') {
      try {
        Object.assign(headers, Object.fromEntries(req.headers.entries()));
      } catch (e) {
        // Fallback to Object.keys
        Object.keys(req.headers).forEach(key => {
          headers[key] = req.headers[key];
        });
      }
    } else {
      // Headers is already an object
      Object.keys(req.headers).forEach(key => {
        headers[key] = req.headers[key];
      });
    }
  }
  
  return {
    httpMethod: req.method,
    path: req.url ? req.url.split('?')[0] : '',
    pathParameters: {},
    queryStringParameters: {},
    headers,
    body: JSON.stringify(req.body || {}),
    isBase64Encoded: false,
  };
}
```

### Solution 2: Increase Reserved Concurrency

**Terraform:** `infra/envs/prod/main.tf` line 223
```hcl
reserved_concurrency = 200  # Increase from 100
```

**Or via AWS CLI:**
```bash
aws lambda put-function-concurrency \
  --function-name warmpawz-prod-api-handler \
  --reserved-concurrent-executions 200 \
  --region ap-south-1
```

### Solution 3: Add Rate Limiting

**Add to API Gateway:**
- Throttle requests per IP
- Limit requests per endpoint
- Add WAF rules to block bot traffic

### Solution 4: Fix IAM Permissions

**Add CloudWatch permissions to Lambda role:**
```bash
aws iam attach-role-policy \
  --role-name warmpawz-prod-lambda-20260207112636730400000002 \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchFullAccess
```

Or create custom policy with only `cloudwatch:PutMetricData`.

---

## Next Steps

1. **IMMEDIATE:** Increase reserved concurrency to 200
2. **URGENT:** Fix code bug in `createApiGatewayEvent` functions
3. **HIGH:** Investigate what's causing 28k+ invocations
4. **MEDIUM:** Add CloudWatch permissions
5. **LOW:** Add rate limiting to API Gateway

---

## Monitoring

**Watch these metrics:**
- Concurrent Executions (should stay below reserved limit)
- Invocations (should be normal ~25-30 per 5 min, not 28k)
- Errors (should decrease after code fix)
- Duration (should be < 10s, not 30s)

**CloudWatch Alarms to set:**
- Concurrent Executions > 90 (80% of 100)
- Invocations > 1000 per 5 minutes
- Errors > 10 per 5 minutes
- Duration > 25 seconds
