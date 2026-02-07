# Database Connection Timeout Investigation

## Issue Summary
The production Lambda function is unable to connect to the dev RDS cluster. The connection hangs during pool initialization, causing Lambda timeouts (30s, now increased to 60s).

**Health Check Response:**
```json
{
  "status": "degraded",
  "timestamp": "2026-02-07T12:38:27.126Z",
  "apiGateway": "mss9sa4y01.execute-api.ap-south-1.amazonaws.com",
  "database": {
    "connected": false,
    "error": "Database health check timeout"
  },
  "environment": {
    "valid": true
  }
}
```

## Infrastructure Verification ✅

### RDS Cluster Status
- **Cluster ID:** `warmpawz-dev-cluster`
- **Status:** `available`
- **Endpoint:** `warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com`
- **Port:** `5432`
- **Database:** `warmpawz`
- **VPC:** `vpc-02a4893e5e582c4d8`
- **Security Groups:** 
  - `sg-0f873d37e561cdfb0` (primary)
  - `sg-0302d683ba28a4e7e` (secondary)

### Lambda Configuration
- **Function Name:** `warmpawz-prod-api-handler`
- **VPC:** `vpc-02a4893e5e582c4d8` ✅ (same as RDS)
- **Subnets:**
  - `subnet-0351dcfcb7fddfc5d` (ap-south-1b)
  - `subnet-0fcae82d307f494c5` (ap-south-1a)
- **Security Group:** `sg-02e65cf9ab59ae60b`
- **Timeout:** 60 seconds (increased from 30s)
- **Memory:** 2048 MB

### Security Group Rules ✅

**RDS Security Group (`sg-0f873d37e561cdfb0`) Ingress:**
- ✅ Allows `sg-02e65cf9ab59ae60b` (prod Lambda SG) on port 5432
- ✅ Allows `0.0.0.0/0` on port 5432 (open rule)
- ✅ Allows other dev security groups

**Lambda Security Group (`sg-02e65cf9ab59ae60b`) Egress:**
- ✅ Allows all outbound traffic (`0.0.0.0/0`)

### Network Configuration
- **Route Tables:** Lambda subnets have route tables with NAT gateway
- **VPC Endpoints:** Secrets Manager VPC endpoint exists (`vpce-003f107655f4111c1`)
- **DNS:** Enabled for VPC
- **Network Interfaces:** Lambda has 2 ENIs in the subnets:
  - `eni-02a8dbd73e9ba95f5` (10.0.11.207) in `subnet-0fcae82d307f494c5`
  - `eni-0457ff2237dd9df0d` (10.0.12.87) in `subnet-0351dcfcb7fddfc5d`

### Environment Variables ✅
- `DB_HOST`: `warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com`
- `DB_PORT`: `5432`
- `DB_NAME`: `warmpawz`
- `DB_SECRET_ARN`: `arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI`

## Root Cause Analysis

### Connection Flow
1. Lambda receives request → calls `checkDbHealth()`
2. `checkDbHealth()` → calls `getRdsPool()`
3. `getRdsPool()` → calls `fetchDbCredentials()` (Secrets Manager) ✅ Works
4. `getRdsPool()` → creates `new Pool()` with connection config
5. **HANGING HERE:** Initial connection test `pool.query('SELECT 1 as test')` hangs

### Possible Causes

#### 1. DNS Resolution Issue
- The RDS endpoint DNS might not be resolving from Lambda's network
- DNS resolution might be hanging (not failing)
- **pg library's `connectionTimeoutMillis` only applies to TCP connection, not DNS resolution**

#### 2. TCP Connection Blocking
- Connection might be blocked by Network ACLs (not security groups)
- Route table might be missing route to RDS subnet
- VPC peering or transit gateway issue (unlikely, same VPC)

#### 3. Connection Pool Library Issue
- `pg` library's `connectionTimeoutMillis: 10000` might not be working as expected
- Connection might be hanging before timeout is applied

#### 4. Cold Start / ENI Issue
- Lambda ENI might not be fully ready
- First connection attempt might need more time

## Code Changes Applied

### 1. Increased Lambda Timeout
- Changed from 30s to 60s to allow more time for connection

### 2. Added Timeout to Initial Connection Test
```typescript
// Before: Blocking connection test
const testResult = await pool.query('SELECT 1 as test');

// After: Timeout-wrapped connection test
const testQuery = pool.query('SELECT 1 as test');
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error('Initial connection test timeout')), 8000);
});
const testResult = await Promise.race([testQuery, timeoutPromise]);
```

### 3. Health Check Already Has Timeout
- Health check endpoint has 5-second timeout
- `checkDbHealth()` has 5-second timeout

## Next Steps to Resolve

### Option 1: Test DNS Resolution from Lambda
Create a test Lambda function to verify DNS resolution:
```javascript
const dns = require('dns').promises;
const hostname = 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com';
const addresses = await dns.resolve4(hostname);
console.log('Resolved addresses:', addresses);
```

### Option 2: Check Network ACLs
Verify Network ACLs allow traffic between Lambda and RDS subnets:
```bash
aws ec2 describe-network-acls --filters "Name=vpc-id,Values=vpc-02a4893e5e582c4d8" --region ap-south-1
```

### Option 3: Test Direct Connection
Use AWS Systems Manager Session Manager to test connection from an EC2 instance in the same VPC:
```bash
# From EC2 in same VPC
psql -h warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com -U warmpawz_admin -d warmpawz
```

