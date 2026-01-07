# JWT Validation Testing Guide

**Date:** 2026-01-28  
**Phase:** 4 - Post Implementation Testing

---

## 🎯 Testing Objectives

1. Verify JWT token extraction from Authorization header
2. Test token validation with Cognito JWKS
3. Verify user ID and role extraction
4. Test error handling for invalid/expired tokens
5. Test public vs protected endpoints

---

## 🧪 Test Scenarios

### 1. Valid JWT Token Test

**Setup:**
- Get a valid Cognito JWT token (ID token or Access token)
- Set `COGNITO_USER_POOL_ID` environment variable
- Set `COGNITO_CLIENT_ID` environment variable (optional)

**Test:**
```bash
curl -X POST https://api.example.com/bookings/create \
  -H "Authorization: Bearer <VALID_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "123e4567-e89b-12d3-a456-426614174000",
    "vendorId": "123e4567-e89b-12d3-a456-426614174001",
    "serviceId": "123e4567-e89b-12d3-a456-426614174002",
    "bookingDate": "2026-02-01",
    "bookingTime": "10:00",
    "serviceType": "at_home"
  }'
```

**Expected:**
- ✅ Request succeeds
- ✅ `context.userId` is extracted from token `sub` claim
- ✅ `context.userRole` is extracted from `cognito:groups` or `custom:user_type`
- ✅ CloudWatch logs show request with user info

---

### 2. Missing Authorization Header Test

**Test:**
```bash
curl -X POST https://api.example.com/bookings/create \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**Expected:**
- ✅ Request succeeds (if endpoint is public)
- ✅ `context.userId` is `undefined`
- ✅ `context.userRole` is `undefined`
- ✅ No error thrown

---

### 3. Invalid Token Format Test

**Test:**
```bash
curl -X POST https://api.example.com/bookings/create \
  -H "Authorization: Bearer invalid-token-format" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**Expected:**
- ✅ Request succeeds (if endpoint is public)
- ✅ `context.userId` is `undefined`
- ✅ `context.userRole` is `undefined`
- ✅ Error logged to CloudWatch: "Token verification failed"

---

### 4. Expired Token Test

**Setup:**
- Use an expired JWT token

**Test:**
```bash
curl -X POST https://api.example.com/bookings/create \
  -H "Authorization: Bearer <EXPIRED_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**Expected:**
- ✅ Request succeeds (if endpoint is public)
- ✅ `context.userId` is `undefined`
- ✅ Error logged: "Token expired"

---

### 5. Invalid Signature Test

**Setup:**
- Use a token with invalid signature (tampered token)

**Test:**
```bash
curl -X POST https://api.example.com/bookings/create \
  -H "Authorization: Bearer <TAMPERED_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ ... }'
```

**Expected:**
- ✅ Request succeeds (if endpoint is public)
- ✅ `context.userId` is `undefined`
- ✅ Error logged: "Invalid token signature"

---

### 6. Protected Endpoint Test

**Test Handler:**
```typescript
class ProtectedHandler extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    this.requireAuth(context); // Throws if not authenticated
    
    return this.success({ 
      message: 'Protected data',
      userId: context.userId 
    }, context.requestId);
  }
}
```

**Test without token:**
```bash
curl -X GET https://api.example.com/protected-endpoint
```

**Expected:**
- ❌ Request fails with 401/403
- ✅ Error message: "Authentication required"

**Test with valid token:**
```bash
curl -X GET https://api.example.com/protected-endpoint \
  -H "Authorization: Bearer <VALID_JWT_TOKEN>"
```

**Expected:**
- ✅ Request succeeds
- ✅ Returns protected data

---

### 7. Role-Based Access Test

**Test Handler:**
```typescript
class AdminHandler extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    this.requireAuth(context);
    
    if (context.userRole !== 'admin') {
      return this.error('Admin access required', 403, 'FORBIDDEN', undefined, context.requestId);
    }
    
    return this.success({ adminData: '...' }, context.requestId);
  }
}
```

**Test with customer token:**
```bash
curl -X GET https://api.example.com/admin-endpoint \
  -H "Authorization: Bearer <CUSTOMER_JWT_TOKEN>"
```

**Expected:**
- ❌ Request fails with 403
- ✅ Error message: "Admin access required"

**Test with admin token:**
```bash
curl -X GET https://api.example.com/admin-endpoint \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```

**Expected:**
- ✅ Request succeeds
- ✅ Returns admin data

---

## 🔧 Manual Testing Steps

### Step 1: Get Cognito Token

1. Login via Cognito (using your auth flow)
2. Extract ID token or Access token from response
3. Save token for testing

### Step 2: Test Token Extraction

```typescript
// In a test handler
const token = event.headers['Authorization']?.replace('Bearer ', '');
const payload = await verifyCognitoToken(token);
console.log('User ID:', payload?.sub);
console.log('Groups:', payload?.['cognito:groups']);
```

### Step 3: Test Enhanced Handler

```typescript
// Create test handler
class TestHandler extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    return this.success({
      userId: context.userId,
      userRole: context.userRole,
      hasAuth: !!context.userId,
    }, context.requestId);
  }
}
```

### Step 4: Verify CloudWatch Logs

Check CloudWatch logs for:
- Request start/complete logs
- JWT verification logs
- Error logs (if any)
- User ID and role in logs

---

## 🐛 Debugging Tips

### Issue: Token verification always fails

**Check:**
1. `COGNITO_USER_POOL_ID` is set correctly
2. Token issuer matches Cognito User Pool
3. Token is not expired
4. JWKS endpoint is accessible

**Debug:**
```typescript
console.log('User Pool ID:', process.env.COGNITO_USER_POOL_ID);
console.log('Token issuer:', `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`);
console.log('Token payload:', decodeTokenUnsafe(token));
```

### Issue: User ID not extracted

**Check:**
1. Token has `sub` or `cognito:username` claim
2. Token is verified successfully
3. `extractAndVerifyAuth()` is called

**Debug:**
```typescript
const authResult = await this.extractAndVerifyAuth(event);
console.log('Auth result:', authResult);
```

### Issue: Role not extracted

**Check:**
1. User is in Cognito group
2. Token includes `cognito:groups` claim
3. Or token has `custom:user_type` claim

**Debug:**
```typescript
const payload = await verifyCognitoToken(token);
console.log('Groups:', payload?.['cognito:groups']);
console.log('User type:', payload?.['custom:user_type']);
```

---

## ✅ Success Criteria

JWT validation is working correctly if:

- ✅ Valid tokens are verified and user info extracted
- ✅ Invalid tokens are rejected gracefully
- ✅ Public endpoints work without tokens
- ✅ Protected endpoints require authentication
- ✅ Role-based access control works
- ✅ CloudWatch logs show proper request tracking
- ✅ No crashes or unhandled errors

---

## 📝 Test Results Template

```
Test Date: ___________
Tester: ___________

[ ] Valid JWT Token - PASS/FAIL
[ ] Missing Header - PASS/FAIL
[ ] Invalid Format - PASS/FAIL
[ ] Expired Token - PASS/FAIL
[ ] Invalid Signature - PASS/FAIL
[ ] Protected Endpoint - PASS/FAIL
[ ] Role-Based Access - PASS/FAIL

Notes:
_________________________________
_________________________________
```

---

**Ready to test!** 🚀

