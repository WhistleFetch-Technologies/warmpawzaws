/**
 * API / Supabase config for vendor-web (single repo: warmpawzecodev).
 * Prefer NEXT_PUBLIC_API_BASE_URL so app uses same backend as API Gateway.
 * projectId/publicAnonKey kept for legacy Supabase URLs if still used.
 */

function getRuntimeConfig(): { apiBaseUrl?: string } {
  if (typeof window === 'undefined') return {};
  return (window as any).__WARMPAWZ_RUNTIME_CONFIG__ || {};
}

export const projectId =
  process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_API_PROJECT_ID ||
  '';export const publicAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_API_ANON_KEY ||
  '';

/**
 * API base URL (no trailing slash).
 * Use so vendor-web hits same backend as API Gateway.
 */
export function getApiBaseUrl(): string {
  const cfg = getRuntimeConfig();
  const fromEnv =
    cfg.apiBaseUrl ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    '';
  return (fromEnv || '').replace(/\/+$/, '');
}/** Full URL for config/roles (choose your role). */
export function configRolesUrl(): string {
  return `${getApiBaseUrl()}/config/roles`;
}