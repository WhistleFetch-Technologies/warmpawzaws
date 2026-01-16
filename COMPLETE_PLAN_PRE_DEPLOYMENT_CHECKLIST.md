# Complete Plan Feature - Pre-Deployment Checklist

## ✅ Code Verification

### Backend Files
- [x] `backend/lambda/src/endpoints/care-plans.ts` - Created
- [x] `backend/lambda/src/endpoints/ui-dashboard-config.ts` - Created
- [x] `backend/lambda/src/handler/index.ts` - Endpoints registered
- [x] `backend/lambda/serverless.yml` - Bedrock permissions added

### Frontend Files
- [x] `apps/admin-web/app/support/page.tsx` - Complete Plan button added
- [x] `apps/admin-web/components/admin/support/CompletePlanModal.tsx` - Created

### Database Files
- [x] `db/migrations/059_create_care_plans_tables.sql` - Created

## 🔍 Pre-Deployment Verification

### 1. Code Compilation
```bash
cd backend/lambda
npm run build
# Should compile without errors
```

### 2. Import Verification
Verify these imports exist in `handler/index.ts`:
- ✅ `import { registerUIDashboardConfigEndpoints } from '../endpoints/ui-dashboard-config';`
- ✅ `import { registerCarePlansEndpoints } from '../endpoints/care-plans';`

### 3. Registration Verification
Verify these calls exist in `handler/index.ts`:
- ✅ `registerUIDashboardConfigEndpoints(app);`
- ✅ `registerCarePlansEndpoints(app);`

### 4. Serverless.yml Verification
Verify Bedrock permissions exist:
```yaml
# AWS Bedrock Access (for AI plan generation)
- Effect: Allow
  Action:
    - bedrock:InvokeModel
    - bedrock:InvokeModelWithResponseStream
  Resource:
    - arn:aws:bedrock:${self:provider.region}::foundation-model/*
```

### 5. Database Migration Verification
Check migration file:
- ✅ Tables: `pet_care_plans`, `care_plan_items`, `care_plan_templates`
- ✅ Indexes created
- ✅ Triggers created
- ✅ Default templates inserted (3 templates)

## 🚀 Deployment Order

### Step 1: Database Migration (FIRST)
```bash
# Must run BEFORE backend deployment
psql -U your_user -d your_database -f db/migrations/059_create_care_plans_tables.sql
```

### Step 2: Backend Deployment
```bash
cd backend/lambda
npm install  # If dependencies changed
npm run build
serverless deploy --stage dev
```

### Step 3: Frontend Deployment
```bash
cd apps/admin-web
npm install  # If dependencies changed
npm run build
# Deploy to hosting platform
```

## 🧪 Post-Deployment Testing

### Test 1: Backend Endpoints
```bash
# Test UI Dashboard Config
curl -X GET "https://your-api-url/config/ui/dashboard?roleId=veterinarian"

# Expected: JSON with buttons array including "complete_plan"

# Test Plan Templates
curl -X GET "https://your-api-url/crm/plans/templates?planType=wellness"

# Expected: JSON with templates array
```

### Test 2: Frontend UI
1. Navigate to Marketing > Dashboard UI tab
2. Verify "Complete Plan" button appears in list
3. Navigate to Support & CRM
4. Open any ticket
5. Verify "Complete Plan" button appears in actions
6. Click button - modal should open

### Test 3: Plan Generation
1. In Complete Plan modal:
   - Select pet
   - Choose plan type
   - Select "AI Generated"
   - Click "Generate Plan"
2. Verify success notification
3. Check database:
   ```sql
   SELECT * FROM pet_care_plans ORDER BY created_at DESC LIMIT 1;
   SELECT * FROM care_plan_items WHERE plan_id = 'PLAN_ID';
   ```

## ⚠️ Common Issues & Solutions

### Issue: Build fails
**Solution:** Check TypeScript errors, ensure all imports are correct

### Issue: Deployment fails
**Solution:** 
- Check AWS credentials
- Verify serverless.yml syntax
- Check CloudWatch logs

### Issue: Endpoints return 404
**Solution:**
- Verify endpoints registered in handler/index.ts
- Check API Gateway routes
- Verify deployment succeeded

### Issue: Database errors
**Solution:**
- Ensure migration ran successfully
- Check table permissions
- Verify foreign key constraints

### Issue: Bedrock errors
**Solution:**
- Verify Bedrock permissions in IAM
- Check Bedrock is enabled in platform settings
- Verify model access in AWS console

## 📊 Success Metrics

After deployment, verify:
- ✅ No build errors
- ✅ No deployment errors
- ✅ Endpoints respond correctly
- ✅ UI components render
- ✅ Plan generation works
- ✅ Database operations succeed
- ✅ No console errors

## 🎯 Rollback Plan

If deployment fails:

1. **Disable Feature:**
   - Set Complete Plan button to `enabled: false` in Dashboard UI config
   - Or comment out button in support/page.tsx

2. **Revert Code:**
   ```bash
   git revert <commit-hash>
   ```

3. **Redeploy:**
   ```bash
   serverless deploy --stage dev
   ```

## ✅ Ready to Deploy!

All code is ready. Follow the deployment order above.

**Estimated Time:**
- Database Migration: 2 minutes
- Backend Deployment: 5-10 minutes
- Frontend Deployment: 5 minutes
- Testing: 10 minutes

**Total: ~30 minutes**
