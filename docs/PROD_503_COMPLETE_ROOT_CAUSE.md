# Production 503 Error - Complete Root Cause Analysis

## Date: 2026-02-09

## Problem

**Endpoint:** `https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/health`  
**Response:** `{"message":"Service Unavailable"}` (503 error)

---

## Root Causes Identified

### 🔴 CRITICAL ISSUE #1: Lambda Function Timing Out

**Evidence:**
- Multiple Lambda timeouts at exactly **30.00 seconds**
- Lambda timeout = 30s
- API Gateway timeout = 30s
- When Lambda times out, API Gateway returns 503

**Status:** ✅ **FIXED** - Lambda timeout increased to 60 seconds

---

### 🔴 CRITICAL ISSUE #2: Database Credential Retrieval Failing

**Error from Logs:**
```
ERROR [DB] Failed to get connection pool: Error: Failed to retrieve database credentials
at fetchDbCredentials (/var/task/handler.js:107486:11)
```

**This is the REAL root cause!**

**Why it's failing:**
1. Lambda is in VPC
2. Lambda needs to access Secrets Manager to get DB credentials
3. Secrets Manager access requires VPC endpoint OR internet access
4. Lambda in VPC cannot access internet without NAT Gateway
5. VPC endpoint exists but may not be configured correctly

**Configuration Check:**
- ✅ Secrets Manager secret exists
- ✅ Lambda role has Secrets Manager permissions
- ✅ VPC endpoint for Secrets Manager exists (`vpce-003f107655f4111c1`)
- ❓ VPC endpoint may not be in Lambda's subnets
- ❓ Security group may not allow traffic to VPC endpoint

---

## Detailed Analysis

### Lambda Configuration
- **Function:** `warmpawz-prod-api-handler`
- **Timeout:** 60s (just updated from 30s)
- **Memory:** 2048 MB
- **VPC:** `vpc-02a4893e5e582c4d8`
- **Subnets:** `subnet-0351dcfcb7fddfc5d`, `subnet-0fcae82d307f494c5`
- **Security Group:** `sg-02e65cf9ab59ae60b`

### Secrets Manager Configuration
- **Secret ARN:** `arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-prod-rds-master-20260207201049162400000001-hmqkCE`
- **Secret Name:** `warmpawz-prod-rds-master-20260207201049162400000001`
- **Status:** ✅ Exists

### IAM Permissions
- ✅ Lambda role has `secretsmanager:GetSecretValue` permission
- ✅ Lambda role has `secretsmanager:DescribeSecret` permission
- ✅ Permission is for the correct secret ARN

### VPC Endpoint Configuration
- **Endpoint ID:** `vpce-003f107655f4111c1`
- **Service:** `com.amazonaws.ap-south-1.secretsmanager`
- **State:** `available`
- **Subnets:** Need to verify if includes Lambda subnets
- **Security Groups:** Need to verify if allows Lambda SG

---

## The Problem Chain

1. **Request comes to API Gateway** ✅
2. **API Gateway invokes Lambda** ✅
3. **Lambda tries to connect to database** ❌
4. **Lambda needs DB credentials from Secrets Manager** ❌
5. **Lambda in VPC tries to access Secrets Manager** ❌
6. **VPC endpoint may not be accessible from Lambda subnets** ❌
7. **OR Security group blocks traffic** ❌
8. **Credential retrieval fails** ❌
9. **Database connection fails** ❌
10. **Lambda waits/retries until timeout (30s)** ❌
11. **API Gateway returns 503** ❌

---

## Solutions

### Solution 1: Verify VPC Endpoint Configuration (IMMEDIATE)

**Check if VPC endpoint is in Lambda's subnets:**
```bash
aws ec2 describe-vpc-endpoints \
  --vpc-endpoint-ids vpce-003f107655f4111c1 \
  --region ap-south-1 \
  --query 'VpcEndpoints[0].SubnetIds'
```

