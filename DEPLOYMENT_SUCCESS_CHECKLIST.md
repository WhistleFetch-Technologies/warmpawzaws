# Warmpawz Deployment Success Checklist

## ✅ Pre-Deployment Verification

### AWS Account Setup
- [ ] IAM user `ketanhirani` has AdministratorAccess policy
- [ ] AWS credentials configured in GitHub Secrets:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_ACCOUNT_ID`
- [ ] Terraform backend exists:
  - S3 bucket: `warmpawz-terraform-state-057442119249`
  - DynamoDB table: `warmpawz-terraform-locks`

### GitHub Secrets Configured
- [ ] `DEV_OPENSEARCH_PASSWORD`
- [ ] `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`
- [ ] `GOOGLE_MAPS_API_KEY`
- [ ] `SHIPROCKET_EMAIL` and `SHIPROCKET_PASSWORD`

---

## 🚀 Deployment Process

### Automatic Steps (GitHub Actions)
1. **Static Analysis** - Code quality checks
2. **Build Backend** - Lambda handler compilation and ZIP creation
3. **Build Frontend Apps** - Next.js static exports (admin, vendor, customer)
4. **Build Android Apps** - React Native APKs (customer, vendor)
5. **Terraform Plan** - Infrastructure planning
6. **Terraform Apply** - Resource creation (~15-20 minutes)
7. **Database Migrations** - Schema creation
8. **Seed Base Data** - Initial data population
9. **Deploy Frontend** - Upload to S3 and CloudFront invalidation
10. **Smoke Tests** - Basic API and frontend checks

### Expected Timeline
- **Total Duration**: 25-35 minutes
- **Longest Steps**: 
  - Terraform Apply (15-20 min) - RDS, NAT Gateway, CloudFront
  - Android Builds (10-15 min each)

---

## 🔧 Troubleshooting & Automatic Fixes

### State Lock Issues
**Symptom**: `Error acquiring the state lock`

**Automatic Fix**: 
- Workflow has `Force unlock stale Terraform state` step
- Runs before both Plan and Apply
- Safe because of GitHub Actions concurrency control

**Manual Fix** (if needed):
```bash
aws dynamodb delete-item \
  --table-name warmpawz-terraform-locks \
  --key '{"LockID":{"S":"warmpawz-terraform-state-057442119249/dev/terraform.tfstate"}}' \
  --region ap-south-1
```

### Orphaned Resources
**Symptom**: `BucketAlreadyExists`, `ResourceAlreadyExists`

**Automatic Fix**:
- Workflow has comprehensive orphan cleanup step
- Removes bucket policies, public access blocks
- Recursively deletes objects
- Cleans up CloudFront OACs
- Runs before Terraform Plan

**What Gets Cleaned**:
- S3 buckets from failed runs
- CloudFront Origin Access Controls
- (Future: Lambda functions, API Gateway resources)

### RDS Free Tier Limits
**Symptom**: `FreeTierRestrictionError: backup retention period exceeds`

**Fix Applied**: `backup_retention_period = 1` (max for free tier)

### Lambda Reserved Variables
**Symptom**: `environment variables contains reserved keys: AWS_REGION`

**Fix Applied**: AWS_REGION removed from `common_env_vars`
- Lambda runtime automatically provides `AWS_REGION`
- No manual configuration needed

### Android Build Maven 403
**Symptom**: `Could not GET ... Received status code 403 from server: Forbidden`

**Auto-Retry**: GitHub Actions will retry failed jobs
- Transient network issues
- Maven Central rate limiting
- Usually succeeds on retry

---

## 📊 Post-Deployment Verification

### 1. Infrastructure Created
```bash
# Get API endpoint
aws apigatewayv2 get-apis --region ap-south-1 \
  --query 'Items[?Name==`warmpawz-dev-api`].ApiEndpoint' --output text

# Check RDS cluster
aws rds describe-db-clusters --region ap-south-1 \
  --query 'DBClusters[?DBClusterIdentifier==`warmpawz-dev-cluster`].Status' --output text

# List S3 buckets
aws s3 ls | grep warmpawz-dev

# Check CloudFront distributions
aws cloudfront list-distributions \
  --query 'DistributionList.Items[*].[Id,Aliases.Items[0],Status]' --output table
```

### 2. Test API Health
```bash
API_ENDPOINT=$(aws apigatewayv2 get-apis --region ap-south-1 \
  --query 'Items[?Name==`warmpawz-dev-api`].ApiEndpoint' --output text)

