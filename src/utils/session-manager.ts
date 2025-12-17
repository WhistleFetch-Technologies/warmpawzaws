/**
 * Session Management Utility
 * Handles session storage, cleanup, and logout
 */

import { projectId, publicAnonKey } from './supabase/info';
import { supabase } from './supabase/client';
import { getDeviceContext } from './device-detection';

const SESSION_STORAGE_KEY = 'warmpawz_session';
const TOKEN_STORAGE_KEY = 'warmpawz_tokens';
const USER_STORAGE_KEY = 'warmpawz_user';

export interface StoredSession {
  sessionId: string;
  userId: string;
  phone: string;
  role: string;
  accessToken: string;
  supabaseAccessToken?: string;
  supabaseRefreshToken?: string;
  expiresAt: string;
  deviceType?: 'mobile' | 'web';
  isMobileApp?: boolean;
}

export interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
}

/**
 * Store session in localStorage
 */
export function storeSession(session: StoredSession): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    
    // Also store tokens separately for easy access
    if (session.supabaseAccessToken) {
      const tokens: StoredTokens = {
        accessToken: session.supabaseAccessToken,
        refreshToken: session.supabaseRefreshToken,
        expiresAt: session.expiresAt
      };
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    }
    
    console.log('✅ Session stored in localStorage');
  } catch (error) {
    console.error('❌ Error storing session:', error);
  }
}

/**
 * Get stored session from localStorage
 */
export function getStoredSession(): StoredSession | null {
  try {
    const sessionData = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionData) return null;
    
    const session = JSON.parse(sessionData) as StoredSession;
    
    // Check if expired
    if (new Date(session.expiresAt) < new Date()) {
      console.log('⏰ Stored session expired');
      clearSession();
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('❌ Error reading session:', error);
    return null;
  }
}

/**
 * Get stored tokens
 */
export function getStoredTokens(): StoredTokens | null {
  try {
    const tokenData = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!tokenData) return null;
    
    const tokens = JSON.parse(tokenData) as StoredTokens;
    
    // Check if expired
    if (new Date(tokens.expiresAt) < new Date()) {
      console.log('⏰ Stored tokens expired');
      clearSession();
      return null;
    }
    
    return tokens;
  } catch (error) {
    console.error('❌ Error reading tokens:', error);
    return null;
  }
}

/**
 * Clear all session data from localStorage and sessionStorage
 */
export function clearSession(): void {
  try {
    // Clear localStorage
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem('warmpawz-auth-token'); // Supabase default key
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear any other auth-related keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('auth') || key.includes('session') || key.includes('token'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log('✅ Session cleared from storage');
  } catch (error) {
    console.error('❌ Error clearing session:', error);
  }
}

/**
 * Complete logout - clears local state and calls backend
 */
export async function performLogout(sessionId?: string, userId?: string, tokens?: StoredTokens): Promise<void> {
  try {
    console.log('👋 Starting logout process...');
    
    // Clear local storage first
    clearSession();
    
    // Sign out from Supabase
    try {
      await supabase.auth.signOut();
      console.log('✅ Supabase auth signed out');
    } catch (error) {
      console.error('⚠️ Error signing out from Supabase:', error);
    }
    
    // Call backend logout endpoint
    try {
      const logoutPayload: any = {};
      
      if (sessionId) {
        logoutPayload.sessionId = sessionId;
      } else if (userId) {
        logoutPayload.userId = userId;
      } else if (tokens?.accessToken) {
        logoutPayload.accessToken = tokens.accessToken;
        if (tokens.refreshToken) {
          logoutPayload.refreshToken = tokens.refreshToken;
        }
      }
      
      if (Object.keys(logoutPayload).length > 0) {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/auth/logout`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify(logoutPayload)
          }
        );
        
        if (response.ok) {
          console.log('✅ Backend logout successful');
        } else {
          console.warn('⚠️ Backend logout failed:', response.status);
        }
      }
    } catch (error) {
      console.error('⚠️ Error calling logout endpoint:', error);
      // Don't throw - local cleanup is more important
    }
    
    console.log('✅ Logout complete');
  } catch (error) {
    console.error('❌ Logout error:', error);
    throw error;
  }
}

/**
 * Check if session is valid
 */
export function isSessionValid(): boolean {
  const session = getStoredSession();
  if (!session) return false;
  
  return new Date(session.expiresAt) > new Date();
}

/**
 * Get device context for login
 */
export function getLoginDeviceInfo() {
  const deviceContext = getDeviceContext();
  
  return {
    deviceType: deviceContext.deviceType,
    isMobileApp: deviceContext.isMobile || isMobileAppContext(),
    userAgent: deviceContext.userAgent
  };
}

/**
 * Check if running in mobile app context
 */
function isMobileAppContext(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check localStorage flag
  const appFlag = localStorage.getItem('warmpawz_app_type');
  if (appFlag === 'mobile_app') return true;
  
  // Check for mobile app indicators
  if ((window as any).ReactNativeWebView) return true;
  if ((window as any).Capacitor) return true;
  if ((window as any).cordova) return true;
  
  return false;
}
