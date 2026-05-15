# AWS Support Case Created

## Case Information

**Case ID:** `case-057442119249-muen-2026-d3270440c0645a66`

**Subject:** Lambda AccessDeniedException despite AdministratorAccess policy

**Service:** AWS Lambda

**Category:** Permissions (real-permissions)

**Severity:** Normal

**Issue Type:** Technical

**Status:** Unassigned (Case created, awaiting assignment to support engineer)

**Display ID:** 177359376600459

**Created:** 2026-03-15T16:56:06.361Z

**Last Checked:** 2026-03-15

## View Case

**AWS Console:** https://console.aws.amazon.com/support/home#/case/view?caseId=case-057442119249-muen-2026-d3270440c0645a66

## Problem Summary

User 'shivangtiwari' (Account: 057442119249) is experiencing AccessDeniedException when trying to access Lambda functions in ap-south-1 region, despite having AdministratorAccess policy attached.

## Details Included in Case

1. **Error Details:**
   - AccessDeniedException when calling ListFunctions/GetFunction operations
   - User: shivangtiwari
   - Account: 057442119249
   - Region: ap-south-1

2. **Policies Attached:**
   - AdministratorAccess (AWS Managed Policy)
   - perkmissiontolambda (Custom Managed Policy)
   - WarmpawzLambdaReadAccess (Inline Policy)
   - WarmpawzLambdaFullAccess (Inline Policy)
   - Warmpawz_lambda_Permission (Inline Policy)

3. **Account Status:**
   - Account is healthy (S3, EC2, Service Quotas all accessible)
   - Lambda service is enabled (quotas visible)
   - Not part of AWS Organizations (no SCPs)
   - No Permissions Boundary attached

4. **Troubleshooting Attempts:**
   - Applied multiple Lambda permission policies
   - Verified policies are correctly attached
   - Waited for IAM propagation (10+ minutes)
   - Checked for SCPs - none found
   - Checked account health - appears healthy

## Next Steps

1. **Monitor Case:** Check the AWS Support Console for updates
2. **Respond Promptly:** AWS Support may ask for additional information
3. **Provide Additional Details:** If requested, refer to:
   - `scripts/LAMBDA_ACCESS_TROUBLESHOOTING.md`
   - `scripts/BILLING_ACCOUNT_CHECK.md`
   - `scripts/support-case-details.json`

## Related Files

- `scripts/support-case-details.json` - Full case details in JSON format
- `scripts/CREATE_SUPPORT_CASE_MANUAL.md` - Manual case creation guide (if needed)
- `scripts/LAMBDA_ACCESS_TROUBLESHOOTING.md` - Troubleshooting documentation
- `scripts/BILLING_ACCOUNT_CHECK.md` - Billing check results

## Expected Response Time

- **Normal Severity:** AWS Support typically responds within 24 hours
- **Business/Enterprise Support:** Faster response times available

## Follow-up Actions

Once AWS Support responds:
1. Review their recommendations
2. Test any suggested solutions
3. Update this document with resolution steps
4. Close the case once resolved

---

**Case Created:** 2026-03-15  
**Last Updated:** 2026-03-15
