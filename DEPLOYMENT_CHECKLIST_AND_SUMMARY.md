# DEPLOYMENT CHECKLIST & IMPLEMENTATION SUMMARY

**Date:** January 2026  
**Architecture:** AWS Serverless (Lambda, RDS, Cognito, CloudFront)  
**Status:** Ready for Deployment

---

## 📋 IMPLEMENTATION SUMMARY

### **Files Created/Updated:**

1. **Implementation Plan:** `IMPLEMENTATION_PLAN_MISSING_PIECES.md`
   - Complete implementation plans for all 8 missing pieces
   - AWS Serverless compatible architecture
   - Testing strategies

2. **Form Schema Generator:** `backend/lambda/src/lib/form-schema-generator.ts`
   - Complete form schemas for all 20 roles
   - Type-safe schema generation
   - Role-specific field definitions

3. **Role Permissions Migration:** `db/migrations/051_seed_role_permissions.sql`
   - Permissions seeding for all 20 roles
   - Capability-to-permission mapping
   - Verification queries

4. **Test Script:** `scripts/test-vendor-onboarding-flow.ts`
   - End-to-end testing for all 20 roles
   - Complete flow validation
   - Error reporting

5. **Flow Documentation:** `VENDOR_SIGNUP_TO_DASHBOARD_COMPLETE_FLOW.md`
   - Complete flow analysis
   - All 20 roles documented
   - Validation checks

---

## 🚀 DEPLOYMENT CHECKLIST

### **Phase 1: Database Setup**

- [ ] **Run Migration 047:** Seed 20 roles
  ```bash
  psql -h $RDS_HOST -U $RDS_USER -d $RDS_DATABASE -f db/migrations/047_seed_roles.sql
  ```

- [ ] **Run Migration 049:** Vendor onboarding state machine
  ```bash
  psql -h $RDS_HOST -U $RDS_USER -d $RDS_DATABASE -f db/migrations/049_vendor_onboarding_state_machine.sql
  ```

- [ ] **Run Migration 050:** Complete form schemas (if created)
  ```bash
  # Update role configs with complete schemas using form-schema-generator.ts
  ```

- [ ] **Run Migration 051:** Seed role permissions
  ```bash
  psql -h $RDS_HOST -U $RDS_USER -d $RDS_DATABASE -f db/migrations/051_seed_role_permissions.sql
  ```

- [ ] **Verify Database:**
  ```sql
  -- Check roles
  SELECT COUNT(*) FROM roles WHERE is_active = true; -- Should be 20
  
  -- Check permissions
  SELECT r.name, COUNT(rp.id) as permission_count
  FROM roles r
  LEFT JOIN role_permissions rp ON r.id = rp.role_id
  WHERE r.is_active = true
  GROUP BY r.name
  ORDER BY r.name;
  ```

---

### **Phase 2: Lambda Functions**

- [ ] **Update Lambda Handler:**
  - [ ] Add form schema generator import
  - [ ] Update `GetOnboardingFormSchemaHandler` to use generator
  - [ ] Add capability enforcement middleware
  - [ ] Update state machine handlers

- [ ] **Environment Variables:**
  ```bash
  COGNITO_USER_POOL_ID=us-east-1_xxxxx
  COGNITO_CLIENT_ID=xxxxx
  RDS_HOST=xxxxx.rds.amazonaws.com
  RDS_DATABASE=warmpawz
  RDS_USER=admin
  RDS_PASSWORD=xxxxx
  API_BASE_URL=https://api.warmpawz.com
  ```

- [ ] **Deploy Lambda Functions:**
  ```bash
  cd backend/lambda
  npm run build
  # Deploy using CDK or SAM
  cdk deploy
  ```

- [ ] **Test Lambda Functions:**
  ```bash
  # Test form schema generation
  aws lambda invoke --function-name GetOnboardingFormSchema \
    --payload '{"queryStringParameters":{"phone":"+911234567890"}}' \
    response.json
  ```

---

### **Phase 3: API Gateway**

