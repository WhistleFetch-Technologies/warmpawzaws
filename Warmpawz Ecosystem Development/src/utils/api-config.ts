/**
 * API config for Warmpawz Ecosystem Development.
 * Backend: Lambda (API Gateway). Auth: Cognito. No Supabase.
 * Set VITE_API_BASE_URL to your API Gateway URL.
 */

const env = typeof import.meta !== 'undefined' && import.meta?.env ? import.meta.env : ({} as Record<string, string>);

/**
 * API base URL (no trailing slash). From env only (VITE_API_BASE_URL). No hardcoded URL.
 */
export function getApiBaseUrl(): string {
  const fromEnv = env.VITE_API_BASE_URL || (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL);
  return (fromEnv ? String(fromEnv) : '').replace(/\/+$/, '');
}

/** Full URL for config/roles (choose your role). */
export function configRolesUrl(): string {
  return `${getApiBaseUrl()}/config/roles`;
}

/**
 * Auth header for API requests. Use Cognito id token when available.
 * Legacy: optional bearer token from env (e.g. for server-side or migration).
 */
export function getAuthHeaders(): Record<string, string> {
  const token = env.VITE_API_AUTH_TOKEN || (typeof process !== 'undefined' && process.env?.VITE_API_AUTH_TOKEN);
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}
