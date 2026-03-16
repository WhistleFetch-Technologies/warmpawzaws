# How to Create AWS Support Case Manually

Since AWS CLI support case creation requires specific support plan permissions, here's how to create the case manually via AWS Console.

## Step-by-Step Instructions

### 1. Navigate to AWS Support Center
**URL:** https://console.aws.amazon.com/support/home

### 2. Click "Create Case"
- Look for the "Create case" button (usually top right)
- Or go directly to: https://console.aws.amazon.com/support/home#/case/create

### 3. Select Case Type
Choose one of:
- **Technical support** (if you have Business/Enterprise support)
- **Account and billing support** (available on all plans)

### 4. Fill in Case Details

**Subject:**
```
Lambda AccessDeniedException despite AdministratorAccess policy
```

**Service:**
- Select: **AWS Lambda** or **IAM** or **Account and Billing**

**Category:**
- Select: **General Information** or **Permissions** or **Account**

**Severity:**
- Select: **Normal** (or **High** if this is blocking production)

**Description:**
Copy and paste the following:

---

**PROBLEM SUMMARY:**
User 'shivangtiwari' (Account: 057442119249) is experiencing AccessDeniedException when trying to access Lambda functions in ap-south-1 region, despite having AdministratorAccess policy attached.

**DETAILED ISSUE:**
- Error: AccessDeniedException when calling ListFunctions/GetFunction operations
- User: shivangtiwari
- Account: 057442119249
- Region: ap-south-1
- Service: AWS Lambda

**POLICIES ATTACHED:**
1. AdministratorAccess (AWS Managed Policy) - ARN: arn:aws:iam::aws:policy/AdministratorAccess
2. perkmissiontolambda (Custom Managed Policy) - Grants lambda:ListFunctions, lambda:GetFunction, lambda:GetFunctionConfiguration
3. WarmpawzLambdaReadAccess (Inline Policy) - Same as above
4. WarmpawzLambdaFullAccess (Inline Policy) - Grants lambda:* on warmpawz-* functions
5. Warmpawz_lambda_Permission (Inline Policy) - Grants lambda:* on all resources

**ACCOUNT STATUS:**
- Account is healthy (S3, EC2, Service Quotas all accessible)
- Lambda service is enabled (quotas visible)
- Not part of AWS Organizations (no SCPs)
- No Permissions Boundary attached
- Other AWS services work normally

**TROUBLESHOOTING ATTEMPTS:**
1. Applied multiple Lambda permission policies (read-only and full access)
2. Verified policies are correctly attached via IAM Console
3. Waited for IAM propagation (10+ minutes)
4. Checked for SCPs - none found
5. Checked account health - appears healthy
6. Verified Lambda service is enabled (quotas visible)

**ERROR DETAILS:**
- Operation: lambda:ListFunctions, lambda:GetFunction
- Error: AccessDeniedException: None
- Region: ap-south-1
- Time: Ongoing issue

**REQUEST:**
Please investigate why AdministratorAccess policy is not granting Lambda access. This appears to be an IAM policy evaluation issue rather than a service availability issue.

**STEPS TO REPRODUCE:**
1. User 'shivangtiwari' tries to list Lambda functions: `aws lambda list-functions --region ap-south-1`
2. Command returns: `AccessDeniedException when calling the ListFunctions operation: None`
3. Same error occurs for GetFunction, GetFunctionConfiguration operations
4. User has AdministratorAccess policy attached which should grant full access
5. Multiple Lambda-specific policies also attached but access still denied

**EXPECTED BEHAVIOR:**
User with AdministratorAccess should be able to list and access Lambda functions without any restrictions.

**ACTUAL BEHAVIOR:**
AccessDeniedException is returned despite AdministratorAccess policy being attached.

---

### 5. Attach Supporting Documents (Optional)

If the console allows file attachments, you can reference:
- `scripts/LAMBDA_ACCESS_TROUBLESHOOTING.md`
- `scripts/BILLING_ACCOUNT_CHECK.md`
- `scripts/support-case-details.json`

### 6. Submit Case
- Review all information
- Click "Submit" or "Create case"

### 7. Case Reference

After creating the case, note the **Case ID** for future reference.

## Alternative: Use AWS Support API (If Available)

If you have Business or Enterprise support, you can try the CLI command:

```powershell
aws support create-case `
    --subject "Lambda AccessDeniedException despite AdministratorAccess policy" `
    --service-code "account-and-billing-support" `
    --severity-code "normal" `
    --category-code "account" `
    --communication-body "User shivangtiwari (Account: 057442119249) experiencing AccessDeniedException when accessing Lambda functions in ap-south-1, despite AdministratorAccess policy. Lambda service enabled, account healthy, no SCPs. Multiple Lambda permission policies applied but access still denied. Please investigate IAM policy evaluation issue." `
    --language "en" `
    --issue-type "account-and-billing"
```

## Quick Links

- **Support Center:** https://console.aws.amazon.com/support/home
- **Create Case:** https://console.aws.amazon.com/support/home#/case/create
- **IAM Console:** https://console.aws.amazon.com/iam/home#/users/shivangtiwari
- **Lambda Console:** https://console.aws.amazon.com/lambda/

## Case Details File

All case details are saved in:
- `scripts/support-case-details.json`

You can copy the content from this file when creating the case manually.
