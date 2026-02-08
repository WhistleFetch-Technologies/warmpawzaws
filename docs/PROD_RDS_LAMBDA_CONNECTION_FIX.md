# Production RDS Lambda Connection - Console Display Fix

## Issue
The production RDS cluster (`warmpawz-prod-cluster`) shows **0 connected compute resources** in the AWS console, even though the Lambda function (`warmpawz-prod-api-handler`) is configured to connect via RDS Proxy.

## Root Cause
The RDS console only displays connections that were **automatically created by RDS** (via the console's "Set up Lambda connection" button). Connections created manually via Terraform won't appear until:
1. The Lambda actually makes a successful connection attempt, OR
2. You manually register it using the console

**Dev Environment**: Was set up using the console's "Set up Lambda connection" button, which is why it appears in the console.

**Prod Environment**: Created entirely via Terraform, so it doesn't appear in the console UI (even though the connection may work functionally).

## Solution: Register Lambda via Console

### Step 1: Navigate to RDS Proxy
1. Go to AWS RDS Console
2. Select **Proxies** from the left menu
3. Find and click on `warmpawz-prod-proxy`

### Step 2: Set Up Lambda Connection
1. In the proxy details page, go to the **Connected compute resources** tab
2. Click the **"Set up Lambda connection"** button
3. Select `warmpawz-prod-api-handler` from the dropdown
4. Click **Connect**

### Step 3: Verify Connection
After setup, you should see:
- **Resource identifier**: `warmpawz-prod-api-handler`
- **Resource type**: `Lambda function`
- **Connected proxy**: `warmpawz-prod-proxy`

## Alternative: Verify Functional Connection

If you want to verify the connection works without using the console:

### Test Connection via CloudWatch Logs
1. Invoke the Lambda function (via API Gateway or direct invocation)
2. Check CloudWatch Logs for `/aws/lambda/warmpawz-prod-api-handler`
3. Look for successful database connection messages

### Test via AWS CLI
```bash
# Check if Lambda can connect to RDS Proxy
aws lambda invoke \
  --function-name warmpawz-prod-api-handler \
  --payload '{"path":"/health"}' \
  response.json

# Check CloudWatch logs
aws logs tail /aws/lambda/warmpawz-prod-api-handler --follow
```

## Configuration Verification

### Current Prod Configuration ✅
- **Lambda Function**: `warmpawz-prod-api-handler`
- **RDS Cluster**: `warmpawz-prod-cluster`
- **RDS Proxy**: `warmpawz-prod-proxy`
- **DB_HOST**: Set to proxy endpoint (`module.rds.proxy_endpoint`)
- **IAM Permissions**: `rds-db:connect` policy configured
- **Security Groups**: Lambda SG allowed in Proxy SG
- **VPC**: Both in same VPC

### Why It Should Work
All infrastructure is correctly configured:
- ✅ Lambda has `rds_proxy_arn` configured
- ✅ Lambda has `rds-db:connect` IAM permission
- ✅ Security groups allow Lambda → Proxy → RDS
- ✅ Lambda uses proxy endpoint in `DB_HOST`
- ✅ All resources in same VPC

## Important Note
**The console display is cosmetic** - it doesn't affect actual connectivity. If the Lambda can connect to the database, the connection is working regardless of what the console shows.

However, using the console's "Set up Lambda connection" button will:
- Make it visible in the console
- Ensure all automatic connection management features work
- Provide better monitoring and troubleshooting visibility

## Next Steps
1. **Recommended**: Use the console to register the connection (takes 2 minutes)
2. **Alternative**: Test the connection functionally and ignore the console display
3. **Future**: Consider using AWS CDK or CloudFormation to automate this registration
