# How to Check CloudTrail for Real Error Details

Since CloudTrail CLI access may require additional permissions, here's how to check via AWS Console:

## Step 1: Navigate to CloudTrail Event History

**URL:** https://console.aws.amazon.com/cloudtrail/home?region=ap-south-1#/events

## Step 2: Filter Events

### Filter by Event Name
1. Click "Filter" or use the search box
2. Select "Event name" filter
3. Enter: `ListFunctions` or `GetFunction`
4. Click "Apply"

### Filter by Username
1. Add another filter
2. Select "User name" filter
3. Enter: `shivangtiwari`
4. Click "Apply"

### Filter by Error Code
1. Add another filter
2. Select "Error code" filter
3. Enter: `AccessDenied` or `AccessDeniedException`
4. Click "Apply"

## Step 3: Review Event Details

Click on any event to see:
- **Event time**
- **Event name** (e.g., ListFunctions)
- **User identity** (shivangtiwari)
- **Error code** (e.g., AccessDeniedException)
- **Error message** (the actual error message, not "UnknownError")
- **Request parameters**
- **Response elements**

## Step 4: Look for These Details

The real error will show:
- **Actual error code** (not just "UnknownError")
- **Detailed error message** explaining why access was denied
- **Request parameters** showing what was attempted
- **User identity** confirming it's your user

## Alternative: Check CloudWatch Logs

If CloudTrail doesn't show the error, check CloudWatch Logs:

1. Go to: https://console.aws.amazon.com/cloudwatch/
2. Navigate to "Logs" > "Log groups"
3. Look for: `/aws/lambda/` log groups
4. Check recent log streams for error messages

## What to Look For

The actual error message might be:
- `User: arn:aws:iam::057442119249:user/shivangtiwari is not authorized to perform: lambda:ListFunctions`
- `AccessDeniedException: User does not have permission to call lambda:ListFunctions`
- `InvalidUserIdentityException: The security token included in the request is invalid`
- Or other specific error codes/messages

## Export Event Details

1. Select the event
2. Click "Download event" or "View event JSON"
3. This will show the complete event details including the real error message

## Key Information to Extract

When you find the error, note:
1. **Exact error code** (e.g., AccessDeniedException, InvalidUserIdentityException)
2. **Error message** (the detailed message explaining the denial)
3. **Request ID** (for AWS Support reference)
4. **Event time** (when it occurred)

## Share with AWS Support

Include this information in your support case:
- Case ID: `case-057442119249-muen-2026-d3270440c0645a66`
- Actual error code from CloudTrail
- Actual error message from CloudTrail
- Request ID from the event

This will help AWS Support diagnose the real issue instead of the generic "UnknownError".

---

**Note:** CloudTrail Event History shows events from the last 90 days. If the error is older, you may need to check CloudTrail logs stored in S3.
