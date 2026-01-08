/**
 * ============================================================================
 * ADMIN ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Migrated from: supabase/functions/make-server-admin/admin-vendor-routes-sql.tsx
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
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, update, insert } from '../database/rds-connection';

// ============================================================================
// ADMIN HANDLERS
// ============================================================================

class VendorStatsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    // ✅ SQL: Get all vendors
    const vendors = await select('vendors', {});

    const activeVendors = vendors.filter(v => v.status === 'approved' && v.is_active);
    const pendingApplications = vendors.filter(v => 
      v.status === 'pending' || v.status === 'pending_approval'
    );
    const deactivatedVendors = vendors.filter(v => !v.is_active);
    const rejectedVendors = vendors.filter(v => v.status === 'rejected');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pendingToday = pendingApplications.filter(v => {
      if (!v.created_at) return false;
      const submittedDate = new Date(v.created_at);
      return submittedDate >= today;
    });

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
        count: pendingApplications.length,
        todayCount: pendingToday.length,
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
      const { publishVendorApproved } = await import('../utils/sns-client');
      await publishVendorApproved({
        vendorId,
        approvedAt: new Date().toISOString(),
        approvedBy: adminId,
      });
    } catch (error) {
      console.error('Failed to publish vendor approved event:', error);
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
    const status = context.event.queryStringParameters?.status;
    const limit = parseInt(context.event.queryStringParameters?.limit || '50', 10);
    const offset = parseInt(context.event.queryStringParameters?.offset || '0', 10);

    // ✅ SQL: Get vendors with filters
    let vendors;
    if (status) {
      vendors = await select('vendors', { status }, {
        limit,
        offset,
        orderBy: 'created_at',
        orderDirection: 'DESC',
      });
    } else {
      vendors = await select('vendors', {}, {
        limit,
        offset,
        orderBy: 'created_at',
        orderDirection: 'DESC',
      });
    }

    return this.success({
      vendors: vendors.map(v => ({
        id: v.id,
        businessName: v.business_name,
        ownerName: v.owner_name,
        phone: v.phone,
        email: v.email,
        status: v.status,
        tier: v.tier,
        createdAt: v.created_at,
      })),
      total: vendors.length,
    });
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

  app.get('/admin/vendors/stats', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await statsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/admin/vendors/:vendorId/approve', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await approveHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/admin/vendors/:vendorId/reject', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await rejectHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/admin/vendors', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await listHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Alias for /admin/vendors/all (frontend compatibility)
  app.get('/admin/vendors/all', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await listHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Frontend compatibility: /admin/vendor/application/:applicationId/approve
  app.post('/admin/vendor/application/:applicationId/approve', async (c) => {
    const applicationId = c.req.param('applicationId');
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: applicationId };
    const context = createLambdaContext();
    const result = await approveHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Frontend compatibility: /admin/vendor/application/:applicationId/reject
  app.post('/admin/vendor/application/:applicationId/reject', async (c) => {
    const applicationId = c.req.param('applicationId');
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: applicationId };
    const context = createLambdaContext();
    const result = await rejectHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Frontend compatibility: /admin/vendor/application/:applicationId/request-clarification
  app.post('/admin/vendor/application/:applicationId/request-clarification', async (c) => {
    // This endpoint can use the reject handler with a clarification reason
    const applicationId = c.req.param('applicationId');
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: applicationId };
    const context = createLambdaContext();
    const result = await rejectHandler.execute(event, context);
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
    functionName: 'admin-handler',
    functionVersion: '$LATEST',
  };
}

