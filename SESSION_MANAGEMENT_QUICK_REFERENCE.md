# Session Management - Quick Reference

**Quick guide for developers and QA**

---

## 🚀 Quick Start

### Run Tests
```bash
# Bash script (Linux/Mac)
./test-session-management.sh

# Node.js script (Cross-platform)
node test-session-management.js
```

### Environment Variables
```bash
export SUPABASE_PROJECT_ID="vpvpbdwtyugbknrntkho"
export SUPABASE_ANON_KEY="your-anon-key"
```

---

## 📋 Token Expiry Rules

| User Type | Platform | Expiry |
|-----------|----------|--------|
| Customer | Mobile App | 365 days |
| Vendor | Mobile App | 365 days |
| Customer | Web | 48 hours |
| Vendor | Web | 48 hours |
| Admin | Any | 4 hours |
| Staff | Any | 7 days |

---

## 🔑 Key Endpoints

### Login
```
POST /auth/login
Body: {
  phone: string,
  portal: 'customer' | 'vendor' | 'admin',
  deviceType?: 'mobile' | 'web',
  isMobileApp?: boolean
}
```

### Logout
```
POST /auth/logout
Body: {
  sessionId?: string,
  userId?: string,
  accessToken?: string,
  logoutAll?: boolean
}
```

### Verify Session
```
POST /auth/verify-session
Body: {
  sessionId: string
}
```

---

## 🛠️ Frontend Usage

### Logout Hook
```typescript
import { useLogout } from '../hooks/useLogout';

const { logout } = useLogout();
await logout({ redirectTo: '/login' });
```

### Logout Button
```typescript
import { LogoutButton } from '../components/common/LogoutButton';

<LogoutButton 
  variant="outline" 
  size="default"
  redirectTo="/login"
/>
```

### Session Manager
```typescript
import { 
  storeSession, 
  getStoredSession, 
  clearSession,
  performLogout 
} from '../utils/session-manager';

// Store session
storeSession(sessionData);

// Get session
const session = getStoredSession();

// Clear session
clearSession();

// Complete logout
await performLogout(sessionId, userId, tokens);
```

### Device Detection
```typescript
import { getDeviceContext, getLoginDeviceInfo } from '../utils/device-detection';

// Get device info
const deviceInfo = getDeviceContext();
// { deviceType: 'mobile' | 'web', platform: 'ios' | 'android' | 'web', ... }

// Get login device info
const loginInfo = getLoginDeviceInfo();
// { deviceType: 'mobile' | 'web', isMobileApp: boolean, ... }
```

---

## 📁 Key Files

### Backend
- `supabase/functions/server/auth-service.tsx` - Auth service
- `supabase/functions/server/auth-endpoints.tsx` - Auth endpoints
- `supabase/functions/server/database-schema.tsx` - Session interface

### Frontend
- `src/utils/device-detection.ts` - Device detection
- `src/utils/session-manager.ts` - Session management
- `src/hooks/useLogout.ts` - Logout hook
- `src/components/common/LogoutButton.tsx` - Logout button

---

## ✅ Testing Checklist

- [ ] Mobile app login (365 days)
- [ ] Web customer login (48 hours)
- [ ] Web vendor login (48 hours)
- [ ] Admin login (4 hours)
- [ ] Session verification
- [ ] Logout by sessionId
- [ ] Logout by userId
- [ ] Logout all devices
- [ ] Frontend logout (all apps)
- [ ] Session persistence
- [ ] Token refresh

---

## 🐛 Common Issues

### Token expiry wrong
- Check `deviceType` and `isMobileApp` in login request
- Verify backend expiry calculation

### Logout not working
- Check sessionId/userId/accessToken
- Verify backend endpoint
- Check browser console

### Session not persisting
- Check localStorage enabled
- Verify storage quota
- Check session storage key

---

## 📞 Support

- Check backend logs
- Check browser console
- Review implementation summary
- Check Supabase dashboard

---

## 📚 Documentation

- `SESSION_MANAGEMENT_IMPLEMENTATION_SUMMARY.md` - Full implementation details
- `SESSION_MANAGEMENT_TESTING_GUIDE.md` - Comprehensive testing guide
- `SESSION_MANAGEMENT_GAP_ANALYSIS.md` - Gap analysis

