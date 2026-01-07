/**
 * ============================================================================
 * AWS COGNITO AUTHENTICATION - FRONTEND
 * ============================================================================
 * 
 * Handles Cognito authentication for Customer Web app
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

const TOKEN_STORAGE_KEY = 'customerCognitoTokens';
const USER_STORAGE_KEY = 'customerUser';

export function storeCognitoTokens(tokens: CognitoTokens): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
    const expiryTime = Date.now() + (tokens.expiresIn * 1000);
    localStorage.setItem('customerTokenExpiry', expiryTime.toString());
  }
}

export function getCognitoTokens(): CognitoTokens | null {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    const tokens = JSON.parse(stored);
    const expiryTime = localStorage.getItem('customerTokenExpiry');
    if (expiryTime && Date.now() > parseInt(expiryTime, 10)) {
      clearCognitoTokens();
      return null;
    }
    return tokens;
  } catch {
    return null;
  }
}

export function getCognitoIdToken(): string | null {
  const tokens = getCognitoTokens();
  return tokens?.idToken || null;
}

export function clearCognitoTokens(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem('customerTokenExpiry');
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export function isAuthenticated(): boolean {
  return getCognitoTokens() !== null;
}

export function storeUserInfo(user: any): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  }
}

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

