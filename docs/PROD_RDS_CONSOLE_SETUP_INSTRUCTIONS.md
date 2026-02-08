# Production RDS Lambda Connection - Console Setup Instructions

## ⚠️ CRITICAL: Do NOT Create a New Proxy

You already have `warmpawz-prod-proxy` created via Terraform. Creating a new proxy will:
- Create duplicate infrastructure
- Cause confusion and potential conflicts
- Waste resources

## Recommended Method: Use RDS Proxy Console

### Step 1: Navigate to RDS Proxy Console
1. Go to **AWS RDS Console**
2. Click **"Proxies"** in the left sidebar (NOT "Databases")
3. Find and click on **`warmpawz-prod-proxy`**

### Step 2: Set Up Lambda Connection
1. In the proxy details page, go to the **"Connected compute resources"** tab
2. Click **"Set up Lambda connection"** button
3. Select **`warmpawz-prod-api-handler`** from the dropdown
4. Click **"Connect"**

This method is better because:
- ✅ Works with existing Terraform-managed proxy
- ✅ Doesn't try to create duplicate resources
- ✅ More reliable connection detection

## Alternative: Use Database Console (If Proxy Appears)

If you want to use the database console method:

### Step 1: Select Existing Proxy
1. In the "RDS Proxy" section, select **"Choose existing proxy"** radio button
2. Look for **`warmpawz-prod-proxy`** in the dropdown
3. If it appears, select it

### Step 2: Enter Database Credentials
1. **Username**: `warmpawz_admin`
2. **Password**: Get from Secrets Manager:
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id <prod-rds-secret-arn> \
     --query SecretString \
     --output text | jq -r .password
   ```

### Step 3: Complete Setup
1. Review the connection summary
2. Click **"Set up"**

## If Existing Proxy Doesn't Appear

If `warmpawz-prod-proxy` doesn't appear in the dropdown, it might be because:
- The proxy isn't properly associated with the cluster in the console's view
- There's a timing/refresh issue

**Solution**: Use the RDS Proxy console method (Step 1 above) - it's more reliable.

## Verify Existing Proxy

Check if your proxy exists:
```bash
aws rds describe-db-proxies \
  --db-proxy-name warmpawz-prod-proxy \
  --region ap-south-1
```

Check if proxy is associated with cluster:
```bash
aws rds describe-db-proxy-targets \
  --db-proxy-name warmpawz-prod-proxy \
  --region ap-south-1
```

## After Setup

Once connected, you should see:
- **Resource identifier**: `warmpawz-prod-api-handler`
- **Resource type**: `Lambda function`
- **Connected proxy**: `warmpawz-prod-proxy`

## Cross-AZ Warning

The warning about Cross-AZ charges is normal if:
- Lambda and RDS are in different Availability Zones
- This is expected in a multi-AZ setup
- Charges are minimal for internal VPC traffic

## Troubleshooting

If connection fails:
1. Verify Lambda is in same VPC as RDS: `vpc-02a4893e5e582c4d8`
2. Check security groups allow traffic
3. Verify IAM permissions for `rds-db:connect`
4. Check CloudWatch logs for connection errors
