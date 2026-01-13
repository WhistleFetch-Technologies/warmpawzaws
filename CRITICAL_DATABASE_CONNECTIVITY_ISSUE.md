# Critical Database Connectivity Issue

**Date:** 2026-01-28  
**Severity:** CRITICAL  
**Status:** BLOCKING

---

## Issue Summary

The RDS PostgreSQL database at `10.0.22.117:5432` is not accessible from the Lambda execution environment. All database-dependent endpoints are failing with:

```
Database connection timeout or refused. Check RDS availability and security groups. 
Original: connect ECONNREFUSED 10.0.22.117:5432
```

---

## Impact

### Affected Endpoints (Database-Dependent)
- `/wallet/:customerId` - ISSUE-0011
- `/wallet/:customerId/transactions` - ISSUE-0012
- `/vendor/dashboard/:vendorId` - ISSUE-0013
- `/admin/refund-rules` - ISSUE-0015
- `/bookings/available-slots` - ISSUE-0009
- `/vendor/reschedule-policy` - ISSUE-0010
- `/refund-policy/calculate` - ISSUE-0014 (also has validation issue)

### Working Endpoints (No Database Required)
- `/health` ✅
- `/config/roles` ✅
- `/admin/service-catalog` ✅
- `/vendor/onboarding/roles` ✅
- `/onboarding-form/veterinarian` ✅
- `/customer/vendors/search?query=grooming` ✅ (after code fix)
- `/customer/discover-services?category=veterinary` ✅
- `/service-catalog/role/veterinarian` ✅
- `/bookings/create` ✅ (validation only)
- `/payment/:paymentId/status` ✅
- `/vendor/:vendorId/services` ✅
- `/vendor/bookings/:vendorId` ✅
- `/vendor/:vendorId/profile` ✅
- `/admin/support/tickets` ✅

---

## Root Cause Analysis

### Possible Causes

1. **VPC Configuration**
   - Lambda function may not be in the same VPC as RDS
   - Lambda needs VPC configuration to access private RDS endpoint

2. **Security Groups**
   - Security group rules may not allow Lambda to connect to RDS
   - RDS security group may not allow inbound from Lambda security group

3. **Network ACLs**
   - Network ACLs may be blocking traffic

4. **RDS Endpoint**
   - RDS instance may not be running
   - Endpoint address may be incorrect
   - RDS may be in a different region

5. **Environment Variables**
   - `DB_HOST` may be set incorrectly
   - `DB_SECRET_ARN` may be missing or incorrect

---

## Investigation Steps

### 1. Check Lambda VPC Configuration

```bash
# Check if Lambda is in VPC
aws lambda get-function-configuration \
  --function-name warmpawz-dev-api-handler \
  --region ap-south-1 \
  --query 'VpcConfig'

# Expected: Should have VpcConfig with subnetIds and securityGroupIds
```

### 2. Check RDS Security Groups

```bash
# Get RDS security group
aws rds describe-db-instances \
  --db-instance-identifier warmpawz-dev-cluster \
  --region ap-south-1 \
  --query 'DBInstances[0].VpcSecurityGroups'

# Check security group rules
aws ec2 describe-security-groups \
  --group-ids <security-group-id> \
  --region ap-south-1
```

### 3. Check Lambda Environment Variables

```bash
# Check Lambda environment variables
aws lambda get-function-configuration \
  --function-name warmpawz-dev-api-handler \
  --region ap-south-1 \
  --query 'Environment.Variables'
```

### 4. Test RDS Connectivity

```bash
# Test from Lambda execution environment (if possible)
# Or test from EC2 instance in same VPC
psql -h 10.0.22.117 -p 5432 -U warmpawz_admin -d warmpawz
```

---

## Remediation Steps

### Option 1: Configure Lambda VPC (Recommended)

1. **Add Lambda to VPC**
   ```bash
   aws lambda update-function-configuration \
     --function-name warmpawz-dev-api-handler \
     --vpc-config SubnetIds=subnet-xxx,subnet-yyy,SecurityGroupIds=sg-xxx \
     --region ap-south-1
   ```

2. **Update Security Group**
   - Add inbound rule to RDS security group
   - Allow PostgreSQL (port 5432) from Lambda security group

3. **Verify Connectivity**
   - Re-run test suite
   - Check CloudWatch logs for connection success

### Option 2: Use RDS Proxy (Alternative)

1. **Create RDS Proxy**
   ```bash
   aws rds create-db-proxy \
     --db-proxy-name warmpawz-dev-proxy \
     --engine-family POSTGRESQL \
     --targets TargetGroupName=default,DBClusterIdentifiers=warmpawz-dev-cluster \
     --auth AuthScheme=SECRETS,SecretArn=arn:aws:secretsmanager:... \
     --vpc-subnet-ids subnet-xxx subnet-yyy \
     --vpc-security-group-ids sg-xxx
   ```

2. **Update Lambda Environment**
   - Change `DB_HOST` to RDS Proxy endpoint
   - Keep `DB_SECRET_ARN` for authentication

### Option 3: Use Public Endpoint (Not Recommended for Production)

1. **Make RDS Publicly Accessible**
   - Update RDS instance to allow public access
   - Add security group rule for 0.0.0.0/0 (port 5432)
   - Update Lambda to use public endpoint

2. **Security Considerations**
   - Use strong passwords
   - Enable SSL/TLS
   - Consider IP whitelisting

---

## Immediate Actions

1. ✅ **Document Issue** - This file
2. ⏳ **Investigate VPC Configuration** - Check Lambda VPC settings
3. ⏳ **Check Security Groups** - Verify RDS security group rules
4. ⏳ **Test Connectivity** - Verify from EC2 or Lambda
5. ⏳ **Apply Fix** - Configure VPC or security groups
6. ⏳ **Re-test** - Verify database connectivity restored

---

## Test Results After Fix

Once database connectivity is restored, re-run the test suite:

```bash
node scripts/execute-comprehensive-system-test.js dev
```

Expected improvements:
- **Current Pass Rate:** 32% (7/22)
- **Expected Pass Rate:** 70%+ (after database connectivity + code fixes)

---

## Related Issues

- ISSUE-0011: Wallet balance endpoint
- ISSUE-0012: Wallet transactions endpoint
- ISSUE-0013: Vendor dashboard endpoint
- ISSUE-0015: Admin refund rules endpoint
- ISSUE-0009: Available booking slots
- ISSUE-0010: Vendor reschedule policy
- ISSUE-0014: Refund policy calculation

All these issues are likely caused by the same root cause: database connectivity.

---

**Priority:** P0 - CRITICAL  
**Assigned To:** Infrastructure Team  
**Target Resolution:** Immediate
