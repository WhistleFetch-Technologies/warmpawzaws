/**
 * AUTHENTICATION MIDDLEWARE
 * 
 * ✅ SECURITY FIX: Validates session tokens for all write operations
 * 
 * Usage:
 * import { requireAuth } from './auth-middleware';
 * app.post('/vendor/services/add', requireAuth, async (c) => { ... });
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Context } from 'hono';
import { sendError } from './response-utils';
import { 
  getAccessTokensRepository,
  getSessionsRepository,
  getCustomersRepository,
  getVendorsRepository
} from '../../../supabase/lib/repositories/index';

/**
 * Validate authentication token from Authorization header
 * 
 * Extracts token, validates it against stored sessions,
 * and attaches user/session data to context
 */
export async function requireAuth(c: Context, next: () => Promise<void>) {
  try {
    // Extract token from Authorization header
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader) {
      console.log('❌ [AUTH] No Authorization header');
      return sendError(c, 'Authentication required', 401);
    }
    
    // Extract bearer token
    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      console.log('❌ [AUTH] Invalid Authorization header format');
      return sendError(c, 'Invalid authentication token', 401);
    }
    
    console.log('🔐 [AUTH] Validating token:', token.substring(0, 20) + '...');
    
    // ✅ SQL: Look up token in access_tokens table
    const accessTokensRepo = getAccessTokensRepository();
    const tokenData = await accessTokensRepo.findByToken(token);
    
    if (!tokenData) {
      console.log('❌ [AUTH] Invalid token - no matching token found');
      console.log('🔍 [AUTH] Token lookup key:', `token:${token.substring(0, 30)}...`);
      return sendError(c, 'Invalid or expired session', 401);
    }
    
    console.log('✅ [AUTH] Token found:', {
      userId: tokenData.user_id,
      phone: tokenData.phone,
      role: tokenData.role,
      expiresAt: tokenData.expires_at
    });
    
    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      console.log('❌ [AUTH] Token expired:', tokenData.expires_at);
      // ✅ SQL: Clean up expired token
      await accessTokensRepo.delete(token);
      return sendError(c, 'Session expired - please login again', 401);
    }
    
    // ✅ SQL: Get user data using phone (more reliable than userId for vendors)
    const { normalizePhone } = await import('./phone-utils.tsx');
    const normalizedPhone = normalizePhone(tokenData.phone);
    const customersRepo = getCustomersRepository();
    let user = await customersRepo.findByPhone(normalizedPhone);
    
    // Fallback: try userId if phone lookup fails
    if (!user) {
      console.log('⚠️ [AUTH] User not found by phone, trying userId...');
      user = await customersRepo.findById(tokenData.user_id);
    }
    
    if (!user) {
      console.log('❌ [AUTH] User not found for token:', tokenData.user_id);
      return sendError(c, 'User not found', 404);
    }
    
    console.log('✅ [AUTH] Token validated for user:', {
      userId: user.id,
      phone: user.phone,
      role: tokenData.role || user.role
    });
    
    // Attach auth data to context for use in route handlers
    c.set('token', {
      userId: tokenData.user_id,
      phone: tokenData.phone,
      role: tokenData.role,
      expiresAt: tokenData.expires_at
    });
    c.set('user', user);
    c.set('userId', user.id);
    c.set('userPhone', user.phone);
    c.set('userRole', tokenData.role || user.role);
    
    // Continue to next middleware/handler
    await next();
    
  } catch (error) {
    console.error('❌ [AUTH] Authentication error:', error);
    return sendError(c, 'Authentication failed', 500);
  }
}

/**
 * Optional authentication - sets user data if token is valid, but doesn't fail if missing
 * Useful for endpoints that have different behavior for authenticated vs anonymous users
 */
export async function optionalAuth(c: Context, next: () => Promise<void>) {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader) {
      // No auth header - proceed as anonymous
      await next();
      return;
    }
    
    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      // Invalid format - proceed as anonymous
      await next();
      return;
    }
    
    // ✅ SQL: Find session by token from sessions table
    const sessionsRepo = getSessionsRepository();
    const matchingSession = await sessionsRepo.findByToken(token);
    
    if (matchingSession && new Date(matchingSession.expires_at) >= new Date()) {
      // ✅ SQL: Valid session - attach user data
      const customersRepo = getCustomersRepository();
      const user = await customersRepo.findById(matchingSession.user_id);
      
      if (user) {
        c.set('session', matchingSession);
        c.set('user', user);
        c.set('userId', user.id);
        c.set('userPhone', user.phone);
        c.set('userRole', user.role);
      }
    }
    
    await next();
    
  } catch (error) {
    console.error('❌ [AUTH] Optional auth error:', error);
    // Don't fail - just proceed as anonymous
    await next();
  }
}

/**
 * Require specific role(s)
 * Must be used AFTER requireAuth
 */
export function requireRole(...allowedRoles: string[]) {
  return async (c: Context, next: () => Promise<void>) => {
    const userRole = c.get('userRole');
    
    if (!userRole) {
      console.log('❌ [AUTH] No user role in context - requireAuth must be called first');
      return sendError(c, 'Authentication required', 401);
    }
    
    if (!allowedRoles.includes(userRole)) {
      console.log('❌ [AUTH] Insufficient permissions:', {
        userRole,
        requiredRoles: allowedRoles
      });
      return sendError(c, 'Insufficient permissions', 403);
    }
    
    console.log('✅ [AUTH] Role check passed:', userRole);
    await next();
  };
}

/**
 * Require vendor ownership
 * Validates that the authenticated user owns the specified vendor
 */
export async function requireVendorOwnership(c: Context, next: () => Promise<void>) {
  try {
    const userId = c.get('userId');
    const vendorIdFromParam = c.req.param('vendorId');
    const vendorIdFromBody = await c.req.json().then((body: any) => body.vendorId).catch(() => null);
    const vendorId = vendorIdFromParam || vendorIdFromBody;
    
    if (!userId) {
      console.log('❌ [AUTH] No userId in context - requireAuth must be called first');
      return sendError(c, 'Authentication required', 401);
    }
    
    if (!vendorId) {
      console.log('❌ [AUTH] No vendorId in request');
      return sendError(c, 'Vendor ID required', 400);
    }
    
    // ✅ SQL: Get vendor's user_id from vendors table
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    
    if (!vendor) {
      console.log('❌ [AUTH] Vendor not found:', vendorId);
      return sendError(c, 'Vendor not found', 404);
    }
    
    if (vendor.user_id !== userId) {
      console.log('❌ [AUTH] Vendor ownership mismatch:', {
        vendorUserId: vendor.user_id,
        requestUserId: userId
      });
      return sendError(c, 'You do not own this vendor', 403);
    }
    
    console.log('✅ [AUTH] Vendor ownership verified');
    c.set('vendor', vendor);
    
    await next();
    
  } catch (error) {
    console.error('❌ [AUTH] Vendor ownership check error:', error);
    return sendError(c, 'Authorization failed', 500);
  }
}

/**
 * Helper: Get current user from context
 * (For use in route handlers after requireAuth)
 */
export function getCurrentUser(c: Context): any {
  return c.get('user');
}

/**
 * Helper: Get current session from context
 */
export function getCurrentSession(c: Context): any {
  return c.get('session');
}

/**
 * Helper: Get current vendor from context
 * (After requireVendorOwnership)
 */
export function getCurrentVendor(c: Context): any {
  return c.get('vendor');
}

console.log('✅ Auth middleware loaded');