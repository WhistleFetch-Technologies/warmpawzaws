# Quick Start - Hard Refresh Fix Deployment

## 🚀 Quick Commands

### Step 1: Deploy Backend Fix
```bash
cd backend/lambda
npm run build
npm run deploy  # or your deployment command
```

**What this fixes**: Customer creation error (missing `full_name` field)

### Step 2: Test API Endpoints
```bash
cd ../..
./test-login-flows.sh
```

**Expected**: All tests should pass ✅

### Step 3: Deploy Frontend (All 3 Apps)

**Customer Web:**
```bash
cd apps/customer-web
npm run build
npm run deploy
```

**Vendor Web:**
```bash
cd ../vendor-web
npm run build
npm run deploy
```

**Admin Web:**
```bash
cd ../admin-web
npm run build
npm run deploy
```

### Step 4: Browser Testing (Required)

1. **Open Browser DevTools** (F12)
   - Chrome: Application → Storage
   - Firefox: Storage tab

2. **Test Customer Login:**
   - Go to customer login page
   - Phone: `9876543210`, OTP: `123456`
   - After login, check:
     - ✅ localStorage has `authToken`
     - ✅ sessionStorage has `_warmpawz_has_session: "true"`
   - Press **F5** (hard refresh)
   - ✅ sessionStorage cleared
   - ✅ localStorage cleared
   - ✅ Redirected to login

3. **Test Vendor Login:**
   - Go to vendor login page
   - Phone: `9876543211`, OTP: `123456`
   - After login, check:
     - ✅ localStorage has `authToken`
     - ✅ sessionStorage has `_warmpawz_vendor_has_session: "true"`
   - Press **F5** (hard refresh)
   - ✅ Session cleared, redirected to login

4. **Test Admin Login:**
   - Go to admin login page
   - Email: `admin@warmpawz.com`, Password: `Warmpawz2025`
   - After login, check:
     - ✅ localStorage has `adminAuthToken`
     - ✅ sessionStorage has `_warmpawz_admin_has_session: "true"`
   - Press **F5** (hard refresh)
   - ✅ Session cleared, redirected to login

## ✅ Success Criteria

- [ ] Backend deployed (customer OTP verify works)
- [ ] API tests pass (`./test-login-flows.sh`)
- [ ] Frontend deployed (all 3 apps)
- [ ] Hard refresh clears session (all user types)
- [ ] Soft navigation preserves session (all user types)

## 🐛 Troubleshooting

**Issue**: Customer OTP verify still fails
- **Fix**: Verify backend deployment completed
- **Check**: `grep "full_name.*Customer" backend/lambda/src/endpoints/auth-enhanced.ts`

**Issue**: Hard refresh doesn't clear session
- **Fix**: Verify frontend deployment completed
- **Check**: DevTools → sessionStorage should have flag after login

**Issue**: False positive on first visit
- **Fix**: This is expected - detection only triggers if tokens exist

## 📋 One-Liner Test

```bash
# Test customer login (after backend deployment)
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210", "otp": "123456", "role": "customer"}' | jq '.success'
```

**Expected**: `true` (not database error)

## ⏱️ Estimated Time

- Backend deployment: 15-30 min
- API testing: 5 min
- Frontend deployment: 30-60 min
- Browser testing: 30-45 min
- **Total**: ~2 hours

---

**Ready?** Start with Step 1! 🚀
