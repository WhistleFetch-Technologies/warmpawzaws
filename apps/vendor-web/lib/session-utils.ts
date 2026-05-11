/**
 * Session Management Utilities for Vendor Web
 * Handles session persistence, expiry, and hard refresh detection
 */

/**
 * Whether the current page load is a "hard refresh" (F5 / Ctrl-R / browser
 * reload button).
 *
 * IMPORTANT: This used to clear the vendor's session on every hard refresh
 * when an auth token was already present — which kicked users out frequently,
 * especially after every deploy. With the 90-day persistent-login requirement
 * we no longer clear on reload. The token-refresh path (`cognito-auth.ts`)
 * already handles short-lived access tokens by silently exchanging the
 * refresh token whenever the access/id token is close to expiry, so a reload
 * never needs to drop credentials.
 *
 * The function is retained (and still detects reloads) so callers can branch
 * on the navigation type, but it always returns `false` to match the product
 * requirement that "logout should only happen when the user explicitly taps
 * Logout".
 */
export function isHardRefresh(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const perfEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (perfEntries.length > 0 && perfEntries[0].type === 'reload') {
      const hasToken = !!(
        localStorage.getItem('authToken') || localStorage.getItem('vendorSessionToken')
      );
      console.log(
        `[Vendor Session] Reload detected (hasToken=${hasToken}) — keeping session; refresh-token flow will renew expired access tokens automatically.`,
      );
    }
  } catch {
    /* Performance API unavailable — nothing to do. */
  }

  return false;
}

/**
 * Clear all vendor session data (login and logout).
 * Ensures no stale temp_vendor_ or partial data remains so auth prompt and dashboard load correctly.
 */
