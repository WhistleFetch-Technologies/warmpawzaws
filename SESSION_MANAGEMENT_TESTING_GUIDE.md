# Session Management Testing Guide

**Date:** December 17, 2024  
**Purpose:** Comprehensive testing guide for session management and authentication

---

## Overview

This guide provides step-by-step instructions for testing all aspects of the session management and authentication system, including token expiry, logout flows, and session persistence.

---

## Prerequisites

1. **Environment Variables**
   ```bash
   export SUPABASE_PROJECT_ID="vpvpbdwtyugbknrntkho"
   export SUPABASE_ANON_KEY="your-anon-key"
   ```

2. **Test Phone Numbers**
   - Customer: `9876543210`
   - Vendor: `9876543211`
   - Admin: Use email `admin@warmpawz.com`

---

## Test Suite Options

### Option 1: Bash Script (Recommended for Linux/Mac)

```bash
./test-session-management.sh
```

### Option 2: Node.js Script

```bash
node test-session-management.js
```

### Option 3: Manual Testing

Follow the sections below for manual testing.

---

## Test Cases

### 1. Device Detection & Token Expiry

#### Test 1.1: Mobile App Login (365 days)
```bash
curl -X POST "https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/auth/login" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "portal": "customer",
    "deviceType": "mobile",
    "isMobileApp": true
  }'
```

**Expected:**
- Status: 200
- `expiresAt` should be ~365 days from now
- `deviceType: "mobile"` in session
- `isMobileApp: true` in session

#### Test 1.2: Web Customer Login (48 hours)
```bash
curl -X POST "https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/auth/login" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "portal": "customer",
    "deviceType": "web",
    "isMobileApp": false
  }'
```

**Expected:**
- Status: 200
- `expiresAt` should be ~48 hours from now
- `deviceType: "web"` in session
- `isMobileApp: false` in session

#### Test 1.3: Web Vendor Login (48 hours)
```bash
curl -X POST "https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/auth/login" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543211",
    "portal": "vendor",
    "deviceType": "web",
    "isMobileApp": false
  }'
```

**Expected:**
- Status: 200
- `expiresAt` should be ~48 hours from now

#### Test 1.4: Admin Login (4 hours)
```bash
# Note: Admin uses email/password, not phone
# This test requires Supabase Auth integration
```

**Expected:**
- Status: 200
- `expiresAt` should be ~4 hours from now

---

### 2. Session Verification

#### Test 2.1: Verify Valid Session
```bash
# First, login to get sessionId
SESSION_ID="your-session-id-from-login"

curl -X POST "https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/auth/verify-session" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"${SESSION_ID}\"
  }"
```

**Expected:**
- Status: 200
- `valid: true`
- Session data returned

#### Test 2.2: Verify Invalid Session
```bash
curl -X POST "https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/auth/verify-session" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "invalid-session-id"
  }'
```

**Expected:**
- Status: 401
- `valid: false`
- Error message

---

### 3. Logout Functionality

#### Test 3.1: Logout by SessionId
```bash
SESSION_ID="your-session-id"

curl -X POST "https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/auth/logout" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"${SESSION_ID}\"
  }"
```

**Expected:**
- Status: 200
- `loggedOut: true`
- Session invalidated

#### Test 3.2: Logout by UserId
```bash
USER_ID="your-user-id"

curl -X POST "https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/auth/logout" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"${USER_ID}\"
  }"
```

**Expected:**
- Status: 200
- `loggedOut: true`
- Current session invalidated

#### Test 3.3: Logout from All Devices
```bash
USER_ID="your-user-id"

curl -X POST "https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/auth/logout" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"${USER_ID}\",
    \"logoutAll\": true
  }"
```

**Expected:**
- Status: 200
- `loggedOut: true`
- All sessions invalidated

#### Test 3.4: Logout by AccessToken
```bash
ACCESS_TOKEN="your-access-token"

curl -X POST "https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/auth/logout" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"accessToken\": \"${ACCESS_TOKEN}\"
  }"
```

**Expected:**
- Status: 200
- `loggedOut: true`
- Token invalidated

---

### 4. Supabase Token Generation

#### Test 4.1: Check Supabase Tokens in Login Response
```bash
curl -X POST "https://${PROJECT_ID}.supabase.co/functions/v1/make-server-3dd53475/auth/login" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "portal": "customer",
    "deviceType": "web"
  }' | jq '.data.supabaseTokens'
```

**Expected:**
- `accessToken` present
- `refreshToken` present (if configured)
- `expiresAt` matches session expiry

---

### 5. Frontend Testing

#### Test 5.1: Vendor App Logout
1. Login to vendor app
2. Click logout button in header
3. Verify:
   - Redirected to login
   - localStorage cleared
   - sessionStorage cleared
   - No tokens in storage

#### Test 5.2: Customer App Logout
1. Login to customer app
2. Open sidebar
3. Go to profile tab
4. Click logout button
5. Verify:
   - Redirected to login
   - All storage cleared

#### Test 5.3: Admin App Logout
1. Login to admin app
2. Click logout button
3. Verify:
   - Redirected to login
   - All storage cleared

---

### 6. Session Persistence

#### Test 6.1: Session Persists After Page Refresh
1. Login to any app
2. Refresh page
3. Verify:
   - Still logged in
   - Session data available
   - Tokens valid

#### Test 6.2: Session Expires Correctly
1. Login to web app (48 hours expiry)
2. Wait for expiry (or manually expire in backend)
3. Verify:
   - Session invalidated
   - Redirected to login
   - Error message shown

---

## Expected Results Summary

| Test | Expected Result |
|------|----------------|
| Mobile App Login | 365 days expiry |
| Web Customer Login | 48 hours expiry |
| Web Vendor Login | 48 hours expiry |
| Admin Login | 4 hours expiry |
| Session Verification | Returns valid session |
| Logout by SessionId | Session invalidated |
| Logout by UserId | Current session invalidated |
| Logout All Devices | All sessions invalidated |
| Supabase Tokens | Generated with proper expiry |
| Frontend Logout | All storage cleared |

---

## Troubleshooting

### Issue: Token expiry not matching expected values
**Solution:** Check device detection in login request. Verify `deviceType` and `isMobileApp` parameters.

### Issue: Logout not working
**Solution:** 
1. Check sessionId/userId/accessToken is correct
2. Verify backend endpoint is accessible
3. Check browser console for errors

### Issue: Supabase tokens not generated
**Solution:** 
1. Check `SUPABASE_SERVICE_ROLE_KEY` is set in backend
2. Verify Supabase client configuration
3. Check backend logs for errors

### Issue: Session not persisting
**Solution:**
1. Check localStorage is enabled
2. Verify session storage key is correct
3. Check for storage quota issues

---

## Test Results Template

```
Date: [Date]
Tester: [Name]
Environment: [Production/Staging/Development]

Test Results:
- Mobile App Login: ✅/❌
- Web Customer Login: ✅/❌
- Web Vendor Login: ✅/❌
- Admin Login: ✅/❌
- Session Verification: ✅/❌
- Logout by SessionId: ✅/❌
- Logout by UserId: ✅/❌
- Logout All Devices: ✅/❌
- Supabase Tokens: ✅/❌
- Frontend Logout: ✅/❌

Issues Found:
[List any issues]

Notes:
[Additional notes]
```

---

## Next Steps After Testing

1. **Fix any issues found**
2. **Document test results**
3. **Update implementation if needed**
4. **Deploy to staging**
5. **Run production smoke tests**

---

## Support

For issues or questions:
1. Check backend logs
2. Check browser console
3. Review implementation summary
4. Check Supabase dashboard