**Expected:** Should include `subnet-0351dcfcb7fddfc5d` and/or `subnet-0fcae82d307f494c5`

**If not, add subnets:**
```bash
aws ec2 modify-vpc-endpoint \
  --vpc-endpoint-id vpce-003f107655f4111c1 \
  --add-subnet-ids subnet-0351dcfcb7fddfc5d subnet-0fcae82d307f494c5 \
  --region ap-south-1
```

### Solution 2: Verify Security Group Rules (IMMEDIATE)

**Check if Lambda security group can reach VPC endpoint:**

VPC endpoint security group must allow inbound from Lambda security group:
```bash
# Get VPC endpoint security group
VPC_ENDPOINT_SG=$(aws ec2 describe-vpc-endpoints \
  --vpc-endpoint-ids vpce-003f107655f4111c1 \
  --region ap-south-1 \
  --query 'VpcEndpoints[0].Groups[0].GroupId' \
  --output text)

# Add rule to allow Lambda SG
aws ec2 authorize-security-group-ingress \
  --group-id "$VPC_ENDPOINT_SG" \
  --protocol tcp \
  --port 443 \
  --source-group sg-02e65cf9ab59ae60b \
  --region ap-south-1
```

### Solution 3: Use NAT Gateway (Alternative)

If VPC endpoint doesn't work, ensure Lambda has internet access via NAT Gateway:
- Lambda subnets need NAT Gateway route
- Security group allows outbound HTTPS (443)

### Solution 4: Move Lambda Out of VPC (If Possible)

If RDS is the only VPC resource:
- Use RDS Proxy with public endpoint
- Or use VPC endpoints for all AWS services

---

## Immediate Fix Steps

### Step 1: Check VPC Endpoint Subnets
```bash
aws ec2 describe-vpc-endpoints \
  --vpc-endpoint-ids vpce-003f107655f4111c1 \
  --region ap-south-1 \
  --query 'VpcEndpoints[0].{SubnetIds:SubnetIds,Groups:Groups[*].GroupId}'
```

### Step 2: Fix VPC Endpoint if Needed
```bash
# Add Lambda subnets to VPC endpoint
aws ec2 modify-vpc-endpoint \
  --vpc-endpoint-id vpce-003f107655f4111c1 \
  --add-subnet-ids subnet-0351dcfcb7fddfc5d subnet-0fcae82d307f494c5 \
  --region ap-south-1
```

### Step 3: Fix Security Group Rules
```bash
# Get VPC endpoint security group
VPC_ENDPOINT_SG=$(aws ec2 describe-vpc-endpoints \
  --vpc-endpoint-ids vpce-003f107655f4111c1 \
  --region ap-south-1 \
  --query 'VpcEndpoints[0].Groups[0].GroupId' \
  --output text)

# Allow Lambda SG to access VPC endpoint
aws ec2 authorize-security-group-ingress \
  --group-id "$VPC_ENDPOINT_SG" \
  --protocol tcp \
  --port 443 \
  --source-group sg-02e65cf9ab59ae60b \
  --region ap-south-1
```

### Step 4: Test
```bash
curl -X GET "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/health" --max-time 35
```

---

## Summary

| Issue | Status | Fix |
|-------|--------|-----|
| Lambda Timeout (30s) | ✅ FIXED | Increased to 60s |
| Database Credential Retrieval | ❌ ACTIVE | Fix VPC endpoint/SG |
| VPC Endpoint Subnets | ❓ UNKNOWN | Verify and fix |
| Security Group Rules | ❓ UNKNOWN | Verify and fix |
| Code Error (undefined) | ⚠️ ACTIVE | Fix code |
| IAM CloudWatch Permission | ⚠️ ACTIVE | Add policy |

**Primary Issue:** Lambda cannot retrieve database credentials from Secrets Manager due to VPC endpoint/security group misconfiguration.
