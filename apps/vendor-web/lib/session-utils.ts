/**
 * Session Management Utilities for Vendor Web
 * Handles session persistence, expiry, and hard refresh detection
 */

/**
 * Check if this is a hard refresh
 * Strategy: If localStorage has tokens but sessionStorage doesn't have the flag,
 * AND navigation type is 'reload', then it's a hard refresh
 * 
 * FIXED: Made detection less aggressive - won't clear on new tab
 */
export function isHardRefresh(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hasToken = !!(localStorage.getItem('authToken') || localStorage.getItem('vendorSessionToken'));
  const hasSessionFlag = !!sessionStorage.getItem('_warmpawz_vendor_has_session');
  const justLoggedIn = !!sessionStorage.getItem('_warmpawz_vendor_just_logged_in');
  
  // Add debug logging for troubleshooting
  const debugInfo = {
    hasToken,
    hasSessionFlag,
    justLoggedIn,
    pathname: window.location.pathname,
    navigationType: 'unknown'
  };
  
  try {
    const perfEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (perfEntries.length > 0) {
      debugInfo.navigationType = perfEntries[0].type;
    }
  } catch (e) {
    // Performance API not available
  }
  
  console.log('[Vendor Session Debug] isHardRefresh check:', debugInfo);
  
  // CRITICAL: Check if user just logged in - never clear session in this case
  if (justLoggedIn) {
    sessionStorage.removeItem('_warmpawz_vendor_just_logged_in');
    console.log('[Vendor Session] Just logged in - preserving session');
    return false;
  }
  
  // If session flag exists, preserve the session
  if (hasSessionFlag) {
    console.log('[Vendor Session] Session flag exists - preserving session');
    return false;
  }
  
  // Check if we're on the auth page - if so, don't clear (user is logging in)
  if (window.location.pathname.includes('/auth')) {
    console.log('[Vendor Session] On auth page - preserving session');
    return false;
  }
  
  // Check navigation type - only clear on explicit reload (F5)
  try {
    const perfEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (perfEntries.length > 0) {
      const navType = perfEntries[0].type;
      
      if (navType === 'reload') {
        // This is an actual hard refresh (F5)
        // Only clear if we had a session before
        if (hasToken) {
          console.log('[Vendor Session] Hard refresh detected with existing token - CLEARING SESSION');
          return true;
        }
      }
      
      if (navType === 'navigate') {
        // This is a new tab or direct navigation
        // DON'T clear session - let app logic handle redirect
        console.log('[Vendor Session] New tab/navigation detected - preserving session (will redirect if needed)');
        return false;
      }
      
      if (navType === 'back_forward') {
        // Browser back/forward button
        console.log('[Vendor Session] Back/forward navigation - preserving session');
        return false;
      }
    }
  } catch (e) {
    console.warn('[Vendor Session] Performance API not available:', e);
  }
  
  // Conservative fallback: If we have tokens but no session flag
  // This is likely a new tab - DON'T clear session
  // The app will handle login redirect if needed
  if (hasToken && !hasSessionFlag) {
    console.log('[Vendor Session] Has token but no session flag - treating as new tab, preserving session');
    return false;
  }
  
  console.log('[Vendor Session] No hard refresh detected - preserving session');
  return false;
}

/**
 * Clear all vendor session data
 */
export function clearVendorSession(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('vendorPhone');
  localStorage.removeItem('vendorId');
  localStorage.removeItem('authToken');
  localStorage.removeItem('vendorSessionToken');
  localStorage.removeItem('vendorData');
  localStorage.removeItem('vendorUser');
  localStorage.removeItem('vendorApplicationStatus');
  
  // Clear Cognito tokens
  localStorage.removeItem('vendorTokenExpiry');
  localStorage.removeItem('cognitoAccessToken');
  localStorage.removeItem('cognitoIdToken');
  localStorage.removeItem('cognitoRefreshToken');
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return true;
    
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch (error) {
    return true;
  }
}

/**
 * Initialize session - clear on hard refresh
 * MUST be called synchronously before any component logic
 */
export function initializeSession(): void {
  if (typeof window === 'undefined') return;
  
  // Check for hard refresh FIRST (before reading localStorage)
  const isHard = isHardRefresh();
  
  if (isHard) {
    console.log('[Session] Hard refresh detected - clearing vendor session');
    clearVendorSession();
    sessionStorage.setItem('_warmpawz_vendor_session_cleared', 'true');
    return;
  }
  
  // Check if session was cleared on previous hard refresh
  const wasCleared = sessionStorage.getItem('_warmpawz_vendor_session_cleared');
  if (wasCleared === 'true') {
    sessionStorage.removeItem('_warmpawz_vendor_session_cleared');
  }
  
  const token = localStorage.getItem('authToken') || 
                localStorage.getItem('vendorSessionToken');
  
  if (token && isTokenExpired(token)) {
    console.log('[Session] Token expired - clearing vendor session');
    clearVendorSession();
  }
}
