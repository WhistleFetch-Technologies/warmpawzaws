# Lambda Access Troubleshooting Guide

## Current Situation

**User:** `shivangtiwari`  
**Account:** `057442119249`  
**Region:** `ap-south-1`  
**Issue:** `AccessDeniedException` when accessing Lambda functions

## Policies Currently Attached

### Managed Policies
1. **AdministratorAccess** (AWS Managed)
   - Should grant full access to all AWS services
   - ARN: `arn:aws:iam::aws:policy/AdministratorAccess`

2. **perkmissiontolambda** (Custom Managed Policy)
   - Unknown contents - needs verification
   - ARN: `arn:aws:iam::057442119249:policy/perkmissiontolambda`

### Inline Policies
1. **Warmpawz_lambda_Permission**
   - Effect: Allow
   - Action: `lambda:*`
   - Resource: `*`

2. **WarmpawzLambdaFullAccess**
   - Effect: Allow
   - Actions: `lambda:*` on `warmpawz-*` functions
   - Also includes IAM PassRole, CloudWatch Logs, IAM Role Management

3. **WarmpawzLambdaReadAccess** (Amazon Q Suggested)
   - Effect: Allow
   - Actions: `lambda:ListFunctions`, `lambda:GetFunction`, `lambda:GetFunctionConfiguration`
   - Resource: `arn:aws:lambda:ap-south-1:057442119249:function/*`

## The Problem

Despite having:
- ✅ `AdministratorAccess` (should grant everything)
- ✅ Multiple inline policies allowing Lambda access
- ✅ No Permissions Boundary
- ✅ S3 access works (confirming IAM is generally functional)

**Lambda access is still denied.**

## Possible Root Causes

### 1. Service Control Policy (SCP) - Most Likely
If your AWS account is part of an AWS Organization, there may be an SCP blocking Lambda access.

**How to Check:**
1. Go to AWS Organizations console: https://console.aws.amazon.com/organizations/
2. Check for Service Control Policies
3. Look for any policies that might deny Lambda access

**Note:** Only Organization administrators can view/modify SCPs.

### 2. AWS Session Not Refreshed
The AWS CLI/Console session might be using cached credentials.

**Solution:**
```powershell
# Refresh AWS credentials
aws configure
# Or log out and back into AWS Console
```

### 3. Account-Level Restrictions
Some AWS accounts have service-level restrictions.

**How to Check:**
- Contact AWS Support
- Check AWS Service Control Policies
- Verify account status in AWS Billing console

### 4. Policy Evaluation Order
Multiple policies might be conflicting (unlikely with Allow statements, but possible).

**Solution:**
- Remove redundant inline policies
- Keep only the most permissive one

## Recommended Actions

### Immediate Steps

1. **Verify in AWS Console:**
   - Go to: https://console.aws.amazon.com/iam/home#/users/shivangtiwari
   - Check Permissions tab
   - Verify all policies are showing correctly
   - Try accessing Lambda from Console: https://console.aws.amazon.com/lambda/

2. **Check the `perkmissiontolambda` Policy:**
   ```powershell
   aws iam get-policy --policy-arn arn:aws:iam::057442119249:policy/perkmissiontolambda
   aws iam get-policy-version --policy-arn arn:aws:iam::057442119249:policy/perkmissiontolambda --version-id <VERSION_ID>
   ```
   - Verify it doesn't have a Deny statement
   - Check if it's properly scoped

3. **Refresh AWS Session:**
   ```powershell
   # Get fresh credentials
   aws sts get-caller-identity
   
   # Test Lambda access
   aws lambda list-functions --region ap-south-1
   ```

4. **Wait for Full Propagation:**
   - IAM changes can take 5-15 minutes to fully propagate
   - Wait 10 minutes, then test again

### If Still Not Working

5. **Check AWS Organizations:**
   - Verify if account is in an Organization
   - Check for Service Control Policies
   - Contact Organization administrator if needed

6. **Contact AWS Support:**
   - Open a support case
   - Provide:
     - Account ID: `057442119249`
     - User: `shivangtiwari`
     - Error: `AccessDeniedException` on `lambda:ListFunctions`
     - List of attached policies
     - Confirmation that `AdministratorAccess` is attached but not working

7. **Try Alternative Approach:**
   - Use a different IAM user/role
   - Use AWS CloudShell (might have different permissions)
   - Check if root account can access Lambda

## Policy Files Created

All policy files are in `warmpawzApp/warmpawzaws/scripts/`:

1. **lambda-read-policy.json** - Minimal read-only access (Amazon Q suggested)
2. **lambda-full-permissions-policy.json** - Full Lambda access with IAM/Logs
3. **apply-lambda-permissions.ps1** - Script to apply policies
4. **LAMBDA_PERMISSIONS_SETUP.md** - Setup guide

## Testing Commands

```powershell
# Test Lambda access
aws lambda list-functions --region ap-south-1

# Test specific function
aws lambda get-function --function-name warmpawz-prod-api-handler --region ap-south-1

# Verify identity
aws sts get-caller-identity

# List all policies
aws iam list-user-policies --user-name shivangtiwari
aws iam list-attached-user-policies --user-name shivangtiwari
```

## Next Steps

1. ✅ Policies have been applied (read-only and full access)
2. ⏳ Wait 10-15 minutes for IAM propagation
3. 🔄 Refresh AWS session/credentials
4. 🔍 Check AWS Organizations for SCPs
5. 📞 Contact AWS Support if issue persists

## Important Notes

- **AdministratorAccess should grant Lambda access** - The fact that it doesn't suggests an SCP or account-level restriction
- **Multiple Allow policies don't conflict** - Having multiple Allow statements is fine
- **IAM propagation can take time** - But 10+ minutes is unusual
- **Session refresh is important** - Old sessions might use cached permissions

---

**Last Updated:** After applying Amazon Q's suggested read-only policy  
**Status:** Policies applied, access still denied - likely SCP or session issue