- [ ] **Configure Routes:**
  - [ ] `/vendor/onboarding/roles` → GetAvailableRolesHandler
  - [ ] `/vendor/onboarding/select-role` → SelectRoleHandler
  - [ ] `/vendor/onboarding/form-schema` → GetOnboardingFormSchemaHandler
  - [ ] `/vendor/onboarding/submit-application` → SubmitApplicationHandler
  - [ ] `/vendor/{vendorId}/dashboard` → VendorDashboardStatsHandler
  - [ ] `/config/roles/{roleId}` → GetRoleHandler

- [ ] **Configure CORS:**
  ```json
  {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  }
  ```

- [ ] **Configure Authentication:**
  - [ ] Set up Cognito Authorizer
  - [ ] Configure API Gateway to use Cognito
  - [ ] Test token validation

---

### **Phase 4: Cognito Setup**

- [ ] **Create User Pool:**
  ```bash
  aws cognito-idp create-user-pool \
    --pool-name warmpawz-vendors \
    --policies PasswordPolicy={MinimumLength=8} \
    --auto-verified-attributes email phone_number
  ```

- [ ] **Create User Pool Client:**
  ```bash
  aws cognito-idp create-user-pool-client \
    --user-pool-id us-east-1_xxxxx \
    --client-name warmpawz-vendor-client \
    --generate-secret \
    --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH
  ```

- [ ] **Configure Custom Attributes:**
  - [ ] `phone` (custom attribute)
  - [ ] `vendor_id` (custom attribute)
  - [ ] `role_id` (custom attribute)

- [ ] **Test Cognito Integration:**
  ```bash
  # Test OTP flow
  aws cognito-idp admin-create-user \
    --user-pool-id us-east-1_xxxxx \
    --username +911234567890 \
    --user-attributes Name=phone_number,Value=+911234567890
  ```

---

### **Phase 5: Frontend Deployment**

- [ ] **Build Next.js App:**
  ```bash
  cd apps/vendor-web
  npm run build
  ```

- [ ] **Environment Variables:**
  ```bash
  NEXT_PUBLIC_API_BASE_URL=https://api.warmpawz.com
  NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxx
  NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxx
  ```

- [ ] **Upload to S3:**
  ```bash
  aws s3 sync .next/static s3://warmpawz-vendor-web/static
  aws s3 sync public s3://warmpawz-vendor-web/public
  ```

- [ ] **Configure CloudFront:**
  - [ ] Create distribution
  - [ ] Set S3 as origin
  - [ ] Configure cache behaviors
  - [ ] Set up SSL certificate
  - [ ] Configure custom domain

- [ ] **Deploy Middleware:**
  - [ ] Ensure `middleware.ts` is in root of `apps/vendor-web`
  - [ ] Test route guards
  - [ ] Verify redirects

---

### **Phase 6: Testing**

- [ ] **Run Unit Tests:**
  ```bash
  npm run test
  ```

- [ ] **Run Integration Tests:**
  ```bash
  npm run test:integration
  ```

- [ ] **Run E2E Tests:**
  ```bash
  # Set API base URL
  export API_BASE_URL=https://api.warmpawz.com
  
  # Run test script
  ts-node scripts/test-vendor-onboarding-flow.ts
  ```

- [ ] **Manual Testing:**
  - [ ] Test OTP flow
  - [ ] Test role selection for each of 20 roles
  - [ ] Test form submission
  - [ ] Test admin approval
  - [ ] Test dashboard loading
  - [ ] Test capability filtering

---

### **Phase 7: Monitoring & Logging**

- [ ] **CloudWatch Logs:**
  - [ ] Create log groups for Lambda functions
  - [ ] Set up log retention (30 days)
  - [ ] Configure log filters

- [ ] **CloudWatch Metrics:**
  - [ ] Set up custom metrics:
    - `VendorOnboarding.RoleSelected`
    - `VendorOnboarding.ApplicationSubmitted`
    - `VendorOnboarding.VendorActivated`
    - `VendorOnboarding.DashboardLoaded`

