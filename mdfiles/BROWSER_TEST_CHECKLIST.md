# Browser Test Checklist - Hard Refresh Fix

**Date**: _______________  
**Tester**: _______________  
**Environment**: Dev (CloudFront)

---

## ✅ Customer Web Testing

### Login Test
- [ ] Navigate to customer web
- [ ] Login with phone `9876543210`, OTP `123456`
- [ ] Login successful

### Session Storage (After Login)
- [ ] `_warmpawz_has_session` = `"true"` in sessionStorage
- [ ] `authToken` or `cognitoAccessToken` in localStorage
- [ ] `customerPhone` in localStorage

### Hard Refresh Test
- [ ] Press F5 (hard refresh)
- [ ] sessionStorage is cleared (flag gone)
- [ ] localStorage is cleared (tokens gone)
- [ ] Redirected to login page

### Soft Navigation Test
- [ ] Login again
- [ ] Click a link (soft navigation)
- [ ] sessionStorage flag persists
- [ ] localStorage tokens persist
- [ ] User remains logged in

### State Routing Test
- [ ] New customer → Shows onboarding
- [ ] Existing customer → Shows dashboard

**Notes**: _________________________________________________

---

## ✅ Vendor Web Testing

### Login Test
- [ ] Navigate to vendor web
- [ ] Login with phone `9876543211`, OTP `123456`
- [ ] Login successful

### Session Storage (After Login)
- [ ] `_warmpawz_vendor_has_session` = `"true"` in sessionStorage
- [ ] `authToken` in localStorage
- [ ] `vendorPhone` in localStorage

### Hard Refresh Test
- [ ] Press F5 (hard refresh)
- [ ] sessionStorage is cleared (flag gone)
- [ ] localStorage is cleared (tokens gone)
- [ ] Redirected to login page

### Soft Navigation Test
- [ ] Login again
- [ ] Click a link (soft navigation)
- [ ] sessionStorage flag persists
- [ ] localStorage tokens persist
- [ ] User remains logged in

### State Routing Test
- [ ] New vendor → Shows role selection
- [ ] Active vendor → Shows dashboard
- [ ] Pending vendor → Shows waiting screen

**Notes**: _________________________________________________

---

## ✅ Admin Web Testing

### Login Test
- [ ] Navigate to admin web
- [ ] Login with email `admin@warmpawz.com`, password `Warmpawz2025`
- [ ] Login successful

### Session Storage (After Login)
- [ ] `_warmpawz_admin_has_session` = `"true"` in sessionStorage
- [ ] `adminAuthToken` in localStorage
- [ ] `adminEmail` in localStorage

### Hard Refresh Test
- [ ] Press F5 (hard refresh)
- [ ] sessionStorage is cleared (flag gone)
- [ ] localStorage is cleared (tokens gone)
- [ ] Redirected to login page

### Soft Navigation Test
- [ ] Login again
- [ ] Click a link (soft navigation)
- [ ] sessionStorage flag persists
- [ ] localStorage tokens persist
- [ ] User remains logged in

**Notes**: _________________________________________________

---

## 📊 Overall Results

### Test Summary
- **Customer Web**: [ ] Pass [ ] Fail
- **Vendor Web**: [ ] Pass [ ] Fail
- **Admin Web**: [ ] Pass [ ] Fail

### Issues Found
1. _________________________________________________
2. _________________________________________________
3. _________________________________________________

### Screenshots
- [ ] After login (sessionStorage + localStorage)
- [ ] After hard refresh (cleared storage)
- [ ] After soft navigation (persisted storage)

---

## ✅ Final Verification

- [ ] All hard refresh tests pass
- [ ] All soft navigation tests pass
- [ ] State-based routing works
- [ ] No console errors
- [ ] No false positives

**Status**: [ ] ✅ All Tests Pass [ ] ⚠️ Issues Found [ ] ❌ Tests Failed

**Signed off by**: _______________  
**Date**: _______________
