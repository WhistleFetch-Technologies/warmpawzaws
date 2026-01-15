/**
 * ============================================================================
 * VENDOR DASHBOARD ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Migrated from: supabase/functions/make-server-vendor/vendor-dashboard-endpoints.tsx
 * 
 * Endpoints:
 * - GET /vendor/dashboard/:vendorId - Get comprehensive dashboard data
 * - GET /vendor/stats/:vendorId - Get statistics
 * - GET /vendor/bookings/:vendorId - Get vendor bookings
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// VENDOR DASHBOARD HANDLERS
// ============================================================================

class VendorDashboardHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    const timeframe = context.event.queryStringParameters?.timeframe || 'today';

    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }

    // ✅ SQL: Get vendor profile
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length === 0) {
      return this.error('Vendor not found', 404);
    }
    const vendor = vendors[0];

    // ✅ CRITICAL: Query DB directly for role and capabilities (no frontend dependency)
    let role = null;
    let capabilities: string[] = [];
    let roleConfig: any = {};
    
    if (vendor.role_id) {
      try {
        // Get role from DB
        const roles = await select('roles', { id: vendor.role_id });
        if (roles.length > 0) {
          role = roles[0];
          roleConfig = role.config || {};
          
          // Get capabilities from DB (batch query for efficiency)
          const roleIds = [vendor.role_id];
          const allPermissions = await query(
            `SELECT role_id, permission_name 
             FROM role_permissions 
             WHERE role_id = ANY($1::text[])`,
            [roleIds]
          ).catch(() => {
            // Fallback to individual query if array syntax fails
            return query(
              `SELECT role_id, permission_name 
               FROM role_permissions 
               WHERE role_id = $1`,
              [vendor.role_id]
            );
          });
          
          capabilities = allPermissions.rows.map((p: any) => p.permission_name);
        }
      } catch (roleError: any) {
        console.warn(`[Vendor Dashboard] Failed to load role ${vendor.role_id}:`, roleError.message);
        // Continue without role - dashboard still works with basic stats
      }
    }

    // ✅ SQL: Get bookings for vendor
    const bookings = await select('bookings', { vendor_id: vendorId });

    // Calculate stats
    const today = new Date().toISOString().split('T')[0];
    const todayBookings = bookings.filter(b => 
      b.booking_date === today && b.status !== 'cancelled'
    );
    const completedBookings = bookings.filter(b => b.status === 'completed');
    const pendingBookings = bookings.filter(b => 
      ['pending', 'confirmed'].includes(b.status)
    );

    // Calculate earnings
    const totalEarnings = completedBookings.reduce((sum, b) => 
      sum + (parseFloat(b.total_amount) || 0), 0
    );
    const pendingEarnings = pendingBookings.reduce((sum, b) => 
      sum + (parseFloat(b.total_amount) || 0), 0
    );

    // ✅ SQL: Get reviews
    const reviews = await select('reviews', { vendor_id: vendorId });
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
      : 0;

    return this.success({
      vendor: {
        id: vendor.id,
        businessName: vendor.business_name,
        ownerName: vendor.owner_name,
        status: vendor.status,
        tier: vendor.tier,
        role_id: vendor.role_id,
        vendor_type: vendor.vendor_type,
        // Include role info directly in response
        role: role ? {
          id: role.id,
          name: role.name,
          display_name: role.display_name,
          description: role.description,
          config: roleConfig,
        } : null,
        capabilities, // Include capabilities directly
        vendorTypes: roleConfig?.vendorTypes || [],
        serviceStyles: roleConfig?.serviceStyles || [],
      },
      stats: {
        appointments: todayBookings.length,
        consultations: bookings.filter(b => b.service_type === 'tele').length,
        earnings: totalEarnings,
        pendingEarnings: pendingEarnings,
        completedServices: completedBookings.length,
        rating: avgRating,
        totalReviews: reviews.length,
      },
      bookings: bookings.slice(0, 10), // Latest 10 bookings
      timeframe,
    });
  }
}

class VendorStatsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    const startDate = context.event.queryStringParameters?.startDate;
    const endDate = context.event.queryStringParameters?.endDate;

    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }

    // ✅ SQL: Get bookings in date range
    let bookingsQuery = `SELECT * FROM bookings WHERE vendor_id = $1`;
    const params: any[] = [vendorId];

    if (startDate && endDate) {
      bookingsQuery += ` AND booking_date BETWEEN $2 AND $3`;
      params.push(startDate, endDate);
    }

    const { rows: bookings } = await query(bookingsQuery, params);

    // Calculate statistics
    const stats = {
      totalBookings: bookings.length,
      completed: bookings.filter(b => b.status === 'completed').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
      totalRevenue: bookings
        .filter(b => b.status === 'completed')
        .reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0),
      averageBookingValue: bookings.length > 0
        ? bookings.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0) / bookings.length
        : 0,
    };

    return this.success(stats);
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerVendorDashboardEndpoints(app: Hono) {
  const dashboardHandler = new VendorDashboardHandler();
  const statsHandler = new VendorStatsHandler();
  
  // ============================================================================
  // CONVENIENCE ROUTES (auth-context based)
  // ============================================================================
  
  /**
   * GET /vendor/dashboard
   * Get dashboard for authenticated vendor (no ID required)
   */
  app.get('/vendor/dashboard', async (c) => {
    const vendorId = c.req.header('X-Vendor-Id') || c.get('vendorId') || c.get('userId');
    
    if (!vendorId) {
      return c.json({ error: 'Vendor authentication required' }, 401);
    }
    
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId };
    const context = createLambdaContext();
    const result = await dashboardHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
  
  /**
   * GET /vendor/services
   * Get services for authenticated vendor
   */
  app.get('/vendor/services', async (c) => {
    const vendorId = c.req.header('X-Vendor-Id') || c.get('vendorId') || c.get('userId');
    
    if (!vendorId) {
      return c.json({ error: 'Vendor authentication required' }, 401);
    }
    
    try {
      const services = await select('services', { vendor_id: vendorId });
      return c.json({
        success: true,
        count: services.length,
        services: services,
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });
  
  /**
   * GET /vendor/staff
   * Get staff for authenticated vendor
   */
  app.get('/vendor/staff', async (c) => {
    const vendorId = c.req.header('X-Vendor-Id') || c.get('vendorId') || c.get('userId');
    
    if (!vendorId) {
      return c.json({ error: 'Vendor authentication required' }, 401);
    }
    
    try {
      const staff = await select('staff', { vendor_id: vendorId, is_active: true });
      return c.json({
        success: true,
        count: staff.length,
        staff: staff,
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });
  
  // ============================================================================
  // ORIGINAL ROUTES (with explicit vendorId)
  // ============================================================================
  
  app.get('/vendor/dashboard/:vendorId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await dashboardHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/vendor/stats/:vendorId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await statsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
    requestContext: {
      requestId: crypto.randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: crypto.randomUUID(),
    functionName: 'vendor-dashboard-handler',
    functionVersion: '$LATEST',
  };
}

