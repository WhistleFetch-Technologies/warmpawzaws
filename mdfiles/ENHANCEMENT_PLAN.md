# Infrastructure Enhancement Plan - Use Existing Resources

**Date:** 2026-01-28  
**Status:** ⚠️ **NEEDS RESOURCE INFORMATION**  
**Approach:** Modify CDK to use existing resources, only add missing pieces

---

## 🔍 What I Found

### From CI/CD Workflow (`.github/workflows/dev.yml`):

1. **S3 Buckets (Frontend):**
   - Pattern: `warmpawz-dev-{admin|vendor|customer}-frontend-ap-south-1`
   - CI/CD already uses these buckets

2. **Lambda Function:**
   - Name: `warmpawz-dev-api-handler`
   - CI/CD updates code only (no infrastructure changes)

3. **RDS Cluster:**
   - Identifier: `warmpawz-dev-cluster` (from Terraform references)

---

## 📋 What I Need to Know

Before modifying CDK, I need to verify:

### Questions:

1. **RDS Cluster:**
   - ✅ Cluster ID: `warmpawz-dev-cluster` (assumed)
   - ❓ Endpoint: ? (need to verify)
   - ❓ Secret ARN: ? (need to verify)
   - ❓ RDS Proxy exists? Name: `warmpawz-aurora-proxy`?

2. **S3 Buckets:**
   - ✅ Frontend buckets: `warmpawz-dev-{admin|vendor|customer}-frontend-ap-south-1`
   - ❓ Storage bucket: ?
   - ❓ Uploads bucket: ?
   - ❓ Assets bucket: ?
   - ❓ Logs bucket: ?

3. **Lambda Functions:**
   - ✅ Main API: `warmpawz-dev-api-handler`
   - ❓ Queue processors exist? Names?

4. **Other Resources:**
   - ❓ Cognito pools exist? Pool IDs?
   - ❓ API Gateway exists? API ID?
   - ❓ SQS queues exist? Queue names?
   - ❓ SNS topics exist? Topic ARNs?

---

## 🛠️ What I'll Do

### Step 1: Create Enhanced CDK Stacks (Use Existing Resources)

1. **AuroraStack Enhancement:**
   - Use `DatabaseCluster.fromDatabaseClusterAttributes()` to reference existing cluster
   - Use existing secret from Secrets Manager
   - Only create RDS Proxy if it doesn't exist

2. **S3Stack Enhancement:**
   - Use `Bucket.fromBucketName()` for existing buckets
   - Only create buckets that don't exist

3. **LambdaStack Enhancement:**
   - Update existing Lambda function code
   - Add log retention (already done)
   - Add event source mappings if missing

4. **CognitoStack Enhancement:**
   - Use existing pools if they exist
   - Only create if missing

### Step 2: CI/CD Integration
- ✅ Already configured for code-only deployment
- ✅ Uses existing S3 buckets
- ✅ Updates existing Lambda function

### Step 3: Push to Git
- Commit enhanced code
- CI/CD will automatically deploy

---

## 🚀 Quick Start

**Option 1: Provide Resource Information**
Run the verification script and share results:
```bash
./GET_EXISTING_RESOURCES.sh
```

**Option 2: I Can Modify Based on Assumptions**
Based on CI/CD patterns, I can modify CDK to:
- Use `warmpawz-dev-cluster` for RDS
- Use `warmpawz-dev-{app}-frontend-ap-south-1` for S3
- Use `warmpawz-dev-api-handler` for Lambda

**Which approach do you prefer?**

---

## ⚠️ IMPORTANT

**I will NOT recreate:**
- ❌ RDS cluster (will use existing)
- ❌ S3 buckets (will use existing)
- ❌ Lambda functions (will update code only)
- ❌ Any existing infrastructure

**I will ONLY:**
- ✅ Reference existing resources
- ✅ Add missing pieces (monitoring, log retention)
- ✅ Deploy enhanced code via CI/CD

---

**Ready to proceed once I have resource information or your approval to proceed with assumptions.**
