# Browser Testing Guide - Hard Refresh Fix

## 🎯 Testing Objectives

1. ✅ Verify hard refresh clears session (all user types)
2. ✅ Verify soft navigation preserves session (all user types)
3. ✅ Verify state-based routing works correctly
4. ✅ Verify sessionStorage flags are set/cleared correctly

## 📋 Pre-Testing Checklist

- [ ] Wait 5-15 minutes after deployment for CloudFront propagation
- [ ] Clear browser cache (optional, to ensure fresh deployment)
- [ ] Open DevTools (F12) → Application → Storage tab
- [ ] Have test credentials ready:
  - Customer: Phone `9876543210`, OTP `123456`
  - Vendor: Phone `9876543211`, OTP `123456`
  - Admin: Email `admin@warmpawz.com`, Password `Warmpawz2025`

## 🧪 Test 1: Customer Login + Hard Refresh

### Step 1: Navigate to Customer Web
- URL: `https://d2aoyjj8ine0wk.cloudfront.net`
- Or: Your configured customer domain

### Step 2: Open DevTools
- Press F12
- Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
- Expand **sessionStorage** and **localStorage**

### Step 3: Login
1. Enter phone: `9876543210`
2. Enter OTP: `123456`
3. Click "Verify" or "Login"
4. Wait for redirect to home/dashboard

### Step 4: Verify Session Storage (BEFORE Hard Refresh)
**Check sessionStorage:**
- [ ] `_warmpawz_has_session` = `"true"` ✅

**Check localStorage:**
- [ ] `authToken` or `cognitoAccessToken` exists ✅
- [ ] `customerPhone` = `"9876543210"` ✅
- [ ] `customerData` exists (optional) ✅

**Screenshot**: Take screenshot of DevTools showing sessionStorage and localStorage

### Step 5: Test Hard Refresh
1. **Press F5** (or Ctrl+R / Cmd+R)
2. Wait for page to reload

**Check sessionStorage:**
- [ ] `_warmpawz_has_session` is **GONE** ✅
- [ ] sessionStorage is **EMPTY** ✅

**Check localStorage:**
- [ ] `authToken` is **GONE** ✅
- [ ] `customerPhone` is **GONE** ✅
- [ ] localStorage is **CLEARED** ✅

**Verify Redirect:**
- [ ] Redirected to `/auth` or login page ✅
- [ ] Login form is visible ✅

**Screenshot**: Take screenshot showing cleared storage and login page

### Step 6: Test Soft Navigation (Should NOT Clear)
1. Login again (phone: `9876543210`, OTP: `123456`)
2. **Click a link** (e.g., "Shop", "Bookings", etc.) - DO NOT press F5
3. Wait for navigation

**Check sessionStorage:**
- [ ] `_warmpawz_has_session` = `"true"` (still present) ✅

**Check localStorage:**
- [ ] `authToken` still exists ✅
- [ ] User remains logged in ✅

**Screenshot**: Take screenshot showing session persists after soft navigation

---

## 🧪 Test 2: Vendor Login + Hard Refresh

### Step 1: Navigate to Vendor Web
- URL: `https://d1s6ykkj381k58.cloudfront.net`

### Step 2: Open DevTools
- Press F12 → Application → Storage

### Step 3: Login
1. Enter phone: `9876543211`
2. Enter OTP: `123456`
3. Complete login

### Step 4: Verify Session Storage (BEFORE Hard Refresh)
**Check sessionStorage:**
- [ ] `_warmpawz_vendor_has_session` = `"true"` ✅

**Check localStorage:**
- [ ] `authToken` exists ✅
- [ ] `vendorPhone` = `"9876543211"` ✅

### Step 5: Test Hard Refresh
1. **Press F5**
2. Wait for reload

**Verify:**
- [ ] sessionStorage cleared ✅
- [ ] localStorage cleared ✅
- [ ] Redirected to login ✅

### Step 6: Test Soft Navigation
1. Login again
2. **Click a link** (not F5)
3. Verify session persists ✅

---

## 🧪 Test 3: Admin Login + Hard Refresh

### Step 1: Navigate to Admin Web
- URL: `https://dfof7mguaa0a5.cloudfront.net`

### Step 2: Open DevTools
- Press F12 → Application → Storage

### Step 3: Login
1. Enter email: `admin@warmpawz.com`
2. Enter password: `Warmpawz2025`
3. Complete login

### Step 4: Verify Session Storage (BEFORE Hard Refresh)
**Check sessionStorage:**
- [ ] `_warmpawz_admin_has_session` = `"true"` ✅

**Check localStorage:**
- [ ] `adminAuthToken` exists ✅
- [ ] `adminEmail` = `"admin@warmpawz.com"` ✅

### Step 5: Test Hard Refresh
1. **Press F5**
2. Wait for reload

**Verify:**
- [ ] sessionStorage cleared ✅
- [ ] localStorage cleared ✅
- [ ] Redirected to login ✅

### Step 6: Test Soft Navigation
1. Login again
2. **Click a link** (not F5)
3. Verify session persists ✅

---

## 🧪 Test 4: State-Based Routing

### Customer State Routing

