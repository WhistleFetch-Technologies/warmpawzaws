# Existing Infrastructure Verification & Enhancement Plan

**Date:** 2026-01-28  
**Status:** ⚠️ **NEEDS RESOURCE INFORMATION**  
**Approach:** Use existing infrastructure, only add missing pieces

---

## 🔍 What I Need to Know

To safely enhance the code without recreating existing infrastructure, I need the following information:

### 1. **RDS Cluster Details**
- **Cluster Identifier:** `warmpawz-dev-cluster` (assumed from CI/CD)
- **Endpoint:** ? (need to verify)
- **Secret ARN:** ? (need to verify)
- **RDS Proxy Name:** ? (if exists)

**Question:** What is the exact RDS cluster identifier and endpoint? Is there an RDS Proxy already set up?

---

### 2. **S3 Bucket Names**
The CI/CD workflow looks for buckets with pattern: `warmpawz-dev-{app}-frontend-ap-south-1`

**Expected Buckets:**
- Admin frontend: `warmpawz-dev-admin-frontend-ap-south-1`?
- Vendor frontend: `warmpawz-dev-vendor-frontend-ap-south-1`?
- Customer frontend: `warmpawz-dev-customer-frontend-ap-south-1`?
- Storage bucket: ?
- Uploads bucket: ?
- Assets bucket: ?
- Logs bucket: ?

**Question:** What are the exact S3 bucket names that already exist?

---

### 3. **Lambda Function Names**
CI/CD references: `warmpawz-dev-api-handler`

**Question:** What are the exact Lambda function names that exist?
- Main API handler: `warmpawz-dev-api-handler`?
- Queue processors: `warmpawz-dev-notification-processor`, etc.?

---

### 4. **API Gateway**
**Question:** What is the API Gateway ID or name that exists?

---

### 5. **Cognito User Pools**
**Question:** Do Cognito user pools already exist? If yes, what are the pool IDs?

---

## 📋 What I'll Do (After Getting Info)

### Step 1: Modify CDK to Use Existing Resources
1. **AuroraStack** → Use `DatabaseCluster.fromDatabaseClusterAttributes()` or lookup
2. **S3Stack** → Use `Bucket.fromBucketName()` for existing buckets
3. **LambdaStack** → Update existing Lambda function code only
4. **CognitoStack** → Use existing pools if they exist

### Step 2: Enhance Code Only
1. ✅ CloudWatch error tracking (already done)
2. ✅ Log retention (already done)
3. ✅ Enhanced Lambda handlers
4. ✅ All queue processors

### Step 3: CI/CD Deployment
1. Push to git
2. CI/CD will:
   - Build Lambda code
   - Update existing Lambda function
   - Deploy frontend to existing S3 buckets
   - Run migrations (if needed)

---

## 🚀 Quick Verification Commands

Run these to get the information I need:

```bash
# RDS Cluster
aws rds describe-db-clusters \
  --db-cluster-identifier warmpawz-dev-cluster \
  --region ap-south-1 \
  --query 'DBClusters[0].{Endpoint:Endpoint,SecretArn:MasterUserSecret.SecretArn}'

# S3 Buckets
aws s3 ls | grep warmpawz-dev

# Lambda Functions
aws lambda list-functions \
  --region ap-south-1 \
  --query 'Functions[?contains(FunctionName, `warmpawz-dev`)].FunctionName'

# API Gateway
aws apigatewayv2 get-apis \
  --region ap-south-1 \
  --query 'Items[?contains(Name, `warmpawz`)].{Name:Name,ApiId:ApiId}'

# Cognito Pools
aws cognito-idp list-user-pools \
  --max-results 10 \
  --region ap-south-1 \
  --query 'UserPools[?contains(Name, `warmpawz`)].{Name:Name,Id:Id}'
```

---

## ⚠️ IMPORTANT

**I will NOT:**
- ❌ Create new RDS clusters
- ❌ Create new S3 buckets
- ❌ Create new Lambda functions (only update code)
- ❌ Recreate any existing infrastructure

**I will ONLY:**
- ✅ Use existing RDS cluster (lookup/import)
- ✅ Use existing S3 buckets (fromBucketName)
- ✅ Update existing Lambda function code
- ✅ Add missing pieces (monitoring, log retention)
- ✅ Deploy enhanced code via CI/CD

---

**Please provide the resource information above, or I can run the verification commands if you prefer.**
