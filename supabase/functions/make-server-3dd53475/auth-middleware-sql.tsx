/**
 * ============================================================================
 * AUTHENTICATION MIDDLEWARE - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * ✅ SECURITY FIX: Validates session tokens for all write operations
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.getByPrefix()`, `kv.del()` with SQL queries
 * - Uses `cache_tokens` table for token validation
 * - Uses `customers`, `vendors`, `staff` tables for user lookup
 * 
 * Date: 2025-01-28
 * Migration: Batch 17 - KV to SQL (8 KV operations removed)
 * ============================================================================
 */

import { Context } from 'npm:hono';
import { sendError } from './response-utils.ts';
import { getDbClient } from '../../lib/db.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';

const db = getDbClient();
const customersRepo = getCustomersRepository();
const vendorsRepo = getVendorsRepository();
const staffRepo = getStaffRepository();

/**
 * Validate authentication token from Authorization header
 */
export async function requireAuth(c: Context, next: () => Promise<void>) {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader) {
      console.log('❌ [AUTH] No Authorization header');
      return sendError(c, 'Authentication required', 401);
    }
    
    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      console.log('❌ [AUTH] Invalid Authorization header format');
      return sendError(c, 'Invalid authentication token', 401);
    }
    
    console.log('🔐 [AUTH] Validating token:', token.substring(0, 20) + '...');
    
    // ✅ SQL: Look up token in cache_tokens table
    const { data: tokenData, error: tokenError } = await db
      .from('cache_tokens')
      .select('*')
      .eq('token', token)
      .single();
    
    if (tokenError || !tokenData) {
      console.log('❌ [AUTH] Invalid token - no matching token found');
      return sendError(c, 'Invalid or expired session', 401);
    }
    
    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      console.log('❌ [AUTH] Token expired:', tokenData.expires_at);
      // ✅ SQL: Clean up expired token
      await db
        .from('cache_tokens')
        .delete()
        .eq('token', token);
      
      return sendError(c, 'Session expired - please login again', 401);
    }
    
    console.log('✅ [AUTH] Token found:', {
      userId: tokenData.user_id,
      phone: tokenData.phone,
      role: tokenData.role,
      expiresAt: tokenData.expires_at
    });
    
    // ✅ SQL: Get user data using phone (more reliable than userId for vendors)
    const { normalizePhone } = await import('./phone-utils.tsx');
    const normalizedPhone = normalizePhone(tokenData.phone);
    
    let user: any = null;
    
    // Try customer first
    if (tokenData.role === 'customer') {
      user = await customersRepo.findByPhone(normalizedPhone);
    }
    
    // Try vendor
    if (!user && (tokenData.role === 'vendor' || tokenData.role === 'center')) {
      const { data: vendors } = await db
        .from('vendors')
        .select('*')
        .eq('phone', normalizedPhone)
        .single();
      
      if (vendors) {
        user = {
          userId: vendors.id,
          phone: vendors.phone,
          role: 'vendor',
          vendorId: vendors.id
        };
      }
    }
    
    // Try staff
    if (!user && tokenData.role === 'staff') {
      const { data: staff } = await db
        .from('staff')
        .select('*')
        .eq('phone', normalizedPhone)
        .single();
      
      if (staff) {
        user = {
          userId: staff.id,
          phone: staff.phone,
          role: 'staff',
          staffId: staff.id
        };
      }
    }
    
    // Fallback: try userId if phone lookup fails
    if (!user) {
      console.log('⚠️ [AUTH] User not found by phone, trying userId...');
      if (tokenData.role === 'customer') {
        user = await customersRepo.findById(tokenData.user_id);
      }
    }
    
    if (!user) {
      console.log('❌ [AUTH] User not found for token:', tokenData.user_id);
      return sendError(c, 'User not found', 404);
    }
    
    console.log('✅ [AUTH] Token validated for user:', {
      userId: user.userId || user.id,
      phone: user.phone,
      role: user.role || tokenData.role
    });
    
    // Attach auth data to context
    c.set('token', tokenData);
    c.set('user', user);
    c.set('userId', user.userId || user.id);
    c.set('userPhone', user.phone);
    c.set('userRole', user.role || tokenData.role);
    
    await next();
    
  } catch (error) {
    console.error('❌ [AUTH] Authentication error:', error);
    return sendError(c, 'Authentication failed', 500);
  }
}

/**
 * Optional authentication - sets user data if token is valid, but doesn't fail if missing
 */
export async function optionalAuth(c: Context, next: () => Promise<void>) {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader) {
      await next();
      return;
    }
    
    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      await next();
      return;
    }
    
    // ✅ SQL: Find token
    const { data: tokenData } = await db
      .from('cache_tokens')
      .select('*')
      .eq('token', token)
      .single();
    
    if (tokenData && new Date(tokenData.expires_at) >= new Date()) {
      // Valid token - get user
      let user: any = null;
      
      if (tokenData.role === 'customer') {
        user = await customersRepo.findById(tokenData.user_id);
      } else if (tokenData.role === 'vendor') {
        user = await vendorsRepo.findById(tokenData.user_id);
      } else if (tokenData.role === 'staff') {
        user = await staffRepo.findById(tokenData.user_id);
      }
      
      if (user) {
        c.set('token', tokenData);
        c.set('user', user);
        c.set('userId', user.id);
        c.set('userPhone', user.phone);
        c.set('userRole', tokenData.role);
      }
    }
    
    await next();
    
  } catch (error) {
    console.error('❌ [AUTH] Optional auth error:', error);
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
    
    // ✅ SQL: Get vendor
    const vendor = await vendorsRepo.findById(vendorId);
    
    if (!vendor) {
      console.log('❌ [AUTH] Vendor not found:', vendorId);
      return sendError(c, 'Vendor not found', 404);
    }
    
    // Check ownership (vendor.owner_id or vendor.user_id should match userId)
    if (vendor.owner_id !== userId && (vendor as any).user_id !== userId) {
      console.log('❌ [AUTH] Vendor ownership mismatch:', {
        vendorOwnerId: vendor.owner_id,
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
 */
export function getCurrentUser(c: Context): any {
  return c.get('user');
}

/**
 * Helper: Get current session from context
 */
export function getCurrentSession(c: Context): any {
  return c.get('token');
}

/**
 * Helper: Get current vendor from context
 */
export function getCurrentVendor(c: Context): any {
  return c.get('vendor');
}

console.log('✅ Auth middleware (SQL-only) loaded');

