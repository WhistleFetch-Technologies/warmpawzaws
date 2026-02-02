# OTP Post-Login Redirect Fix – Forensic Verification

## Issue
After OTP verification, the vendor app was falling back to the login page instead of staying on the dashboard.

## Root Cause (Verified)
1. **UAT JWT expiry**: Auth-enhanced issued UAT tokens with **60-second** expiry. By the time the page redirected and the first API call ran (e.g. `/vendor/onboarding/status` or `/vendor/:id/profile`), the token was often expired → backend returned **401** → frontend cleared session and redirected to `/auth`.
2. **Fallback tokens**: When Cognito is unavailable, legacy auth returns `fallback_*` tokens. The auth middleware only accepted Cognito/UAT JWTs, so those tokens caused 401 on the first authenticated request.
3. **Frontend JWT parsing**: UAT JWTs use **base64url** encoding. The frontend used `atob(parts[1])` without base64url→base64 conversion, which can fail; the catch assumed "not expired" so this was a robustness fix, not the primary cause.

## Fixes Applied

### 1. Backend: UAT token expiry (`backend/lambda/src/endpoints/auth-enhanced.ts`)
- **Before**: `expiresIn: 60` (60 seconds).
- **After**: `expiresIn: 24 * 60 * 60` (24 hours).
- **Effect**: Token remains valid after OTP redirect and for the first API calls.

### 2. Backend: Fallback token support (`backend/lambda/src/utils/jwt-verification.ts`)
- **Added**: `verifyFallbackToken(token)` for `fallback_*` format; validates 1-hour TTL from `payload.timestamp` and returns a Cognito-compatible payload.
- **Order in `verifyCognitoToken()`**: Fallback → UAT JWT → Cognito JWT.
- **`isTokenExpired()`**: For `fallback_*` tokens, skip JWT expiry check (return `false`); TTL is enforced inside `verifyFallbackToken()`.
- **Effect**: OTP-issued fallback tokens are accepted by the auth middleware.

### 3. Frontend: JWT base64url decoding (`apps/vendor-web/lib/session-utils.ts`)
- **Added**: Base64url → base64 conversion and padding before `atob(parts[1])` for standard JWT payload.
- **Effect**: UAT JWT `exp` is correctly read so client-side expiry matches 24h.

## Forensic Verification Checklist

| Step | Check | Status |
|------|--------|--------|
| 1 | Backend auth-enhanced: UAT `expiresIn` is 24*60*60 | ✅ |
| 2 | Backend jwt-verification: `verifyFallbackToken` exists and is used first in `verifyCognitoToken` | ✅ |
| 3 | Backend jwt-verification: `isTokenExpired` returns false for `fallback_*` | ✅ |
| 4 | Frontend VendorAuth: Unwraps `verifyData.data` / `verifyData.data.data`, extracts `tokens.access_token` | ✅ |
| 5 | Frontend storeSession + handleAuthSuccess: Set authToken, vendorSessionToken, vendorPhone before redirect | ✅ |
| 6 | Frontend page.tsx: Reads authToken/vendorSessionToken; redirects to /auth only if missing or expired | ✅ |
| 7 | Frontend session-utils: isTokenExpired handles staff_, fallback_, JWT (with base64url for JWT) | ✅ |
| 8 | Frontend api-client: getAuthToken returns authToken/vendorSessionToken; 401 calls clearVendorSession and redirects to /auth | ✅ |
| 9 | VendorApp: First API call (onboarding status or profile) uses token from getAuthToken; 24h token valid | ✅ |
| 10 | Base handler: verify-otp does not require auth; extractAndVerifyAuth returns null when no header | ✅ |

## Deployment
- **Backend**: Lambda (auth-enhanced + jwt-verification) must be deployed for token expiry and fallback fixes.
- **Frontend**: Vendor-web must be deployed for session-utils base64url fix.
- **Command**: `./scripts/deploy-all.sh dev` (or deploy Lambda + vendor-web per project process).

## Expected Behaviour After Fix
1. Vendor completes OTP on `/auth`.
2. Frontend stores token (24h UAT or fallback), then `window.location.replace('/')` or `/onboarding`.
3. Root page loads; finds token and phone; token not expired; renders VendorApp.
4. VendorApp or child calls e.g. `/vendor/onboarding/status` or `/vendor/:id/profile` with same token.
5. Backend accepts token (UAT 24h or fallback 1h); returns 200.
6. User remains on dashboard/onboarding; no redirect back to login.
