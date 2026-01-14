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
  
  // CRITICAL: Check if user just logged in - never clear session in this case
  const justLoggedIn = sessionStorage.getItem('_warmpawz_just_logged_in');
  if (justLoggedIn) {
    // Clear the flag but don't clear session
    sessionStorage.removeItem('_warmpawz_just_logged_in');
    return false;
  }
  
  // Check if session flag exists - if it does, user has an active session
  const hasSessionFlag = sessionStorage.getItem('_warmpawz_has_session');
  if (hasSessionFlag) {
    // Session flag exists, not a hard refresh (sessionStorage persists within tab)
    return false;
  }
  
  // Method 1: Check navigation type (most reliable)
  try {
    const perfEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (perfEntries.length > 0) {
      const navType = perfEntries[0].type;
      if (navType === 'reload') {
        // Hard refresh detected - but only clear if we had a session before
        const hasToken = !!(localStorage.getItem('authToken') || localStorage.getItem('cognitoAccessToken'));
        return hasToken; // Only consider it a "hard refresh" if there was a session to clear
      }
      if (navType === 'navigate' || navType === 'back_forward') {
        // Normal navigation - not a hard refresh
        return false;
      }
    }
  } catch (e) {
    // Performance API not available
  }
  
  // Method 2: If we have tokens but no session flag AND navigation type was reload
  // This is a hard refresh scenario
  const hasToken = !!(localStorage.getItem('authToken') || localStorage.getItem('cognitoAccessToken'));
  
  // Only consider it hard refresh if:
  // 1. We have tokens (there was a session)
  // 2. No session flag (sessionStorage was cleared = browser refresh or new tab)
  // 3. This is not a fresh login (handled above)
  if (hasToken && !hasSessionFlag) {
    // Check if we're on the auth page - if so, don't clear (user is logging in)
    if (typeof window !== 'undefined' && window.location.pathname.includes('/auth')) {
      return false;
    }
    // For other pages, this is likely a new tab or hard refresh
    // Be conservative - only clear on explicit reload
    return false; // Changed: Don't auto-clear to avoid login loops
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