### Option 4: Use RDS Proxy
Consider using RDS Proxy to handle connection pooling and reduce connection issues:
- RDS Proxy handles connection pooling
- Better for Lambda functions
- Reduces connection overhead

### Option 5: Increase Connection Timeout and Add Retry Logic
```typescript
pool = new Pool({
  // ... existing config
  connectionTimeoutMillis: 30000, // Increase to 30s
  // Add retry logic
});
```

### Option 6: Check CloudWatch Logs for Detailed Errors
Monitor Lambda logs for specific error messages:
```bash
aws logs tail /aws/lambda/warmpawz-prod-api-handler --region ap-south-1 --since 10m --format short
```

## Current Status
- ✅ Infrastructure configured correctly
- ✅ Security groups allow traffic
- ✅ Environment variables set correctly
- ✅ Secrets Manager accessible
- ✅ **DNS Resolution: WORKING** - Resolved to `10.0.22.117` in 4-5ms
- ❌ **Database TCP Connection: FAILING** - Connection timeout after 10s

## Diagnostic Results (2026-02-07)

### Test Results from `/health/diagnostic` Endpoint:

1. **DNS Resolution Test: ✅ SUCCESS**
   - Hostname: `warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com`
   - Resolved to: `10.0.22.117`
   - Duration: 4-5ms
   - **Conclusion:** DNS resolution is working perfectly. The issue is NOT DNS.

2. **Database Connection Test: ❌ FAILED**
   - Error: "Database health check timeout after 10s"
   - **Conclusion:** TCP connection to RDS is failing or timing out.

3. **Secrets Manager: ✅ CONFIGURED**
   - Secret ARN configured correctly
   - Credentials accessible

### Root Cause Analysis Update:

**DNS is NOT the issue.** The problem is with the TCP connection itself. Possible causes:

1. **Network ACLs** - May be blocking traffic between Lambda subnets and RDS subnet
2. **Route Tables** - Lambda subnets may not have routes to RDS subnet
3. **RDS Security Group** - May need to verify the rule is actually active
4. **RDS Instance** - May not be accepting connections (check RDS status)

## 🔍 CRITICAL FINDING: RDS Proxy Configuration Issue (2026-02-07)

### Investigation Results:

1. **RDS Proxy Exists:**
   - Proxy Name: `proxy-1767869261853-warmpawz-dev-cluster`
   - Proxy Endpoint: `proxy-1767869261853-warmpawz-dev-cluster.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com`
   - Proxy Security Group: `sg-059dd98bea81c8120` (rdsproxy-lambda-1)
   - Status: Available

2. **Security Group Configuration:**
   - **RDS Security Group** (`sg-0f873d37e561cdfb0`): ✅ Allows prod Lambda SG (`sg-02e65cf9ab59ae60b`)
   - **RDS Proxy Security Group** (`sg-059dd98bea81c8120`): ❌ **ONLY allows dev Lambda SG (`sg-016a5f2d0ccaf638e`), NOT prod Lambda SG**

3. **Lambda Configuration:**
   - **Dev Lambda**: Uses direct RDS endpoint, but shows as "Connected compute resource" (likely through proxy)
   - **Prod Lambda**: Uses direct RDS endpoint, NOT showing in "Connected compute resources"
   - Both Lambdas use same endpoint: `warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com`

4. **Network Configuration:**
   - ✅ Network ACLs: Default ACL (allows all traffic)
   - ✅ Route Tables: Local route (10.0.0.0/16) exists for VPC internal traffic
   - ✅ Both Lambdas in same VPC: `vpc-02a4893e5e582c4d8`

### Root Cause Identified:

**The prod Lambda security group (`sg-02e65cf9ab59ae60b`) is NOT allowed in the RDS Proxy security group.** 

While the RDS security group allows direct connection, the RDS cluster appears to be configured to work primarily through the RDS Proxy. The dev Lambda is connected through the proxy (showing in "Connected compute resources"), but prod Lambda cannot connect because:
- It's not allowed in the RDS Proxy security group
- Direct connection to RDS may be blocked or not preferred

### Solution Options:

**Option 1: Add Prod Lambda SG to RDS Proxy Security Group (Recommended)**
```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-059dd98bea81c8120 \
  --protocol tcp \
  --port 5432 \
  --source-group sg-02e65cf9ab59ae60b \
  --region ap-south-1 \
  --description "Allow prod Lambda (warmpawz-prod-api-handler) to connect to RDS Proxy"
```

**Option 2: Use RDS Proxy Endpoint for Prod Lambda**
- Update prod Lambda environment variable `DB_HOST` to use proxy endpoint:
  - `proxy-1767869261853-warmpawz-dev-cluster.proxy-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com`
- Then add prod Lambda SG to RDS Proxy security group

**Option 3: Fix Direct Connection Path**
- Verify RDS cluster accepts direct connections (not just through proxy)
- Ensure route tables allow traffic from Lambda subnets to RDS subnet

## Recommended Next Steps

1. ✅ **DNS Resolution Test: COMPLETE** - DNS is working
2. ✅ **Root Cause Identified: RDS Proxy Security Group missing prod Lambda SG**
3. ⏳ **Add prod Lambda SG to RDS Proxy security group** (Option 1 - Recommended)
4. ⏳ **Test connection after adding security group rule**
5. ⏳ **Verify prod Lambda appears in "Connected compute resources"**
