# 🚀 Deployment Next Steps

## Current Status

✅ **Fixed Issues:**
- API Gateway certificate validation hang → Made conditional
- Regional certificate validation hang → Made conditional  
- Flipper Maven 403 errors → Fixed
- Android build errors → Fixed
- Terraform plan exit codes → Fixed
- S3 bucket naming conflicts → Fixed

⚠️ **Remaining Issues:**
- VPC limit exceeded (manual action required)
- Existing resources not in Terraform state (import script created)
- Regional certificate not validated (optional - API Gateway works without custom domain)

---

## Step 1: Fix VPC Limit Issue (REQUIRED)

**Problem:** AWS account has reached maximum VPC limit (5 VPCs per region)

**Solution Options:**

### Option A: Delete Unused VPCs (Recommended)
1. Go to AWS Console → VPC → Your VPCs
2. Identify unused VPCs (no resources attached)
3. Delete unused VPCs:
   - Delete Internet Gateways first
   - Delete Subnets
   - Delete Route Tables
   - Delete VPCs

### Option B: Request Limit Increase
1. Go to AWS Support Center
2. Request VPC limit increase for ap-south-1
3. Wait for approval (usually instant for small increases)

**Quick Check:**
```bash
aws ec2 describe-vpcs --region ap-south-1 --query 'Vpcs[*].[VpcId,Tags[?Key==`Name`].Value|[0]]' --output table
```

---

## Step 2: Import Existing Resources (REQUIRED)

**Problem:** Resources exist in AWS but not in Terraform state

**Solution:** Run the import script

```bash
cd infra/envs/dev
chmod +x import-existing-resources.sh
./import-existing-resources.sh
```

**What it imports:**
- S3 buckets (frontend, uploads, logs, backups)
- DynamoDB tables (sessions, cache, analytics, rate-limits)
- CloudWatch log groups
- Secrets Manager secrets

**After import:**
```bash
terraform plan
# Should show fewer resources to create
```

---

## Step 3: Run Terraform Apply

Once VPC limit is fixed and resources are imported:

```bash
cd infra/envs/dev

# Verify plan looks good
terraform plan

# Apply changes
terraform apply
```

**Expected Result:**
- ✅ Creates missing resources
- ✅ Uses existing resources (imported)
- ⚠️ Skips API Gateway domain (certificate not validated)
- ✅ API Gateway works with default URL

---

## Step 4: Verify Deployment

### Check API Gateway
```bash
# Get API Gateway URL
aws apigatewayv2 get-apis --region ap-south-1 --query 'Items[?Name==`warmpawz-dev-api`].ApiEndpoint' --output text

# Test health endpoint
curl https://<api-id>.execute-api.ap-south-1.amazonaws.com/health
```

### Check Lambda
```bash
# List Lambda functions
aws lambda list-functions --region ap-south-1 --query 'Functions[?contains(FunctionName, `warmpawz-dev`)].FunctionName'
```

### Check RDS
```bash
# Get RDS endpoint
aws rds describe-db-clusters --region ap-south-1 --query 'DBClusters[?contains(DBClusterIdentifier, `warmpawz-dev`)].Endpoint' --output text
```

---

## Step 5: Validate Regional Certificate (OPTIONAL - for Custom Domain)

**Current State:** Regional certificate is created but not validated

**Why Optional:** API Gateway works fine without custom domain (uses default URL)

**To Enable Custom Domain (`dev.api.warmpawz.com`):**

### Option A: Manual Validation (Quick)
1. Go to AWS ACM Console → ap-south-1
2. Find certificate: `warmpawz-dev-regional-certificate`
3. Click "Create record in Route 53" (if available)
4. Or manually create DNS validation records
5. Wait for validation (5-10 minutes)
6. Update `terraform.tfvars`:
   ```hcl
   skip_cert_validation = false
   ```
7. Run `terraform apply` again
8. API Gateway domain will be created

