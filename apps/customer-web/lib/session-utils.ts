/**
 * Session Management Utilities
 * Handles session persistence, expiry, and hard refresh detection
 */

/**
 * Check if this is a hard refresh
 * Uses multiple methods for reliability
 */
export function isHardRefresh(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Method 1: Check navigation type (most reliable)
  try {
    const perfEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (perfEntries.length > 0) {
      const navType = perfEntries[0].type;
      if (navType === 'reload') {
        // Hard refresh detected
        return true;
      }
      if (navType === 'navigate') {
        // First load or navigation - check if we have a session flag
        const hasSessionFlag = sessionStorage.getItem('_warmpawz_has_session');
        if (!hasSessionFlag) {
          // First load - no session exists anyway
          return false; // Don't clear on first load (no session to clear)
        }
      }
    }
  } catch (e) {
    // Performance API not available
  }
  
  // Method 2: Check if localStorage has tokens but sessionStorage flag is missing
  // On hard refresh: localStorage persists, sessionStorage is cleared
  // If we have tokens in localStorage but no sessionStorage flag = hard refresh
  const hasToken = !!(localStorage.getItem('authToken') || localStorage.getItem('cognitoAccessToken'));
  const hasSessionFlag = sessionStorage.getItem('_warmpawz_has_session');
  
  // If we have tokens but no session flag = hard refresh (sessionStorage was cleared)
  if (hasToken && !hasSessionFlag) {
    return true;
  }
  
  // Set page load flag for future checks (only if we have a token)
  if (hasToken && !hasSessionFlag) {
    // This will be set after we clear session, so next check won't trigger
    // But we return true first to clear the session
  }
  
  return false;
}

/**
 * Clear all customer session data
 */
export function clearCustomerSession(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('customerPhone');
  localStorage.removeItem('customerId');
  localStorage.removeItem('authToken');
  localStorage.removeItem('customerData');
  localStorage.removeItem('customerProfile');
  localStorage.removeItem('customerPets');
  localStorage.removeItem('customerOnboardingComplete');
  localStorage.removeItem('customerJourneyStage');
  
  // Clear Cognito tokens
  localStorage.removeItem('cognitoAccessToken');
  localStorage.removeItem('cognitoIdToken');
  localStorage.removeItem('cognitoRefreshToken');
  localStorage.removeItem('cognitoTokenExpiry');
  localStorage.removeItem('cognitoUserInfo');
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  
  // UAT tokens are always valid (they don't expire)
  // Format: uat-token-customer-{timestamp} or uat-token-vendor-{timestamp}
  if (token.startsWith('uat-token-')) {
    return false;
  }
  
  try {
    // Decode JWT token to check expiry
    const parts = token.split('.');
    if (parts.length !== 3) return true; // Not a valid JWT
    
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return true;
    
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch (error) {
    // If we can't decode, assume expired
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
    console.log('[Session] Hard refresh detected - clearing customer session');
    clearCustomerSession();
    // Set flag so we know session was cleared
    sessionStorage.setItem('_warmpawz_session_cleared', 'true');
    return;
  }
  
  // Check if session was cleared on previous hard refresh
  const wasCleared = sessionStorage.getItem('_warmpawz_session_cleared');
  if (wasCleared === 'true') {
    // Session was cleared, remove flag
    sessionStorage.removeItem('_warmpawz_session_cleared');
  }
  
  // Check token expiry
  const token = localStorage.getItem('authToken') || 
                localStorage.getItem('cognitoAccessToken');
  
  if (token && isTokenExpired(token)) {
    console.log('[Session] Token expired - clearing customer session');
    clearCustomerSession();
  }
}
