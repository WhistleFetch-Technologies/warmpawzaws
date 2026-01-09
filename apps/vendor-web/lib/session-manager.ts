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

