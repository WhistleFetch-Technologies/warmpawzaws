# Login Flow Testing Guide

## Overview
This guide tests the login flows for customers, vendors, and admins to verify that:
1. OTP verification works correctly
2. Tokens are generated properly
3. State information is returned in responses
4. Hard refresh detection will work (sessionStorage flags)

## Prerequisites
- API Base URL: `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`
- UAT Mode: Enabled (uses `123456` as OTP)
- curl installed

## Test Script
Run the automated test script:
```bash
./test-login-flows.sh
```

Or set custom API URL:
```bash
API_BASE_URL=https://your-api-url.com ./test-login-flows.sh
```

## Manual Testing

### 1. Customer Login

#### Send OTP:
```bash
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210", "role": "customer"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "OTP generated (UAT Mode)",
  "debug_otp": "123456",
  "uat_mode": true
}
```

#### Verify OTP:
```bash
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210", "otp": "123456", "role": "customer"}'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "token": {
      "access_token": "eyJ...",
      "refresh_token": "eyJ...",
      "expires_in": 60,
      "token_type": "Bearer"
    },
    "user": {
      "id": "customer-id",
      "phone": "9876543210",
      "role": "customer"
    },
    "state": "new" | "existing",
    "profile": {
      "id": "customer-id",
      "phone": "9876543210",
      "full_name": null,
      "email": null
    }
  }
}
```

**Verification Points:**
- ✅ `access_token` is present and valid JWT
- ✅ `state` field is present (`"new"` or `"existing"`)
- ✅ `profile` object is present

### 2. Vendor Login

#### Send OTP:
```bash
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543211", "role": "vendor"}'
```

#### Verify OTP:
```bash
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543211", "otp": "123456", "role": "vendor"}'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "token": {
      "access_token": "eyJ...",
      "refresh_token": "eyJ...",
      "expires_in": 60,
      "token_type": "Bearer"
    },
    "user": {
      "id": "vendor-id",
      "phone": "9876543211",
      "role": "vendor"
    },
    "state": "new" | "existing",
    "profile": {
      "id": "vendor-id",
      "phone": "9876543211",
      "business_name": null,
      "status": "pending"
    }
  }
}
```

**Verification Points:**
- ✅ `access_token` is present
- ✅ `state` field is present
- ✅ `profile.status` indicates vendor status

### 3. Admin Login

```bash
curl -X POST "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@warmpawz.com", "password": "Warmpawz2025"}'
```

**Expected Response:**
```json
{
  "success": true,
  "token": {
    "access_token": "eyJ...",
    "id_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_in": 60,
    "token_type": "Bearer"
  },
  "admin": {
    "id": "admin-id",
    "email": "admin@warmpawz.com",
    "name": "Admin User",
    "role": "admin"
  }
}
```

## Testing Hard Refresh Behavior

### Browser Testing (Required)

The hard refresh detection relies on browser behavior (sessionStorage vs localStorage), so it must be tested in a browser:

1. **Open Browser DevTools**:
   - Chrome: F12 → Application tab → Storage
   - Firefox: F12 → Storage tab

2. **Login via Web UI**:
   - Navigate to customer/vendor/admin login page
   - Enter phone/email and OTP
   - Complete login

3. **Verify sessionStorage Flag**:
   - Check Application/Storage → sessionStorage
   - Should see:
     - Customer: `_warmpawz_has_session: "true"`
     - Vendor: `_warmpawz_vendor_has_session: "true"`
     - Admin: `_warmpawz_admin_has_session: "true"`

4. **Verify localStorage Tokens**:
   - Check Application/Storage → localStorage
   - Should see:
     - Customer: `authToken` or `cognitoAccessToken`
     - Vendor: `authToken`
     - Admin: `adminAuthToken`

5. **Test Hard Refresh**:
   - Press F5 (hard refresh)
   - Check sessionStorage: Should be cleared (flag gone)
   - Check localStorage: Should be cleared (tokens gone)
   - Verify: Redirected to login page

6. **Test Soft Navigation**:
   - Login again
   - Click a link (soft navigation)
   - Check sessionStorage: Flag should still exist
   - Check localStorage: Tokens should still exist
   - Verify: Still logged in

## Expected Behavior

### After Login (Browser):
- ✅ localStorage has tokens
- ✅ sessionStorage has `_warmpawz_*_has_session` flag
- ✅ User is on dashboard/home page

### After Hard Refresh (F5):
- ✅ sessionStorage is cleared (flag gone)
- ✅ localStorage tokens are cleared
- ✅ User is redirected to login page

### After Soft Navigation:
- ✅ sessionStorage flag persists
- ✅ localStorage tokens persist
- ✅ User remains logged in

## Troubleshooting

### Issue: Hard refresh doesn't clear session
**Check:**
1. Is `initializeSession()` called before reading localStorage?
2. Is sessionStorage flag set on login?
3. Is detection logic checking for tokens + missing flag?

### Issue: False positive on first visit
**Check:**
1. Detection should only trigger if localStorage has tokens
2. First visit (no tokens) should not trigger hard refresh detection

### Issue: Soft navigation clears session
**Check:**
1. sessionStorage should persist across soft navigation
2. Only hard refresh should clear sessionStorage

## Test Results Template

```
Date: [DATE]
Tester: [NAME]

Customer Login:
- [ ] OTP sent successfully
- [ ] OTP verified successfully
- [ ] Token received
- [ ] State field present
- [ ] sessionStorage flag set
- [ ] Hard refresh clears session

Vendor Login:
- [ ] OTP sent successfully
- [ ] OTP verified successfully
- [ ] Token received
- [ ] State field present
- [ ] sessionStorage flag set
- [ ] Hard refresh clears session

Admin Login:
- [ ] Login successful
- [ ] Token received
- [ ] sessionStorage flag set
- [ ] Hard refresh clears session
```
