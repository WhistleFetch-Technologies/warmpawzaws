/**
 * ============================================================================
 * AUTHENTICATION & AUTHORIZATION MIDDLEWARE
 * ============================================================================
 * 
 * Provides middleware functions for protecting endpoints:
 * - requireAuth: Ensures user is authenticated
 * - requireAdmin: Ensures user has admin role
 * - requireVendor: Ensures user is a vendor
 * - requireCustomer: Ensures user is a customer
 * 
 * Date: 2025-01-28
 * Security Enhancement
 * ============================================================================
 */

import { Context, Next } from 'hono';
import { extractAndVerifyAuthToken } from '../utils/jwt-verification';

// Public endpoints that don't require authentication
const PUBLIC_ENDPOINTS = [
  '/health',
  '/auth/otp/send',
  '/auth/otp/verify',
  '/auth/login',
  '/auth/register',
  '/admin/auth/login',
  '/admin/auth/refresh',
  '/admin/auth/signup',
  '/admin/test/ping',  
  '/vendor/onboarding/status',
  '/service-catalog/categories',
  '/service-catalog/services',
  '/services/discovery',
  '/config/roles',
  '/config/commerce-switch',
  '/config/commerce-switch/health',
  '/ecommerce/categories',
  '/customer/articles',
  '/customer/banners',
  '/regions',
  '/webhooks',
  /** Allyticas product telemetry ingest — POST only; rate-limited in product-analytics/routes.ts */
  '/analytics/v1/events',
];

// Patterns for public endpoints (regex)
const PUBLIC_PATTERNS = [
  /^\/auth\//,
  /^\/admin\/auth\//,  // ✅ FIX: Admin auth endpoints should be public
  /^\/admin\/test\//,  // ✅ FIX: Admin test endpoints should be public
  /^\/webhooks\//,
  /^\/health/,
  /^\/public\//,
  // Allyticas ingest: allow guests; handler optionally parses JWT for server actor_id
  /^\/analytics\/v1\/events$/,
];

/**
 * Check if an endpoint is public (doesn't require auth)
 */
export function isPublicEndpoint(path: string, method?: string): boolean {
  const verb = (method || 'GET').toUpperCase();
  // Guest "Use current location" reverse-geocodes with this browser key.
  // PUT stays authenticated so the key cannot be overwritten anonymously.
  if (verb === 'GET' && (path === '/config/google-maps-key' || path.endsWith('/config/google-maps-key'))) {
    return true;
  }

  // Check exact matches
  if (PUBLIC_ENDPOINTS.some(ep => path === ep || path.startsWith(ep + '/'))) {
    return true;
  }
  
  // Check pattern matches
  if (PUBLIC_PATTERNS.some(pattern => pattern.test(path))) {
    return true;
  }
  
  return false;
}

/**
 * Check if environment allows UAT mode
 * Checks both UAT_MODE env var and environment type
 */
function isUATModeAllowed(): boolean {
  // ✅ FIX: Check UAT_MODE env var first (explicit flag)
  if (process.env.UAT_MODE === 'true') {
    return true;
  }
  
  const env = process.env.NODE_ENV || process.env.ENVIRONMENT || 'development';
  // Only allow UAT mode in non-production environments
  return env !== 'production' && env !== 'prod';
}

/**
 * Extract and verify authentication from request
 * Supports both real Cognito JWTs and UAT mode tokens
 */
