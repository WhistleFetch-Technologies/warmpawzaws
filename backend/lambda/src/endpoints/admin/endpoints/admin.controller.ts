/**
 * ============================================================================
 * ADMIN ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * 
 * Endpoints:
 * - GET /admin/vendors/stats - Get vendor statistics
 * - POST /admin/vendors/:id/approve - Approve vendor
 * - POST /admin/vendors/:id/reject - Reject vendor
 * - GET /admin/vendors - List all vendors
 * - GET /admin/vendors/all - Alias for /admin/vendors (frontend compatibility)
 * - POST /admin/vendor/application/:applicationId/approve - Approve vendor application (frontend compatibility)
 * - POST /admin/vendor/application/:applicationId/reject - Reject vendor application (frontend compatibility)
 * - POST /admin/vendor/application/:applicationId/request-clarification - Request clarification (frontend compatibility)
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../handler/base-handler';
import { query, select, update, insert } from '../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';

// ============================================================================
// ADMIN HANDLERS
// ============================================================================

class VendorStatsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      // ✅ FIX: Get all vendors excluding soft-deleted ones
      // Use SQL query directly to properly filter and handle is_active type conversion
      const vendorsResult = await query(`
        SELECT 
          id,
          business_name,
          owner_name,
          status,
          is_active,
          is_deleted,
          category,
          created_at
        FROM vendors
        WHERE (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f')
        ORDER BY created_at DESC
      `);

      const vendors = vendorsResult.rows || [];

      // ✅ FIX: Normalize is_active to handle boolean, string ('t'/'f'), and number (1/0) types
      const normalizeIsActive = (value: any): boolean => {
        if (value === true || value === 1 || value === '1' || value === 't' || value === 'true') {
          return true;
        }
        return false;
      };

      // ✅ FIX: Filter active vendors - 'approved' and 'active' are semantically equivalent
      // An active vendor was approved, so we should count both statuses
      const activeVendors = vendors.filter(v => 
        (v.status === 'approved' || v.status === 'active') && normalizeIsActive(v.is_active)
      );

      // ✅ FIX: Get pending applications from vendor_onboarding_applications table (not vendors table)
      let pendingApplicationsCount = 0;
      let pendingTodayCount = 0;
      try {
        const pendingResult = await query(`
        SELECT COUNT(*) as total, 
               SUM(CASE WHEN submitted_at >= CURRENT_DATE THEN 1 ELSE 0 END) as today_count
        FROM vendor_onboarding_applications 
        WHERE status IN ('SUBMITTED', 'PENDING', 'UNDER_REVIEW')
      `);
        if (pendingResult.rows && pendingResult.rows[0]) {
          pendingApplicationsCount = parseInt(pendingResult.rows[0].total || '0', 10);
          pendingTodayCount = parseInt(pendingResult.rows[0].today_count || '0', 10);
        }
      } catch (e) {
        console.warn('Could not fetch pending applications from vendor_onboarding_applications:', e);
        // Fallback to vendors table if the new table doesn't exist
        const fallbackPending = vendors.filter(v =>
          v.status === 'pending' || v.status === 'pending_approval'
        );
        pendingApplicationsCount = fallbackPending.length;
      }

      const deactivatedVendors = vendors.filter(v => !normalizeIsActive(v.is_active));
      const rejectedVendors = vendors.filter(v => v.status === 'rejected');

      // Distribution by category
      const distributionByCategory: Record<string, number> = {};
      vendors.forEach(vendor => {
        if (vendor.category) {
          distributionByCategory[vendor.category] =
            (distributionByCategory[vendor.category] || 0) + 1;
        }
      });

      return this.success({
        activeVendors: {
          count: activeVendors.length,
          percentage: vendors.length > 0
            ? Math.round((activeVendors.length / vendors.length) * 100)
            : 0,
        },
        pendingApplications: {
          count: pendingApplicationsCount,
          todayCount: pendingTodayCount,
        },
        deactivatedVendors: {
          count: deactivatedVendors.length,
        },
        rejectedVendors: {
          count: rejectedVendors.length,
        },
        distributionByCategory,
        total: vendors.length,
      });
    } catch (error: any) {
      console.error('Error in VendorStatsHandler:', error);
      return this.error(error.message || 'Failed to fetch vendor stats', 500);
    }
  }
}

class ApproveVendorHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    const body = this.parseBody(context.event);
    const adminId = context.userId || body.adminId;

    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }

    // ✅ SQL: Get vendor
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length === 0) {
      return this.error('Vendor not found', 404);
    }

    // ✅ SQL: Update vendor status
    await update(
      'vendors',
      { id: vendorId },
      {
        status: 'approved',
        approved_at: new Date(),
        approved_by: adminId,
        is_active: true,
      }
    );

    // ✅ SQL: Create notification (use recipient_id/recipient_type)
    await insert('notifications', {
      recipient_id: vendorId,
      recipient_type: 'vendor',
      notification_type: 'vendor_approved',
      title: 'Application Approved',
      message: 'Your vendor application has been approved!',
      channels: { email: true, sms: true, inApp: true, push: false },
      is_read: false,
    });

    // ✅ Publish vendor approved event
    try {
      const { publishVendorApproved } = await import('../../../utils/sns-client');
      await publishVendorApproved({
        vendorId,
        approvedAt: new Date().toISOString(),
        approvedBy: adminId,
      });
    } catch (error) {
      console.error('Failed to publish vendor approved event:', error);
    }

    // ✅ Trigger webhooks
    try {
      const { triggerWebhook } = await import('../../webhooks');
      await triggerWebhook('vendor.approved', {
        vendorId,
        approvedAt: new Date().toISOString(),
        approvedBy: adminId,
      });
    } catch (error) {
      console.error('Failed to trigger webhooks:', error);
    }

    return this.success({
      message: 'Vendor approved successfully',
      vendorId,
    });
  }
}

class RejectVendorHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    const body = this.parseBody(context.event);
    const { reason } = body;
    const adminId = context.userId || body.adminId;

    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }

    if (!reason) {
      return this.error('Rejection reason is required', 400);
    }

    // ✅ SQL: Get vendor
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length === 0) {
      return this.error('Vendor not found', 404);
    }

    // ✅ SQL: Update vendor status
    await update(
      'vendors',
      { id: vendorId },
      {
        status: 'rejected',
        rejection_reason: reason,
        rejected_at: new Date(),
        rejected_by: adminId,
        is_active: false,
      }
    );

    // ✅ Trigger webhooks
    try {
      const { triggerWebhook } = await import('../../webhooks');
      await triggerWebhook('vendor.rejected', {
        vendorId,
        rejectedAt: new Date().toISOString(),
        rejectedBy: adminId,
        reason,
      });
    } catch (error) {
      console.error('Failed to trigger webhooks:', error);
    }

    // ✅ SQL: Add comment
    await insert('vendor_onboarding_comments', {
      vendor_id: vendorId,
      admin_id: adminId,
      comment: reason,
      comment_type: 'rejection',
      is_resolved: false,
    });

    // ✅ SQL: Create notification (use recipient_id/recipient_type)
    await insert('notifications', {
      recipient_id: vendorId,
      recipient_type: 'vendor',
      notification_type: 'vendor_rejected',
      title: 'Application Rejected',
      message: `Your application was rejected: ${reason}`,
      channels: { email: true, sms: true, inApp: true, push: false },
      is_read: false,
    });

    return this.success({
      message: 'Vendor rejected',
      vendorId,
    });
  }
}

class ListVendorsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      // ✅ ENHANCED: Extract all filter parameters
      const queryParams = context.event.queryStringParameters || {};
      const status = queryParams.status;
      const search = queryParams.search?.trim();
      const category = queryParams.category;
      const role = queryParams.role;
      const vendorType = queryParams.vendorType;
      const city = queryParams.city;
      const tier = queryParams.tier;
      const isActive = queryParams.isActive;
      const limit = parseInt(queryParams.limit || '100', 10);
      const offset = parseInt(queryParams.offset || '0', 10);

      console.log('[ListVendors] Filters:', { status, search, category, role, vendorType, city, tier, isActive });

      // Build dynamic WHERE clause
      let whereConditions: string[] = ['1=1'];
      const params: any[] = [];
      let paramIdx = 1;

      // Status filter
      if (status && status !== 'all') {
        whereConditions.push(`v.status = $${paramIdx}`);
        params.push(status);
        paramIdx++;
      }

      // Search filter - across multiple fields
      if (search) {
        whereConditions.push(`(
          v.business_name ILIKE $${paramIdx} OR
          v.owner_name ILIKE $${paramIdx} OR
          v.phone ILIKE $${paramIdx} OR
          v.email ILIKE $${paramIdx} OR
          v.city ILIKE $${paramIdx} OR
          r.name ILIKE $${paramIdx} OR
          r.display_name ILIKE $${paramIdx}
        )`);
        params.push(`%${search}%`);
        paramIdx++;
      }

      // Category filter
      if (category && category !== 'all') {
        whereConditions.push(`(
          LOWER(v.category) = LOWER($${paramIdx}) OR 
          LOWER(r.name) ILIKE $${paramIdx + 1} OR
          LOWER(r.display_name) ILIKE $${paramIdx + 1}
        )`);
        params.push(category.toLowerCase());
        params.push(`%${category}%`);
        paramIdx += 2;
      }

      // Role ID filter
      if (role && role !== 'all') {
        whereConditions.push(`v.role_id = $${paramIdx}`);
        params.push(role);
        paramIdx++;
      }

      // City filter
      if (city && city !== 'all') {
        whereConditions.push(`LOWER(v.city) = LOWER($${paramIdx})`);
        params.push(city);
        paramIdx++;
      }

      // Tier filter
      if (tier && tier !== 'all') {
        whereConditions.push(`LOWER(v.tier) = LOWER($${paramIdx})`);
        params.push(tier);
        paramIdx++;
      }

      // Is Active filter (treat NULL is_active as active when requesting active, to match stats and schema default)
      if (isActive !== undefined && isActive !== 'all') {
        if (isActive === 'true') {
          whereConditions.push(`COALESCE(v.is_active, true) = true`);
        } else {
          whereConditions.push(`COALESCE(v.is_active, true) = false`);
        }
      }

      const whereClause = whereConditions.join(' AND ');

      // Main query with all filters
      // ✅ FIX: Join vendor_identity by phone instead of vendor_id (vendor_id column may not exist in production)
      const vendorsResult = await query(`
        SELECT 
          v.id,
          v.phone,
          v.email,
          v.business_name,
          v.owner_name,
          v.role_id,
          v.category,
          v.status,
          v.tier,
          v.is_active,
          v.city,
          v.state,
          v.address,
          v.experience_years,
          v.created_at,
          v.approved_at,
          -- Role information
          r.name as role_name,
          r.display_name as role_display_name,
          -- Vendor type derived from multiple sources
          CASE 
            WHEN vi.vendor_type IS NOT NULL AND vi.vendor_type != '' THEN vi.vendor_type
            WHEN r.config->>'vendorConfiguration' IS NOT NULL THEN r.config->>'vendorConfiguration'
            WHEN r.name LIKE '%_solo' OR r.name LIKE 'solo_%' OR LOWER(r.display_name) LIKE '%solo%' THEN 'solo'
            ELSE 'business'
          END as vendor_type,
          -- Services count
          (SELECT COUNT(*) FROM vendor_services vs WHERE vs.vendor_id = v.id AND vs.is_enabled = true) as active_services_count,
          -- Average rating
          (SELECT COALESCE(AVG(rating), 0) FROM reviews rv WHERE rv.vendor_id = v.id) as avg_rating,
          -- Review count
          (SELECT COUNT(*) FROM reviews rv WHERE rv.vendor_id = v.id) as review_count
        FROM vendors v
        LEFT JOIN roles r ON r.id = v.role_id
        LEFT JOIN vendor_identity vi ON vi.phone = v.phone
        WHERE ${whereClause}
        ORDER BY v.created_at DESC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
      `, [...params, limit, offset]);

      // Get total count for pagination
      // ✅ FIX: Join vendor_identity by phone instead of vendor_id
      const countResult = await query(`
        SELECT COUNT(DISTINCT v.id) as total
        FROM vendors v
        LEFT JOIN roles r ON r.id = v.role_id
        LEFT JOIN vendor_identity vi ON vi.phone = v.phone
        WHERE ${whereClause}
      `, params);

      const totalCount = parseInt(countResult.rows[0]?.total) || 0;

      // Transform and filter by vendor type (derived field, done in memory)
      let vendors = (vendorsResult.rows || []).map((v: any) => ({
        id: v.id,
        vendorId: v.id,
        businessName: v.business_name,
        ownerName: v.owner_name,
        fullName: v.business_name || v.owner_name,
        phone: v.phone,
        email: v.email,
        status: v.status,
        tier: v.tier || 'Bronze',
        isActive: v.is_active,
        // Role and type info
        roleId: v.role_id,
        roleName: v.role_name,
        roleDisplayName: v.role_display_name,
        category: v.category || v.role_name || 'General',
        vendorType: v.vendor_type,
        vendor_type: v.vendor_type,
        // Location
        city: v.city,
        location: v.city ? `${v.city}${v.state ? ', ' + v.state : ''}` : null,
        address: v.address,
        // Experience
        experience: v.experience_years ? `${v.experience_years} years` : null,
        experienceYears: v.experience_years,
        // Rating
        rating: parseFloat(v.avg_rating) || 0,
        reviewCount: parseInt(v.review_count) || 0,
        // Services
        activeServicesCount: parseInt(v.active_services_count) || 0,
        // Dates
        createdAt: v.created_at,
        approvedAt: v.approved_at,
      }));

      // Apply vendor type filter (derived field)
      if (vendorType && vendorType !== 'all') {
        vendors = vendors.filter((v: any) => v.vendorType === vendorType);
      }

      return this.success({
        vendors,
        total: totalCount,
        filtered: vendors.length,
        filters: { status, search, category, role, vendorType, city, tier, isActive }
      });
    } catch (error: any) {
      console.error('Error in ListVendorsHandler:', error);
      return this.error(error.message || 'Failed to fetch vendors', 500);
    }
  }
}

// ============================================================================
// ADMIN AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Verify admin authentication for protected routes
 * Returns 401 for missing/invalid auth, 403 for non-admin users
 */
