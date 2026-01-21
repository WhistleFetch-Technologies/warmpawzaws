# Next Steps - Action Plan

## Immediate Actions Required

### 1. Deploy Backend Fix (Priority: HIGH)
**Issue**: Customer creation fails due to missing `full_name` field
**Fix**: Already applied in code, needs deployment

**File**: `backend/lambda/src/endpoints/auth-enhanced.ts`
**Change**: Added `full_name: 'Customer ${phone.slice(-4)}'` when creating new customer

**Deployment Steps**:
```bash
# 1. Verify the fix is in the code
cd backend/lambda/src/endpoints
grep -A 10 "Create customer" auth-enhanced.ts | grep full_name

# 2. Deploy lambda function
# Follow your standard deployment process
# Example:
cd backend/lambda
npm run deploy
# OR
./scripts/deploy-lambda.sh
```

**Verification**:
```bash
# After deployment, test customer login
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210", "role": "customer"}'

curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210", "otp": "123456", "role": "customer"}'
```

**Expected**: Should return token successfully (no database constraint error)

---

### 2. Re-run Automated Tests (Priority: HIGH)
**After backend deployment**, run the test script:

```bash
./test-login-flows.sh
```

**Expected Results**:
- ✅ Customer login: SUCCESS
- ✅ Vendor login: SUCCESS
- ✅ Admin login: SUCCESS
- ✅ All endpoints return tokens
- ✅ All responses include `state` field

---

### 3. Deploy Frontend Changes (Priority: MEDIUM)
**Files Changed**:
- `apps/customer-web/lib/session-utils.ts`
- `apps/customer-web/app/auth/page.tsx`
- `apps/customer-web/app/page.tsx`
- `apps/vendor-web/lib/session-utils.ts`
- `apps/vendor-web/components/vendor/VendorAuth.tsx`
- `apps/vendor-web/app/page.tsx`
- `apps/admin-web/lib/session-utils.ts`
- `apps/admin-web/app/page.tsx`
- `apps/admin-web/components/admin/AdminAuth.tsx`

**Deployment Steps**:
```bash
# Customer Web
cd apps/customer-web
npm run build
npm run deploy  # or your deployment command

# Vendor Web
cd apps/vendor-web
npm run build
npm run deploy

# Admin Web
cd apps/admin-web
npm run build
npm run deploy
```

---

### 4. Browser Testing (Priority: HIGH - Required)
**This is CRITICAL** - Hard refresh behavior can only be tested in a browser.

#### Test Customer Login + Hard Refresh:
1. Open browser DevTools (F12)
2. Go to Application → Storage (Chrome) or Storage (Firefox)
3. Navigate to customer login page
4. Enter phone: `9876543210`
5. Enter OTP: `123456`
6. Complete login
7. **Verify**:
   - localStorage has `authToken` or `cognitoAccessToken`
   - sessionStorage has `_warmpawz_has_session: "true"`
8. **Press F5** (hard refresh)
9. **Verify**:
   - sessionStorage is cleared (flag gone)
   - localStorage is cleared (tokens gone)
   - Redirected to login page ✅

#### Test Vendor Login + Hard Refresh:
1. Navigate to vendor login page
2. Enter phone: `9876543211`
3. Enter OTP: `123456`
4. Complete login
5. **Verify**:
   - localStorage has `authToken`
   - sessionStorage has `_warmpawz_vendor_has_session: "true"`
6. **Press F5** (hard refresh)
7. **Verify**: Session cleared, redirected to login ✅

#### Test Admin Login + Hard Refresh:
1. Navigate to admin login page
2. Enter email: `admin@warmpawz.com`
3. Enter password: `Warmpawz2025`
4. Complete login
5. **Verify**:
   - localStorage has `adminAuthToken`
   - sessionStorage has `_warmpawz_admin_has_session: "true"`
6. **Press F5** (hard refresh)
7. **Verify**: Session cleared, redirected to login ✅

#### Test Soft Navigation (Should NOT clear session):
1. Login as any user type
2. Click a link (soft navigation, not F5)
3. **Verify**:
   - sessionStorage flag persists ✅
   - localStorage tokens persist ✅
   - User remains logged in ✅

---

### 5. Verify State Routing (Priority: MEDIUM)
**After login, verify routing based on state**:

#### Customer:
- New customer (`state: "new"`) → Should show onboarding
- Existing customer (`state: "existing"`) → Should show home/dashboard

#### Vendor:
- New vendor (`state: "new"`) → Should show role selection
- Existing active vendor (`onboarding_status: "ACTIVATED"`) → Should show dashboard
- Pending vendor (`onboarding_status: "UNDER_REVIEW"`) → Should show waiting screen

#### Admin:
- Should route to analytics/dashboard after login

---

## Testing Checklist

### Backend Tests (curl):
- [ ] Customer OTP send works
- [ ] Customer OTP verify works (after deployment)
- [ ] Vendor OTP send works
- [ ] Vendor OTP verify works
- [ ] Admin login works
- [ ] All responses include `state` field
- [ ] All responses include tokens

### Frontend Tests (Browser):
- [ ] Customer login sets sessionStorage flag
- [ ] Customer hard refresh clears session
- [ ] Customer soft navigation preserves session
- [ ] Vendor login sets sessionStorage flag
- [ ] Vendor hard refresh clears session
- [ ] Vendor soft navigation preserves session
- [ ] Admin login sets sessionStorage flag
- [ ] Admin hard refresh clears session
- [ ] Admin soft navigation preserves session

### State Routing Tests:
- [ ] New customer → Onboarding flow
- [ ] Existing customer → Home/Dashboard
- [ ] New vendor → Role selection
- [ ] Active vendor → Dashboard
- [ ] Pending vendor → Waiting screen
- [ ] Admin → Analytics/Dashboard

---

## Deployment Order

1. **Backend First** (fixes customer creation issue)
   - Deploy `auth-enhanced.ts`
   - Test customer OTP verify endpoint

2. **Re-run API Tests** (verify backend works)
   - Run `./test-login-flows.sh`
   - Verify all endpoints work

3. **Frontend Second** (enables hard refresh detection)
   - Deploy all frontend apps
   - Test in browser

4. **Browser Testing** (verify hard refresh works)
   - Test all user types
   - Verify hard refresh clears session
   - Verify soft navigation preserves session

---

## Rollback Plan

If issues occur:

### Backend Rollback:
```bash
# Revert to previous version of auth-enhanced.ts
# Or deploy previous lambda version
```

### Frontend Rollback:
```bash
# Revert to previous frontend build
# Or deploy previous version
```

---

## Success Criteria

✅ **Backend**:
- Customer OTP verify returns token
- All login endpoints work
- All responses include state information

✅ **Frontend**:
- Hard refresh clears session (all user types)
- Soft navigation preserves session (all user types)
- Routing works based on state

✅ **End-to-End**:
- User can login
- Hard refresh requires re-login
- Soft navigation keeps user logged in
- State-based routing works correctly

---

## Timeline Estimate

- **Backend Deployment**: 15-30 minutes
- **API Testing**: 5 minutes
- **Frontend Deployment**: 30-60 minutes (all 3 apps)
- **Browser Testing**: 30-45 minutes
- **Total**: ~2 hours

---

## Notes

- Hard refresh detection relies on browser behavior (sessionStorage vs localStorage)
- Must be tested in real browser (cannot be fully tested with curl)
- The `full_name` fix uses temporary name - consider making field nullable in future
- All code changes are complete and ready for deployment