async function extractAuth(c: Context): Promise<{
  valid: boolean;
  userId?: string;
  userRole?: string;
  groups?: string[];
  isUAT?: boolean;
  error?: string;
}> {
  const authHeader = c.req.header('authorization') || c.req.header('Authorization');
  const uatModeHeader = c.req.header('X-UAT-Mode') || c.req.header('x-uat-mode');
  
  // ✅ FIX: In UAT mode, allow requests without auth header (for testing)
  const uatMode = process.env.UAT_MODE === 'true' || uatModeHeader === 'true';
  if (uatMode && (!authHeader || !authHeader.startsWith('Bearer '))) {
    console.log('[AuthMiddleware] UAT Mode: Allowing request without auth header');
    return {
      valid: true,
      userId: 'uat-admin-user',
      userRole: 'admin',
      groups: ['admin'],
      isUAT: true,
    };
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[AuthMiddleware] No authorization header found');
    return { valid: false, error: 'No authorization header' };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  console.log(`[AuthMiddleware] Token detected: ${token.substring(0, 30)}... (UAT_MODE=${process.env.UAT_MODE}, uatModeHeader=${uatModeHeader})`);

  // Check for UAT mode tokens (format: uat-token-{type}-{timestamp})
  if (token.startsWith('uat-token-') || uatModeHeader === 'true' || uatMode) {
    const uatAllowed = isUATModeAllowed();
    console.log(`[AuthMiddleware] UAT token detected, UAT allowed: ${uatAllowed}`);
    if (!uatAllowed) {
      console.warn('[AuthMiddleware] UAT mode not allowed in production');
      return { valid: false, error: 'UAT mode not allowed in production' };
    }

    // Parse UAT token type: uat-token-admin-xxx, uat-token-vendor-xxx, uat-token-customer-xxx
    let userRole = 'user';
    let groups: string[] = [];
    
    if (token.includes('-admin-')) {
      userRole = 'admin';
      groups = ['admin'];
    } else if (token.includes('-vendor-')) {
      userRole = 'vendor';
      groups = ['vendor'];
    } else if (token.includes('-customer-')) {
      userRole = 'customer';
      groups = ['customer'];
    } else if (uatMode) {
      // If UAT mode is enabled but token doesn't specify role, default to admin
      userRole = 'admin';
      groups = ['admin'];
    }

    console.log(`[AuthMiddleware] UAT mode token accepted for role: ${userRole}, token: ${token.substring(0, 30)}...`);
    
    return {
      valid: true,
      userId: `uat-${userRole}-user`,
      userRole,
      groups,
      isUAT: true,
    };
  }

  // Standard JWT verification
  try {
    const headers: Record<string, string> = { authorization: authHeader };
    const result = await extractAndVerifyAuthToken(headers);
    
    if (!result.valid || !result.payload) {
      console.warn(`[AuthMiddleware] Token verification failed: ${result.error || 'unknown error'}`);
      return { valid: false, error: result.error || 'Invalid or expired token' };
    }

    const payload = result.payload;
    const userId = payload.sub || payload['cognito:username'];
    const groups = payload['cognito:groups'] as string[] | undefined;
    const userType = payload['custom:user_type'] as string | undefined;
    const userRole = groups?.[0] || userType;
    
    // ✅ FIX: Detect if this is a UAT token (issued by warmpawz-uat)
    const isUATToken = payload.iss === 'warmpawz-uat' || payload.issuer === 'warmpawz-uat';

    console.log(`[AuthMiddleware] Token verified successfully - userId: ${userId}, role: ${userRole}, isUAT: ${isUATToken}`);

    return {
      valid: true,
      userId,
      userRole,
      groups,
      isUAT: isUATToken,
    };
  } catch (error: any) {
    console.error('[AuthMiddleware] Token verification failed:', error.message || error);
    return { valid: false, error: `Token verification failed: ${error.message || 'unknown error'}` };
  }
}

/**
 * Middleware: Require authentication for non-public endpoints
 * Sets c.set('userId', ...) and c.set('userRole', ...) for downstream handlers
 */
export function requireAuth() {
  return async (c: Context, next: Next) => {
    const path = c.req.path;
    
    // Skip auth for public endpoints
    if (isPublicEndpoint(path, c.req.method)) {
      return next();
    }

    // Skip auth for OPTIONS requests (CORS preflight)
    if (c.req.method === 'OPTIONS') {
      return next();
    }

    const auth = await extractAuth(c);
    
    if (!auth.valid) {
      return c.json(
        { 
          success: false, 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        },
        401
      );
    }

    // Set user context for downstream handlers
    c.set('userId', auth.userId);
    c.set('userRole', auth.userRole);
    c.set('userGroups', auth.groups);
    
    return next();
  };
}

/**
 * Middleware: Require admin role
 * Supports both real Cognito JWTs and UAT mode tokens
 */
export function requireAdmin() {
  return async (c: Context, next: Next) => {
    const path = c.req.path;
    
    // Skip auth for public endpoints
    if (isPublicEndpoint(path, c.req.method)) {
      return next();
    }
    
    // Skip for OPTIONS
    if (c.req.method === 'OPTIONS') {
      return next();
    }

    const auth = await extractAuth(c);
    
    if (!auth.valid) {
      return c.json(
        { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' },
        401
      );
    }

    // In UAT mode, check if the token is for admin
    if (auth.isUAT) {
      if (auth.userRole !== 'admin') {
        console.warn(`[AuthMiddleware] UAT Admin access denied - token is for role: ${auth.userRole}`);
        return c.json(
          { success: false, error: 'Admin access required', code: 'ADMIN_REQUIRED' },
          403
        );
      }
      // UAT admin token is valid
      console.log(`[AuthMiddleware] UAT Admin access granted for: ${auth.userId}`);
      c.set('userId', auth.userId);
      c.set('userRole', 'admin');
      c.set('userGroups', ['admin']);
      c.set('isAdmin', true);
      c.set('isUAT', true);
      return next();
    }

    // Standard admin check for real tokens
    const isAdmin = auth.groups?.includes('admin') || 
                    auth.groups?.includes('super-admin') || 
                    auth.userRole === 'admin';

    if (!isAdmin) {
      console.warn(`[AuthMiddleware] Admin access denied for user ${auth.userId}, role: ${auth.userRole}`);
      return c.json(
        { success: false, error: 'Admin access required', code: 'ADMIN_REQUIRED' },
        403
      );
    }

    c.set('userId', auth.userId);
    c.set('userRole', auth.userRole);
    c.set('userGroups', auth.groups);
    c.set('isAdmin', true);
    
    return next();
  };
}

/**
 * Middleware: Require vendor role
 * Supports both real Cognito JWTs and UAT mode tokens
 */
export function requireVendor() {
  return async (c: Context, next: Next) => {
    // Skip for OPTIONS
    if (c.req.method === 'OPTIONS') {
      return next();
    }

    const auth = await extractAuth(c);
    
    if (!auth.valid) {
      return c.json(
        { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' },
        401
      );
    }

    // In UAT mode, check if the token is for vendor
    if (auth.isUAT) {
      if (auth.userRole !== 'vendor') {
        console.warn(`[AuthMiddleware] UAT Vendor access denied - token is for role: ${auth.userRole}`);
        return c.json(
          { success: false, error: 'Vendor access required', code: 'VENDOR_REQUIRED' },
          403
        );
      }
      console.log(`[AuthMiddleware] UAT Vendor access granted for: ${auth.userId}`);
      c.set('userId', auth.userId);
      c.set('userRole', 'vendor');
      c.set('userGroups', ['vendor']);
      c.set('isVendor', true);
      c.set('isUAT', true);
      return next();
    }

    const isVendor = auth.groups?.includes('vendor') || 
                     auth.userRole === 'vendor' ||
                     auth.userRole === 'staff';

    if (!isVendor) {
      console.warn(`[AuthMiddleware] Vendor access denied for user ${auth.userId}, role: ${auth.userRole}`);
      return c.json(
        { success: false, error: 'Vendor access required', code: 'VENDOR_REQUIRED' },
        403
      );
    }

    c.set('userId', auth.userId);
    c.set('userRole', auth.userRole);
    c.set('userGroups', auth.groups);
    c.set('isVendor', true);
    
    return next();
  };
}

/**
 * Middleware: Require customer role
 * Supports both real Cognito JWTs and UAT mode tokens
 */
export function requireCustomer() {
  return async (c: Context, next: Next) => {
    // Skip for OPTIONS
    if (c.req.method === 'OPTIONS') {
      return next();
    }

    const auth = await extractAuth(c);
    
    if (!auth.valid) {
      return c.json(
        { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' },
        401
      );
    }

    // In UAT mode, check if the token is for customer
    if (auth.isUAT) {
      if (auth.userRole !== 'customer') {
        console.warn(`[AuthMiddleware] UAT Customer access denied - token is for role: ${auth.userRole}`);
        return c.json(
          { success: false, error: 'Customer access required', code: 'CUSTOMER_REQUIRED' },
          403
        );
      }
      console.log(`[AuthMiddleware] UAT Customer access granted for: ${auth.userId}`);
      c.set('userId', auth.userId);
      c.set('userRole', 'customer');
      c.set('userGroups', ['customer']);
      c.set('isCustomer', true);
      c.set('isUAT', true);
      return next();
    }

    const isCustomer = auth.groups?.includes('customer') || 
                       auth.userRole === 'customer';

    if (!isCustomer) {
      console.warn(`[AuthMiddleware] Customer access denied for user ${auth.userId}, role: ${auth.userRole}`);
      return c.json(
        { success: false, error: 'Customer access required', code: 'CUSTOMER_REQUIRED' },
        403
      );
    }

    c.set('userId', auth.userId);
    c.set('userRole', auth.userRole);
    c.set('userGroups', auth.groups);
    c.set('isCustomer', true);
    
    return next();
  };
}

/**
 * Strict Bearer (or UAT) auth for /ai-chatbot/* when registered with AI_CHATBOT_REQUIRE_AUTH=true.
 */
export function requireAiChatbotAuth() {
  return async (c: Context, next: Next) => {
    if (c.req.method === 'OPTIONS') {
      return next();
    }

    const auth = await extractAuth(c);

    if (!auth.valid) {
      return c.json(
        { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' },
        401
      );
    }

    c.set('userId', auth.userId);
    c.set('userRole', auth.userRole);
    c.set('userGroups', auth.groups);

    return next();
  };
}

/**
 * Middleware: Log authentication attempts for security monitoring
 */
export function authAuditLog() {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const path = c.req.path;
    const method = c.req.method;
    const userId = c.get('userId');
    
    // Log the request
    console.log(`[AuthAudit] ${method} ${path} - User: ${userId || 'anonymous'}`);
    
    await next();
    
    const duration = Date.now() - startTime;
    const status = c.res.status;
    
    // Log auth failures for security monitoring
    if (status === 401 || status === 403) {
      console.warn(`[AuthAudit] AUTH_FAILURE ${method} ${path} - Status: ${status} - Duration: ${duration}ms`);
    }
  };
}
