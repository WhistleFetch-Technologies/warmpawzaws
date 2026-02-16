# Dev API UAT Mode Configuration Fix

## Issue
Getting "Admin access required" error when accessing dev API Gateway (`z0b3obweb6`) from `localhost:3003`:
```json
{"success":false,"error":"Admin access required","code":"ADMIN_REQUIRED"}
```

## Root Cause
The dev Lambda function (`warmpawz-api-dev-api`) has `UAT_MODE: "true"` which is correct, but the frontend needs to:
1. Send a UAT token in the format: `uat-token-admin-{timestamp}`
2. Include `X-UAT-Mode: true` header
3. Ensure UAT mode is detected correctly

## Solution

### ✅ Dev Lambda Configuration
- **Function:** `warmpawz-api-dev-api`
- **UAT_MODE:** `"true"` ✅ (Correct)
- **API Gateway:** `z0b3obweb6` ✅ (Correct)

### ✅ Frontend Configuration
The admin-web app automatically:
1. Creates UAT token: `uat-token-admin-{timestamp}` when UAT mode is detected
2. Sends token in `Authorization: Bearer uat-token-admin-{timestamp}` header
3. Sends `X-UAT-Mode: true` header

### ✅ Token Format
The Lambda middleware expects:
- Format: `uat-token-admin-{timestamp}`
- Must contain `-admin-` in the token string
- Example: `uat-token-admin-1234567890`

### ✅ Verification
Test with curl:
```bash
curl -X GET \
  "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/admin/vendors/activities?filter=all&limit=50" \
  -H "Authorization: Bearer uat-token-admin-1234567890" \
  -H "X-UAT-Mode: true" \
  -H "Origin: http://localhost:3003"
```

**Result:** ✅ Should return vendor activities data

## How It Works

### Dev Environment (UAT_MODE=true)
1. Frontend detects UAT mode from `runtime-config.js` or environment variables
2. Auto-creates UAT token: `localStorage.setItem('adminAuthToken', 'uat-token-admin-' + Date.now())`
3. Sends token in `Authorization: Bearer {token}` header
4. Lambda middleware checks:
   - `UAT_MODE === 'true'` ✅
   - Token starts with `uat-token-` ✅
   - Token contains `-admin-` ✅
   - Returns `{ valid: true, userRole: 'admin', isUAT: true }`
5. Admin middleware allows access ✅

### Production Environment (UAT_MODE=false)
1. Frontend detects production mode
2. Clears any UAT tokens
3. Requires real JWT tokens from `/admin/auth/login`
4. Lambda middleware rejects UAT tokens
5. Requires valid Cognito JWT or database password authentication

## Configuration Files

### Dev Lambda Environment Variables
```json
{
  "UAT_MODE": "true",
  "ENVIRONMENT": null,
  "ALLOWED_ORIGINS": "..."
}
```

### Frontend Auto-Login (layout.tsx)
```javascript
if (isUatMode && !isProd) {
  var token = localStorage.getItem('adminAuthToken');
  if (!token) {
    localStorage.setItem('adminAuthToken', 'uat-token-admin-' + Date.now());
    localStorage.setItem('adminEmail', 'admin@warmpawz.com');
  }
}
```

### API Client (api-client.ts)
```typescript
if (token) {
  headers['Authorization'] = `Bearer ${token}`;
}

if (uatMode) {
  headers['X-UAT-Mode'] = 'true';
  if (token && token.startsWith('uat-token-')) {
    headers['X-UAT-Token'] = token;
  }
}
```

## Troubleshooting

### If you still get "Admin access required":
1. **Check UAT mode is enabled:**
   - Open browser console
   - Check: `window.__WARMPAWZ_RUNTIME_CONFIG__.uatMode` should be `true`
   - Check: `localStorage.getItem('adminAuthToken')` should start with `uat-token-admin-`

2. **Check token format:**
   - Token must be: `uat-token-admin-{timestamp}`
   - Must contain `-admin-` (not just `uat-token-`)

3. **Check Lambda UAT_MODE:**
   ```bash
   aws lambda get-function-configuration \
     --function-name warmpawz-api-dev-api \
     --region ap-south-1 \
     --query 'Environment.Variables.UAT_MODE'
   ```
   Should return: `"true"`

4. **Clear and regenerate token:**
   ```javascript
   localStorage.removeItem('adminAuthToken');
   localStorage.setItem('adminAuthToken', 'uat-token-admin-' + Date.now());
   ```

## Date Fixed
2026-02-16