#### New Customer Test:
1. Login with a **new phone number** (never used before)
2. Verify:
   - [ ] `state: "new"` in response (check Network tab)
   - [ ] Redirected to onboarding flow ✅
   - [ ] Not redirected to dashboard ✅

#### Existing Customer Test:
1. Login with phone that has completed onboarding
2. Verify:
   - [ ] `state: "existing"` in response
   - [ ] `onboarding_status: "COMPLETED"` in profile
   - [ ] Redirected to home/dashboard ✅
   - [ ] Not shown onboarding ✅

### Vendor State Routing

#### New Vendor Test:
1. Login with a **new vendor phone**
2. Verify:
   - [ ] `state: "new"` in response
   - [ ] Shows role selection screen ✅

#### Active Vendor Test:
1. Login with vendor that has `onboarding_status: "ACTIVATED"`
2. Verify:
   - [ ] `state: "existing"` in response
   - [ ] Routes directly to dashboard ✅
   - [ ] Skips `/onboarding` page ✅

#### Pending Vendor Test:
1. Login with vendor that has `onboarding_status: "UNDER_REVIEW"`
2. Verify:
   - [ ] Shows "Waiting for Approval" screen ✅

---

## 📊 Test Results Template

### Customer Web
- [ ] Login works
- [ ] SessionStorage flag set: `_warmpawz_has_session`
- [ ] Hard refresh (F5) clears sessionStorage
- [ ] Hard refresh (F5) clears localStorage
- [ ] Hard refresh redirects to login
- [ ] Soft navigation preserves session
- [ ] New customer → Onboarding
- [ ] Existing customer → Dashboard

### Vendor Web
- [ ] Login works
- [ ] SessionStorage flag set: `_warmpawz_vendor_has_session`
- [ ] Hard refresh (F5) clears sessionStorage
- [ ] Hard refresh (F5) clears localStorage
- [ ] Hard refresh redirects to login
- [ ] Soft navigation preserves session
- [ ] New vendor → Role selection
- [ ] Active vendor → Dashboard
- [ ] Pending vendor → Waiting screen

### Admin Web
- [ ] Login works
- [ ] SessionStorage flag set: `_warmpawz_admin_has_session`
- [ ] Hard refresh (F5) clears sessionStorage
- [ ] Hard refresh (F5) clears localStorage
- [ ] Hard refresh redirects to login
- [ ] Soft navigation preserves session

---

## 🐛 Troubleshooting

### Issue: Hard refresh doesn't clear session
**Possible Causes:**
1. CloudFront cache not propagated (wait 5-15 min)
2. Browser cache (clear cache and try again)
3. Code not deployed (check deployment logs)

**Fix:**
```bash
# Check if deployment completed
# Verify CloudFront invalidation status
aws cloudfront get-invalidation \
  --distribution-id YOUR_DIST_ID \
  --id YOUR_INVALIDATION_ID
```

### Issue: SessionStorage flag not set
**Check:**
1. Open browser console for errors
2. Verify login was successful
3. Check if `initializeSession()` is called
4. Verify code changes are deployed

### Issue: False positive on first visit
**Note**: This is expected behavior. Detection only triggers if:
- localStorage has tokens (user was logged in)
- sessionStorage doesn't have flag (hard refresh cleared it)

### Issue: Soft navigation clears session
**Check:**
1. Verify you clicked a link (not pressed F5)
2. Check browser console for errors
3. Verify sessionStorage flag persists

---

## 📸 Screenshots to Capture

1. **After Login** (before hard refresh):
   - DevTools showing sessionStorage with flag
   - DevTools showing localStorage with tokens

2. **After Hard Refresh**:
   - DevTools showing empty sessionStorage
   - DevTools showing empty localStorage
   - Login page visible

3. **After Soft Navigation**:
   - DevTools showing sessionStorage flag still present
   - User still logged in

---

## ✅ Success Criteria

### All Tests Pass If:
- ✅ Hard refresh (F5) clears session for all user types
- ✅ Hard refresh redirects to login for all user types
- ✅ Soft navigation preserves session for all user types
- ✅ State-based routing works correctly
- ✅ SessionStorage flags are set/cleared correctly

---

## 🚀 Quick Test Script

Run this in browser console after login to verify session:

```javascript
// Check sessionStorage flag
console.log('SessionStorage flag:', sessionStorage.getItem('_warmpawz_has_session') || 
  sessionStorage.getItem('_warmpawz_vendor_has_session') || 
  sessionStorage.getItem('_warmpawz_admin_has_session'));

// Check localStorage tokens
console.log('AuthToken:', localStorage.getItem('authToken') || 
  localStorage.getItem('cognitoAccessToken') || 
  localStorage.getItem('adminAuthToken'));

// Simulate hard refresh check
const hasToken = !!(localStorage.getItem('authToken') || 
  localStorage.getItem('cognitoAccessToken') || 
  localStorage.getItem('adminAuthToken'));
const hasFlag = !!(sessionStorage.getItem('_warmpawz_has_session') || 
  sessionStorage.getItem('_warmpawz_vendor_has_session') || 
  sessionStorage.getItem('_warmpawz_admin_has_session'));

console.log('Hard refresh would be detected:', hasToken && !hasFlag);
```

---

**Ready to test!** Follow the steps above for each user type. 🧪
