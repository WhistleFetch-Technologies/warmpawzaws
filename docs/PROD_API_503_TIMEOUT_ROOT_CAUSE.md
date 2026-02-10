# Production API 503 Timeout - Root Cause Analysis

## Date: 2026-02-09

## Problem

**Endpoint:** `https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/health`  
**Response:** `{"message":"Service Unavailable"}` (503 error)

---

## Root Cause Identified

### ✅ PRIMARY ISSUE: Lambda Function Timing Out

**Evidence from CloudWatch Logs:**
```
REPORT RequestId: 9e91b212-5df4-4505-8f61-b82fb9d3aa75
Duration: 30000.00 ms
Billed Duration: 30000 ms
Memory Size: 2048 MB
Max Memory Used: 165 MB
Status: timeout
```

**Multiple timeouts observed:**
- RequestId: 9e91b212-5df4-4505-8f61-b82fb9d3aa75 - **30.00s timeout**
- RequestId: 065cc348-9a3b-429f-a055-e1e4224b838c - **30.00s timeout**
- RequestId: 0d003e49-522c-4bcb-b473-c72fb675d80e - **30.00s timeout**
- RequestId: e6332841-cebb-4ae7-b3a2-88704d39dbf9 - **30.00s timeout**
- RequestId: 28fb6fd3-99ef-4de5-bcf2-983f465702c0 - **30.00s timeout**

**Error Rate:**
- **204 errors** in one 5-minute period
- **51 errors** in another period
- **31 errors** in multiple periods

---

## Configuration Analysis

### Lambda Configuration
- **Timeout:** 30 seconds
- **Memory:** 2048 MB
- **State:** Active
- **VPC:** Configured (vpc-02a4893e5e582c4d8)

### API Gateway Configuration
- **Integration Timeout:** 30 seconds (30000ms)
- **Type:** AWS_PROXY
- **Status:** Active

### The Problem
1. **Lambda timeout = 30s** (exactly)
2. **API Gateway timeout = 30s** (exactly)
3. **When Lambda hits 30s, it times out**
4. **API Gateway returns 503 "Service Unavailable"**

---

## Secondary Issues Found

### 1. Code Errors (Not causing 503, but present)
```
TypeError: Cannot read properties of undefined (reading 'entries')
at createApiGatewayEvent28 (/var/task/handler.js:200454:45)
```

**Affected endpoints:**
- `/admin/tax-categories`
- `/admin/hsn-codes`

### 2. IAM Permission Issue
```
AccessDenied: User is not authorized to perform: cloudwatch:PutMetricData
```

**Impact:** Lambda cannot publish CloudWatch metrics (non-critical, but should be fixed)

### 3. Throttling (Minor)
- 11 throttles in one 5-minute period
- Not the main issue, but indicates concurrency pressure

---

## Why Lambda is Timing Out

### Likely Causes (in order of probability):

1. **VPC Cold Start + Database Connection**
   - VPC cold start: 5-10 seconds
   - Database connection: 2-5 seconds
   - Handler execution: 1-2 seconds
   - **Total: 8-17 seconds** (should work, but...)

2. **Database Connection Pool Exhaustion**
   - If connection pool is exhausted, new connections wait
   - Can cause timeouts

3. **Database Query Timeout**
   - Health check queries database
   - If database is slow/unresponsive, query times out

4. **VPC ENI (Elastic Network Interface) Creation**
   - First request after inactivity creates ENI
   - Can take 10-15 seconds in VPC

5. **No Provisioned Concurrency**
   - Every idle period = cold start
   - Cold starts in VPC are slow

---

## Solutions (Priority Order)

### Solution 1: Increase Lambda Timeout (IMMEDIATE FIX)

**Current:** 30 seconds  
**Recommended:** 60 seconds

**Why:** Gives Lambda buffer for VPC cold starts and database connections

**Command:**
```bash
aws lambda update-function-configuration \
  --function-name warmpawz-prod-api-handler \
  --timeout 60 \
  --region ap-south-1
```

**Note:** API Gateway still has 30s limit, but this prevents Lambda from timing out before API Gateway does.

### Solution 2: Enable Provisioned Concurrency (RECOMMENDED)

**Purpose:** Eliminate cold starts

**Command:**
```bash
aws lambda put-provisioned-concurrency-config \
  --function-name warmpawz-prod-api-handler \
  --qualifier '$LATEST' \
  --provisioned-concurrent-executions 2 \
  --region ap-south-1
```

**Benefits:**
- Eliminates VPC cold starts
- Instant response times
- Better user experience

### Solution 3: Fix Code Error (HIGH PRIORITY)

**Error:** `Cannot read properties of undefined (reading 'entries')` in `createApiGatewayEvent28`

**Location:** `/var/task/handler.js:200454:45`

**Impact:** Affects `/admin/tax-categories` and `/admin/hsn-codes` endpoints

**Action:** Fix the code to handle undefined values properly

### Solution 4: Fix IAM Permissions (MEDIUM PRIORITY)

**Issue:** Lambda cannot publish CloudWatch metrics

**Fix:** Add `cloudwatch:PutMetricData` permission to Lambda execution role

**Command:**
```bash
# Get role name
ROLE_NAME=$(aws lambda get-function --function-name warmpawz-prod-api-handler --region ap-south-1 --query 'Configuration.Role' --output text | grep -oP 'role/\K[^/]+')

# Attach CloudWatch policy
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchFullAccess \
  --region ap-south-1
```

### Solution 5: Optimize Database Connection (LOW PRIORITY)

- Use RDS Proxy (already configured ✅)
- Implement connection pooling (already done ✅)
- Add connection timeout (already done ✅)
- Consider moving out of VPC if possible

---

## Immediate Action Plan

### Step 1: Increase Lambda Timeout (Do This First)
```bash
aws lambda update-function-configuration \
  --function-name warmpawz-prod-api-handler \
  --timeout 60 \
  --region ap-south-1
```

### Step 2: Test Health Endpoint
```bash
curl -X GET "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/health" --max-time 35
```

### Step 3: Enable Provisioned Concurrency
```bash
aws lambda put-provisioned-concurrency-config \
  --function-name warmpawz-prod-api-handler \
  --qualifier '$LATEST' \
  --provisioned-concurrent-executions 2 \
  --region ap-south-1
```

### Step 4: Monitor
```bash
# Watch logs
aws logs tail /aws/lambda/warmpawz-prod-api-handler --follow --region ap-south-1

# Check metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=warmpawz-prod-api-handler \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Maximum,Average \
  --region ap-south-1
```

---

## Summary

| Issue | Severity | Status | Fix |
|-------|----------|--------|-----|
| Lambda Timeout (30s) | 🔴 CRITICAL | Active | Increase to 60s |
| No Provisioned Concurrency | 🔴 CRITICAL | Active | Enable 2 instances |
| Code Error (undefined entries) | 🟡 HIGH | Active | Fix code |
| IAM Permission (CloudWatch) | 🟡 MEDIUM | Active | Add policy |
| Throttling | 🟢 LOW | Minor | Monitor |

**Primary Fix:** Increase Lambda timeout to 60 seconds + Enable provisioned concurrency
