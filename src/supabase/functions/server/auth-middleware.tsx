/**
 * AUTHENTICATION MIDDLEWARE
 * 
 * ✅ SECURITY FIX: Validates session tokens for all write operations
 * 
 * Usage:
 * import { requireAuth } from './auth-middleware.tsx';
 * app.post('/vendor/services/add', requireAuth, async (c) => { ... });
 */

import { Context } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { sendError } from './response-utils.ts';

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
    
    // Find session by token
    // Tokens are stored as session.token, so we need to search all sessions
    const allSessions = await kv.getByPrefix('session:session_');
    const matchingSession = allSessions.find((s: any) => s.token === token);
    
    if (!matchingSession) {
      console.log('❌ [AUTH] Invalid token - no matching session found');
      return sendError(c, 'Invalid or expired session', 401);
    }
    
    // Check if session is expired
    if (new Date(matchingSession.expiresAt) < new Date()) {
      console.log('❌ [AUTH] Token expired:', matchingSession.expiresAt);
      // Clean up expired session
      await kv.del(`session:${matchingSession.sessionId}`);
      await kv.del(`session:user:${matchingSession.userId}`);
      await kv.del(`session:phone:${matchingSession.phone}`);
      return sendError(c, 'Session expired - please login again', 401);
    }
    
    // Get user data
    const user = await kv.get(`user:id:${matchingSession.userId}`);
    
    if (!user) {
      console.log('❌ [AUTH] User not found for session:', matchingSession.userId);
      return sendError(c, 'User not found', 404);
    }
    
    console.log('✅ [AUTH] Token validated for user:', {
      userId: user.userId,
      phone: user.phone,
      role: user.role
    });
    
    // Attach auth data to context for use in route handlers
    c.set('session', matchingSession);
    c.set('user', user);
    c.set('userId', user.userId);
    c.set('userPhone', user.phone);
    c.set('userRole', user.role);
    
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
    
    // Find session by token
    const allSessions = await kv.getByPrefix('session:session_');
    const matchingSession = allSessions.find((s: any) => s.token === token);
    
    if (matchingSession && new Date(matchingSession.expiresAt) >= new Date()) {
      // Valid session - attach user data
      const user = await kv.get(`user:id:${matchingSession.userId}`);
      
      if (user) {
        c.set('session', matchingSession);
        c.set('user', user);
        c.set('userId', user.userId);
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
    
    // Get vendor's userId
    const vendor = await kv.get(`vendor:${vendorId}`);
    
    if (!vendor) {
      console.log('❌ [AUTH] Vendor not found:', vendorId);
      return sendError(c, 'Vendor not found', 404);
    }
    
    if (vendor.userId !== userId) {
      console.log('❌ [AUTH] Vendor ownership mismatch:', {
        vendorUserId: vendor.userId,
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
