# Dev Login Endpoint Disabled

## Issue
The `/admin/auth/login` endpoint was available in dev (`z0b3obweb6`), but it should only exist in production. Dev should use UAT tokens instead.

## Solution
Modified `backend/lambda/src/endpoints/admin-comprehensive.ts` to conditionally register the login endpoint:

- **Dev (UAT_MODE=true)**: Login endpoint returns 404 with error message
- **Prod (UAT_MODE=false)**: Login endpoint works normally

## Changes Made

### Code Change
```typescript
// Before: Login endpoint always registered
app.post('/admin/auth/login', async (c) => {
  // ... handler code
});

// After: Conditionally registered based on UAT_MODE
const isUATMode = process.env.UAT_MODE === 'true';
if (!isUATMode) {
  // Production: Register login endpoint
  app.post('/admin/auth/login', async (c) => {
    // ... handler code
  });
} else {
  // Dev: Return 404 for login endpoint
  app.post('/admin/auth/login', async (c) => {
    return c.json({
      success: false,
      error: 'Login endpoint is not available in development. Use UAT tokens instead.',
      code: 'ENDPOINT_DISABLED_IN_DEV'
    }, 404);
  });
}
```

## Behavior

### Dev Environment (UAT_MODE=true)
- **Login Endpoint**: Returns 404 with error message
- **Authentication**: Use UAT tokens (`uat-token-admin-{timestamp}`)
- **Auto-login**: Frontend automatically creates UAT token in localStorage

### Production Environment (UAT_MODE=false)
- **Login Endpoint**: Works normally
- **Authentication**: Requires real credentials via `/admin/auth/login`
- **Tokens**: JWT tokens from login endpoint

## Testing

### Test Dev (should return 404)
```bash
curl -X POST \
  "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3003" \
  -d '{"email":"test@test.com","password":"test"}'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Login endpoint is not available in development. Use UAT tokens instead.",
  "code": "ENDPOINT_DISABLED_IN_DEV"
}
```
**Status:** 404

### Test Prod (should work)
```bash
curl -X POST \
  "https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com/admin/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3003" \
  -d '{"email":"admin@warmpawz.com","password":"Admin123!"}'
```

**Expected Response:**
```json
{
  "success": true,
  "token": {
    "access_token": "...",
    "id_token": "...",
    "refresh_token": "...",
    "expires_in": 86400,
    "token_type": "Bearer"
  },
  "admin": {
    "id": "...",
    "email": "admin@warmpawz.com",
    "name": "Admin User",
    "role": "admin"
  }
}
```
**Status:** 200

## Frontend Impact

### Dev Mode
- Frontend should NOT call `/admin/auth/login`
- Frontend should use UAT tokens automatically created in localStorage
- Token format: `uat-token-admin-{timestamp}`

### Production Mode
- Frontend MUST call `/admin/auth/login` with credentials
- Frontend stores JWT tokens from login response
- No UAT tokens allowed

## Verification

### Check Dev Lambda
```bash
aws lambda get-function-configuration \
  --function-name warmpawz-api-dev-api \
  --region ap-south-1 \
  --query 'Environment.Variables.UAT_MODE'
```
Should return: `"true"`

### Check Prod Lambda
```bash
aws lambda get-function-configuration \
  --function-name warmpawz-prod-api-handler \
  --region ap-south-1 \
  --query 'Environment.Variables.UAT_MODE'
```
Should return: `"false"`

## Date Fixed
2026-02-16