export function clearVendorSession(): void {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('vendorPhone');
  localStorage.removeItem('vendorId');
  localStorage.removeItem('authToken');
  localStorage.removeItem('vendorSessionToken');
  localStorage.removeItem('vendorAuthToken');
  localStorage.removeItem('vendorData');
  localStorage.removeItem('vendorUser');
  localStorage.removeItem('vendorApplicationStatus');
  localStorage.removeItem('vendorRole');
  localStorage.removeItem('vendorName');
  localStorage.removeItem('businessName');
  localStorage.removeItem('vendorCountryCode');
  
  // Clear Cognito tokens
  localStorage.removeItem('vendorTokenExpiry');
  localStorage.removeItem('vendorRefreshTokenExpiry');
  localStorage.removeItem('cognitoAccessToken');
  localStorage.removeItem('cognitoIdToken');
  localStorage.removeItem('cognitoRefreshToken');
  
  // Clear session flags so next load shows login prompt instead of redirecting
  sessionStorage.removeItem('_warmpawz_vendor_has_session');
  sessionStorage.removeItem('_warmpawz_vendor_just_logged_in');
  sessionStorage.removeItem('_warmpawz_vendor_login_at');
  sessionStorage.removeItem('_warmpawz_vendor_session_cleared');
  sessionStorage.removeItem('_vendor_redirected_to_auth');
  
  // Clear capability cache from sessionStorage
  try {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith('vendor_capabilities_')) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Check if current session is a stale temp_vendor_ session (e.g. leftover from a previous visit).
 * When true, we should clear and show login so the user gets the actual auth prompt.
 * Do NOT treat as stale when we have a valid token (fresh login after OTP).
 */
export function isStaleTempVendorSession(token: string | null): boolean {
  if (typeof window === 'undefined') return false;
  const vendorId = localStorage.getItem('vendorId');
  const justLoggedIn = sessionStorage.getItem('_warmpawz_vendor_just_logged_in');
  if (!vendorId || !vendorId.startsWith('temp_vendor_')) return false;
  // Right after OTP we set just_logged_in and redirect; if flag is set, never treat as stale
  if (justLoggedIn === 'true') return false;
  // If we have a valid (non-expired) token, assume fresh login — don't clear and send back to auth
  if (token && token.length >= 10 && !isTokenExpired(token)) return false;
  // Stale: temp_vendor_ + no just_logged_in flag + no valid token
  return true;
}

/**
 * Check if token is expired
 * ✅ FIX: Handle both JWT tokens and staff session tokens
 * Staff tokens format: staff_session_PHONE_TIMESTAMP or staff_refresh_PHONE_TIMESTAMP
 * Fallback tokens format: fallback_BASE64PAYLOAD.HASH
 */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  
  try {
    // ✅ FIX: Check for staff session tokens (non-JWT format)
    // Staff tokens are valid for 24 hours from creation
    if (token.startsWith('staff_session_') || token.startsWith('staff_refresh_')) {
      // Extract timestamp from staff token: staff_session_PHONE_TIMESTAMP
      const parts = token.split('_');
      if (parts.length >= 3) {
        const timestamp = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(timestamp)) {
          const tokenAge = Date.now() - timestamp;
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
          const isExpired = tokenAge > maxAge;
          console.log('[TokenExpiry] Staff token check:', { tokenAge: tokenAge / 1000 / 60, minutes: tokenAge / 1000 / 60, maxAgeMinutes: maxAge / 1000 / 60, isExpired });
          return isExpired;
        }
      }
      // If we can't parse timestamp, assume valid (let backend reject if needed)
      console.log('[TokenExpiry] Staff token - cannot parse timestamp, assuming valid');
      return false;
    }
    
    // ✅ FIX: Check for fallback tokens (format: fallback_BASE64.HASH)
    if (token.startsWith('fallback_')) {
      // Fallback tokens are valid for 1 hour
      try {
        const payloadPart = token.replace('fallback_', '').split('.')[0];
        // Convert base64url to standard base64
        const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));
        if (payload.timestamp) {
          const tokenAge = Date.now() - payload.timestamp;
          const maxAge = 60 * 60 * 1000; // 1 hour in milliseconds
          return tokenAge > maxAge;
        }
      } catch (e) {
        // Can't parse fallback token, assume valid
        console.log('[TokenExpiry] Fallback token - cannot parse, assuming valid');
        return false;
      }
      return false;
    }
    
    // Standard JWT token validation (JWT uses base64url; atob needs standard base64)
    const parts = token.split('.');
    if (parts.length !== 3) {
      // Not a JWT, but also not a recognized session token
      // ✅ FIX: Return false (not expired) to let the backend validate
      console.log('[TokenExpiry] Unknown token format, assuming valid (backend will validate)');
      return false;
    }
    const base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padding = base64Payload.length % 4 ? '='.repeat(4 - (base64Payload.length % 4)) : '';
    const payload = JSON.parse(atob(base64Payload + padding));
    if (!payload.exp) {
      // No expiry in JWT, assume valid
      console.log('[TokenExpiry] JWT without exp claim, assuming valid');
      return false;
    }
    
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch (error) {
    // ✅ FIX: On error, return false (not expired) instead of true
    // Let the backend validate the token - don't prematurely clear session
    console.warn('[TokenExpiry] Error parsing token, assuming valid:', error);
    return false;
  }
}

/**
 * Initialize session.
 *
 * MUST be called synchronously before any component logic.
 *
 * Behaviour change (90-day persistent login):
 *   - We NEVER clear the session here. Reloads, deploys and new tabs simply
 *     restore whatever is in `localStorage` and kick off a silent refresh if
 *     the access/id token has expired.
 *   - The only path that clears the session is `clearVendorSession()` (used
 *     by the explicit logout flow).
 *   - If the refresh token itself has expired or the server rejects it, the
 *     refresh helper in `cognito-auth.ts` is the one that decides whether to
 *     drop credentials — not this function.
 */
export function initializeSession(): void {
  if (typeof window === 'undefined') return;

  isHardRefresh();

  const wasCleared = sessionStorage.getItem('_warmpawz_vendor_session_cleared');
  if (wasCleared === 'true') {
    sessionStorage.removeItem('_warmpawz_vendor_session_cleared');
  }

  const token = localStorage.getItem('authToken') || localStorage.getItem('vendorSessionToken');
  if (token && isTokenExpired(token)) {
    console.log('[Vendor Session] Access token expired - attempting silent refresh (90-day refresh window)');
    import('./cognito-auth').then(({ refreshVendorTokensIfNeeded }) => {
      refreshVendorTokensIfNeeded().catch(() => {
        /* swallow — keep session and let the next API call retry the refresh. */
      });
    });
  }
}
