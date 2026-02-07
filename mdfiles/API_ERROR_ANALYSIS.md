# API Error Analysis: 500 Errors and Connection Timeouts

## 🔍 Error Summary

The following errors are occurring in the UAT environment:

1. **500 Internal Server Error** on:
   - `GET /admin/catalog/categories`
   - `GET /admin/roles`
   - `GET /service-catalog/categories`

2. **Connection Timeout Errors**:
   - "Connection terminated due to connection timeout"
   - Errors occur during API requests

3. **503 Service Unavailable** on:
   - `/stats` endpoint

## 📊 Root Cause Analysis

### 1. Lambda Timeout Configuration

**Current Settings:**
- **Lambda Timeout**: 30 seconds (`infrastructure/cdk/lib/lambda-stack.ts:72`)
- **API Gateway Timeout**: 60 seconds (`infra/envs/dev/main.tf:284`)
- **Database Connection Timeout**: 10 seconds (`backend/lambda/src/database/rds-connection.ts:115`)

**Problem:**
The Lambda function has a 30-second timeout, but complex queries (especially `/admin/roles` which does multiple queries per role) may exceed this limit, causing the Lambda to terminate before completing the request.

### 2. Database Query Performance

**Issue in `/admin/roles` endpoint:**
```typescript
// backend/lambda/src/endpoints/roles.ts:38-118
const rolesWithFullData = await Promise.all(
  roles.map(async (role) => {
    const permissions = await select('role_permissions', { role_id: role.id });
    // ... additional processing
  })
);
```

**Problem:**
- If there are many roles, this creates N+1 query pattern
- Each role triggers additional database queries
- With 20+ roles, this could result in 40+ database queries
- Each query adds latency, potentially exceeding the 30-second timeout

### 3. Database Connection Pool Exhaustion

**Current Pool Settings:**
```typescript
// backend/lambda/src/database/rds-connection.ts:107-117
pool = new Pool({
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
```

**Problem:**
- If multiple concurrent requests hit the same endpoints, the pool may be exhausted
- New requests wait for available connections
- If wait time exceeds connection timeout (10s), requests fail with timeout errors

### 4. VPC Cold Start Latency

**Configuration:**
- Lambda is in a VPC (`lambda-stack.ts:75-82`)
- Uses public subnets
- Requires ENI (Elastic Network Interface) creation on cold start

**Problem:**
- VPC Lambdas have additional cold start latency (1-3 seconds)
- ENI creation can take 5-10 seconds on first invocation
- This reduces available execution time for actual work

## 🔧 Recommended Fixes

### Fix 1: Increase Lambda Timeout

**File**: `infrastructure/cdk/lib/lambda-stack.ts`

```typescript
// Change from 30 seconds to 60 seconds
timeout: cdk.Duration.seconds(60),
```

**Rationale:**
- API Gateway already supports 60 seconds
- Gives more time for complex queries
- Reduces timeout-related 500 errors

### Fix 2: Optimize Roles Query (Batch Loading)

**File**: `backend/lambda/src/endpoints/roles.ts`

**Current (N+1 Problem):**
```typescript
const rolesWithFullData = await Promise.all(
  roles.map(async (role) => {
    const permissions = await select('role_permissions', { role_id: role.id });
    // ...
  })
);
```

**Optimized (Single Query):**
```typescript
// Get all permissions in one query
const allPermissions = await query(`
  SELECT role_id, permission_name 
  FROM role_permissions 
  WHERE role_id = ANY($1)
`, [roles.map(r => r.id)]);

// Group permissions by role_id
const permissionsByRole = new Map<string, string[]>();
allPermissions.rows.forEach(p => {
  if (!permissionsByRole.has(p.role_id)) {
    permissionsByRole.set(p.role_id, []);
  }
  permissionsByRole.get(p.role_id)!.push(p.permission_name);
});

// Map roles with permissions
const rolesWithFullData = roles.map(role => {
  const capabilities = permissionsByRole.get(role.id) || [];
  // ... rest of processing
});
```

**Benefits:**
- Reduces 20+ queries to 2 queries (roles + permissions)
- Significantly faster execution
- Less database connection pool pressure

### Fix 3: Increase Connection Pool Size

**File**: `backend/lambda/src/database/rds-connection.ts`

```typescript
pool = new Pool({
  max: 50, // Increased from 20
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000, // Increased from 10000
});
```

**Rationale:**
- Handles more concurrent requests
- Reduces connection wait time
- Better for high-traffic scenarios

### Fix 4: Add Query Timeout Protection

**File**: `backend/lambda/src/database/rds-connection.ts`

