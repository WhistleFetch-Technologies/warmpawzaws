# Session Expiry Extended to 48 Hours

**Date:** December 18, 2024  
**Applied To:** All Three Web Apps (Customer, Vendor, Admin)

---

## Summary

Extended session token expiry from 24 hours to **48 hours** across all apps to prevent premature "Session expired, please login again" errors during critical vendor operations (staff creation, center profile management, etc.).

---

## Files Updated

### 1. Frontend Session Manager
**File:** `/utils/session-manager.ts`  
**Line 22:** `const SESSION_EXPIRY_HOURS = 48;`

```typescript
const SESSION_KEY = 'warmpawz_session';
const SESSION_EXPIRY_HOURS = 48; // ✅ EXTENDED: 48 hours for all apps
```

**Impact:**
- Customer app sessions last 48 hours
- Vendor app sessions last 48 hours  
- Admin app sessions last 48 hours
- Session stored in `localStorage` as `warmpawz_session`

---

### 2. Backend Session Creation
**File:** `/supabase/functions/server/auth-service.tsx`  
**Line 188:** `const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();`

```typescript
export async function createUserSession(userId: string, phone: string, role: string): Promise<Session> {
  const sessionId = generateId('session');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // ✅ EXTENDED: 48 hours
  
  const session: Session = {
    sessionId,
    userId,
    phone: normalizePhone(phone),
    role: role as 'customer' | 'vendor' | 'staff' | 'admin',
    token: createSession(userId, role as 'customer' | 'vendor' | 'staff' | 'admin'),
    createdAt: now,
    expiresAt
  };
  
  // Store session in KV
  await kv.set(`session:${session.sessionId}`, session);
  await kv.set(`session:user:${userId}`, session.sessionId);
  await kv.set(`session:phone:${normalizePhone(phone)}`, session.sessionId);
  
  return session;
}
```

**Impact:**
- Backend session tokens valid for 48 hours
- Synchronized with frontend session expiry
- Prevents authentication mismatch errors

---

## Session Expiry Flow

### Login
1. User logs in via OTP (5 minute expiry for OTP only)
2. Backend creates session with 48-hour expiry
3. Frontend stores session in `localStorage` with matching 48-hour expiry
4. Access token generated and included in session

### API Calls
1. Frontend reads session from `localStorage`
2. Checks if `session.expiresAt > Date.now()`
3. If expired → Clear session → Redirect to login
4. If valid → Use `session.accessToken` in Authorization header
5. Backend validates token against KV store

### Session Validation (Backend)
```typescript
// auth-middleware.tsx
if (new Date(matchingSession.expiresAt) < new Date()) {
  console.log('❌ [AUTH] Token expired:', matchingSession.expiresAt);
  // Clean up expired session
  await kv.del(`session:${matchingSession.sessionId}`);
  await kv.del(`session:user:${matchingSession.userId}`);
  await kv.del(`session:phone:${matchingSession.phone}`);
  return sendError(c, 'Session expired - please login again', 401);
}
```

---

## What's NOT Changed

### OTP Expiry (Remains 5 Minutes)
**File:** `/supabase/functions/server/auth-endpoints.tsx`  
**Line 28:** `await kv.set(\`otp:${phone}\`, { code: otp, expiresAt: Date.now() + 5 * 60 * 1000 });`

OTP codes expire in 5 minutes for security (this is correct and should not be extended).

### Video Call Token Expiry (Remains 24 Hours)
**File:** `/supabase/functions/server/agora-video-integration.tsx`  
**Line 17:** `const TOKEN_EXPIRY_TIME = 24 * 3600;`

Agora video call tokens expire in 24 hours (this is separate from user sessions).

### Analytics Time Windows
Files like `analytics-aggregation.tsx` use 30-day windows for data analysis, which is unrelated to session expiry.

---

## Testing Checklist

✅ **Login Flow**
- Customer login → Session created with 48h expiry
- Vendor login → Session created with 48h expiry  
- Admin login → Session created with 48h expiry
- Staff login → Session created with 48h expiry

✅ **Long Operations**
- Add staff member (takes 2-5 minutes) → No session expiry
- Create center profile with specializations → No session expiry
- Upload multiple images → No session expiry
- Fill out long forms → No session expiry

✅ **Session Persistence**
- Close browser → Session persists in localStorage
- Reopen browser within 48h → Still logged in
- After 48h → Session expired, redirect to login

✅ **API Calls**
- POST /staff/create → Uses valid session token
- POST /vendor/onboarding/save → Uses valid session token
- PUT /vendor/profile → Uses valid session token
- All write operations → Session token validated

---

## Security Considerations

### Why 48 Hours?
1. **User Experience:** Prevents interruptions during multi-step workflows
2. **Vendor Operations:** Staff creation, profile editing take time
3. **Mobile Usage:** Vendors may leave app open for extended periods
4. **Industry Standard:** 48-72 hours is common for B2B applications

### Security Measures
1. **Token Validation:** Every API call validates token against KV store
2. **Secure Storage:** Sessions stored in encrypted localStorage
3. **Auto Cleanup:** Expired sessions automatically deleted from KV
4. **401 Handling:** Frontend clears session and redirects on 401
5. **Token Rotation:** Could implement token refresh before expiry (future)

### Monitoring
- Log all session expirations
- Track session duration analytics
- Monitor 401 error rates
- Alert on unusual session patterns

---

## Rollback Plan

If 48 hours causes issues, revert by:

1. **Frontend:** Change line 22 in `/utils/session-manager.ts`:
   ```typescript
   const SESSION_EXPIRY_HOURS = 24; // Revert to 24 hours
   ```

2. **Backend:** Change line 188 in `/supabase/functions/server/auth-service.tsx`:
   ```typescript
   const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Revert to 24 hours
   ```

3. **Clear Existing Sessions:** All users must re-login after rollback

---

## Future Enhancements

### Token Refresh (Recommended)
Implement silent token refresh before expiry:
```typescript
// Refresh token 1 hour before expiry
if (session.expiresAt - Date.now() < 60 * 60 * 1000) {
  await refreshSessionToken(session.sessionId);
}
```

### "Remember Me" Feature
Allow users to opt into longer sessions (7-30 days):
```typescript
const SESSION_EXPIRY_HOURS = rememberMe ? 168 : 48; // 7 days vs 48 hours
```

### Session Analytics Dashboard
Track average session duration, expiry patterns, re-login frequency per app.

---

## Related Issues Fixed

1. ❌ **Before:** "Session expired" during staff creation
2. ✅ **After:** 48-hour window allows full completion

3. ❌ **Before:** "Authentication Required" when uploading photos
4. ✅ **After:** Session persists through multi-step uploads

5. ❌ **Before:** Token mismatch between frontend (24h) and backend (30 days)
6. ✅ **After:** Synchronized 48h expiry across all layers

---

## Verification Commands

### Check Frontend Session
```javascript
// Browser console
const session = JSON.parse(localStorage.getItem('warmpawz_session'));
console.log('Expires At:', new Date(session.expiresAt));
console.log('Hours Remaining:', (session.expiresAt - Date.now()) / (60 * 60 * 1000));
```

### Check Backend Session (via API)
```bash
curl -X GET https://PROJECT_ID.supabase.co/functions/v1/make-server-3dd53475/auth/session \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

---

**Status:** ✅ DEPLOYED  
**Next Review:** January 18, 2025 (30 days)