- [ ] **Error Tracking:**
  - [ ] Set up SNS topic for errors
  - [ ] Configure Lambda error notifications
  - [ ] Set up CloudWatch alarms

- [ ] **Performance Monitoring:**
  - [ ] Monitor Lambda execution time
  - [ ] Monitor RDS query performance
  - [ ] Monitor API Gateway latency

---

## 🔍 VERIFICATION STEPS

### **1. Verify All 20 Roles Exist:**
```sql
SELECT name, display_name, is_active 
FROM roles 
WHERE is_active = true 
ORDER BY name;
-- Should return 20 rows
```

### **2. Verify Role Permissions:**
```sql
SELECT r.name, COUNT(rp.id) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.is_active = true
GROUP BY r.name
HAVING COUNT(rp.id) > 0
ORDER BY r.name;
-- All 20 roles should have permissions
```

### **3. Verify Form Schemas:**
```bash
# Test API endpoint
curl -X GET "https://api.warmpawz.com/vendor/onboarding/form-schema?phone=+911234567890" \
  -H "Authorization: Bearer $TOKEN"

# Should return schema with fields for selected role
```

### **4. Verify Dashboard Loading:**
```bash
# Test dashboard endpoint
curl -X GET "https://api.warmpawz.com/vendor/{vendorId}/dashboard" \
  -H "Authorization: Bearer $TOKEN"

# Should return stats and capabilities
```

### **5. Verify Route Guards:**
- [ ] Try accessing `/dashboard` without activation → Should redirect
- [ ] Try accessing `/onboarding/form` without role selection → Should redirect
- [ ] Verify status-based routing works correctly

---

## 📊 EXPECTED RESULTS

### **After Deployment:**

1. **All 20 Roles:**
   - ✅ Roles seeded in database
   - ✅ Permissions mapped correctly
   - ✅ Form schemas available

2. **Complete Flow:**
   - ✅ OTP verification works
   - ✅ Role selection works for all roles
   - ✅ Form submission works
   - ✅ Admin approval works
   - ✅ Vendor activation works
   - ✅ Dashboard loads with correct capabilities

3. **Route Guards:**
   - ✅ Status-based routing enforced
   - ✅ Unauthorized access blocked
   - ✅ Redirects work correctly

4. **Dashboard:**
   - ✅ Stats calculated correctly
   - ✅ Capabilities filtered by role
   - ✅ Specialized sections render

---

## 🐛 TROUBLESHOOTING

### **Common Issues:**

1. **Form Schema Not Found:**
   - Check if role config has `onboardingFields`
   - Verify form schema generator is imported
   - Check Lambda logs for errors

2. **Permissions Not Loading:**
   - Verify migration 051 ran successfully
   - Check `role_permissions` table
   - Verify role_id matches

3. **Route Guards Not Working:**
   - Check middleware.ts is in correct location
   - Verify API endpoint for status check
   - Check Cognito token validation

4. **Dashboard Stats Empty:**
   - Verify bookings exist in database
   - Check date range calculations
   - Verify vendor_id is correct

---

## 📝 POST-DEPLOYMENT TASKS

- [ ] **Documentation:**
  - [ ] Update API documentation
  - [ ] Update user guides
  - [ ] Document role-specific features

- [ ] **Training:**
  - [ ] Train admin team on approval process
  - [ ] Train support team on troubleshooting
  - [ ] Create video tutorials

- [ ] **Monitoring:**
  - [ ] Set up dashboards
  - [ ] Configure alerts
  - [ ] Schedule regular reviews

---

## ✅ SUCCESS CRITERIA

- [ ] All 20 roles can complete onboarding
- [ ] All 20 roles can access dashboard
- [ ] Capabilities filter correctly per role
- [ ] Route guards enforce status-based access
- [ ] Form schemas load for all roles
- [ ] Dashboard stats calculate correctly
- [ ] E2E tests pass for all roles
- [ ] No critical errors in CloudWatch logs

---

## 📞 SUPPORT

For issues or questions:
1. Check CloudWatch logs
2. Review implementation plan document
3. Check test script output
4. Review database state

---

**End of Deployment Checklist**

