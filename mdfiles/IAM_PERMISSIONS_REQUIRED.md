# Required IAM Permissions for GitHub Actions

## Overview

The GitHub Actions workflow requires specific IAM permissions to:
1. Read and update Secrets Manager
2. Modify RDS cluster passwords
3. Describe RDS clusters

## Required Permissions

### For Secrets Manager

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:PutSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:ap-south-1:*:secret:warmpawz-dev-rds-master-*"
    }
  ]
}
```

### For RDS Cluster

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "rds:DescribeDBClusters",
        "rds:ModifyDBCluster"
      ],
      "Resource": "arn:aws:rds:ap-south-1:*:cluster:warmpawz-dev-cluster"
    }
  ]
}
```

## Complete IAM Policy

Here's the complete policy you can attach to your IAM user or role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SecretsManagerAccess",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret",
        "secretsmanager:PutSecretValue",
        "secretsmanager:ListSecrets"
      ],
      "Resource": [
        "arn:aws:secretsmanager:ap-south-1:*:secret:warmpawz-dev-rds-master-*"
      ]
    },
    {
      "Sid": "RDSClusterAccess",
      "Effect": "Allow",
      "Action": [
        "rds:DescribeDBClusters",
        "rds:ModifyDBCluster",
        "rds:DescribeDBInstances"
      ],
      "Resource": [
        "arn:aws:rds:ap-south-1:*:cluster:warmpawz-dev-cluster",
        "arn:aws:rds:ap-south-1:*:db:warmpawz-dev-instance-*"
      ]
    }
  ]
}
```

## How to Apply

### Option 1: Attach to IAM User (for GitHub Actions with Access Keys)

1. Go to AWS Console → IAM → Users
2. Select your IAM user (the one with AWS_ACCESS_KEY_ID)
3. Click "Add permissions" → "Create inline policy"
4. Use JSON editor and paste the policy above
5. Name it: `GitHubActionsRDSSecretsAccess`
6. Save

### Option 2: Attach to IAM Role (if using OIDC)

1. Go to AWS Console → IAM → Roles
2. Select your GitHub Actions role
3. Click "Add permissions" → "Create inline policy"
4. Use JSON editor and paste the policy above
5. Name it: `GitHubActionsRDSSecretsAccess`
6. Save

## Verification

After applying the permissions, the workflow will automatically verify them in the "Verify AWS IAM permissions" step. You should see:

```
✅ secretsmanager:GetSecretValue - OK
✅ secretsmanager:PutSecretValue - OK
✅ rds:DescribeDBClusters - OK
✅ rds:ModifyDBCluster - OK
```

If any permission is missing, the workflow will fail with a clear error message showing exactly what permission is needed.

## Troubleshooting

### Error: "AccessDenied" when updating Secrets Manager

**Solution:** Add `secretsmanager:PutSecretValue` permission to your IAM user/role.

### Error: "AccessDenied" when modifying RDS cluster

**Solution:** Add `rds:ModifyDBCluster` permission to your IAM user/role.

### Error: "Cannot describe RDS cluster"

**Solution:** Add `rds:DescribeDBClusters` permission to your IAM user/role.

## Security Best Practices

1. **Principle of Least Privilege**: Only grant the minimum permissions needed
2. **Resource-Level Permissions**: Restrict to specific secrets and clusters (as shown above)
3. **Regular Audits**: Review permissions periodically
4. **Use IAM Roles**: Prefer IAM roles with OIDC over access keys when possible

## Current Status

The workflow now includes automatic permission verification. If permissions are missing, the workflow will:
1. ✅ Detect the missing permission
2. ✅ Show a clear error message
3. ✅ Provide the exact IAM policy needed
4. ✅ Fail early before attempting operations

This prevents silent failures and makes it easy to identify and fix permission issues.