```typescript
export async function query(
  text: string,
  params?: any[]
): Promise<QueryResult<any>> {
  const start = Date.now();
  let pool: Pool;
  
  try {
    pool = await getRdsPool();
  } catch (error) {
    console.error('[DB] Failed to get connection pool:', error);
    throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Add query timeout (25 seconds to leave buffer for Lambda timeout)
  const QUERY_TIMEOUT_MS = 25000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Query timeout exceeded')), QUERY_TIMEOUT_MS);
  });
  
  try {
    const queryPromise = pool.query<any>(text, params);
    const result = await Promise.race([queryPromise, timeoutPromise]);
    
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[DB] Slow query (${duration}ms): ${text.substring(0, 100)}`);
    }
    
    return result;
  } catch (error: any) {
    const duration = Date.now() - start;
    console.error('[DB] Query error after', duration, 'ms:', error?.message || error);
    
    if (error?.message === 'Query timeout exceeded') {
      throw new Error(`Query exceeded ${QUERY_TIMEOUT_MS}ms timeout. Consider optimizing the query.`);
    }
    
    // ... rest of error handling
  }
}
```

### Fix 5: Add Retry Logic with Exponential Backoff

**File**: `backend/lambda/src/endpoints/roles.ts` (and other endpoints)

```typescript
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on non-retryable errors
      if (error?.code === 'ETIMEDOUT' && attempt < maxRetries - 1) {
        const backoffDelay = delayMs * Math.pow(2, attempt);
        console.warn(`[Retry] Attempt ${attempt + 1} failed, retrying in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError!;
}
```

### Fix 6: Add Response Caching for Frequently Accessed Data

**File**: `backend/lambda/src/endpoints/roles.ts`

```typescript
// Simple in-memory cache (for Lambda, consider Redis for production)
const rolesCache = {
  data: null as any,
  timestamp: 0,
  TTL: 60000, // 1 minute
};

app.get('/admin/roles', async (c) => {
  const now = Date.now();
  
  // Return cached data if still valid
  if (rolesCache.data && (now - rolesCache.timestamp) < rolesCache.TTL) {
    return c.json(rolesCache.data);
  }
  
  // Fetch fresh data
  const handler = new GetRolesHandler();
  const event = createApiGatewayEvent(c.req);
  const context = createLambdaContext();
  const result = await handler.execute(event, context);
  
  // Update cache
  rolesCache.data = JSON.parse(result.body);
  rolesCache.timestamp = now;
  
  return c.json(rolesCache.data, result.statusCode);
});
```

## 🚨 Immediate Actions

### 1. Check CloudWatch Logs

```bash
# Check recent Lambda errors
aws logs tail /aws/lambda/warmpawz-api-uat --follow --filter-pattern "ERROR"

# Check for timeout errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/warmpawz-api-uat \
  --filter-pattern "timeout" \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

### 2. Check RDS Performance

```bash
# Check RDS instance status
aws rds describe-db-instances \
  --db-instance-identifier warmpawz-uat \
  --query 'DBInstances[0].[DBInstanceStatus,DBInstanceClass,EngineVersion]'

# Check connection count (if using RDS Proxy)
aws rds describe-db-proxies \
  --db-proxy-name warmpawz-proxy-uat \
  --query 'DBProxies[0].Status'
```

### 3. Monitor Database Query Performance

Add logging to identify slow queries:

```typescript
// In rds-connection.ts query function
if (duration > 2000) { // Log queries taking > 2 seconds
  console.error(`[DB] SLOW QUERY (${duration}ms):`, {
    query: text.substring(0, 200),
    params: params?.slice(0, 5), // First 5 params only
    duration,
  });
}
```

## 📈 Performance Metrics to Monitor

1. **Lambda Duration**: Should be < 10 seconds for most requests
2. **Database Query Time**: Should be < 1 second for simple queries
3. **Connection Pool Utilization**: Should be < 80%
4. **Error Rate**: Should be < 1% of total requests
5. **Timeout Rate**: Should be 0%

## 🔄 Deployment Priority

1. **High Priority** (Deploy immediately):
   - Fix 1: Increase Lambda timeout to 60s
   - Fix 2: Optimize roles query (batch loading)

2. **Medium Priority** (Deploy this week):
   - Fix 3: Increase connection pool size
   - Fix 4: Add query timeout protection

3. **Low Priority** (Nice to have):
   - Fix 5: Add retry logic
   - Fix 6: Add response caching

## 📝 Testing After Fixes

1. **Load Test**:
   ```bash
   # Test with concurrent requests
   for i in {1..10}; do
     curl -s "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/roles" &
   done
   wait
   ```

2. **Monitor Metrics**:
   - Check CloudWatch for reduced error rates
   - Verify Lambda duration is within limits
   - Confirm no timeout errors

3. **Verify Endpoints**:
   - `/admin/roles` - Should respond in < 2 seconds
   - `/admin/catalog/categories` - Should respond in < 1 second
   - `/service-catalog/categories` - Should respond in < 1 second

## 🎯 Expected Outcomes

After implementing these fixes:

- ✅ **500 errors reduced by 90%+**
- ✅ **Connection timeout errors eliminated**
- ✅ **Average response time < 2 seconds**
- ✅ **99.9% request success rate**
- ✅ **Better handling of concurrent requests**

## 📚 Additional Resources

- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [RDS Connection Pooling](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html#CHAP_BestPractices.ConnectionPooling)
- [PostgreSQL Query Optimization](https://www.postgresql.org/docs/current/performance-tips.html)
