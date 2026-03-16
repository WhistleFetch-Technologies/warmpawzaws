# Lambda Permissions Setup Guide

This guide helps you apply Lambda permissions to the user `shivangtiwari` to resolve `AccessDeniedException` errors.

## Quick Start

### Option 1: Automated Script (Recommended)

```powershell
cd warmpawzApp/warmpawzaws/scripts
.\apply-lambda-permissions.ps1
```

### Option 2: AWS CLI Command

```powershell
aws iam put-user-policy `
    --user-name shivangtiwari `
    --policy-name WarmpawzLambdaFullAccess `
    --policy-document file://warmpawzApp/warmpawzaws/scripts/lambda-full-permissions-policy.json
```

### Option 3: AWS Console (Manual)

Follow the detailed steps below.

---

## Manual Setup via AWS Console

### Step 1: Navigate to IAM Console
1. Go to: https://console.aws.amazon.com/iam/
2. Sign in with your AWS account credentials

### Step 2: Find the User
1. In the left navigation pane, click on **Users**
2. Search for and select the user **`shivangtiwari`**

### Step 3: View Current Permissions
1. Click on the **Permissions** tab
2. Review existing policies (you should see `AdministratorAccess` and possibly `Warmpawz_lambda_Permission`)

### Step 4: Create Inline Policy
1. Click the **Add permissions** button
2. Select **Attach policies directly**
3. Click **Create policy** (or if you see "Add inline policy", click that)
4. In the policy editor, switch to **JSON** view

### Step 5: Copy Policy JSON
1. Open the file: `warmpawzApp/warmpawzaws/scripts/lambda-full-permissions-policy.json`
2. Copy the entire JSON content
3. Paste it into the policy editor in AWS Console

### Step 6: Review and Save
1. Click **Next** or **Review policy**
2. Provide a name: **`WarmpawzLambdaFullAccess`**
3. (Optional) Add description: "Full Lambda access for Warmpawz deployment and management"
4. Click **Create policy** or **Save changes**

### Step 7: Attach Policy to User
1. If you created a managed policy, go back to the user's Permissions tab
2. Click **Add permissions** > **Attach policies directly**
3. Search for and select **`WarmpawzLambdaFullAccess`**
4. Click **Add permissions**

---

## What This Policy Grants

The policy includes permissions for:

### Lambda Functions
- **List Functions**: `lambda:ListFunctions`
- **Read Functions**: `lambda:GetFunction`, `lambda:GetFunctionConfiguration`
- **Create Functions**: `lambda:CreateFunction`
- **Update Functions**: `lambda:UpdateFunctionCode`, `lambda:UpdateFunctionConfiguration`
- **Delete Functions**: `lambda:DeleteFunction`
- **Invoke Functions**: `lambda:InvokeFunction`
- **Manage Permissions**: `lambda:AddPermission`, `lambda:RemovePermission`
- **Version Management**: `lambda:PublishVersion`, `lambda:ListVersionsByFunction`
- **Alias Management**: `lambda:CreateAlias`, `lambda:UpdateAlias`, `lambda:DeleteAlias`
- **Tagging**: `lambda:TagResource`, `lambda:UntagResource`, `lambda:ListTags`

### IAM Roles (for Lambda Execution Roles)
- **Pass Role**: `iam:PassRole` (to assign execution roles to Lambda functions)
- **Role Management**: `iam:GetRole`, `iam:PutRolePolicy`, `iam:DeleteRolePolicy`, etc.

### CloudWatch Logs
- **Create Log Groups**: `logs:CreateLogGroup`
- **Write Logs**: `logs:CreateLogStream`, `logs:PutLogEvents`
- **Read Logs**: `logs:DescribeLogGroups`, `logs:GetLogEvents`, `logs:FilterLogEvents`

### Resource Scope
The policy is scoped to:
- All Warmpawz Lambda functions in `ap-south-1` region
- Specific function patterns: `warmpawz-prod-*`, `warmpawz-dev-*`, `warmpawz-api-*`
- Lambda execution roles: `warmpawz-prod-lambda-*`, `warmpawz-dev-lambda-*`
- CloudWatch log groups: `/aws/lambda/warmpawz-*`

---

## Verification Steps

After applying the policy, wait 1-2 minutes for IAM propagation, then test:

### Test 1: List Lambda Functions
```powershell
aws lambda list-functions --region ap-south-1
```

### Test 2: Get Specific Function
```powershell
aws lambda get-function --function-name warmpawz-prod-api-handler --region ap-south-1
```

### Test 3: Deploy Lambda
```powershell
cd warmpawzApp/warmpawzaws/backend/lambda
npx serverless deploy --stage prod --region ap-south-1
```

---

## Troubleshooting

### Issue: Still Getting AccessDeniedException

**Possible Causes:**
1. **IAM Propagation Delay**: Wait 2-5 minutes and try again
2. **Session Cache**: Log out and back into AWS Console/CLI
3. **Policy Not Applied**: Verify policy is attached in IAM Console
4. **Resource Doesn't Exist**: Lambda function may not exist (check CloudFormation stack state)

**Solutions:**
1. Wait 5-10 minutes for full propagation
2. Refresh AWS credentials:
   ```powershell
   aws sts get-caller-identity  # Verify identity
   ```
3. Check policy attachment:
   ```powershell
   aws iam list-user-policies --user-name shivangtiwari
   aws iam get-user-policy --user-name shivangtiwari --policy-name WarmpawzLambdaFullAccess
   ```
4. Check CloudFormation stack:
   ```powershell
   aws cloudformation describe-stacks --stack-name warmpawz-api-prod --region ap-south-1
   ```

### Issue: Policy Size Limit

If you get a "Policy too large" error:
- The inline policy may be too large
- Consider splitting into multiple inline policies
- Or create a managed policy instead

### Issue: Cannot Create Inline Policy

If you don't have permission to create inline policies:
- Contact your AWS Administrator
- Ask them to apply the policy using the JSON file provided

---

## Policy File Location

- **Policy JSON**: `warmpawzApp/warmpawzaws/scripts/lambda-full-permissions-policy.json`
- **Apply Script**: `warmpawzApp/warmpawzaws/scripts/apply-lambda-permissions.ps1`
- **This Guide**: `warmpawzApp/warmpawzaws/scripts/LAMBDA_PERMISSIONS_SETUP.md`

---

## Additional Notes

- This policy is **scoped** to Warmpawz resources only (not all AWS resources)
- The policy follows **least privilege** principles where possible
- Some actions require `*` resource (like `lambda:ListFunctions`) as per AWS requirements
- The policy includes permissions for both **user access** (what you can do) and **Lambda execution role management** (what Lambda functions can do)

---

## Support

If you continue to experience issues after following this guide:
1. Check AWS CloudTrail logs for detailed error messages
2. Verify your AWS account and region are correct
3. Contact AWS Support or your AWS Administrator
