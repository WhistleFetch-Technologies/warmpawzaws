/**
 * API config for Vendor Web app.
 * Backend: Lambda (API Gateway). Auth: Cognito.
 * Use getApiBaseUrl() and getAuthHeaders() for direct fetch; prefer apiClient for requests.
 */

type RuntimeConfig = { 
  apiBaseUrl?: string;
  environment?: string;
};

function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') return {};
  return (window as any).__WARMPAWZ_RUNTIME_CONFIG__ || {};
}

/**
 * Determine if we're in production environment
 * Checks: runtime config → NEXT_PUBLIC_ENVIRONMENT → NODE_ENV → hostname
 */
function isProductionEnvironment(): boolean {
  const cfg = getRuntimeConfig();
  
  // 1. Check runtime config environment field
  if (cfg.environment) {
    return cfg.environment === 'production';
  }
  
  // 2. Check NEXT_PUBLIC_ENVIRONMENT env var
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ENVIRONMENT) {
    return process.env.NEXT_PUBLIC_ENVIRONMENT === 'production';
  }
  
  // 3. Check NODE_ENV
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV === 'production';
  }
  
  // 4. Check hostname (production CloudFront domains)
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    // Production CloudFront domains
    if (hostname.includes('cloudfront.net') || 
        hostname.includes('warmpawz.com') ||
        hostname.includes('admin.warmpawz.com') ||
        hostname.includes('vendor.warmpawz.com') ||
        hostname.includes('customer.warmpawz.com')) {
      return true;
    }
    // Development indicators
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
      return false;
    }
  }
  
  // Default to production for safety
  return true;
}

/**
 * Get API Gateway URL based on environment
 * Production: mss9sa4y01
 * Development: z0b3obweb6
 */
function getApiGatewayUrl(): string {
  const isProd = isProductionEnvironment();
  return isProd
    ? 'https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com'
    : 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
}

/**
 * Get API base from runtime config or env, with environment-aware API Gateway fallback.
 * Set via runtime-config.js (injected at deploy) or NEXT_PUBLIC_API_BASE_URL.
 */
export function getApiBaseUrl(): string {
  const cfg = getRuntimeConfig();
  
  const base =
    cfg.apiBaseUrl ||
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_BASE_URL) ||
    getApiGatewayUrl();
  
  return (base && typeof base === 'string' ? base.trim() : getApiGatewayUrl()).replace(/\/+$/, '');
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
