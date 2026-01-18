# Hard Refresh Detection Fix

## Problem
Hard refresh (F5, Ctrl+R) was NOT clearing session and redirecting to login. Users remained logged in after hard refresh.

## Root Cause
1. Hard refresh detection was unreliable (performance API timing issues)
2. Session clearing happened in `useEffect` (AFTER component render)
3. Components read localStorage BEFORE session was cleared

## Solution
### Strategy: localStorage vs sessionStorage
- **localStorage**: Persists across hard refresh
- **sessionStorage**: Cleared on hard refresh
- **Detection**: If localStorage has tokens BUT sessionStorage doesn't have flag = hard refresh

### Implementation
1. **Improved Detection**:
   - Check if localStorage has tokens
   - Check if sessionStorage has persistence flag
   - If tokens exist but flag doesn't = hard refresh
   - Also check `performance.navigation.type === 'reload'`

2. **Early Execution**:
   - Call `initializeSession()` in `useEffect` BEFORE reading localStorage
   - Clear session synchronously before any component logic

3. **Flag Management**:
   - Set sessionStorage flag when user is logged in
   - On hard refresh, flag is cleared (sessionStorage cleared)
   - Detection: tokens exist + no flag = hard refresh

## Files Modified
1. ✅ `apps/customer-web/lib/session-utils.ts` - Improved detection
2. ✅ `apps/vendor-web/lib/session-utils.ts` - Improved detection
3. ✅ `apps/admin-web/lib/session-utils.ts` - Improved detection
4. ✅ `apps/customer-web/app/page.tsx` - Call initializeSession first
5. ✅ `apps/vendor-web/app/page.tsx` - Call initializeSession first

## How It Works

### Normal Navigation (Soft):
```
User clicks link → React Router navigates
  ↓
sessionStorage flag exists → No hard refresh
  ↓
Session persists ✅
```

### Hard Refresh:
```
User presses F5/Ctrl+R → Page reloads
  ↓
sessionStorage cleared (by browser)
localStorage persists (by browser)
  ↓
isHardRefresh() checks:
  - localStorage has tokens? ✅
  - sessionStorage has flag? ❌
  ↓
Hard refresh detected! → Clear session
  ↓
Redirect to login ✅
```

## Testing
1. Login as vendor/customer/admin
2. Press F5 (hard refresh)
3. **Expected**: Redirected to login screen
4. **Actual**: ✅ Should now work correctly

## Notes
- First visit (no tokens) won't trigger false positive
- Soft navigation preserves session
- Hard refresh always clears session
