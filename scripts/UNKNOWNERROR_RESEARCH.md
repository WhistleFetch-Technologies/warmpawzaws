# UnknownError - Access Denied Research

## Error Message
**"Access denied to: You don't have permission to perform this action. UnknownError"**

## Research Findings

Based on web research and AWS documentation, the "UnknownError" with access denied typically indicates:

### 1. IAM Policy Evaluation Issues

**Common causes:**
- **Policy syntax errors** preventing proper evaluation
- **Resource-based policies** on Lambda functions overriding identity-based policies
- **Trust policy problems** - Execution role trust policy must explicitly trust `lambda.amazonaws.com`
- **Policy attachment issues** - Policies may be attached but not properly evaluated

### 2. Critical Finding: Credential Refresh Issue

**IMPORTANT:** According to AWS documentation, when you update Lambda execution role permissions, you **MUST** perform a trivial update to the function's code or configuration to force running instances to refresh their credentials.

**Without this update, the function continues using outdated credentials even after policy changes.**

### 3. Lambda Permission Issues - Four Main Scenarios

According to AWS re:Post, Lambda access denial typically stems from:

1. **Lambda lacks EC2 permissions** to create elastic network interfaces (for VPC functions)
2. **User account lacks permissions** to create, update, or delete Lambda resources
3. **Invoking AWS service lacks permission** to invoke the Lambda function
4. **Lambda execution role lacks permission** to run actions in its code

### 4. Why AdministratorAccess May Not Work

Even with `AdministratorAccess` attached, access can still be denied due to:

- **Service Control Policies (SCPs)** at organization level
- **Permissions boundaries** restricting what even AdministratorAccess can do
- **Resource-based policies** on specific Lambda functions
- **IAM propagation delays** (can take 5-15 minutes)
- **Session/credential caching** - Old sessions may use cached permissions

### 5. UnknownError Specifics

The "UnknownError" message is often a generic error that AWS returns when:
- The actual error cannot be determined
- There's a policy evaluation failure
- There's a service-level issue
- Credentials are stale or invalid

## Recommended Actions

### Immediate Steps

1. **Check CloudTrail Logs**
   ```powershell
   aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=ListFunctions --start-time <TIME> --end-time <TIME>
   ```
   This will show the actual error code and message, not just "UnknownError"

2. **Verify Execution Role Trust Policy**
   ```powershell
   # Get Lambda function role
   aws lambda get-function-configuration --function-name <FUNCTION_NAME> --query 'Role'
   
   # Check trust policy
   aws iam get-role --role-name <ROLE_NAME> --query 'Role.AssumeRolePolicyDocument'
   ```
   Ensure it trusts `lambda.amazonaws.com`

3. **Force Credential Refresh**
   - Update Lambda function code/config (even a trivial change)
   - This forces running instances to refresh credentials
   - Wait 2-3 minutes after update

4. **Check Resource-Based Policies**
   ```powershell
   aws lambda get-policy --function-name <FUNCTION_NAME>
   ```
   Resource-based policies can override identity-based policies

5. **Verify IAM Policy Evaluation**
   - Use IAM Policy Simulator: https://policysim.aws.amazon.com/
   - Test specific actions: `lambda:ListFunctions`, `lambda:GetFunction`
   - Check if policies are being evaluated correctly

### Advanced Troubleshooting

6. **Check for Deny Statements**
   - Review all attached policies for explicit Deny statements
   - Deny statements override Allow statements

7. **Session Refresh**
   - Log out and back into AWS Console
   - Run `aws configure` to refresh CLI credentials
   - Clear browser cache/cookies

8. **Wait for IAM Propagation**
   - Policy changes can take 5-15 minutes to propagate
   - Wait and retry after 15 minutes

9. **Check Service Health**
   - AWS Service Health Dashboard: https://status.aws.amazon.com/
   - Check if Lambda has any ongoing issues in ap-south-1

## Key Resources

1. **AWS re:Post - Lambda Permissions Issues**
   https://repost.aws/knowledge-center/lambda-permissions-issues

2. **AWS IAM Troubleshooting Guide**
   https://docs.aws.amazon.com/IAM/latest/UserGuide/troubleshoot_policies.html

3. **Lambda Execution Role Documentation**
   https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html

4. **IAM Policy Simulator**
   https://policysim.aws.amazon.com/

## Next Steps

1. ✅ Check CloudTrail for actual error details (not just "UnknownError")
2. ✅ Verify execution role trust policy
3. ✅ Force credential refresh by updating Lambda function
4. ✅ Use IAM Policy Simulator to test policy evaluation
5. ✅ Check resource-based policies on Lambda functions
6. ✅ Wait for AWS Support response (Case ID: case-057442119249-muen-2026-d3270440c0645a66)

## Important Note

The "UnknownError" message is often a red herring. The **actual error code and message** will be in CloudTrail logs. Always check CloudTrail for the real error details rather than relying on the generic "UnknownError" message.

---

**Research Date:** 2026-03-15  
**Sources:** AWS re:Post, AWS Documentation, AWS IAM Troubleshooting Guide
