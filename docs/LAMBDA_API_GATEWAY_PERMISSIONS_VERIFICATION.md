# Lambda API Gateway Permissions Verification

## Date: 2026-02-09

## Current Status

### ✅ PROD Lambda Function - CORRECT

**Function:** `warmpawz-prod-api-handler`  
**API Gateway Permission:** `arn:aws:execute-api:ap-south-1:057442119249:mss9sa4y01/*/*`  
**Status:** ✅ **CORRECT** - Has PROD API Gateway (`mss9sa4y01`)

**Policy:**
```json
{
  "Version": "2012-10-17",
  "Id": "default",
  "Statement": [
    {
      "Sid": "AllowAPIGatewayInvoke-api-handler",
      "Effect": "Allow",
      "Principal": {
        "Service": "apigateway.amazonaws.com"
      },
      "Action": "lambda:InvokeFunction",
      "Resource": "arn:aws:lambda:ap-south-1:057442119249:function:warmpawz-prod-api-handler",
      "Condition": {
        "ArnLike": {
          "AWS:SourceArn": "arn:aws:execute-api:ap-south-1:057442119249:mss9sa4y01/*/*"
        }
      }
    }
  ]
}
```

### ✅ DEV Lambda Function - CORRECT

**Function:** `warmpawz-api-dev-api`  
**API Gateway Permission:** `arn:aws:execute-api:ap-south-1:057442119249:z0b3obweb6/*`  
**Status:** ✅ **CORRECT** - Has DEV API Gateway (`z0b3obweb6`)

---

## API Gateway IDs

| Environment | API Gateway ID | Endpoint |
|-------------|----------------|----------|
| **PROD** | `mss9sa4y01` | `https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com` |
| **DEV** | `z0b3obweb6` | `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com` |

---

## How to Check Permissions

### Check a Specific Lambda Function

```bash
# Get the policy
aws lambda get-policy \
  --function-name warmpawz-prod-api-handler \
  --region ap-south-1

# Extract API Gateway ID from policy
aws lambda get-policy \
  --function-name warmpawz-prod-api-handler \
  --region ap-south-1 \
  --query 'Policy' \
  --output text | jq -r '.Statement[] | select(.Principal.Service == "apigateway.amazonaws.com") | .Condition.ArnLike."AWS:SourceArn"'
```

### Verify All Functions

```bash
# Run the verification script
bash scripts/verify-lambda-api-gateway-permissions.sh
```

---

## If You Find Wrong Permissions

If you find a Lambda function with the wrong API Gateway permission, use the fix script:

```bash
# Fix PROD function
bash scripts/fix-lambda-api-gateway-permission.sh warmpawz-prod-api-handler

# Fix DEV function
bash scripts/fix-lambda-api-gateway-permission.sh warmpawz-api-dev-api
```

### Manual Fix

If you need to fix manually:

```bash
# 1. Remove old permission
aws lambda remove-permission \
  --function-name <function-name> \
  --statement-id <old-statement-id> \
  --region ap-south-1

# 2. Add correct permission for PROD
aws lambda add-permission \
  --function-name <function-name> \
  --statement-id "AllowAPIGatewayInvoke-<function-name>" \
  --action "lambda:InvokeFunction" \
  --principal "apigateway.amazonaws.com" \
  --source-arn "arn:aws:execute-api:ap-south-1:057442119249:mss9sa4y01/*/*" \
  --region ap-south-1

# Or for DEV
aws lambda add-permission \
  --function-name <function-name> \
  --statement-id "AllowAPIGatewayInvoke-<function-name>" \
  --action "lambda:InvokeFunction" \
  --principal "apigateway.amazonaws.com" \
  --source-arn "arn:aws:execute-api:ap-south-1:057442119249:z0b3obweb6/*/*" \
  --region ap-south-1
```

---

## Common Issues

### Issue 1: Lambda Function Has Wrong API Gateway Permission

**Symptoms:**
- API Gateway returns 403 or 500 errors
- CloudWatch logs show "AccessDenied" errors
- Lambda function exists but API Gateway can't invoke it

**Solution:**
- Use the fix script: `bash scripts/fix-lambda-api-gateway-permission.sh <function-name>`

### Issue 2: No Permission at All

**Symptoms:**
- `aws lambda get-policy` returns "ResourceNotFoundException"
- API Gateway can't invoke Lambda

**Solution:**
- Add permission using the fix script or manual command above

### Issue 3: Multiple Permissions (Old + New)

**Symptoms:**
- Policy has multiple statements
- One points to DEV, one to PROD

**Solution:**
- Remove old permission first, then add correct one
- The fix script handles this automatically

---

## Verification Checklist

- [ ] PROD Lambda (`warmpawz-prod-api-handler`) has PROD API Gateway (`mss9sa4y01`)
- [ ] DEV Lambda (`warmpawz-api-dev-api`) has DEV API Gateway (`z0b3obweb6`)
- [ ] No PROD functions have DEV API Gateway permissions
- [ ] No DEV functions have PROD API Gateway permissions
- [ ] All API Gateway integrations point to correct Lambda functions

---

## Current Configuration Summary

| Lambda Function | API Gateway | Status |
|----------------|-------------|--------|
| `warmpawz-prod-api-handler` | `mss9sa4y01` (PROD) | ✅ Correct |
| `warmpawz-api-dev-api` | `z0b3obweb6` (DEV) | ✅ Correct |

---

## Notes

- The PROD Lambda function **currently has the correct permission** for PROD API Gateway
- If you saw a different permission earlier, it may have been:
  1. A different function name
  2. An old/cached view
  3. A function that has since been fixed

- Always verify the actual function name you're checking matches what you expect
