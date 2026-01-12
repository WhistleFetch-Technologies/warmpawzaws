/**
 * Session Manager Utility
 * Provides authenticated fetch functionality for vendor web app
 */

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get session token from localStorage or context
  const sessionToken = typeof window !== 'undefined' 
    ? localStorage.getItem('vendorSessionToken') 
    : null;

  // Merge headers
  const headers = new Headers(options.headers);
  if (sessionToken) {
    headers.set('Authorization', `Bearer ${sessionToken}`);
  }
  headers.set('Content-Type', 'application/json');

  // Make authenticated request
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Store session data securely
 */
export function storeSession(sessionData: any): void {
  if (typeof window !== 'undefined') {
    // Store vendor ID
    if (sessionData.vendorId) {
      localStorage.setItem('vendorId', sessionData.vendorId);
    }
    
    // Store token - handle both accessToken and sessionToken
    const token = sessionData.accessToken || sessionData.sessionToken;
    if (token) {
      localStorage.setItem('authToken', token); // Used by onboarding page
      localStorage.setItem('vendorSessionToken', token); // Used by API client
    }
    
    // Store phone
    if (sessionData.phone) {
      localStorage.setItem('vendorPhone', sessionData.phone);
      // Also set cookie for middleware (if possible in static export)
      // Note: Static exports can't set cookies, but middleware should allow localStorage fallback
    }
    
    // Store user data if provided
    if (sessionData.user) {
      localStorage.setItem('vendorUser', JSON.stringify(sessionData.user));
    }
    
    // Store vendor profile if provided
    if (sessionData.profile) {
      localStorage.setItem('vendorData', JSON.stringify(sessionData.profile));
    }
  }
}