curl -v "$API_ENDPOINT/health"
# Expected: {"status":"ok","timestamp":"..."}
```

### 3. Database Connectivity
```bash
# Check if migrations ran
# RDS cluster should be in 'available' state
aws rds describe-db-clusters --region ap-south-1 \
  --db-cluster-identifier warmpawz-dev-cluster \
  --query 'DBClusters[0].Status' --output text
```

### 4. Frontend Deployments
```bash
# Check S3 buckets have content
aws s3 ls s3://warmpawz-dev-admin-frontend-ap-south-1/ | head -5
aws s3 ls s3://warmpawz-dev-vendor-frontend-ap-south-1/ | head -5
aws s3 ls s3://warmpawz-dev-customer-frontend-ap-south-1/ | head -5

# Get CloudFront distribution URLs
aws cloudfront list-distributions \
  --query 'DistributionList.Items[?contains(Comment, `warmpawz-dev`)].{App:Comment,Domain:DomainName,Status:Status}' \
  --output table
```

### 5. Download Mobile APKs
From GitHub Actions artifacts:
- `android-WarmpawzCustomer.apk`
- `android-WarmpawzVendor.apk`

---

## 🔄 Workflow Idempotency

The CI/CD pipeline is designed to be **fully idempotent**:

### Can Run Multiple Times
✅ Orphan cleanup removes conflicting resources  
✅ State locks are automatically unlocked  
✅ Terraform handles existing resources gracefully  
✅ `continue-on-error` prevents cascading failures  
✅ Timeouts prevent infinite hangs  

### Safe Retry Scenarios
- **After fixing code errors**: Just push again
- **After AWS permission issues**: Re-run workflow
- **After network timeouts**: Manual re-trigger
- **After partial deployments**: Workflow cleans up and continues

### Concurrency Control
```yaml
concurrency:
  group: deploy-dev-${{ github.ref }}
  cancel-in-progress: true
```
- Only one deployment runs at a time
- New pushes cancel in-progress runs
- Prevents resource conflicts

---

## 🚨 Known Issues & Limitations

### 1. ACM Certificate Validation
**Issue**: Regional certificate validation is skipped  
**Impact**: Custom domain (dev.api.warmpawz.com) not configured  
**Workaround**: Use API Gateway default URL  
**Future**: Manual DNS validation, then re-run Terraform

### 2. VPC Limit
**Issue**: AWS accounts limited to 5 VPCs per region  
**Mitigation**: Workflow checks VPC count before deployment  
**Solution**: Delete unused VPCs or request limit increase

### 3. Android Build Time
**Issue**: 10-15 minutes per app  
**Optimization**: Could use build caching (future enhancement)

### 4. RDS Cold Start
**Issue**: First Lambda invocation may timeout (RDS Aurora Serverless)  
**Mitigation**: Warmup period after deployment  
**Solution**: Configure higher `min_capacity` or use provisioned instances

---

## 📈 Future Enhancements

### Short-Term
- [ ] Add CloudWatch alarms to GitHub output
- [ ] Generate deployment summary (resource counts, costs)
- [ ] Slack/Email notifications on deployment success/failure
- [ ] Automated smoke tests for all endpoints

### Medium-Term
- [ ] Blue-green deployments for zero downtime
- [ ] Approval gates for production deployments
- [ ] Automated rollback on failure detection
- [ ] Performance benchmarking before/after

### Long-Term
- [ ] Multi-region deployments
- [ ] Disaster recovery automation
- [ ] Cost optimization recommendations
- [ ] Security scanning integration

---

## 📞 Support

**Deployment Status**: https://github.com/ketan0103/warmpawzaws/actions  
**AWS Console**: https://ap-south-1.console.aws.amazon.com/

**Common Commands**:
```bash
# Check current deployment
gh run list --repo ketan0103/warmpawzaws --branch develop --limit 5

# View specific run
gh run view <RUN_ID> --repo ketan0103/warmpawzaws

# Re-trigger last workflow
gh workflow run "🚀 Deploy to Development" --repo ketan0103/warmpawzaws --ref develop

# Cancel running workflow
gh run cancel <RUN_ID> --repo ketan0103/warmpawzaws
```

---

**Last Updated**: 2026-01-04  
**Pipeline Version**: 1.0 (fully idempotent)  
**Account**: 057442119249 (ap-south-1)

