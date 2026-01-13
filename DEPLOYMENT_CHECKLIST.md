# Deployment Checklist - Hard Refresh Fix

## Pre-Deployment

- [x] Code changes complete
- [x] Test scripts created
- [x] Documentation updated
- [ ] Code reviewed
- [ ] Backup current version

## Backend Deployment

### Files to Deploy:
- [ ] `backend/lambda/src/endpoints/auth-enhanced.ts`

### Steps:
1. [ ] Verify fix is in code:
   ```bash
   grep -A 5 "full_name.*Customer" backend/lambda/src/endpoints/auth-enhanced.ts
   ```

2. [ ] Build lambda function:
   ```bash
   cd backend/lambda
   npm run build
   ```

3. [ ] Deploy lambda:
   ```bash
   # Your deployment command
   npm run deploy
   # OR
   ./scripts/deploy-lambda.sh
   ```

4. [ ] Verify deployment:
   ```bash
   # Test customer OTP verify
   curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/auth/verify-otp" \
     -H "Content-Type: application/json" \
     -d '{"phone": "9876543210", "otp": "123456", "role": "customer"}'
   ```
   - Should return token (not database error)

## Frontend Deployment

### Customer Web:
- [ ] `apps/customer-web/lib/session-utils.ts`
- [ ] `apps/customer-web/app/auth/page.tsx`
- [ ] `apps/customer-web/app/page.tsx`

**Steps**:
1. [ ] Build:
   ```bash
   cd apps/customer-web
   npm run build
   ```

2. [ ] Deploy:
   ```bash
   npm run deploy
   # OR your deployment command
   ```

### Vendor Web:
- [ ] `apps/vendor-web/lib/session-utils.ts`
- [ ] `apps/vendor-web/components/vendor/VendorAuth.tsx`
- [ ] `apps/vendor-web/app/page.tsx`

**Steps**:
1. [ ] Build:
   ```bash
   cd apps/vendor-web
   npm run build
   ```

2. [ ] Deploy:
   ```bash
   npm run deploy
   ```

### Admin Web:
- [ ] `apps/admin-web/lib/session-utils.ts`
- [ ] `apps/admin-web/app/page.tsx`
- [ ] `apps/admin-web/components/admin/AdminAuth.tsx`

**Steps**:
1. [ ] Build:
   ```bash
   cd apps/admin-web
   npm run build
   ```

2. [ ] Deploy:
   ```bash
   npm run deploy
   ```

## Post-Deployment Testing

### API Tests:
- [ ] Run `./test-login-flows.sh`
- [ ] Verify all tests pass
- [ ] Check CloudWatch logs for errors

### Browser Tests:
- [ ] Customer login + hard refresh
- [ ] Vendor login + hard refresh
- [ ] Admin login + hard refresh
- [ ] Soft navigation (all user types)

### Verification:
- [ ] Hard refresh clears session (all user types)
- [ ] Soft navigation preserves session (all user types)
- [ ] State-based routing works
- [ ] No console errors
- [ ] No false positives

## Rollback Plan

If issues occur:

1. [ ] Revert backend to previous version
2. [ ] Revert frontend to previous version
3. [ ] Verify system works with previous version
4. [ ] Document issues encountered

## Sign-off

- [ ] Backend deployed and tested
- [ ] Frontend deployed and tested
- [ ] All tests passing
- [ ] Hard refresh working correctly
- [ ] Ready for production

**Deployed by**: _______________
**Date**: _______________
**Verified by**: _______________
