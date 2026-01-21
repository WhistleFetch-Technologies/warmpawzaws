# RDS Password Authentication Fix - Complete Guide

## Problem Summary

The GitHub Actions workflow was failing with:
```
FATAL: password authentication failed for user "warmpawz_admin"
```

**Root Cause:**
- Secrets Manager had password: `Warmpawz2026` ✅
- RDS cluster had a different password ❌
- `DEV_DATABASE_URL` (if set) might have old password ❌
- Password update step was being skipped when `DEV_DATABASE_URL` was set ❌

## Complete Fix Applied

### 1. Always Fetch RDS Info (Even with DEV_DATABASE_URL)
- **Before**: When `DEV_DATABASE_URL` was set, script exited early without fetching RDS info
- **After**: Always fetches RDS endpoint and secret ARN before checking `DEV_DATABASE_URL`
- **Result**: Password update step can always find the secret ARN

### 2. IAM Permission Verification
- Added step to verify all required permissions before attempting operations
- Tests: `secretsmanager:GetSecretValue`, `secretsmanager:PutSecretValue`, `rds:ModifyDBCluster`
- Fails early with clear error messages if permissions are missing
- Provides exact IAM policy JSON needed

### 3. Always Update RDS Cluster Password
- **Before**: Only updated if Secrets Manager password was wrong
- **After**: ALWAYS updates RDS cluster password to match `Warmpawz2026`
- **Result**: Ensures RDS cluster and Secrets Manager are always synchronized

### 4. Rebuild DEV_DATABASE_URL After Password Update
- **Before**: Used original `DEV_DATABASE_URL` which might have old password
- **After**: Always rebuilds `DEV_DATABASE_URL` with correct password (`Warmpawz2026`)
- **Result**: Connectivity test uses updated credentials

### 5. Enhanced Retry Logic
- Increased retries from 3 to 5
- Increasing wait times: 10s, 20s, 30s, 40s
- Waits 20 seconds after password update before first test
- Better error messages with debugging info

## Required IAM Permissions

Your IAM user (with `AWS_ACCESS_KEY_ID`) needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:PutSecretValue",
        "secretsmanager:ListSecrets",
        "rds:DescribeDBClusters",
        "rds:ModifyDBCluster"
      ],
      "Resource": [
        "arn:aws:secretsmanager:ap-south-1:*:secret:warmpawz-dev-rds-master-*",
        "arn:aws:rds:ap-south-1:*:cluster:warmpawz-dev-cluster"
      ]
    }
  ]
}
```

## How to Apply IAM Permissions

1. Go to AWS Console → IAM → Users
2. Select your IAM user (the one with `AWS_ACCESS_KEY_ID`)
3. Click "Add permissions" → "Create inline policy"
4. Use JSON editor and paste the policy above
5. Name it: `GitHubActionsRDSSecretsAccess`
6. Save

## Verification Steps

### 1. Check IAM Permissions
The workflow will automatically verify permissions. Look for:
```
✅ secretsmanager:GetSecretValue - OK
✅ secretsmanager:PutSecretValue - OK
✅ rds:DescribeDBClusters - OK
✅ rds:ModifyDBCluster - OK
```

### 2. Check Password Update
Look for:
```
✅ RDS cluster password update initiated
✅ RDS cluster is available
✅ Password synchronization complete!
```

### 3. Check Credentials Rebuild
Look for:
```
🔄 Rebuilding database credentials with updated password...
✅ Rebuilt DATABASE_URL with correct password (Warmpawz2026)
```

### 4. Check Authentication
Look for:
```
✅ PostgreSQL connection successful
```

## Manual Verification (If Needed)

If the workflow still fails, manually verify:

### 1. Check Secrets Manager Password
```bash
aws secretsmanager get-secret-value \
  --secret-id <YOUR_SECRET_ARN> \
  --query SecretString \
  --output text | jq -r '.password'
```
Should return: `Warmpawz2026`

### 2. Check RDS Cluster Status
```bash
aws rds describe-db-clusters \
  --db-cluster-identifier warmpawz-dev-cluster \
  --query 'DBClusters[0].{Status:Status,PendingModifiedValues:PendingModifiedValues}' \
  --output json
```
Check if password update is pending.

### 3. Manually Update RDS Password (If Needed)
```bash
aws rds modify-db-cluster \
  --db-cluster-identifier warmpawz-dev-cluster \
  --master-user-password 'Warmpawz2026' \
  --apply-immediately \
  --region ap-south-1
```

### 4. Test Connection
```bash
psql "postgresql://warmpawz_admin:Warmpawz2026@warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com:5432/warmpawz" \
  -c "SELECT version();"
```

## What Changed in the Workflow

### Commit History
1. `d1f2c8264` - Fixed S3 deployment (dist/ directory)
2. `303526aa3` - Added password verification and update
3. `8a32ff47a` - Always sync RDS password
4. `a786f549e` - Improved retry logic
5. `db8c2cb1f` - Added IAM permission checks
6. `211017b66` - Always fetch RDS info even with DEV_DATABASE_URL
7. `371d97150` - Always rebuild DEV_DATABASE_URL with correct password

### Key Improvements
- ✅ Password update always runs (not skipped)
- ✅ RDS cluster password always synchronized
- ✅ DEV_DATABASE_URL always rebuilt with correct password
- ✅ IAM permissions verified before operations
- ✅ Better error messages and debugging
- ✅ Enhanced retry logic with increasing wait times

## Expected Behavior on Next Deployment

1. **Get credentials** → Fetches RDS info even if DEV_DATABASE_URL is set
2. **Verify IAM permissions** → Checks all required permissions
3. **Update password** → Updates Secrets Manager and RDS cluster to `Warmpawz2026`
4. **Wait for completion** → Waits for RDS cluster to be available
5. **Rebuild credentials** → Rebuilds DEV_DATABASE_URL with correct password
6. **Test connection** → Uses updated credentials (should succeed!)
7. **Check schema** → Proceeds with schema deployment

## Troubleshooting

### Still Getting Authentication Failed?

1. **Check IAM permissions** - The workflow will show exactly what's missing
2. **Verify RDS password was updated** - Check AWS Console → RDS → Cluster
3. **Check Secrets Manager** - Verify password is `Warmpawz2026`
4. **Wait longer** - RDS password updates can take 1-2 minutes to propagate
5. **Check username** - Ensure it's `warmpawz_admin` (not `postgres`)

### Permission Denied Errors?

See `IAM_PERMISSIONS_REQUIRED.md` for complete IAM policy and application instructions.

## Success Indicators

When everything works, you should see:
```
✅ All required IAM permissions verified!
✅ Secrets Manager password is correct
✅ RDS cluster password update initiated
✅ RDS cluster is available
✅ Password synchronization complete!
✅ Rebuilt DATABASE_URL with correct password
✅ PostgreSQL connection successful
✅ Database is ready for schema check
```

