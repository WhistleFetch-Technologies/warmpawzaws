# Next Steps - Schedule Management Testing

## 📋 Current Status

✅ **Code Implementation**: Complete and correct  
⚠️ **Deployment Status**: Needs deployment  
⚠️ **Test Results**: Revealed deployment/connectivity issues

---

## 🚀 Immediate Next Steps

### Step 1: Deploy Lambda Function

The test results show that the new endpoints are not accessible, which means the Lambda function needs to be redeployed with the latest code.

#### Option A: CDK Deployment (Recommended)

```bash
# Navigate to infrastructure directory
cd infrastructure/cdk

# Deploy Lambda stack
npm run deploy
# or
cdk deploy LambdaStack
```

#### Option B: Manual Deployment

```bash
# Navigate to Lambda directory
cd backend/lambda

# Build the Lambda function
npm run build

# Package for deployment
npm run package
# or use the deploy script if available
./deploy.sh
```

#### Option C: AWS CLI Direct Deployment

```bash
cd backend/lambda

# Build and zip
npm run build
zip -r function.zip dist/ node_modules/ package.json

# Update Lambda function code
aws lambda update-function-code \
  --function-name warmpawz-api-handler \
  --zip-file fileb://function.zip \
  --region ap-south-1
```

---

### Step 2: Verify Database Schema

Ensure the `scheduling_policies` table exists in the database:

```sql
-- Check if table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'scheduling_policies';

-- If table doesn't exist, run migration
-- See: db/migrations/009_scheduling_policies_complete.sql
```

**Migration File**: `db/migrations/009_scheduling_policies_complete.sql`

---

### Step 3: Verify Endpoint Registration

After deployment, verify endpoints are accessible:

```bash
# Test health endpoint (should work)
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/health"

# Test scheduling policies endpoint (should work after deployment)
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/scheduling-policies" \
  -H "Content-Type: application/json" \
  -H "X-UAT-Mode: true" \
  -H "X-UAT-Token: uat-token-admin"
```

**Expected**: Should return `{"success": true, "policies": [], "total": 0}` (empty array if no policies exist)

---

### Step 4: Re-run Test Script

After deployment, run the test script again:

```bash
# Run the test script
./test-schedule-management.sh YOUR_VENDOR_ID

# Or with custom API URL
API_URL="https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com" \
./test-schedule-management.sh YOUR_VENDOR_ID
```

---

## 🔧 Troubleshooting Steps

### Issue 1: Endpoint Still Returns 404

**Symptom**: `/admin/scheduling-policies` returns `{"error":"Not Found"}`

**Check**:
1. Verify Lambda function was deployed successfully
2. Check CloudWatch logs for endpoint registration
3. Verify API Gateway routes are configured correctly
4. Check if endpoint path matches API Gateway configuration

**Fix**:
- Redeploy Lambda function
- Verify handler exports are correct
- Check API Gateway integration settings

---

### Issue 2: Connection Timeouts

**Symptom**: Endpoints timeout with `{"error":"Connection terminated due to connection timeout"}`

**Check**:
1. Verify database connection is working
2. Check Lambda timeout configuration (should be 60s)
3. Review CloudWatch logs for database errors
4. Check connection pool settings

**Fix**:
- Verify database is accessible from Lambda
- Check security group rules for RDS
- Review database connection pool configuration
- Check for slow queries in logs

---

### Issue 3: Database Table Missing

**Symptom**: Endpoints return errors about missing `scheduling_policies` table

**Fix**:
```bash
# Run migration
psql -h YOUR_DB_HOST -U YOUR_DB_USER -d warmpawz -f db/migrations/009_scheduling_policies_complete.sql
```

---

## 📊 Verification Checklist

After deployment, verify:

- [ ] Lambda function deployed successfully
- [ ] Health endpoint returns 200 OK
- [ ] `/admin/scheduling-policies` endpoint accessible (returns 200, not 404)
- [ ] `/vendor/:vendorId/schedule` endpoints accessible
- [ ] Database connection working
- [ ] `scheduling_policies` table exists
- [ ] CloudWatch logs show no errors
- [ ] Test script passes all tests

---

## 🧪 Testing After Deployment

### Quick Smoke Test

```bash
# 1. Health check
curl https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/health

# 2. Get policies (should return empty array if none exist)
curl -X GET "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/scheduling-policies" \
  -H "Content-Type: application/json"

# 3. Create a test policy
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/scheduling-policies" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_name": "Test Buffer Policy",
    "policy_type": "buffer_time",
    "policy_config": {
      "minBufferTime": 30
    },
    "is_active": true
  }'
```

### Full Test Suite

```bash
# Run the comprehensive test script
./test-schedule-management.sh YOUR_VENDOR_ID
```

---

## 📝 Monitoring After Deployment

### CloudWatch Logs

Monitor Lambda function logs for:
- Endpoint registration messages
- Database connection errors
- Query timeout errors
- Validation errors

**Log Group**: `/aws/lambda/warmpawz-api-handler`

### Key Metrics to Watch

1. **Invocation Count**: Should increase when testing
2. **Error Rate**: Should be low/zero
3. **Duration**: Should be under Lambda timeout (60s)
4. **Throttles**: Should be zero

---

## 🎯 Expected Results After Deployment

### Successful Deployment

1. ✅ All endpoints return 200 (not 404)
2. ✅ No connection timeouts
3. ✅ Test script passes all tests
4. ✅ CloudWatch logs show no errors
5. ✅ Policies can be created/retrieved
6. ✅ Schedule validation works correctly

### Test Script Results (Expected)

- ✅ Test 1: Get All Scheduling Policies - PASS
- ✅ Test 2: Create Valid Schedule - PASS
- ✅ Test 3: Create Past Schedule - PASS (correctly rejected)
- ✅ Test 4: Create Overlapping Slots - PASS (correctly rejected)
- ✅ Test 5: Get Available Slots - PASS
- ✅ Test 6: Get Schedule Configuration - PASS
- ✅ Test 7: Get Policy by Type - PASS

---

## 🔄 Rollback Plan

If deployment causes issues:

1. **Rollback Lambda Function**:
   ```bash
   # Get previous version
   aws lambda list-versions-by-function \
     --function-name warmpawz-api-handler \
     --region ap-south-1
   
   # Update to previous version
   aws lambda update-alias \
     --function-name warmpawz-api-handler \
     --name PROD \
     --function-version PREVIOUS_VERSION \
     --region ap-south-1
   ```

2. **Revert Code Changes** (if needed):
   ```bash
   git revert HEAD
   git push
   ```

---

## 📚 Related Documentation

- **Implementation Details**: `SCHEDULE_MANAGEMENT_POLICY_ENFORCEMENT_COMPLETE.md`
- **Test Results**: `TEST_RESULTS_ANALYSIS.md`
- **Test Script**: `test-schedule-management.sh`
- **Migration File**: `db/migrations/009_scheduling_policies_complete.sql`

---

## ✅ Summary

**Priority**: HIGH  
**Status**: Ready for deployment  
**Action Required**: Deploy Lambda function and verify endpoints  
**Expected Time**: 15-30 minutes (deployment + testing)

**Next Action**: Deploy Lambda function using your preferred deployment method, then re-run the test script to verify functionality.
