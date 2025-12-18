/**
 * Session Manager
 * 
 * Handles secure storage and retrieval of user session tokens.
 * Provides utilities for authenticated API calls.
 * 
 * ⚠️ SECURITY: Use session tokens for write operations, not publicAnonKey
 */

import { publicAnonKey } from './supabase/info';

interface SessionData {
  phone: string;
  accessToken?: string;
  user?: any;
  profile?: any;
  vendorId?: string;
  expiresAt?: number;
}

const SESSION_KEY = 'warmpawz_session';
const SESSION_EXPIRY_HOURS = 48; // ✅ EXTENDED: 48 hours for all apps (Customer, Vendor, Admin)

/**
 * Store session data securely
 */
export function storeSession(sessionData: SessionData): void {
  try {
    const expiresAt = Date.now() + (SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
    const dataWithExpiry = {
      ...sessionData,
      expiresAt
    };
    
    localStorage.setItem(SESSION_KEY, JSON.stringify(dataWithExpiry));
    console.log('✅ [SessionManager] Session stored successfully');
  } catch (error) {
    console.error('❌ [SessionManager] Failed to store session:', error);
  }
}

/**
 * Retrieve current session
 */
export function getSession(): SessionData | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) {
      console.log('⚠️ [SessionManager] No session found');
      return null;
    }
    
    const session: SessionData = JSON.parse(stored);
    
    // Check if expired
    if (session.expiresAt && Date.now() > session.expiresAt) {
      console.log('⚠️ [SessionManager] Session expired');
      clearSession();
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('❌ [SessionManager] Failed to retrieve session:', error);
    return null;
  }
}

/**
 * Clear session data
 */
export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    console.log('✅ [SessionManager] Session cleared');
  } catch (error) {
    console.error('❌ [SessionManager] Failed to clear session:', error);
  }
}

/**
 * Get authentication headers for API calls
 * 
 * ✅ SECURITY: Uses session token for write operations
 * Fallback to publicAnonKey only for read operations
 */
export function getAuthHeaders(options?: { 
  requireAuth?: boolean;
  contentType?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {};
  
  if (options?.contentType !== 'multipart/form-data') {
    headers['Content-Type'] = options?.contentType || 'application/json';
  }
  
  const session = getSession();
  
  if (session?.accessToken) {
    // ✅ Use session token if available
    headers['Authorization'] = `Bearer ${session.accessToken}`;
    console.log('🔐 [SessionManager] Using session token for authenticated request');
  } else if (options?.requireAuth) {
    // ⚠️ Auth required but no session - throw error
    throw new Error('Authentication required. Please log in again.');
  } else {
    // ⚠️ Fallback to publicAnonKey (only for read operations!)
    headers['Authorization'] = `Bearer ${publicAnonKey}`;
    console.log('⚠️ [SessionManager] Using publicAnonKey (fallback)');
  }
  
  return headers;
}

/**
 * Make an authenticated API call
 * 
 * ✅ SECURITY: Automatically uses session tokens for write operations
 * 
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @returns Promise<Response>
 */
export async function authenticatedFetch(
  url: string, 
  options: RequestInit & { requireAuth?: boolean } = {}
): Promise<Response> {
  const { requireAuth, ...fetchOptions } = options;
  const method = options.method || 'GET';
  
  // ✅ SECURITY: Require auth for all write operations
  const isWriteOperation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  const shouldRequireAuth = requireAuth !== undefined ? requireAuth : isWriteOperation;
  
  try {
    const headers = getAuthHeaders({ 
      requireAuth: shouldRequireAuth,
      contentType: fetchOptions.body instanceof FormData ? 'multipart/form-data' : 'application/json'
    });
    
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...headers,
        ...fetchOptions.headers
      }
    });
    
    // Check for 401 Unauthorized
    if (response.status === 401) {
      console.error('❌ [SessionManager] Unauthorized - clearing session');
      clearSession();
      throw new Error('Session expired. Please log in again.');
    }
    
    return response;
  } catch (error) {
    console.error('❌ [SessionManager] Fetch error:', error);
    throw error;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const session = getSession();
  return session !== null && !!session.accessToken;
}

/**
 * Get current vendor ID from session
 */
export function getVendorId(): string | null {
  const session = getSession();
  return session?.vendorId || session?.profile?.id || null;
}

/**
 * Get current user phone from session
 */
export function getUserPhone(): string | null {
  const session = getSession();
  return session?.phone || null;
}