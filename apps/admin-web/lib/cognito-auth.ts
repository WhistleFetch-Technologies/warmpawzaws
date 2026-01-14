/**
 * ============================================================================
 * AWS COGNITO AUTHENTICATION - FRONTEND
 * ============================================================================
 * 
 * Handles Cognito authentication for Admin Web app
 * Integrates with backend Lambda endpoints that use Cognito
 * 
 * Date: 2026-01-06
 * ============================================================================
 */

export interface CognitoTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

const TOKEN_STORAGE_KEY = 'adminCognitoTokens';
const USER_STORAGE_KEY = 'adminUser';

/**
 * Store Cognito tokens after authentication
 */
export function storeCognitoTokens(tokens: CognitoTokens): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    // Also store expiry time
    const expiryTime = Date.now() + (tokens.expiresIn * 1000);
    localStorage.setItem('adminTokenExpiry', expiryTime.toString());
  }
}

/**
 * Get stored Cognito tokens
 */
export function getCognitoTokens(): CognitoTokens | null {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    const tokens = JSON.parse(stored);
    
    // Check if token is expired
    const expiryTime = localStorage.getItem('adminTokenExpiry');
    if (expiryTime && Date.now() > parseInt(expiryTime, 10)) {
      clearCognitoTokens();
      return null;
    }
    
    return tokens;
  } catch {
    return null;
  }
}

/**
 * Get ID token for API requests
 */
export function getCognitoIdToken(): string | null {
  const tokens = getCognitoTokens();
  return tokens?.idToken || null;
}

/**
 * Clear Cognito tokens
 */
export function clearCognitoTokens(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem('adminTokenExpiry');
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getCognitoTokens() !== null;
}

/**
 * Store user info
 */
export function storeUserInfo(user: any): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
}

/**
 * Get user info
 */
export function getUserInfo(): any | null {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem(USER_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Get admin ID from token or user info
 * Decodes JWT token to extract 'sub' claim, or falls back to user info
 */
export function getAdminId(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Try to get from user info first
  const userInfo = getUserInfo();
  if (userInfo?.id || userInfo?.sub || userInfo?.username) {
    return userInfo.id || userInfo.sub || userInfo.username;
  }
  
  // Try to decode JWT token
  const idToken = getCognitoIdToken();
  if (idToken) {
    try {
      // JWT tokens have 3 parts: header.payload.signature
      const parts = idToken.split('.');
      if (parts.length === 3) {
        // Decode the payload (base64)
        const payload = JSON.parse(atob(parts[1]));
        // Return 'sub' (subject) claim which is the user ID
        return payload.sub || payload.username || payload.email || null;
      }
    } catch (error) {
      console.warn('Failed to decode JWT token:', error);
    }
  }
  
  // Fallback to localStorage
  const adminId = localStorage.getItem('adminId');
  if (adminId) {
    return adminId;
  }
  
  return null;
}
