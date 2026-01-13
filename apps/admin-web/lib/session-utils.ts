/**
 * Session Management Utilities for Admin Web
 * Handles session persistence, expiry, and hard refresh detection
 */

/**
 * Check if this is a hard refresh
 * Strategy: If localStorage has tokens but sessionStorage doesn't have the flag,
 * it means localStorage persisted but sessionStorage was cleared = hard refresh
 */
export function isHardRefresh(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hasToken = !!localStorage.getItem('adminAuthToken');
  const hasSessionFlag = !!sessionStorage.getItem('_warmpawz_admin_has_session');
  
  // If we have tokens but no session flag = hard refresh (sessionStorage was cleared)
  if (hasToken && !hasSessionFlag) {
    return true;
  }
  
  // Check navigation type
  try {
    const perfEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (perfEntries.length > 0) {
      const navType = perfEntries[0].type;
      if (navType === 'reload') {
        return true;
      }
    }
  } catch (e) {
    // Performance API not available
  }
  
  // Set flag for future checks
  if (hasToken && !hasSessionFlag) {
    sessionStorage.setItem('_warmpawz_admin_page_loaded', 'true');
  }
  
  return false;
}

/**
 * Clear all admin session data
 */
export function clearAdminSession(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('adminAuthToken');
  localStorage.removeItem('adminId');
  localStorage.removeItem('adminEmail');
  localStorage.removeItem('adminUser');
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
    console.log('[Session] Hard refresh detected - clearing admin session');
    clearAdminSession();
    sessionStorage.setItem('_warmpawz_admin_session_cleared', 'true');
    return;
  }
  
  const wasCleared = sessionStorage.getItem('_warmpawz_admin_session_cleared');
  if (wasCleared === 'true') {
    sessionStorage.removeItem('_warmpawz_admin_session_cleared');
  }
  
  const token = localStorage.getItem('adminAuthToken');
  
  if (token && isTokenExpired(token)) {
    console.log('[Session] Token expired - clearing admin session');
    clearAdminSession();
  }
}
