/**
 * API config for Vendor Web app.
 * Backend: Lambda (API Gateway). Auth: Cognito. No Supabase.
 * Use getApiBaseUrl() and getAuthHeaders() for direct fetch; prefer apiClient for requests.
 */

type RuntimeConfig = { apiBaseUrl?: string };
function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') return {};
  return (window as any).__WARMPAWZ_RUNTIME_CONFIG__ || {};
}

const DEFAULT_API_BASE = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

export function getApiBaseUrl(): string {
  const cfg = getRuntimeConfig();
  const base =
    cfg.apiBaseUrl ||
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
    '';
  return (base || DEFAULT_API_BASE).replace(/\/+$/, '');
}

/** Auth headers for API requests (Cognito id token when available). */
export function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const { getCognitoIdToken } = require('./cognito-auth');
    const token = getCognitoIdToken();
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // cognito-auth not available
  }
  const legacy = typeof localStorage !== 'undefined' ? localStorage.getItem('vendorAuthToken') : null;
  if (legacy) return { Authorization: `Bearer ${legacy}` };
  return {};
}
