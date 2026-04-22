/**
 * Session Management Utilities
 * Handles session persistence, expiry, and hard refresh detection
 */

import { ensureCustomerIdStorageReconciledOnce } from './customer-id-storage';
import { getCognitoTokens, clearCognitoTokens } from './cognito-auth';

/** After OTP, customer must set password before treating login as complete (first-time / legacy OTP-only). */
export const SESSION_KEY_NEEDS_PASSWORD_SETUP = 'warmpawz_needs_password_setup';

export function setNeedsPasswordSetupAfterOtp(): void {
  if (typeof window !== 'undefined') sessionStorage.setItem(SESSION_KEY_NEEDS_PASSWORD_SETUP, '1');
}

export function clearNeedsPasswordSetup(): void {
  if (typeof window !== 'undefined') sessionStorage.removeItem(SESSION_KEY_NEEDS_PASSWORD_SETUP);
}

export function needsPasswordSetupAfterOtp(): boolean {
  return typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY_NEEDS_PASSWORD_SETUP) === '1';
}

/** Prefer Cognito bundle (`customerCognitoTokens`), then legacy `authToken` / `cognitoAccessToken`. */
export function getStoredCustomerJwtForSession(): string | null {
  if (typeof window === 'undefined') return null;
  const c = getCognitoTokens();
  if (c?.idToken) return c.idToken;
  if (c?.accessToken) return c.accessToken;
  return localStorage.getItem('authToken') || localStorage.getItem('cognitoAccessToken');
}

/**
 * Check if this is a hard refresh
 * Uses multiple methods for reliability
 * 
 * FIXED: Re-enabled proper hard refresh detection with conservative approach
 */
export function isHardRefresh(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Add debug logging for troubleshooting
  const debugInfo = {
    hasToken: !!getStoredCustomerJwtForSession(),
    hasSessionFlag: !!sessionStorage.getItem('_warmpawz_has_session'),
    justLoggedIn: !!sessionStorage.getItem('_warmpawz_just_logged_in'),
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
  
  console.log('[Session Debug] isHardRefresh check:', debugInfo);
  
  // CRITICAL: Check if user just logged in - never clear session in this case
  const justLoggedIn = sessionStorage.getItem('_warmpawz_just_logged_in');
  if (justLoggedIn) {
    // Clear the flag but don't clear session
    sessionStorage.removeItem('_warmpawz_just_logged_in');
    console.log('[Session] Just logged in - preserving session');
    return false;
  }
  
  // Check if session flag exists - if it does, user has an active session
  const hasSessionFlag = sessionStorage.getItem('_warmpawz_has_session');
  if (hasSessionFlag) {
    // Session flag exists, not a hard refresh (sessionStorage persists within tab)
    console.log('[Session] Session flag exists - preserving session');
    return false;
  }
  
  // Check if we're on the auth page - if so, don't clear (user is logging in)
  if (window.location.pathname.includes('/auth')) {
    console.log('[Session] On auth page - preserving session');
    return false;
  }
  
  // Method 1: Check navigation type (most reliable)
  const hasToken = !!getStoredCustomerJwtForSession();
  
  try {
    const perfEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (perfEntries.length > 0) {
      const navType = perfEntries[0].type;
      
      if (navType === 'reload') {
        // Hard refresh detected (F5 or Ctrl+R)
        // Only clear if we had a session before
        if (hasToken) {
          console.log('[Session] Hard refresh detected with existing token - CLEARING SESSION');
          return true;
        }
      }
      
      if (navType === 'navigate' || navType === 'back_forward') {
        // Normal navigation - not a hard refresh
        console.log('[Session] Normal navigation - preserving session');
        return false;
      }
    }
  } catch (e) {
    console.warn('[Session] Performance API not available:', e);
  }
  
  // Method 2: Conservative fallback
  // If we have tokens but no session flag, check navigation type
  // Don't automatically clear - only clear if we confirmed reload above
  if (hasToken && !hasSessionFlag) {
    console.log('[Session] Has token but no session flag - treating as new tab, preserving session for now');
    // This is likely a new tab - don't clear session
    // New tabs should redirect to login naturally via the app logic
    return false;
  }
  
  console.log('[Session] No hard refresh detected - preserving session');
  return false;
}

/**
 * Clear all customer session data
 */
export function clearCustomerSession(): void {
  if (typeof window === 'undefined') return;

  try {
    clearCognitoTokens();
  } catch {
    /* ignore */
  }
  
  localStorage.removeItem('customerPhone');
  localStorage.removeItem('customerId');
  localStorage.removeItem('customer_id');
  localStorage.removeItem('warmpawz_customer_id');
  localStorage.removeItem('authToken');
  localStorage.removeItem('customerData');
  localStorage.removeItem('customerProfile');
  localStorage.removeItem('customerPets');
  localStorage.removeItem('customerOnboardingComplete');
  localStorage.removeItem('onboarding_completed');
  localStorage.removeItem('profile_completed');
  localStorage.removeItem('customerJourneyStage');
  
  // Clear Cognito tokens
  localStorage.removeItem('cognitoAccessToken');
  localStorage.removeItem('cognitoIdToken');
  localStorage.removeItem('cognitoRefreshToken');
  localStorage.removeItem('cognitoTokenExpiry');
  localStorage.removeItem('cognitoUserInfo');

  // Aliases used by auth / legacy flows
  localStorage.removeItem('customer_phone');
  localStorage.removeItem('phone');
  localStorage.removeItem('refreshToken');

  // Tab session flags (avoid stale “logged in” after explicit sign-out)
  sessionStorage.removeItem('_warmpawz_has_session');
  sessionStorage.removeItem('_warmpawz_just_logged_in');
  sessionStorage.removeItem(SESSION_KEY_NEEDS_PASSWORD_SETUP);
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
  const token = getStoredCustomerJwtForSession();
  
  if (token && isTokenExpired(token)) {
    console.log('[Session] Token expired - clearing customer session');
    clearCustomerSession();
  }

  ensureCustomerIdStorageReconciledOnce();
}
