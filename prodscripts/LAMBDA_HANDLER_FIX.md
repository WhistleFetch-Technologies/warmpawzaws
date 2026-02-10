# Lambda Handler Configuration Fix

## Issue Found
The Lambda function `warmpawz-prod-api-handler` was configured with handler `index.handler`, but the deployment package structure requires `handler.handler`.

## Root Cause
1. **Terraform Configuration** (`infra/envs/prod/main.tf` line 217) specifies: `handler = "index.handler"`
2. **Build Output** (`backend/lambda/dist/handler.js`) creates: `dist/handler.js`
3. **Package Script** (`backend/lambda/package.json`) zips from inside `dist/`, so the zip contains `handler.js` at root level
4. **Mismatch**: Handler was looking for `index.handler` but package has `handler.js`

## Fix Applied
✅ Updated Lambda handler configuration to `handler.handler`:
```bash
aws lambda update-function-configuration \
  --function-name warmpawz-prod-api-handler \
  --region ap-south-1 \
  --handler "handler.handler"
```

## Verification
After the fix, test OPTIONS request:
```bash
curl -X OPTIONS \
  "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/auth/send-otp" \
  -H "Origin: https://d1y5ywletev82x.cloudfront.net" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization" \
  -v
```

Expected: HTTP 200 (not 500)

## Next Steps
1. ✅ Handler configuration fixed
2. ⏳ Wait for Lambda to update (check `LastUpdateStatus`)
3. ⏳ Test OPTIONS request returns 200
4. ⏳ Verify CORS works in browser
5. ⚠️ If still failing, may need to rebuild and redeploy Lambda package

## Terraform Fix Needed
Update `infra/envs/prod/main.tf` line 217:
```hcl
handler = "handler.handler"  # Changed from "index.handler"
```

This ensures future Terraform deployments use the correct handler.