### Option B: Let Terraform Validate (Automatic)
1. Update `terraform.tfvars`:
   ```hcl
   skip_cert_validation = false
   ```
2. Update `infra/envs/dev/main.tf`:
   ```hcl
   module "acm" {
     ...
     skip_validation = false  # Change this
   }
   ```
3. Run `terraform apply`
4. Terraform will create DNS records and wait for validation
5. This may take 10-15 minutes

---

## Step 6: Deploy Frontend Apps

After infrastructure is deployed:

```bash
# Frontend apps are built in GitHub Actions
# They will be deployed to S3 automatically
# Or deploy manually:

cd apps/admin-web
npm run build
aws s3 sync dist/ s3://warmpawz-dev-admin-frontend-ap-south-1/ --delete

cd ../vendor-web
npm run build
aws s3 sync dist/ s3://warmpawz-dev-vendor-frontend-ap-south-1/ --delete

cd ../customer-web
npm run build
aws s3 sync dist/ s3://warmpawz-dev-customer-frontend-ap-south-1/ --delete
```

---

## Step 7: Run Database Migrations

```bash
cd db
npm ci
export DATABASE_URL="postgresql://warmpawz_admin:<password>@<rds-endpoint>:5432/warmpawz"
npm run migrate:up
npm run seed:dev
```

**Get RDS password:**
```bash
aws secretsmanager get-secret-value \
  --secret-id warmpawz-dev-rds-master \
  --region ap-south-1 \
  --query SecretString --output text | jq -r .password
```

---

## Troubleshooting

### If Terraform Apply Fails

1. **Check VPC limit:**
   ```bash
   aws ec2 describe-vpcs --region ap-south-1 --query 'length(Vpcs)'
   ```

2. **Check existing resources:**
   ```bash
   # S3 buckets
   aws s3 ls | grep warmpawz-dev
   
   # DynamoDB tables
   aws dynamodb list-tables --region ap-south-1 | grep warmpawz-dev
   ```

3. **Import missing resources:**
   ```bash
   ./import-existing-resources.sh
   ```

### If API Gateway Doesn't Work

1. **Check Lambda function:**
   ```bash
   aws lambda get-function --function-name warmpawz-dev-api-handler --region ap-south-1
   ```

2. **Check API Gateway routes:**
   ```bash
   aws apigatewayv2 get-routes --api-id <api-id> --region ap-south-1
   ```

3. **Test Lambda directly:**
   ```bash
   aws lambda invoke --function-name warmpawz-dev-api-handler --payload '{"path":"/health"}' response.json
   cat response.json
   ```

---

## Summary Checklist

- [ ] Fix VPC limit (delete unused VPCs or request increase)
- [ ] Run `import-existing-resources.sh` to import existing resources
- [ ] Run `terraform plan` to verify changes
- [ ] Run `terraform apply` to deploy infrastructure
- [ ] Verify API Gateway is working (default URL)
- [ ] Verify Lambda function is deployed
- [ ] Verify RDS cluster is created
- [ ] (Optional) Validate regional certificate for custom domain
- [ ] Deploy frontend apps to S3
- [ ] Run database migrations
- [ ] Test end-to-end functionality

---

## Quick Commands Reference

```bash
# Import existing resources
cd infra/envs/dev && ./import-existing-resources.sh

# Plan deployment
terraform plan

# Apply deployment
terraform apply

# Check VPC count
aws ec2 describe-vpcs --region ap-south-1 --query 'length(Vpcs)'

# Get API Gateway URL
aws apigatewayv2 get-apis --region ap-south-1 --query 'Items[?Name==`warmpawz-dev-api`].ApiEndpoint' --output text

# Get RDS endpoint
aws rds describe-db-clusters --region ap-south-1 --query 'DBClusters[?contains(DBClusterIdentifier, `warmpawz-dev`)].Endpoint' --output text
```

---

**🎯 Goal:** Get infrastructure deployed and working, then add custom domain later if needed.

