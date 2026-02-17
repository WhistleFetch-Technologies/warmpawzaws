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
  '/vendor/onboarding/status',
  '/service-catalog/categories',
  '/service-catalog/services',
  '/services/discovery',
  '/config/roles',
  '/regions',
  '/webhooks',
];

// Patterns for public endpoints (regex)
const PUBLIC_PATTERNS = [
  /^\/auth\//,
  /^\/webhooks\//,
  /^\/health/,
  /^\/public\//,
];

/**
 * Check if an endpoint is public (doesn't require auth)
 */
function isPublicEndpoint(path: string): boolean {
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
 * SECURITY: Only checks UAT_MODE environment variable for consistency with rest of codebase
 * This ensures production (UAT_MODE=false) never accepts UAT tokens
 */
function isUATModeAllowed(): boolean {
  // ✅ FIX: Check UAT_MODE env var for consistency with rest of codebase
  // This ensures production (UAT_MODE=false) correctly rejects UAT tokens
  return process.env.UAT_MODE === 'true';
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
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'No authorization header' };
  }

  const token = authHeader.replace('Bearer ', '').trim();

  // Check for UAT mode tokens (format: uat-token-{type}-{timestamp})
  if (token.startsWith('uat-token-') || uatModeHeader === 'true') {
    if (!isUATModeAllowed()) {
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
    }

    console.log(`[AuthMiddleware] UAT mode token accepted for role: ${userRole}`);
    
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
      return { valid: false, error: 'Invalid or expired token' };
    }

    const payload = result.payload;
    const userId = payload.sub || payload['cognito:username'];
    const groups = payload['cognito:groups'] as string[] | undefined;
    const userType = payload['custom:user_type'] as string | undefined;
    const userRole = groups?.[0] || userType;

    return {
      valid: true,
      userId,
      userRole,
      groups,
      isUAT: false,
    };
  } catch (error) {
    console.error('[AuthMiddleware] Token verification failed:', error);
    return { valid: false, error: 'Token verification failed' };
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
    if (isPublicEndpoint(path)) {
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
    // Skip for OPTIONS
    if (c.req.method === 'OPTIONS') {
      return next();
    }

    const path = c.req.path;
    
    // ✅ FIX: Skip authentication for public admin endpoints
    // These endpoints handle their own authentication (login, signup, etc.)
    const publicAdminPaths = [
      '/admin/auth/login',
      '/admin/auth/signup',
      '/admin/test/ping', // Test endpoint
      '/admin/setup/create-admin', // Setup endpoint for creating initial admin
      '/admin/users/verify-otp-set-password', // Public: OTP + set/reset password
      '/admin/users/forgot-password', // Public: request password reset OTP by email
    ];
    
    if (publicAdminPaths.some(publicPath => path === publicPath || path.startsWith(publicPath + '/'))) {
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