export async function requireAdminAuth(c: any): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const authHeader = c.req.header('authorization') || c.req.header('Authorization');

  // Check for UAT mode - ONLY check UAT_MODE env variable for security
  const uatMode = process.env.UAT_MODE === 'true';

  // ✅ FIX: In UAT mode, allow admin access with any valid token or UAT token
  if (uatMode) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // In UAT mode, allow requests without auth header (for testing)
      console.log('[ADMIN AUTH] UAT Mode: Allowing admin access without auth header');
      return { authorized: true, userId: 'uat-admin-user' };
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');

    // Allow UAT tokens immediately (no JWT verification)
    if (token.startsWith('uat-token-')) {
      const suffix = token.replace('uat-token-', '');
      if (suffix.length >= 10) {
        console.log('[ADMIN AUTH] UAT Mode: Allowing admin access with UAT token');
        return { authorized: true, userId: 'uat-admin-user' };
      }
    }

    // Allow JWT tokens (verify or allow in dev)
    if (token.startsWith('eyJ')) {
      // JWT token or UAT token - verify it's valid
      try {
        const { extractAndVerifyAuthToken } = await import('../../../utils/jwt-verification');
        const headers: Record<string, string> = {};
        headers['authorization'] = authHeader;

        const result = await extractAndVerifyAuthToken(headers);

        if (result.valid && result.payload) {
          // Check if token has admin role or allow in UAT mode
          const groups = result.payload['cognito:groups'] as string[] | undefined;
          const userType = result.payload['custom:user_type'] as string | undefined;
          const role = result.payload['custom:user_type'] as string | undefined;

          const isAdmin = groups?.includes('admin') ||
            groups?.includes('super-admin') ||
            userType === 'admin' ||
            role === 'admin';

          if (isAdmin || uatMode) {
            return { authorized: true, userId: result.payload.sub || result.payload['cognito:username'] || 'uat-admin-user' };
          }
        }

        // In UAT mode, allow any valid token for admin operations
        console.log('[ADMIN AUTH] UAT Mode: Allowing admin access with valid token');
        return { authorized: true, userId: result.payload?.sub || 'uat-admin-user' };
      } catch (tokenError) {
        // SECURITY FIX: Only allow UAT bypass in non-production environments
        const isProduction = process.env.NODE_ENV === 'production' ||
          process.env.STAGE === 'prod' ||
          process.env.AWS_LAMBDA_FUNCTION_NAME?.includes('prod');

        if (!isProduction && token.startsWith('eyJ')) {
          console.log('[ADMIN AUTH] UAT Mode (DEV ONLY): Allowing admin access (token verification skipped)');
          return { authorized: true, userId: 'uat-admin-user' };
        }
        // In production, require valid token
        console.warn('[ADMIN AUTH] Token verification failed in production');
      }
    }
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Authentication required' };
  }

  const token = authHeader.replace('Bearer ', '');

  // Verify JWT token
  try {
    const { extractAndVerifyAuthToken } = await import('../../../utils/jwt-verification');
    const headers: Record<string, string> = {};
    headers['authorization'] = authHeader;

    const result = await extractAndVerifyAuthToken(headers);

    if (!result.valid || !result.payload) {
      const reason = result.error || 'unknown';
      console.warn('[ADMIN AUTH] Token verification failed:', reason, 'tokenPrefix:', token.slice(0, 20) + '...');
      return { authorized: false, error: 'Invalid or expired token' };
    }

    // Check for admin role in token claims
    const groups = result.payload['cognito:groups'] as string[] | undefined;
    const userType = result.payload['custom:user_type'] as string | undefined;

    const isAdmin = groups?.includes('admin') ||
      groups?.includes('super-admin') ||
      userType === 'admin';

    if (!isAdmin) {
      return { authorized: false, error: 'Admin access required' };
    }

    return { authorized: true, userId: result.payload.sub || result.payload['cognito:username'] };
  } catch (error) {
    console.error('[ADMIN AUTH] Token verification failed:', error);
    return { authorized: false, error: 'Token verification failed' };
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerAdminEndpoints(app: Hono) {
  const statsHandler = new VendorStatsHandler();
  const approveHandler = new ApproveVendorHandler();
  const rejectHandler = new RejectVendorHandler();
  const listHandler = new ListVendorsHandler();

  // Register webhook endpoints
  const { setupWebhookRoutes } = require('../../webhooks');
  setupWebhookRoutes(app);

  app.get('/admin/vendors/stats', async (c) => {
    // ✅ SECURITY FIX: Require admin authentication
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }

    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await statsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/admin/vendors/:vendorId/approve', async (c) => {
    // ✅ SECURITY FIX: Require admin authentication
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }

    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await approveHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/admin/vendors/:vendorId/reject', async (c) => {
    // ✅ SECURITY FIX: Require admin authentication
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }

    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await rejectHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Request clarification by vendorId (e.g. useVendors, AdminApp). Uses message/notes/comment only – NEVER rejection_reason.
  app.post('/admin/vendors/:vendorId/request-clarification', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json().catch(() => ({}));
    const notes = (body.notes ?? body.message ?? body.comment ?? body.comments ?? '').trim();
    if (!notes) {
      return c.json({ success: false, error: 'Message or notes are required for request clarification' }, 400);
    }
    try {
      let applicationId: string | null = null;
      // ✅ FIX: Use phone-based join to avoid vendor_id column dependency
      const byVendor = await query(
        `SELECT voa.id FROM vendor_onboarding_applications voa
         JOIN vendor_identity vi ON vi.id = voa.vendor_identity_id
         WHERE vi.phone = (SELECT phone FROM vendors WHERE id = $1 LIMIT 1)
         ORDER BY voa.created_at DESC LIMIT 1`,
        [vendorId]
      );
      applicationId = byVendor?.rows?.[0]?.id ?? null;
      if (!applicationId) {
        const byAppId = await query(
          `SELECT id FROM vendor_onboarding_applications WHERE id = $1 LIMIT 1`,
          [vendorId]
        );
        applicationId = byAppId?.rows?.[0]?.id ?? null;
      }
      if (!applicationId) {
        return c.json({ success: false, error: 'Application not found for this vendor' }, 404);
      }
      await query(
        `UPDATE vendor_onboarding_applications SET status = 'CLARIFICATION_REQUIRED', admin_comments = $2, is_locked = false, locked_at = NULL, updated_at = NOW() WHERE id = $1`,
        [applicationId, notes]
      );
      // ✅ FIX: Use vendor_identity_id from application, not application_id column
      try {
        const appCheck = await query(
          `SELECT vendor_identity_id FROM vendor_onboarding_applications WHERE id = $1 LIMIT 1`,
          [applicationId]
        );
        
        if (appCheck.rows.length > 0 && appCheck.rows[0].vendor_identity_id) {
          await query(
            `UPDATE vendor_identity 
             SET onboarding_status = 'CLARIFICATION_REQUIRED', updated_at = NOW() 
             WHERE id = $1 
               AND (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f')`,
            [appCheck.rows[0].vendor_identity_id]
          );
        }
      } catch (e) {
        console.warn('Optional vendor_identity update failed:', (e as Error).message);
      }
      return c.json({ success: true, message: 'Clarification requested', applicationId });
    } catch (error: any) {
      console.error('Error requesting clarification (vendors/:id):', error);
      return c.json({ success: false, error: error.message || 'Failed to request clarification' }, 500);
    }
  });

  app.get('/admin/vendors', async (c) => {
    // ✅ SECURITY FIX: Require admin authentication
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }

    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await listHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Alias for /admin/vendors/all (frontend compatibility)
  app.get('/admin/vendors/all', async (c) => {
    // ✅ SECURITY FIX: Require admin authentication
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }

    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await listHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get pending applications (new applications + re-approval cases)
  app.get('/admin/vendors/pending-applications-fixed', async (c) => {
    // ✅ SECURITY FIX: Require admin authentication
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }

    try {
      const applications: any[] = [];

      // 1️⃣ Get new vendor applications from vendor_onboarding_applications
      try {
        const newApplicationsResult = await query(`
          SELECT 
            voa.id,
            voa.vendor_identity_id,
            voa.status,
            voa.submitted_at,
            voa.created_at,
            voa.updated_at,
            voa.custom_fields,
            voa.admin_comments,
            vi.phone,
            vi.email,
            vi.full_name,
            vi.business_name,
            vi.owner_name,
            vi.address,
            vi.city,
            vi.state,
            vi.pincode,
            vi.vendor_type,
            vi.experience_years,
            r.name as role_name,
            r.display_name as role_display_name
          FROM vendor_onboarding_applications voa
          LEFT JOIN vendor_identity vi ON vi.id = voa.vendor_identity_id
          LEFT JOIN roles r ON r.id = vi.selected_role_id
          WHERE voa.status IN ('SUBMITTED', 'PENDING', 'UNDER_REVIEW')
            AND (vi.is_deleted IS NULL OR vi.is_deleted = false OR vi.is_deleted = 'f')
          ORDER BY voa.submitted_at DESC NULLS LAST, voa.created_at DESC
        `);

        for (const app of newApplicationsResult.rows || []) {
          applications.push({
            id: app.id,
            vendorId: app.vendor_identity_id,
            applicationId: app.id,
            fullName: app.full_name || app.owner_name || app.business_name,
            businessName: app.business_name,
            ownerName: app.owner_name,
            phone: app.phone,
            email: app.email,
            address: app.address,
            city: app.city,
            state: app.state,
            pincode: app.pincode,
            roleName: app.role_name,
            roleDisplayName: app.role_display_name,
            vendorType: app.vendor_type || 'business',
            experienceYears: app.experience_years,
            experience: app.experience_years ? `${app.experience_years} years` : null,
            status: app.status.toLowerCase().replace(/_/g, '_'),
            submittedAt: app.submitted_at || app.created_at,
            createdAt: app.created_at,
            customFields: app.custom_fields || {},
            adminComments: app.admin_comments,
            isReapproval: false,
          });
        }
      } catch (e) {
        console.warn('[pending-applications-fixed] Could not fetch new applications from vendor_onboarding_applications:', e);
      }

      // 2️⃣ Get re-approval cases from vendors table
      try {
        const reapprovalResult = await query(`
          SELECT 
            v.id,
            v.phone,
            v.email,
            v.business_name,
            v.owner_name,
            v.role_id,
            v.status,
            v.city,
            v.state,
            v.address,
            v.pincode,
            v.experience_years,
            v.created_at,
            v.updated_at,
            v.metadata,
            r.name as role_name,
            r.display_name as role_display_name,
            vi.vendor_type
          FROM vendors v
          LEFT JOIN roles r ON r.id = v.role_id
          LEFT JOIN LATERAL (
            SELECT vendor_type
            FROM vendor_identity vi2
            WHERE (
              vi2.phone = v.phone 
              OR REPLACE(REPLACE(REPLACE(vi2.phone, ' ', ''), '+', ''), '-', '') = REPLACE(REPLACE(REPLACE(v.phone, ' ', ''), '+', ''), '-', '')
            )
            AND (vi2.is_deleted IS NULL OR vi2.is_deleted = false OR vi2.is_deleted = 'f')
            ORDER BY vi2.updated_at DESC NULLS LAST
            LIMIT 1
          ) vi ON true
          WHERE v.status = 'pending'
            AND (
              (v.metadata->>'wasApprovedBefore')::boolean = true
              OR v.metadata->>'wasApprovedBefore' = 'true'
            )
            AND (v.is_deleted IS NULL OR v.is_deleted = false OR v.is_deleted = 'f')
          ORDER BY 
            CASE 
              WHEN v.metadata->>'reapprovalRequestedAt' IS NOT NULL 
              THEN (v.metadata->>'reapprovalRequestedAt')::timestamp 
              ELSE v.updated_at 
            END DESC NULLS LAST
        `);

        for (const vendor of reapprovalResult.rows || []) {
          const metadata = vendor.metadata || {};
          applications.push({
            id: vendor.id,
            vendorId: vendor.id,
            applicationId: null, // No application ID for re-approvals
            fullName: vendor.business_name || vendor.owner_name,
            businessName: vendor.business_name,
            ownerName: vendor.owner_name,
            phone: vendor.phone,
            email: vendor.email,
            address: vendor.address,
            city: vendor.city,
            state: vendor.state,
            pincode: vendor.pincode,
            roleName: vendor.role_name,
            roleDisplayName: vendor.role_display_name,
            vendorType: vendor.vendor_type || 'business',
            experienceYears: vendor.experience_years,
            experience: vendor.experience_years ? `${vendor.experience_years} years` : null,
            status: 'pending_reverification',
            submittedAt: metadata.reapprovalRequestedAt || vendor.updated_at,
            createdAt: vendor.created_at,
            customFields: {},
            adminComments: null,
            isReapproval: true,
            reapprovalReason: metadata.reapprovalReason || 'Critical profile fields updated',
            previousStatus: metadata.previousStatus || 'approved',
          });
        }
      } catch (e) {
        console.warn('[pending-applications-fixed] Could not fetch re-approval cases from vendors:', e);
      }

      // Sort by submittedAt (most recent first)
      applications.sort((a, b) => {
        const dateA = new Date(a.submittedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.submittedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      return c.json({
        success: true,
        applications,
        total: applications.length,
      });
    } catch (error: any) {
      console.error('[pending-applications-fixed] Error:', error);
      return c.json({ 
        success: false, 
        error: error.message || 'Failed to fetch pending applications',
        applications: [],
        total: 0
      }, 500);
    }
  });

  // Frontend compatibility: /admin/vendor/application/:applicationId/approve
  app.post('/admin/vendor/application/:applicationId/approve', async (c) => {
    // SECURITY FIX: Require admin authentication
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }

    const applicationId = c.req.param('applicationId');

    try {
      //  Look up vendor_identity by application_id
      // Handle case where vi.application_id might not be a valid UUID (could be status string)
      // Strategy: Find application first, then get identity from vendor_identity_id
      // Fallback: If application not found, try finding identity directly by ID
      let identityResults;
      
      // First, try to find the application and get identity from it
      const appResult = await query(
        `SELECT voa.*, voa.vendor_identity_id 
         FROM vendor_onboarding_applications voa 
         WHERE voa.id = $1`,
        [applicationId]
      );
      
      if (appResult.rows.length > 0) {
        const app = appResult.rows[0];
        
        //Validate vendor_identity_id is a valid UUID before using it
        if (!app.vendor_identity_id || 
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(app.vendor_identity_id)) {
          console.error(`⚠️ [APPROVE] Invalid vendor_identity_id in application: ${app.vendor_identity_id}`);
          return c.json({ error: 'Invalid application data: vendor_identity_id is not a valid UUID' }, 400);
        }
        
        // Get identity from the application's vendor_identity_id
        identityResults = await query(
        `SELECT vi.*, voa.id as app_id, voa.application_payload, voa.status as app_status,
                r.name as role_name, r.id as role_id
         FROM vendor_identity vi
           LEFT JOIN vendor_onboarding_applications voa ON voa.id = $1
         LEFT JOIN roles r ON vi.selected_role_id = r.id
           WHERE vi.id = $2`,
          [applicationId, app.vendor_identity_id]
        );
      } else {
        // Application not found - try finding identity directly by ID (backward compatibility)
        identityResults = await query(
          `SELECT vi.*, NULL as app_id, NULL as application_payload, NULL as app_status,
                  r.name as role_name, r.id as role_id
           FROM vendor_identity vi
           LEFT JOIN roles r ON vi.selected_role_id = r.id
           WHERE vi.id = $1`,
        [applicationId]
      );
      }

      let vendorId: string;
      let identity: any = null;

      if (identityResults.rows.length > 0) {
        identity = identityResults.rows[0];

        // Check if vendor already exists - filter out deleted vendors
        // Only use identity.vendor_id if it's a valid UUID, otherwise use identity.id
        const vendorIdToCheck = (identity.vendor_id && 
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.vendor_id))
          ? identity.vendor_id 
          : identity.id;
        
        const existingVendor = await query(
          `SELECT id, is_deleted FROM vendors 
           WHERE (id = $1 OR phone = $2)
           AND (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f')
           LIMIT 1`,
          [vendorIdToCheck, identity.phone]
        );

        if (existingVendor.rows.length > 0) {
          vendorId = existingVendor.rows[0].id;
          // Vendor exists and is not deleted - link them
          if (!identity.vendor_id || identity.vendor_id !== vendorId) {
            try {
              await query(
                `UPDATE vendor_identity 
                 SET vendor_id = $1, 
                     onboarding_status = 'APPROVED',
                     updated_at = NOW()
                 WHERE id = $2 
                 AND (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f')`,
                [vendorId, identity.id]
              );
            } catch (linkErr) {
              console.warn('Failed to link vendor_id to vendor_identity:', linkErr);
            }
          }
        } else {
          // Check if identity.vendor_id points to a deleted vendor
          // If it does, we MUST create a new vendor with a new ID
          // Only check identity.vendor_id if it's a valid UUID (not a string like "approved")
          let proposedVendorId: string | null = null;
          
          if (identity.vendor_id && 
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identity.vendor_id)) {
            const deletedVendorCheck = await query(
              `SELECT id, is_deleted FROM vendors WHERE id = $1 LIMIT 1`,
              [identity.vendor_id]
            );
            
            if (deletedVendorCheck.rows.length > 0) {
              const vendor = deletedVendorCheck.rows[0];
              const isDeleted = vendor.is_deleted === true || 
                vendor.is_deleted === 't' ||
                (typeof vendor.is_deleted === 'string' && vendor.is_deleted.toLowerCase() === 'true');
              
              if (isDeleted) {
                console.log(`⚠️ [APPROVE] Identity ${identity.id} vendor_id ${identity.vendor_id} points to deleted vendor - generating new ID`);
                proposedVendorId = null; // Will generate new UUID
              } else {
                // Shouldn't happen if query above worked, but be safe
                proposedVendorId = identity.vendor_id;
              }
            } else {
              // Vendor doesn't exist - can use identity.vendor_id
              proposedVendorId = identity.vendor_id;
            }
          }
          
          // Generate new UUID if needed
          if (!proposedVendorId) {
            const { randomUUID } = await import('crypto');
            proposedVendorId = randomUUID();
            console.log(`✅ [APPROVE] Generating new unique vendor ID: ${proposedVendorId}`);
          }
          
          // Double-check the ID doesn't exist (even if deleted)
          const finalIdCheck = await query(
            `SELECT id FROM vendors WHERE id = $1 LIMIT 1`,
            [proposedVendorId]
          );
          
          let finalVendorId = proposedVendorId;
          if (finalIdCheck.rows.length > 0) {
            // ID exists - generate new one
            const { randomUUID } = await import('crypto');
            finalVendorId = randomUUID();
            console.log(`⚠️ [APPROVE] Proposed vendor ID ${proposedVendorId} already exists - generating new: ${finalVendorId}`);
          }
          
          // Create vendor from application data
          const formData = identity.application_payload || {};
          //Ensure email is never null - use phone-based fallback if needed
          const vendorEmail = formData.email || identity.email || `vendor-${identity.phone}@warmpawz.app`;

          // Fetch default tier/commission from vendor_tiers (fallback to Basic/15%)
          let defaultTierName = 'Basic';
          let defaultCommission = 15;
          try {
            const tierResult = await query(
              `SELECT tier_name, commission_rate 
          FROM vendor_tiers 
          WHERE is_active = true 
            AND (is_default = true OR is_free_tier = true)
          ORDER BY is_default DESC NULLS LAST, tier_level ASC
          LIMIT 1`
            );

            if (tierResult.rows && tierResult.rows.length > 0) {
              defaultTierName = tierResult.rows[0].tier_name;
              const cr = parseFloat(tierResult.rows[0].commission_rate || '15');
              if (!isNaN(cr)) defaultCommission = cr;
            }
          } catch (tierError: any) {
            // Continue with fallback tier
          }

          const insertResult = await query(
            `INSERT INTO vendors (
              id, phone, email, owner_name, business_name, role_id, status, vendor_type,
              city, state, address, pincode, tier, commission_percentage, is_active, is_deleted, metadata, created_at, approved_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'approved', $7, $8, $9, $10, $11, $12, $13, $14, true, false, '{}'::jsonb, NOW(), NOW())
            RETURNING id`,
            [
              finalVendorId, // ✅ Use the final (unique) vendor ID
              identity.phone,
              vendorEmail,
              formData.contactPersonName || formData.businessName || 'Vendor',
              formData.businessName || formData.contactPersonName || 'Business',
              identity.role_id || identity.selected_role_id, // ✅ role_id (UUID)
              identity.vendor_type || 'solo', // ✅ vendor_type
              formData.city || 'Unknown',
              formData.state || 'Unknown',
              formData.address || 'Unknown',
              formData.pincode || formData.pinCode || '',
              defaultTierName,
              defaultCommission
            ]
          );
          vendorId = insertResult.rows[0].id;

          //Immediately verify vendor was created correctly
          const verifyVendor = await query(
            `SELECT id, is_deleted FROM vendors WHERE id = $1 LIMIT 1`,
            [vendorId]
          );
          
          if (verifyVendor.rows.length > 0) {
            const vendor = verifyVendor.rows[0];
            const isDeleted = vendor.is_deleted === true || 
              vendor.is_deleted === 't' ||
              (typeof vendor.is_deleted === 'string' && vendor.is_deleted.toLowerCase() === 'true');
            
            if (isDeleted) {
              console.error(`❌ [APPROVE] CRITICAL: Vendor ${vendorId} was created but is marked as deleted! Fixing...`);
              await query(
                `UPDATE vendors 
                 SET is_deleted = false, 
                     metadata = '{}'::jsonb,
                     updated_at = NOW()
                 WHERE id = $1`,
                [vendorId]
              );
              console.log(`✅ [APPROVE] Fixed vendor ${vendorId} - set is_deleted to false`);
            }
          }

          // Update vendor_identity to link vendor_id and set status
          //Only update if identity is not deleted
          const verifyIdentity = await query(
            `SELECT id, is_deleted FROM vendor_identity WHERE id = $1 LIMIT 1`,
            [identity.id]
          );
          
          if (verifyIdentity.rows.length > 0) {
            const identityCheck = verifyIdentity.rows[0];
            const isIdentityDeleted = identityCheck.is_deleted === true || 
              identityCheck.is_deleted === 't' ||
              (typeof identityCheck.is_deleted === 'string' && identityCheck.is_deleted.toLowerCase() === 'true');
            
            if (!isIdentityDeleted) {
          try {
            await query(
              `UPDATE vendor_identity 
               SET onboarding_status = 'APPROVED', 
                   vendor_id = $1,
                   updated_at = NOW()
                   WHERE id = $2 
                   AND (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f')`,
              [vendorId, identity.id]
            );
          } catch (updateErr) {
            console.error('Failed to update vendor_identity:', updateErr);
            // Try without vendor_id if column doesn't exist (backward compatibility)
            try {
              await query(
                `UPDATE vendor_identity SET onboarding_status = 'APPROVED', updated_at = NOW() WHERE id = $1`,
                [identity.id]
              );
            } catch (fallbackErr) {
              console.error('Failed to update vendor_identity (fallback):', fallbackErr);
                }
              }
            } else {
              console.warn(`⚠️ [APPROVE] Cannot update deleted vendor_identity ${identity.id}`);
            }
          }
        }
      } else {
        // Try direct vendor lookup (backward compatibility)
        const vendors = await select('vendors', { id: applicationId });
        if (vendors.length === 0) {
          return c.json({ error: 'Application not found' }, 404);
        }
        vendorId = vendors[0].id;
      }

      //Ensure facility/profile is provisioned after approval
      // Update vendor record with any missing facility fields from application data
      // Do this BEFORE status update so facility data is available immediately
      try {
        const application = await select('vendor_onboarding_applications', { id: applicationId });
        const currentVendor = await select('vendors', { id: vendorId });
        const vendorRecord = currentVendor.length > 0 ? currentVendor[0] : null;

        if (application.length > 0) {
          const appPayload = application[0].application_payload || {};
          const facilityUpdate: any = {};

          // Ensure address fields are populated (even if from application)
          if (appPayload.address && (!vendorRecord?.address || vendorRecord.address === 'Unknown' || vendorRecord.address === 'Not specified')) {
            facilityUpdate.address = appPayload.address;
          }
          if (appPayload.city && (!vendorRecord?.city || vendorRecord.city === 'Unknown' || vendorRecord.city === 'Not specified')) {
            facilityUpdate.city = appPayload.city;
          }
          if (appPayload.state && (!vendorRecord?.state || vendorRecord.state === 'Unknown' || vendorRecord.state === 'Not specified')) {
            facilityUpdate.state = appPayload.state;
          }
          if ((appPayload.pincode || appPayload.pinCode) && (!vendorRecord?.pincode || vendorRecord.pincode === '000000' || vendorRecord.pincode === '')) {
            facilityUpdate.pincode = appPayload.pincode || appPayload.pinCode;
          }
          if (appPayload.latitude && !vendorRecord?.latitude) {
            facilityUpdate.latitude = appPayload.latitude;
          }
          if (appPayload.longitude && !vendorRecord?.longitude) {
            facilityUpdate.longitude = appPayload.longitude;
          }

          // Update vendor if any facility fields need to be set
          if (Object.keys(facilityUpdate).length > 0) {
            await update('vendors', { id: vendorId }, {
              ...facilityUpdate,
              updated_at: new Date().toISOString(),
            });
            console.log(`✅ [Vendor Approval] Provisioned facility fields for vendor ${vendorId}:`, Object.keys(facilityUpdate));
          }
        }
      } catch (facilityErr: any) {
        console.warn(`⚠️ [Vendor Approval] Failed to provision facility (non-critical):`, facilityErr.message);
        // Don't fail approval if facility provisioning fails - vendor can update later
      }

      // Update vendor status to approved
      await update(
        'vendors',
        { id: vendorId },
        {
          status: 'approved',
          approved_at: new Date(),
          is_active: true,
        }
      );

      // Update application status if exists
      await query(
        `UPDATE vendor_onboarding_applications SET status = 'APPROVED', updated_at = NOW() WHERE id = $1`,
        [applicationId]
      );

      //Update vendor_identity status to APPROVED and ensure vendor_id is set
      // Use identity.id directly (we already validated it's a valid UUID)
      let updatedIdentity = null;
      if (identity && identity.id) {
      try {
        const updateResult = await query(
          `UPDATE vendor_identity 
           SET onboarding_status = 'APPROVED', 
               vendor_id = COALESCE(vendor_id, $1),
               updated_at = NOW() 
             WHERE id = $2 
               AND (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f')
               AND (vendor_id IS NULL OR vendor_id = $1)
           RETURNING *`,
            [vendorId, identity.id]
        );
        if (updateResult.rows.length > 0) {
          updatedIdentity = updateResult.rows[0];
        }
      } catch (updateErr) {
        console.error('Failed to update vendor_identity with vendor_id:', updateErr);
          // Fallback: update status only (using identity.id which we know is valid)
          try {
        const fallbackResult = await query(
              `UPDATE vendor_identity 
               SET onboarding_status = 'APPROVED', updated_at = NOW() 
               WHERE id = $1 
                 AND (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f')
           RETURNING *`,
              [identity.id]
        );
        if (fallbackResult.rows.length > 0) {
          updatedIdentity = fallbackResult.rows[0];
            }
          } catch (fallbackErr) {
            console.error('Failed to update vendor_identity (fallback):', fallbackErr);
          }
        }
      }

      // Process vendor referral - check both metadata AND existing referral records
      let referralProcessed = false;

      // Method 1: Check metadata (from signup)
      if (updatedIdentity && updatedIdentity.metadata && updatedIdentity.metadata.referral_code_id) {
        try {
          const { processVendorReferralSignup } = await import('../../../lib/services/referral-service');
          const referralResult = await processVendorReferralSignup({
            vendorId: vendorId,
            referralCode: updatedIdentity.metadata.referral_code || '',
            phone: updatedIdentity.phone || identity?.phone || '',
          });

          if (referralResult.success) {
            console.log(`[ADMIN-APPROVAL] ✅ Vendor referral processed: ${referralResult.referrerPoints} points awarded to referrer`);
            referralProcessed = true;
          } else {
            console.warn(`[ADMIN-APPROVAL] Vendor referral processing failed: ${referralResult.error}`);
          }
        } catch (refError: any) {
          console.error('[ADMIN-APPROVAL] Error processing vendor referral:', refError);
        }
      }

      // Method 2: Check for existing referral records for this vendor (fallback)
      // This handles cases where metadata is missing but referral record exists
      if (!referralProcessed) {
        try {
          const vendorPhone = updatedIdentity?.phone || identity?.phone || '';
          const normalizedPhone = vendorPhone.replace(/\D/g, '').slice(-10);

          // Find referral records for this vendor that are approved but don't have points
          const referralRecords = await query(
            `SELECT vr.* FROM vendor_referrals vr
             WHERE vr.referred_vendor_id = $1
             AND vr.status = 'approved'
             AND NOT EXISTS (
               SELECT 1 FROM loyalty_transactions lt
               WHERE lt.customer_id = vr.referrer_vendor_id
               AND lt.reference_type = 'vendor_referral'
               AND lt.reference_id = vr.id
             )
             ORDER BY vr.approved_at DESC
             LIMIT 1`,
            [vendorId]
          );

          if (referralRecords.rows.length > 0) {
            const referralRecord = referralRecords.rows[0];
            console.log(`[ADMIN-APPROVAL] Found approved referral record ${referralRecord.id} without points, processing now...`);

            // Award points directly to referrer
            const { loyaltyPointsService } = await import('../../../lib/services/loyalty&reward/loyalty-points-service');
            const pointsResult = await loyaltyPointsService.awardPoints({
              vendorId: referralRecord.referrer_vendor_id,
              actionName: 'vendor_refer_friend',
              referenceType: 'vendor_referral',
              referenceId: referralRecord.id,
              description: `Vendor referral: Admin approved vendor ${vendorId} with code ${referralRecord.referral_code}`,
            });

            console.log(`[ADMIN-APPROVAL] ✅ Awarded ${pointsResult.points} points (₹${pointsResult.walletCredited} to wallet) to referrer vendor ${referralRecord.referrer_vendor_id}`);
            referralProcessed = true;
          }
        } catch (refError: any) {
          console.error('[ADMIN-APPROVAL] Error processing referral from record:', refError);
        }
      }

      // Method 3: Check for existing referral records by phone (additional fallback)
      // This handles cases where referral was applied/approved but metadata wasn't saved or points weren't awarded
      // IMPORTANT: Only match by phone if referred_vendor_id is NULL (pending referral that hasn't been linked to a vendor yet)
      // ALSO: Check for referrals that have points but wrong vendor_id (data inconsistency fix)
      if (!referralProcessed) {
        try {
          const vendorPhone = identity?.phone?.replace(/\D/g, '').slice(-10) || '';

          // Find referral records for this vendor that:
          // 1. Don't have points awarded yet, OR
          // 2. Have points but wrong/null vendor_id (data inconsistency)
          // Priority: Match by referred_vendor_id first, then by phone ONLY if referred_vendor_id is NULL
          const existingReferrals = await query(
            `SELECT vr.*,
             EXISTS (
               SELECT 1 FROM loyalty_transactions lt
               WHERE lt.customer_id = vr.referrer_vendor_id
               AND lt.reference_type = 'vendor_referral'
               AND lt.reference_id = vr.id
             ) as has_points
             FROM vendor_referrals vr
             WHERE (
               vr.referred_vendor_id = $1 
               OR (vr.referred_vendor_id IS NULL AND vr.referred_phone = $2 AND vr.status = 'pending')
               OR (vr.referred_phone = $2 AND vr.referred_vendor_id IS NULL)
             )
             AND vr.status IN ('applied', 'approved', 'pending')
             ORDER BY 
               CASE WHEN vr.referred_vendor_id = $1 THEN 1 ELSE 2 END,
               vr.created_at DESC
             LIMIT 1`,
            [vendorId, vendorPhone]
          );

          if (existingReferrals.rows.length > 0) {
            const referral = existingReferrals.rows[0];
            const hasPoints = referral.has_points === true;

            console.log(`[ADMIN-APPROVAL] Found existing referral record ${referral.id} for vendor ${vendorId}, processing...`);
            console.log(`[ADMIN-APPROVAL] Referral status: ${referral.status}, Referrer: ${referral.referrer_vendor_id}, Referred Vendor ID: ${referral.referred_vendor_id}, Has Points: ${hasPoints}`);

            // Only award points if they don't exist yet
            if (!hasPoints) {
              const { loyaltyPointsService } = await import('../../../lib/services/loyalty&reward/loyalty-points-service');
              const pointsResult = await loyaltyPointsService.awardPoints({
                vendorId: referral.referrer_vendor_id,
                actionName: 'vendor_refer_friend',
                referenceType: 'vendor_referral',
                referenceId: referral.id,
                description: `Vendor referral: Admin approved vendor ${vendorId} (code: ${referral.referral_code})`,
              });

              console.log(`[ADMIN-APPROVAL] ✅ Awarded ${pointsResult.points} points (₹${pointsResult.walletCredited} to wallet) to referrer ${referral.referrer_vendor_id}`);
            } else {
              console.log(`[ADMIN-APPROVAL] Points already exist for referral ${referral.id}, skipping award but will update referral record`);
            }

            // CRITICAL: Always update referral record with the correct vendor ID and status
            // This fixes data inconsistencies where points exist but vendor_id is wrong/null
            // IMPORTANT: Update even if referral already has a different vendor_id (data fix)
            const updateResult = await query(
              `UPDATE vendor_referrals
               SET referred_vendor_id = $1,
                   status = 'approved',
                   approved_at = COALESCE(approved_at, NOW()),
                   applied_at = COALESCE(applied_at, NOW()),
                   updated_at = NOW()
               WHERE id = $2`,
              [vendorId, referral.id]
            );

            console.log(`[ADMIN-APPROVAL] ✅ Updated referral ${referral.id} with vendor ID ${vendorId} and status 'approved'`);
            console.log(`[ADMIN-APPROVAL] Update result: ${JSON.stringify(updateResult)}`);

            referralProcessed = true;
          }
        } catch (refError2: any) {
          console.error('[ADMIN-APPROVAL] Error processing existing referral:', refError2);
          console.error('[ADMIN-APPROVAL] Error stack:', refError2.stack);
        }
      }

      // Method 4: Check for existing referral records for this vendor (fallback)
      // This handles cases where referral was created but metadata wasn't stored
      // CRITICAL: Also handles referrals with points but wrong/null vendor_id
      if (!referralProcessed) {
        try {
          const vendorPhone = identity?.phone?.replace(/\D/g, '').slice(-10) || '';

          // Find referrals by vendor_id OR by phone (if vendor_id is null)
          // Include referrals that have points but wrong vendor_id (data fix)
          const existingReferrals = await query(
            `SELECT vr.*,
             EXISTS (
               SELECT 1 FROM loyalty_transactions lt
               WHERE lt.customer_id = vr.referrer_vendor_id
               AND lt.reference_type = 'vendor_referral'
               AND lt.reference_id = vr.id
             ) as has_points
             FROM vendor_referrals vr
             WHERE (
               vr.referred_vendor_id = $1
               OR (vr.referred_vendor_id IS NULL AND vr.referred_phone = $2)
             )
             AND vr.status IN ('applied', 'pending', 'approved')
             ORDER BY 
               CASE WHEN vr.referred_vendor_id = $1 THEN 1 ELSE 2 END,
               vr.created_at DESC 
             LIMIT 1`,
            [vendorId, vendorPhone]
          );

          if (existingReferrals.rows.length > 0) {
            const referral = existingReferrals.rows[0];
            const hasPoints = referral.has_points === true;

            console.log(`[ADMIN-APPROVAL] Found existing referral record: ${referral.id}, processing...`);
            console.log(`[ADMIN-APPROVAL] Has points: ${hasPoints}, Current vendor_id: ${referral.referred_vendor_id}`);

            // Award points if they don't exist
            if (!hasPoints) {
              // Points not awarded yet - award them now
              // Ensure vendor_refer_friend rule exists
              const { loyaltyRulesInitService } = await import('../../../lib/services/loyalty-rules-init-service');
              await loyaltyRulesInitService.initializeVendorReferralRules();

              const { loyaltyPointsService } = await import('../../../lib/services/loyalty&reward/loyalty-points-service');
              const pointsResult = await loyaltyPointsService.awardPoints({
                vendorId: referral.referrer_vendor_id,
                actionName: 'vendor_refer_friend',
                referenceType: 'vendor_referral',
                referenceId: referral.id,
                description: `Vendor referral: Admin approved vendor ${vendorId} with code ${referral.referral_code}`,
              });

              console.log(`[ADMIN-APPROVAL] ✅ Awarded ${pointsResult.points} points (₹${pointsResult.walletCredited} to wallet) to referrer vendor ${referral.referrer_vendor_id}`);
            } else {
              console.log(`[ADMIN-APPROVAL] Points already exist for referral ${referral.id}`);
            }

            // CRITICAL: Always update referral with correct vendor_id and status
            // This fixes cases where points exist but vendor_id is wrong/null
            await query(
              `UPDATE vendor_referrals
               SET referred_vendor_id = $1,
                   status = 'approved',
                   approved_at = COALESCE(approved_at, NOW()),
                   applied_at = COALESCE(applied_at, NOW()),
                   updated_at = NOW()
               WHERE id = $2`,
              [vendorId, referral.id]
            );

            console.log(`[ADMIN-APPROVAL] ✅ Updated referral ${referral.id} with vendor ID ${vendorId} and status 'approved'`);
            referralProcessed = true;
          }
        } catch (refError: any) {
          console.error('[ADMIN-APPROVAL] Error processing existing referral:', refError);
          console.error('[ADMIN-APPROVAL] Error stack:', refError.stack);
          // Don't fail approval if referral processing fails
        }
      }

      // Create notification
      await insert('notifications', {
        recipient_id: vendorId,
        recipient_type: 'vendor',
        notification_type: 'vendor_approved',
        title: 'Application Approved',
        message: 'Your vendor application has been approved! You can now access your dashboard.',
        channels: { email: true, sms: true, inApp: true, push: false },
        is_read: false,
      });

      return c.json({
        success: true,
        message: 'Vendor approved successfully',
        vendorId,
        applicationId,
      });
    } catch (error: any) {
      console.error('Error approving vendor:', error);
      return c.json({ error: error.message || 'Failed to approve vendor' }, 500);
    }
  });

  // Frontend compatibility: /admin/vendor/application/:applicationId/reject
  app.post('/admin/vendor/application/:applicationId/reject', async (c) => {
    // ✅ SECURITY FIX: Require admin authentication
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }

    const applicationId = c.req.param('applicationId');
    const body = await c.req.json().catch(() => ({}));
    const reason = body.reason || 'Application rejected by admin';

    try {
      // ✅ FIX: Update vendor_identity status - use vendor_identity_id from application, not application_id column
      const appCheck = await query(
        `SELECT vendor_identity_id FROM vendor_onboarding_applications WHERE id = $1 LIMIT 1`,
        [applicationId]
      );
      
      if (appCheck.rows.length > 0 && appCheck.rows[0].vendor_identity_id) {
        await query(
          `UPDATE vendor_identity 
           SET onboarding_status = 'REJECTED' 
           WHERE id = $1 
             AND (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f')`,
          [appCheck.rows[0].vendor_identity_id]
        );
      }

      // Update application status
      await query(
        `UPDATE vendor_onboarding_applications 
         SET status = 'REJECTED', rejection_reason = $2, updated_at = NOW() 
         WHERE id = $1`,
        [applicationId, reason]
      );

      return c.json({
        success: true,
        message: 'Application rejected',
        applicationId,
        reason,
      });
    } catch (error: any) {
      console.error('Error rejecting application:', error);
      return c.json({ error: error.message || 'Failed to reject application' }, 500);
    }
  });

  // Frontend compatibility: /admin/vendor/application/:applicationId/request-clarification
  // Request clarification uses message/notes only. rejection_reason is ONLY for reject – never required here.
  app.post('/admin/vendor/application/:applicationId/request-clarification', async (c) => {
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }

    const applicationId = c.req.param('applicationId');
    const body = await c.req.json().catch(() => ({}));
    // Only notes/message/comments – do not use or require rejection_reason
    const notes = (body.notes ?? body.message ?? body.comments ?? '').trim();
    if (!notes) {
      return c.json({ success: false, error: 'Message or notes are required for request clarification' }, 400);
    }

    try {
      const apps = await select('vendor_onboarding_applications', { id: applicationId });
      if (!apps.length) {
        return c.json({ success: false, error: 'Application not found' }, 404);
      }
      const app = apps[0];
      await query(
        `UPDATE vendor_onboarding_applications 
         SET status = 'CLARIFICATION_REQUIRED', admin_comments = $2, is_locked = false, locked_at = NULL, updated_at = NOW() 
         WHERE id = $1`,
        [applicationId, notes]
      );
      // ✅ FIX: Use vendor_identity_id from application, not application_id column
      try {
        const appCheck = await query(
          `SELECT vendor_identity_id FROM vendor_onboarding_applications WHERE id = $1 LIMIT 1`,
          [applicationId]
        );
        
        if (appCheck.rows.length > 0 && appCheck.rows[0].vendor_identity_id) {
          await query(
            `UPDATE vendor_identity 
             SET onboarding_status = 'CLARIFICATION_REQUIRED', updated_at = NOW() 
             WHERE id = $1 
               AND (is_deleted IS NULL OR is_deleted = false OR is_deleted = 'f')`,
            [appCheck.rows[0].vendor_identity_id]
          );
        }
      } catch (e) {
        console.warn('Optional vendor_identity update failed:', (e as Error).message);
      }
      return c.json({
        success: true,
        message: 'Clarification requested',
        applicationId,
      });
    } catch (error: any) {
      console.error('Error requesting clarification:', error);
      return c.json({ success: false, error: error.message || 'Failed to request clarification' }, 500);
    }
  });

  // ============================================================================
  // MISSING ADMIN ENDPOINTS - Added to fix "Failed to load data" issues
  // ============================================================================

  /**
   * GET /admin/customers
   * List all customers (for admin dashboard)
   */
  app.get('/admin/customers', async (c) => {
    try {
      // For now, allow without auth for testing (add auth later)
      const customers = await select('customers', {});

      return c.json({
        success: true,
        count: customers.length,
        customers: customers.map(customer => ({
          id: customer.id,
          name: customer.full_name || customer.name,
          full_name: customer.full_name,
          email: customer.email,
          phone: customer.phone,
          created_at: customer.created_at,
          is_active: customer.is_active,
          status: customer.status || 'active',
        })),
      });
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/bookings
   * List all bookings (for admin dashboard)
   */
  app.get('/admin/bookings', async (c) => {
    try {
      // For now, allow without auth for testing
      const bookings = await query(`
        SELECT 
          b.*,
          c.full_name as customer_name,
          c.email as customer_email,
          c.phone as customer_phone,
          v.business_name as vendor_name,
          s.name as service_name
        FROM bookings b
        LEFT JOIN customers c ON b.customer_id = c.id
        LEFT JOIN vendors v ON b.vendor_id = v.id
        LEFT JOIN services s ON b.service_id = s.id
        ORDER BY b.created_at DESC
        LIMIT 100
      `);

      return c.json({
        success: true,
        count: bookings.rows.length,
        bookings: bookings.rows,
      });
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/gst-configs
   * List all GST configurations (for admin settings)
   */
  app.get('/admin/gst-configs', async (c) => {
    try {
      const gstConfigs = await select('gst_configs', {});

      return c.json({
        success: true,
        count: gstConfigs.length,
        configs: gstConfigs,
      });
    } catch (error: any) {
      console.error('Error fetching GST configs:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/policies
   * List all cancellation policies (for admin settings)
   */
  app.get('/admin/policies', async (c) => {
    try {
      const policies = await select('cancellation_policies', {});

      return c.json({
        success: true,
        count: policies.length,
        policies: policies,
      });
    } catch (error: any) {
      console.error('Error fetching policies:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/staff
   * List all staff members (for admin dashboard)
   */
  app.get('/admin/staff', async (c) => {
    try {
      const staff = await query(`
        SELECT 
          s.*,
          v.business_name as vendor_name
        FROM staff s
        LEFT JOIN vendors v ON s.vendor_id = v.id
        ORDER BY s.created_at DESC
      `);

      return c.json({
        success: true,
        count: staff.rows.length,
        staff: staff.rows,
      });
    } catch (error: any) {
      console.error('Error fetching staff:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/pets
   * List all pet profiles (for admin dashboard)
   */
  app.get('/admin/pets', async (c) => {
    try {
      const pets = await query(`
        SELECT 
          p.*,
          c.full_name as owner_name,
          c.email as owner_email,
          c.phone as owner_phone
        FROM pets p
        LEFT JOIN customers c ON p.customer_id = c.id
        ORDER BY p.created_at DESC
      `);

      return c.json({
        success: true,
        count: pets.rows.length,
        pets: pets.rows,
      });
    } catch (error: any) {
      console.error('Error fetching pets:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ✅ TEMPORARY: Fix staff vendor_identity records
  app.post('/admin/fix-staff-vendor-identity', async (c) => {
    try {
      console.log('[ADMIN] Fixing staff vendor_identity records...');

      // Step 1: Delete existing vendor_identity for staff phones
      await query(`
        DELETE FROM vendor_identity
        WHERE phone IN ('8426334832', '5555555555')
      `);
      console.log('[ADMIN] Deleted existing vendor_identity records');

      // Step 2: Create/Update vendor_identity with proper staff configuration
      const result = await query(`
        INSERT INTO vendor_identity (
          phone,
          user_type,
          onboarding_status,
          vendor_id,
          selected_role_id,
          vendor_type,
          full_name,
          business_name,
          email,
          metadata
        )
        SELECT 
          s.phone,
          'staff',
          'ACTIVATED',
          s.vendor_id::uuid,
          r.id as selected_role_id,
          -- Vendor type derived from role name if vendor_identity.vendor_type is NULL
          CASE 
            WHEN vi_vendor.vendor_type IS NOT NULL THEN vi_vendor.vendor_type
            WHEN r.name LIKE '%_solo' OR r.name LIKE 'solo_%' OR LOWER(r.display_name) LIKE '%solo%' THEN 'solo'
            ELSE 'business'
          END as vendor_type,
          s.name as full_name,
          COALESCE(v.business_name, s.name) as business_name,
          s.email,
          jsonb_build_object(
            'staff_id', s.id,
            'created_via', 'staff_fix_script'
          ) as metadata
        FROM staff s
        LEFT JOIN roles r ON (
          (r.name = s.role OR r.display_name = s.role OR 
           LOWER(r.name) = LOWER(s.role) OR LOWER(r.display_name) = LOWER(s.role))
          AND r.is_active = true
        )
        LEFT JOIN vendor_identity vi_vendor ON (
          vi_vendor.vendor_id = s.vendor_id::uuid 
          AND (vi_vendor.user_type IS NULL OR vi_vendor.user_type = 'vendor')
        )
        LEFT JOIN vendors v ON v.id = s.vendor_id::uuid
        WHERE s.phone IN ('8426334832', '5555555555')
          AND s.is_active = true
        ON CONFLICT (phone) DO UPDATE SET
          user_type = 'staff',
          onboarding_status = 'ACTIVATED',
          vendor_id = EXCLUDED.vendor_id,
          selected_role_id = EXCLUDED.selected_role_id,
          vendor_type = EXCLUDED.vendor_type,
          full_name = EXCLUDED.full_name,
          business_name = EXCLUDED.business_name,
          email = EXCLUDED.email,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING *
      `);

      console.log('[ADMIN] Created/updated vendor_identity records:', result.rows.length);

      // Step 3: Verify the fix
      const verify = await query(`
        SELECT 
          s.id as staff_id,
          s.name,
          s.phone,
          s.vendor_id,
          vi.id as vendor_identity_id,
          vi.user_type,
          vi.onboarding_status,
          vi.vendor_id as vi_vendor_id,
          vi.selected_role_id,
          r.name as role_name,
          vi.vendor_type,
          vi.business_name
        FROM staff s
        INNER JOIN vendor_identity vi ON s.phone = vi.phone
        LEFT JOIN roles r ON vi.selected_role_id = r.id
        WHERE s.phone IN ('8426334832', '5555555555')
        ORDER BY s.phone
      `);

      return c.json({
        success: true,
        message: 'Staff vendor_identity records fixed successfully',
        records_updated: result.rows.length,
        verification: verify.rows,
      });
    } catch (error: any) {
      console.error('[ADMIN] Error fixing staff vendor_identity:', error);
      return c.json({
        success: false,
        error: error.message,
        stack: error.stack
      }, 500);
    }
  });


  //UPDATE VENDOR PROFILE
  app.post('/admin/update-vendor-profile/:vendorId', async (c) => {
    // ✅ SECURITY FIX: Require admin authentication
    const authResult = await requireAdminAuth(c);
    if (!authResult.authorized) {
      return c.json({ error: authResult.error }, 401);
    }

    try {
      const {
        email,
        phone,
        business_name,
        owner_name,
        status,
        address
      } = await c.req.json();

      const vendorId = c.req.param("vendorId");

      if (!vendorId) {
        return c.json({ error: "vendorId is required" }, 400);
      }
      const fields: string[] = [];
      const values: any[] = [];
      let index = 1;

      // Note: 'name' field is not a column in vendors table
      // Use business_name or owner_name instead

      if (email !== undefined) {
        fields.push(`email = $${index++}`);
        values.push(email);
      }

      if (phone !== undefined) {
        fields.push(`phone = $${index++}`);
        values.push(phone);
      }

      if (business_name !== undefined) {
        fields.push(`business_name = $${index++}`);
        values.push(business_name);
      }

      if (owner_name !== undefined) {
        fields.push(`owner_name = $${index++}`);
        values.push(owner_name);
      }

      if (status !== undefined) {
        fields.push(`status = $${index++}`);
        values.push(status);
      }

      if (address !== undefined) {
        fields.push(`address = $${index++}`);
        values.push(address);
      }

      if (fields.length === 0) {
        return c.json({ message: "Nothing to update" }, 400);
      }

      fields.push(`updated_at = NOW()`);

      values.push(vendorId);

      const sql = `
        UPDATE vendors
        SET ${fields.join(", ")}
        WHERE id = $${index}
        RETURNING *;
      `;

      const result = await query(sql, values);


      return c.json({
        success: true,
        message: 'vendor updated successfully',
        records_updated: result.rows.length,
        verification: result.rows,
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error('[ADMIN] Error fixing staff vendor_identity:', error);
        return c.json({
          success: false,
          error: error.message,
          stack: error.stack
        }, 500);
      }
    }
  });
}

export function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
    requestContext: {
      requestId: randomUUID(),
    },
  };
}

export function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'admin-handler',
    functionVersion: '$LATEST',
  };
}

