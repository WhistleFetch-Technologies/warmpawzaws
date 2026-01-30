/**
 * API config for Admin UI.
 * Backend: Lambda (API Gateway). Auth: Cognito. No Supabase.
 * Set NEXT_PUBLIC_API_BASE_URL or runtime config to your API Gateway URL.
 */

const DEFAULT_API_BASE = 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

function getEnv(): Record<string, string> {
  if (typeof process !== 'undefined' && process.env) return process.env as Record<string, string>;
  return {};
}

export function getApiBaseUrl(): string {
  const base =
    getEnv().NEXT_PUBLIC_API_BASE_URL ||
    (typeof window !== 'undefined' && (window as any).__WARMPAWZ_RUNTIME_CONFIG__?.apiBaseUrl) ||
    '';
  return (base || DEFAULT_API_BASE).replace(/\/+$/, '');
}

/** Auth headers for API requests (Cognito or legacy token). */
export function getAuthHeaders(): Record<string, string> {
  const token =
    getEnv().NEXT_PUBLIC_API_AUTH_TOKEN ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('adminAuthToken'));
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

/** Raw token for apikey header or similar (no "Bearer " prefix). */
export function getAuthToken(): string {
  const h = getAuthHeaders();
  return h.Authorization?.replace(/^Bearer\s+/i, '') || '';
}
