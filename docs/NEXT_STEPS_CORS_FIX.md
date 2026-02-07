# Next Steps: Deploy and Verify CORS & 500 Fixes

## Quick fix: Customer page CORS preflight (d2aoyjj8ine0wk.cloudfront.net)

If the customer app shows:
- **"Response to preflight request doesn't pass access control check: It does not have HTTP ok status"**
- **"Failed to load resource: net::ERR_FAILED"** on `/customer/profile`, `/customer/by-phone`, `/customer/notifications/...`

**Cause:** API Gateway CORS may not include the customer CloudFront origin or wasn’t applied.

**Fix (run once):**
```bash
./scripts/fix-cors-api-gateway.sh
```
Then hard-refresh the customer page (Cmd+Shift+R). The script updates the existing API `z0b3obweb6` with the correct `AllowOrigins` (including `https://d2aoyjj8ine0wk.cloudfront.net`) and runs a quick OPTIONS test.

**503 on some endpoints** (e.g. `/customer/pets/...`, `/products?featured=true`): Those are separate from CORS — the server is returning Service Unavailable (Lambda timeout, cold start, or backend error). Check CloudWatch logs for the API and Lambda.

---

## Step 1: Build and Deploy Lambda Function

### 1.1 Build the Lambda function
```bash
cd backend/lambda
npm run build
```

### 1.2 Deploy using Serverless Framework
```bash
# Make sure you're in the lambda directory
cd backend/lambda

# Deploy to your environment (dev/staging/prod)
serverless deploy --stage dev
# OR
serverless deploy --stage prod
```

### 1.3 Alternative: Deploy using AWS CLI (if not using Serverless)
```bash
# Package the function
cd backend/lambda
zip -r function.zip dist/ node_modules/

# Update Lambda function code
aws lambda update-function-code \
  --function-name warmpawz-api \
  --zip-file fileb://function.zip \
  --region ap-south-1
```

---

## Step 2: Verify Deployment

### 2.1 Check Lambda function was updated
```bash
aws lambda get-function \
  --function-name warmpawz-api \
  --region ap-south-1 \
  --query 'Configuration.LastModified'
```

### 2.2 Test OPTIONS request (CORS preflight)
```bash
curl -X OPTIONS \
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/platform?roleId=veterinarian&serviceStyle=tele' \
  -H 'Origin: https://d2aoyjj8ine0wk.cloudfront.net' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization,content-type' \
  -v
```

**Expected Result:**
- HTTP Status: `200 OK` (not 500)
- Headers include: `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, etc.

### 2.3 Test notifications endpoint
```bash
curl -X GET \
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/notifications/9611377119?limit=10' \
  -H 'Origin: https://d2aoyjj8ine0wk.cloudfront.net' \
  -v
```

**Expected Result:**
- HTTP Status: `200 OK` (not 500)
- Response body: `{"success": true, "notifications": [...], "unreadCount": 0}`

---

## Step 3: Test in Browser

### 3.1 Clear browser cache
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Or open DevTools → Network tab → Check "Disable cache"

### 3.2 Open browser console
- Open DevTools (F12)
- Go to Console tab
- Look for CORS errors

### 3.3 Test the application
1. Navigate to the customer web app
2. Try to load services/platform endpoint
3. Check notifications
4. Verify no CORS errors in console

---

## Step 4: Monitor CloudWatch Logs

### 4.1 Watch Lambda logs in real-time
```bash
aws logs tail /aws/lambda/warmpawz-api --follow --region ap-south-1
```

### 4.2 Check for errors
Look for:
- ✅ OPTIONS requests returning 200 OK
- ✅ Notifications endpoint returning 200 OK
- ❌ Any 500 errors (should be gone)
- ❌ Any unhandled exceptions

### 4.3 Search for specific errors
```bash
# Search for OPTIONS errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/warmpawz-api \
  --filter-pattern "OPTIONS" \
  --region ap-south-1 \
  --max-items 50

# Search for notifications errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/warmpawz-api \
  --filter-pattern "notifications" \
  --region ap-south-1 \
  --max-items 50
```

---

## Step 5: Run Comprehensive Tests

### 5.1 Run the CORS diagnostic script
```bash
./scripts/test-cors-preflight.sh
```

**Expected:** All tests should pass (200 OK)

### 5.2 Test multiple endpoints
```bash
# Test platform services
curl -X GET \
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/platform?roleId=veterinarian&serviceStyle=tele' \
  -H 'Origin: https://d2aoyjj8ine0wk.cloudfront.net' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -v

# Test available providers
curl -X GET \
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/tele/available-providers?roleId=veterinarian&category=vet&serviceId=instant-general&availableIn=5' \
  -H 'Origin: https://d2aoyjj8ine0wk.cloudfront.net' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -v
```

---

## Step 6: Verify Frontend Integration

### 6.1 Check runtime config
Verify the frontend is using the correct API endpoint:
- Check `runtime-config.js` in CloudFront
- Verify `apiBaseUrl` points to: `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`

### 6.2 Test in production environment
1. Deploy frontend if needed
2. Test in production/staging environment
3. Verify CORS works from CloudFront origin

---

## Step 7: Rollback Plan (if needed)

If issues persist:

### 7.1 Check previous deployment
```bash
# List Lambda versions
aws lambda list-versions-by-function \
  --function-name warmpawz-api \
  --region ap-south-1

# Rollback to previous version (if needed)
aws lambda update-alias \
  --function-name warmpawz-api \
  --name PROD \
  --function-version PREVIOUS_VERSION \
  --region ap-south-1
```

### 7.2 Revert code changes
```bash
git revert HEAD
# Then rebuild and redeploy
```

---

## Troubleshooting

### Issue: OPTIONS still returning 500
**Check:**
1. Lambda function was actually deployed
2. Check CloudWatch logs for errors in OPTIONS handler
3. Verify API Gateway isn't intercepting OPTIONS requests

### Issue: Notifications still returning 500
**Check:**
1. Database connection is working
2. `notifications` table exists
3. CloudWatch logs for specific error messages

### Issue: CORS errors in browser
**Check:**
1. Browser cache is cleared
2. Origin header matches allowed origins
3. Network tab shows OPTIONS request returns 200

---

## Success Criteria

✅ OPTIONS requests return HTTP 200 OK  
✅ CORS headers are present in OPTIONS responses  
✅ Notifications endpoint returns HTTP 200 OK  
✅ No CORS errors in browser console  
✅ API requests succeed from CloudFront origin  
✅ CloudWatch logs show no 500 errors for these endpoints  

---

## Quick Test Commands

```bash
# Quick OPTIONS test
curl -s -o /dev/null -w "%{http_code}" -X OPTIONS \
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/services/platform?roleId=veterinarian&serviceStyle=tele' \
  -H 'Origin: https://d2aoyjj8ine0wk.cloudfront.net'
# Should output: 200

# Quick notifications test
curl -s -o /dev/null -w "%{http_code}" -X GET \
  'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/notifications/9611377119?limit=10'
# Should output: 200
```
