/**
 * ========================================
 * AUTHENTICATED FETCH UTILITY
 * ========================================
 * 
 * Secure wrapper for API calls that require authentication.
 * Uses session tokens instead of publicAnonKey for write operations.
 * 
 * Usage:
 * import { authenticatedFetch } from '@/utils/authenticatedFetch';
 * 
 * const data = await authenticatedFetch('/api/endpoint', {
 *   method: 'POST',
 *   body: JSON.stringify({ data })
 * });
 */

import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './supabase/info';

const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

interface AuthenticatedFetchOptions extends RequestInit {
  skipAuth?: boolean; // For GET requests that don't need auth
}

/**
 * Authenticated fetch wrapper
 * Automatically adds session token to Authorization header
 */
export async function authenticatedFetch(
  url: string,
  options: AuthenticatedFetchOptions = {}
): Promise<any> {
  const { skipAuth = false, ...fetchOptions } = options;

  // Get session token
  let token = publicAnonKey; // Default for GET requests

  if (!skipAuth && options.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method)) {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      throw new Error('Authentication required. Please login.');
    }
    
    token = session.access_token;
  }

  // Prepare headers
  const headers = new Headers(fetchOptions.headers);
  headers.set('Authorization', `Bearer ${token}`);
  
  if (fetchOptions.body && typeof fetchOptions.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  // Make request
  const response = await fetch(url, {
    ...fetchOptions,
    headers
  });

  // Handle response
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText || response.statusText}`);
  }

  // Return JSON if available
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }

  return await response.text();
}

/**
 * GET request with optional authentication
 */
export async function authenticatedGet(url: string, requireAuth = false): Promise<any> {
  return authenticatedFetch(url, {
    method: 'GET',
    skipAuth: !requireAuth
  });
}

/**
 * POST request with authentication
 */
export async function authenticatedPost(url: string, data: any): Promise<any> {
  return authenticatedFetch(url, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * PUT request with authentication
 */
export async function authenticatedPut(url: string, data: any): Promise<any> {
  return authenticatedFetch(url, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

/**
 * DELETE request with authentication
 */
export async function authenticatedDelete(url: string): Promise<any> {
  return authenticatedFetch(url, {
    method: 'DELETE'
  });
}

/**
 * Get current user ID from session
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

/**
 * Get current user metadata
 */
export async function getCurrentUserMetadata(): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.user_metadata || {};
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}
