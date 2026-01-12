# SSM Parameter Store - Complete Guide

**Date:** 2026-01-28  
**Status:** ✅ **VERIFICATION & SETUP TOOLS CREATED**

---

## 📋 Table of Contents

1. [What is SSM Parameter Store?](#what-is-ssm-parameter-store)
2. [Why is it Important?](#why-is-it-important)
3. [What Breaks Without SSM Parameters?](#what-breaks-without-ssm-parameters)
4. [Required Parameters](#required-parameters)
5. [CDK vs Serverless Framework](#cdk-vs-serverless-framework)
6. [Verification & Setup Tools](#verification--setup-tools)
7. [Manual Setup Instructions](#manual-setup-instructions)
8. [Enhancement Recommendations](#enhancement-recommendations)

---

## 🔍 What is SSM Parameter Store?

**AWS Systems Manager Parameter Store** is a secure, hierarchical key-value store for configuration data and secrets management.

### Key Features:
- **Secure Storage**: Encrypted at rest using AWS KMS
- **Hierarchical Organization**: `/warmpawz/{stage}/{service}/{key}` pattern
- **Access Control**: IAM-based permissions
- **Versioning**: Track parameter changes over time
- **Cost-Effective**: Free for standard parameters (up to 10,000)

### Parameter Types:
- **String**: Plain text values (e.g., hostnames, IDs)
- **SecureString**: Encrypted values (e.g., passwords, API keys)
- **StringList**: Comma-separated values

---

## 🎯 Why is it Important?

### 1. **Security**
- Secrets encrypted at rest
- No hardcoded credentials in code
- IAM-based access control
- Audit trail via CloudTrail

### 2. **Environment Management**
- Same code, different configs per environment
- Easy environment promotion (dev → stage → prod)
- No code changes needed for config updates

### 3. **Serverless Requirement**
- Lambda functions need external configuration
- No file system for config files
- Environment variables injected at deployment time

### 4. **Brownfield Compatibility**
- Works with existing AWS resources
- Can reference existing RDS, Cognito, VPC resources
- No need to recreate infrastructure

### 5. **Operational Benefits**
- Centralized configuration management
- Easy updates without redeployment
- Parameter versioning and rollback
- Integration with AWS services

---

## ❌ What Breaks Without SSM Parameters?

### 🔴 **CRITICAL FAILURES** (System Completely Broken)

#### 1. **Database Parameters Missing**
```
Error: Parameter /warmpawz/dev/db/host not found
```
**Impact:**
- ❌ Lambda cannot connect to RDS
- ❌ All database operations fail
- ❌ System completely non-functional
- ❌ No data access, no API responses

**Required Parameters:**
- `/warmpawz/{stage}/db/host`
- `/warmpawz/{stage}/db/port`
- `/warmpawz/{stage}/db/name`
- `/warmpawz/{stage}/db/user`
- `/warmpawz/{stage}/db/password`

#### 2. **Cognito Parameters Missing**
```
Error: Parameter /warmpawz/dev/cognito/userPoolId not found
```
**Impact:**
- ❌ User authentication completely broken
- ❌ No user logins possible
- ❌ JWT validation fails
- ❌ All protected endpoints return 401

**Required Parameters:**
- `/warmpawz/{stage}/cognito/userPoolId`
- `/warmpawz/{stage}/cognito/clientId`

#### 3. **Razorpay Parameters Missing**
```
Error: Parameter /warmpawz/dev/razorpay/keyId not found
```
**Impact:**
- ❌ Payment processing broken
- ❌ No revenue collection
- ❌ Checkout flow fails
- ❌ Refunds cannot be processed

**Required Parameters:**
- `/warmpawz/{stage}/razorpay/keyId`
- `/warmpawz/{stage}/razorpay/keySecret`
- `/warmpawz/{stage}/razorpay/webhookSecret`

#### 4. **VPC Parameters Missing**
```
Error: Parameter /warmpawz/dev/vpc/securityGroupId not found
```
**Impact:**
- ❌ Lambda cannot access RDS (network isolation)
- ❌ Database connection timeouts
- ❌ All database operations fail

**Required Parameters:**
- `/warmpawz/{stage}/vpc/securityGroupId`
- `/warmpawz/{stage}/vpc/subnetId1`
- `/warmpawz/{stage}/vpc/subnetId2`

### 🟡 **IMPORTANT FAILURES** (Partial System Breakdown)

#### 5. **SNS Parameters Missing**
```
Error: Parameter /warmpawz/dev/sns/smsTopicArn not found
```
**Impact:**
- ⚠️ SMS notifications fail (OTP delivery broken)
- ⚠️ User registration/login issues
- ⚠️ Booking confirmations not sent

**Required Parameters:**
- `/warmpawz/{stage}/sns/smsTopicArn`

#### 6. **CORS Parameters Missing**
```
Error: Parameter /warmpawz/dev/cors/allowedOrigins not found
```
**Impact:**
- ⚠️ Frontend API calls blocked by CORS
- ⚠️ Browser console shows CORS errors
- ⚠️ Web app cannot communicate with API

**Required Parameters:**
- `/warmpawz/{stage}/cors/allowedOrigins`

### 🟢 **OPTIONAL FAILURES** (Non-Critical)

#### 7. **CloudFront Parameters Missing**
```
Warning: Parameter /warmpawz/dev/cloudfront/distributionId not found
```
**Impact:**
- ⚠️ CloudFront cache invalidation fails
- ⚠️ CDN updates require manual invalidation
- ✅ System still functional

**Optional Parameters:**
- `/warmpawz/{stage}/cloudfront/distributionId`

#### 8. **Feature Flags Missing**
```
Warning: Parameter /warmpawz/dev/features/uatMode not found
```
**Impact:**
- ⚠️ UAT mode defaults to false
- ⚠️ Fixed OTP (123456) not enabled in dev
- ✅ System still functional

**Optional Parameters:**
- `/warmpawz/{stage}/features/uatMode`

---

## 📝 Required Parameters

### Complete Parameter List (14 Total)

#### **Database (5 parameters)**
```
/warmpawz/{stage}/db/host          (String)
/warmpawz/{stage}/db/port          (String, default: 5432)
/warmpawz/{stage}/db/name          (String)
/warmpawz/{stage}/db/user          (String)
/warmpawz/{stage}/db/password      (SecureString)
```

#### **Cognito (2 parameters)**
```
/warmpawz/{stage}/cognito/userPoolId  (String)
/warmpawz/{stage}/cognito/clientId    (String)
```

#### **Razorpay (3 parameters)**
```
/warmpawz/{stage}/razorpay/keyId          (String)
/warmpawz/{stage}/razorpay/keySecret      (SecureString)
/warmpawz/{stage}/razorpay/webhookSecret  (SecureString)
```

#### **SNS (1 parameter)**
```
/warmpawz/{stage}/sns/smsTopicArn  (String)
```

#### **VPC (3 parameters)**
```
/warmpawz/{stage}/vpc/securityGroupId  (String)
/warmpawz/{stage}/vpc/subnetId1       (String)
/warmpawz/{stage}/vpc/subnetId2       (String)
```

#### **CORS (1 parameter)**
```
/warmpawz/{stage}/cors/allowedOrigins  (String)
```

#### **CloudFront (1 parameter - optional)**
```
/warmpawz/{stage}/cloudfront/distributionId  (String)
```

#### **Features (1 parameter - optional)**
```
/warmpawz/{stage}/features/uatMode  (String, default: false)
```

---

## 🔄 CDK vs Serverless Framework

### **Important Architecture Note**

Your Warmpawz codebase uses **TWO deployment methods**:

### 1. **CDK Deployment** (`infrastructure/cdk/`)

**How it works:**
- Uses **stack props** (direct references)
- Values come from CDK stack outputs
- No SSM parameters required
- Example: `props.cognitoStack.customerPool.userPoolId`

**Code Example:**
```typescript
// infrastructure/cdk/lib/lambda-stack.ts
environment: {
  COGNITO_CUSTOMER_POOL_ID: props.cognitoStack.customerPool.userPoolId,
  COGNITO_CUSTOMER_CLIENT_ID: props.cognitoStack.customerPoolClient.userPoolClientId,
  // ... direct stack references
}
```

**When to use:**
- ✅ Greenfield deployments
- ✅ Full infrastructure control
- ✅ All resources created by CDK

**SSM Parameters:**
- ❌ **NOT REQUIRED** (but recommended for brownfield compatibility)

---

### 2. **Serverless Framework** (`backend/lambda/serverless.yml`)

**How it works:**
- Uses **SSM Parameter Store** references
- Parameters injected at deployment time
- Must exist before deployment
- Example: `${ssm:/warmpawz/${self:provider.stage}/cognito/userPoolId}`

**Code Example:**
```yaml
# backend/lambda/serverless.yml
environment:
  COGNITO_USER_POOL_ID: ${ssm:/warmpawz/${self:provider.stage}/cognito/userPoolId}
  COGNITO_CLIENT_ID: ${ssm:/warmpawz/${self:provider.stage}/cognito/clientId}
  # ... SSM references
```

**When to use:**
- ✅ Brownfield deployments
- ✅ Existing infrastructure
- ✅ Quick Lambda-only deployments
- ✅ Multi-environment management

**SSM Parameters:**
- ✅ **REQUIRED** (deployment will fail without them)

---

### **Which One Are You Using?**

**Check your deployment method:**

```bash
# If using CDK
cd infrastructure/cdk
cdk deploy --all

# If using Serverless Framework
cd backend/lambda
serverless deploy --stage dev --region ap-south-1
```

**If using Serverless Framework → SSM parameters are REQUIRED**

---

## 🛠️ Verification & Setup Tools

### **1. Verification Script**

**Location:** `scripts/verify-ssm-parameters.sh`

**Usage:**
```bash
./scripts/verify-ssm-parameters.sh [stage] [region]
```

**Examples:**
```bash
# Verify dev environment
./scripts/verify-ssm-parameters.sh dev ap-south-1

# Verify prod environment
./scripts/verify-ssm-parameters.sh prod ap-south-1
```

**What it does:**
- ✅ Checks all required SSM parameters
- ✅ Validates parameter values (non-empty)
- ✅ Reports missing parameters
- ✅ Reports invalid parameters (empty values)
- ✅ Provides summary statistics

**Output Example:**
```
🔍 SSM Parameter Store Verification
====================================
Stage: dev
Region: ap-south-1
Base Path: /warmpawz/dev

📊 Database Configuration
----------------------------------------
  Checking: /warmpawz/dev/db/host... ✅ EXISTS (warmpawz-db.xxxxx.rds...)
  Checking: /warmpawz/dev/db/port... ✅ EXISTS (5432)
  ...

📊 Verification Summary
====================================
Total Parameters: 14
✅ Exists: 12
❌ Missing: 2
⚠️  Invalid: 0
```

---

### **2. Setup Script**

**Location:** `scripts/setup-ssm-parameters.sh`

**Usage:**
```bash
./scripts/setup-ssm-parameters.sh [stage] [region]
```

**Examples:**
```bash
# Interactive setup for dev
./scripts/setup-ssm-parameters.sh dev ap-south-1

# Interactive setup for prod
./scripts/setup-ssm-parameters.sh prod ap-south-1
```

**What it does:**
- 🔧 Interactive prompts for each parameter
- 🔧 Shows existing values (if present)
- 🔧 Allows skipping (keeps existing values)
- 🔧 Handles SecureString encryption
- 🔧 Creates or updates parameters
- 🔧 Provides defaults where appropriate

**Features:**
- ✅ Preserves existing values (press Enter to keep)
- ✅ Secure input for passwords/secrets (hidden typing)
- ✅ Validation for required parameters
- ✅ Type selection (String vs SecureString)
- ✅ Environment-specific defaults

---

## 📖 Manual Setup Instructions

### **Using AWS CLI**

#### **1. Database Parameters**
```bash
# Host
aws ssm put-parameter \
  --name "/warmpawz/dev/db/host" \
  --value "warmpawz-db.xxxxx.rds.amazonaws.com" \
  --type "String" \
  --region ap-south-1

# Port
aws ssm put-parameter \
  --name "/warmpawz/dev/db/port" \
  --value "5432" \
  --type "String" \
  --region ap-south-1

# Name
aws ssm put-parameter \
  --name "/warmpawz/dev/db/name" \
  --value "warmpawz" \
  --type "String" \
  --region ap-south-1

# User
aws ssm put-parameter \
  --name "/warmpawz/dev/db/user" \
  --value "warmpawz_user" \
  --type "String" \
  --region ap-south-1

# Password (SecureString - encrypted)
aws ssm put-parameter \
  --name "/warmpawz/dev/db/password" \
  --value "your-secure-password" \
  --type "SecureString" \
  --region ap-south-1
```

#### **2. Cognito Parameters**
```bash
# User Pool ID
aws ssm put-parameter \
  --name "/warmpawz/dev/cognito/userPoolId" \
  --value "ap-south-1_XXXXXXXXX" \
  --type "String" \
  --region ap-south-1

# Client ID
aws ssm put-parameter \
  --name "/warmpawz/dev/cognito/clientId" \
  --value "xxxxxxxxxxxxxxxxxxxx" \
  --type "String" \
  --region ap-south-1
```

#### **3. Razorpay Parameters**
```bash
# Key ID
aws ssm put-parameter \
  --name "/warmpawz/dev/razorpay/keyId" \
  --value "rzp_test_XXXXXXXXX" \
  --type "String" \
  --region ap-south-1

# Key Secret (SecureString)
aws ssm put-parameter \
  --name "/warmpawz/dev/razorpay/keySecret" \
  --value "your-razorpay-secret" \
  --type "SecureString" \
  --region ap-south-1

# Webhook Secret (SecureString)
aws ssm put-parameter \
  --name "/warmpawz/dev/razorpay/webhookSecret" \
  --value "your-webhook-secret" \
  --type "SecureString" \
  --region ap-south-1
```

#### **4. SNS Parameters**
```bash
aws ssm put-parameter \
  --name "/warmpawz/dev/sns/smsTopicArn" \
  --value "arn:aws:sns:ap-south-1:123456789012:warmpawz-dev-sms" \
  --type "String" \
  --region ap-south-1
```

#### **5. VPC Parameters**
```bash
# Security Group
aws ssm put-parameter \
  --name "/warmpawz/dev/vpc/securityGroupId" \
  --value "sg-xxxxxxxxx" \
  --type "String" \
  --region ap-south-1

# Subnet 1
aws ssm put-parameter \
  --name "/warmpawz/dev/vpc/subnetId1" \
  --value "subnet-xxxxxxxxx" \
  --type "String" \
  --region ap-south-1

# Subnet 2
aws ssm put-parameter \
  --name "/warmpawz/dev/vpc/subnetId2" \
  --value "subnet-yyyyyyyyy" \
  --type "String" \
  --region ap-south-1
```

#### **6. CORS Parameters**
```bash
aws ssm put-parameter \
  --name "/warmpawz/dev/cors/allowedOrigins" \
  --value "*" \
  --type "String" \
  --region ap-south-1
```

### **Using AWS Console**

1. Navigate to **Systems Manager** → **Parameter Store**
2. Click **Create parameter**
3. Enter parameter name (e.g., `/warmpawz/dev/db/host`)
4. Select type (String or SecureString)
5. Enter value
6. Click **Create parameter**

---

## 🚀 Enhancement Recommendations

### **1. Automated Parameter Sync**

**Enhancement:** Create a script that syncs CDK stack outputs to SSM Parameter Store

**Benefits:**
- Single source of truth (CDK stacks)
- SSM parameters automatically updated
- Works for both CDK and Serverless Framework deployments

**Implementation:**
```bash
# scripts/sync-cdk-to-ssm.sh
# After CDK deploy, extract outputs and create SSM parameters
```

### **2. Parameter Validation**

**Enhancement:** Add validation rules for parameter values

**Examples:**
- Database host must be valid RDS endpoint format
- Cognito User Pool ID must match pattern `region_XXXXXXXXX`
- VPC IDs must start with `sg-` or `subnet-`
- CORS origins must be valid URLs or `*`

### **3. Environment Promotion**

**Enhancement:** Script to promote parameters from dev → stage → prod

**Benefits:**
- Consistent configuration across environments
- Easy environment setup
- Validation before promotion

### **4. Parameter Backup**

**Enhancement:** Regular backup of SSM parameters to S3

**Benefits:**
- Disaster recovery
- Configuration history
- Audit trail

### **5. Integration with CI/CD**

**Enhancement:** Verify SSM parameters in CI/CD pipeline

**Benefits:**
- Fail fast if parameters missing
- Prevent broken deployments
- Automated verification

---

## ✅ Quick Start Checklist

- [ ] Run verification: `./scripts/verify-ssm-parameters.sh dev ap-south-1`
- [ ] Review missing parameters
- [ ] Run setup: `./scripts/setup-ssm-parameters.sh dev ap-south-1`
- [ ] Verify again: `./scripts/verify-ssm-parameters.sh dev ap-south-1`
- [ ] Test deployment: `serverless deploy --stage dev --region ap-south-1`
- [ ] Repeat for stage/prod environments

---

## 📚 Additional Resources

- [AWS SSM Parameter Store Documentation](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html)
- [Serverless Framework SSM Variables](https://www.serverless.com/framework/docs/providers/aws/guide/variables#reference-variables-using-the-ssm-parameter-store)
- [CDK Parameter Store](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ssm-readme.html)

---

## 🆘 Troubleshooting

### **Error: Parameter not found**
```
Error: Parameter /warmpawz/dev/db/host not found
```
**Solution:** Run setup script or create parameter manually

### **Error: Access Denied**
```
Error: User is not authorized to perform: ssm:GetParameter
```
**Solution:** Add IAM permissions for SSM Parameter Store access

### **Error: Invalid parameter type**
```
Error: Parameter type must be String or SecureString
```
**Solution:** Use correct parameter type (String for plain text, SecureString for secrets)

---

**Last Updated:** 2026-01-28  
**Status:** ✅ Complete - Verification & Setup Tools Ready
