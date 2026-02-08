# Production Lambda Not Showing in RDS Console Dropdown - Troubleshooting

## Issue
When trying to set up Lambda connection via RDS console, the `warmpawz-prod-api-handler` function doesn't appear in the "Choose a Lambda function" dropdown.

## Root Causes

### 1. Lambda Not Deployed
The Lambda function might not exist yet or hasn't been deployed.

**Check:**
```bash
aws lambda get-function --function-name warmpawz-prod-api-handler --region ap-south-1
```

**Fix:** Deploy the Lambda function via Terraform:
```bash
cd warmpawzApp/warmpawzaws/infra/envs/prod
terraform apply
```

### 2. Lambda Not in VPC
The console only shows Lambda functions that are in the same VPC as the RDS cluster.

**Check Lambda VPC Configuration:**
```bash
aws lambda get-function-configuration \
  --function-name warmpawz-prod-api-handler \
  --region ap-south-1 \
  --query 'VpcConfig'
```

**Expected Output:**
```json
{
  "SubnetIds": ["subnet-xxx", "subnet-yyy"],
  "SecurityGroupIds": ["sg-xxx"],
  "VpcId": "vpc-02a4893e5e582c4d8"
}
```

**Check RDS Cluster VPC:**
```bash
aws rds describe-db-clusters \
  --db-cluster-identifier warmpawz-prod-cluster \
  --region ap-south-1 \
  --query 'DBClusters[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text | xargs -I {} aws ec2 describe-security-groups \
    --group-ids {} \
    --query 'SecurityGroups[0].VpcId' \
    --output text
```

**Fix if VPC Mismatch:**
- Ensure both Lambda and RDS are in the same VPC (`vpc-02a4893e5e582c4d8` for prod)
- Update Terraform configuration if needed
- Re-deploy Lambda with correct VPC configuration

### 3. Console Refresh Issue
The console might need a refresh or the Lambda was just created.

**Fix:**
1. Click the refresh icon next to the Lambda dropdown
2. Wait 1-2 minutes after Lambda deployment
3. Try closing and reopening the setup page

### 4. Lambda Function Name Mismatch
Verify the exact function name matches what's in Terraform.

**Check:**
```bash
aws lambda list-functions \
  --region ap-south-1 \
  --query 'Functions[?contains(FunctionName, `warmpawz-prod`)].FunctionName' \
  --output table
```

**Expected:** `warmpawz-prod-api-handler`

## Current Configuration (from Terraform)

### Lambda VPC Config
- **VPC ID**: `module.vpc.vpc_id` (should be `vpc-02a4893e5e582c4d8`)
- **Subnets**: `module.vpc.private_subnet_ids`
- **Security Group**: `aws_security_group.lambda.id`

### RDS VPC Config
- **VPC ID**: `module.vpc.vpc_id` (same as Lambda)
- **Subnets**: `module.vpc.database_subnet_ids`
- **Security Group**: `aws_security_group.rds.id`

### Verification Steps

1. **Verify Lambda exists:**
   ```bash
   aws lambda get-function --function-name warmpawz-prod-api-handler
   ```

2. **Verify Lambda VPC:**
   ```bash
   aws lambda get-function-configuration \
     --function-name warmpawz-prod-api-handler \
     --query 'VpcConfig.VpcId' \
     --output text
   ```
   Should return: `vpc-02a4893e5e582c4d8`

3. **Verify RDS VPC:**
   ```bash
   # Get RDS security group
   RDS_SG=$(aws rds describe-db-clusters \
     --db-cluster-identifier warmpawz-prod-cluster \
     --query 'DBClusters[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
     --output text)
   
   # Get VPC ID from security group
   aws ec2 describe-security-groups \
     --group-ids $RDS_SG \
     --query 'SecurityGroups[0].VpcId' \
     --output text
   ```
   Should return: `vpc-02a4893e5e582c4d8`

4. **Compare VPCs:**
   ```bash
   LAMBDA_VPC=$(aws lambda get-function-configuration \
     --function-name warmpawz-prod-api-handler \
     --query 'VpcConfig.VpcId' \
     --output text)
   
   RDS_SG=$(aws rds describe-db-clusters \
     --db-cluster-identifier warmpawz-prod-cluster \
     --query 'DBClusters[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
     --output text)
   
   RDS_VPC=$(aws ec2 describe-security-groups \
     --group-ids $RDS_SG \
     --query 'SecurityGroups[0].VpcId' \
     --output text)
   
   echo "Lambda VPC: $LAMBDA_VPC"
   echo "RDS VPC: $RDS_VPC"
   ```
   Both should be the same.

## Alternative: Manual Connection Setup

If the Lambda still doesn't appear, you can manually configure the connection:

### Option 1: Use Existing RDS Proxy (Recommended)
Since you already have `warmpawz-prod-proxy` created via Terraform:

1. **Go to RDS Proxy Console:**
   - Navigate to **RDS → Proxies**
   - Find `warmpawz-prod-proxy`
   - Click on it

2. **Add Lambda Connection:**
   - Go to **Connected compute resources** tab
   - Click **"Set up Lambda connection"**
   - Select `warmpawz-prod-api-handler` (should appear here if it's in the same VPC)
   - Click **Connect**

### Option 2: Skip Console Setup
The connection will work functionally even if it doesn't show in the console, as long as:
- ✅ Lambda is in the same VPC as RDS
- ✅ Security groups allow traffic
- ✅ IAM permissions are configured
- ✅ Lambda uses proxy endpoint in `DB_HOST`

## Quick Fix Checklist

- [ ] Verify Lambda function exists: `aws lambda get-function --function-name warmpawz-prod-api-handler`
- [ ] Verify Lambda is in VPC: Check `VpcConfig` in function configuration
- [ ] Verify Lambda VPC matches RDS VPC: Both should be `vpc-02a4893e5e582c4d8`
- [ ] Refresh the console dropdown
- [ ] Try setting up connection via RDS Proxy console instead of RDS cluster console
- [ ] Wait 2-3 minutes after Lambda deployment before trying console setup

## Next Steps

1. **First**: Verify Lambda exists and is in the correct VPC
2. **Then**: Try the RDS Proxy console method (Option 1 above)
3. **If still not working**: The functional connection should still work - verify via CloudWatch logs
