/**
 * ============================================================================
 * VENDOR SETUP ENDPOINTS - PHASES 12-13
 * ============================================================================
 * 
 * Endpoints for:
 * - Phase 12: Post-Approval Setup
 * - Phase 13: Dashboard & Landing
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, update, insert } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// PHASE 12: POST-APPROVAL SETUP
// ============================================================================

class GetVendorSetupStatusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length === 0) {
      return this.error('Vendor not found', 404);
    }
    const vendor = vendors[0];
    return this.success({
      setupStatus: {
        servicesConfigured: vendor.services_configured || false,
        availabilityConfigured: vendor.availability_configured || false,
        setupCompleted: vendor.setup_completed || false,
        setupStage: vendor.setup_stage || 'services_pending',
      },
    });
  }
}

class CompleteVendorSetupHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }
    await update('vendors', { id: vendorId }, {
      setup_completed: true,
      setup_stage: 'completed',
      updated_at: new Date().toISOString(),
    });
    return this.success({ success: true });
  }
}

class GetVendorAvailabilityHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }
    const availability = await select('vendor_availability', { vendor_id: vendorId });
    return this.success({ availability: availability[0] || null });
  }
}

class UpdateVendorAvailabilityHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    const body = this.parseBody(context.event);
    if (!vendorId || !body.availability) {
      return this.error('Vendor ID and availability are required', 400);
    }
    const existing = await select('vendor_availability', { vendor_id: vendorId });
    if (existing.length > 0) {
      await update('vendor_availability', { vendor_id: vendorId }, body.availability);
    } else {
      await insert('vendor_availability', {
        ...body.availability,
        vendor_id: vendorId,
        created_at: new Date().toISOString(),
      });
    }
    await update('vendors', { id: vendorId }, {
      availability_configured: true,
      updated_at: new Date().toISOString(),
    });
    return this.success({ success: true });
  }
}

class GetAvailableServicesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length === 0) {
      return this.error('Vendor not found', 404);
    }
    const vendor = vendors[0];
    const roleId = vendor.role_id;
    const services = await select('services', { role_id: roleId, is_active: true });
    return this.success({ services });
  }
}

class SelectVendorServicesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    const body = this.parseBody(context.event);
    if (!vendorId || !body.serviceIds) {
      return this.error('Vendor ID and service IDs are required', 400);
    }
    // Store selected services
    for (const serviceId of body.serviceIds) {
      await insert('vendor_services', {
        vendor_id: vendorId,
        service_id: serviceId,
        is_active: true,
        created_at: new Date().toISOString(),
      });
    }
    await update('vendors', { id: vendorId }, {
      services_configured: true,
      setup_stage: 'availability_pending',
      updated_at: new Date().toISOString(),
    });
    return this.success({ success: true });
  }
}

class GetServiceConfigsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const serviceIds = context.event.queryStringParameters?.serviceIds;
    if (!serviceIds) {
      return this.error('Service IDs are required', 400);
    }
    const ids = serviceIds.split(',');
    // Use query for IN clause
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
    const result = await query(
      `SELECT * FROM service_configs WHERE service_id IN (${placeholders})`,
      ids
    );
    return this.success({ services: result.rows });
  }
}

class ConfigureVendorServicesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    if (!body.vendorId || !body.configurations) {
      return this.error('Vendor ID and configurations are required', 400);
    }
    for (const config of body.configurations) {
      await update('service_configs', { service_id: config.serviceId }, config);
    }
    return this.success({ success: true });
  }
}

// ============================================================================
// PHASE 13: DASHBOARD & LANDING
// ============================================================================

class GetVendorStatusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length === 0) {
      return this.error('Vendor not found', 404);
    }
    const vendor = vendors[0];
    return this.success({ vendor });
  }
}

class GetSoloProviderInfoHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length === 0) {
      return this.error('Vendor not found', 404);
    }
    const vendor = vendors[0];
    const centers = await select('centers', { vendor_id: vendorId });
    const staff = await select('staff', { vendor_id: vendorId });
    return this.success({
      vendor,
      center: centers[0] || null,
      staff: staff[0] || null,
    });
  }
}

class GetCenterStatsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    if (!vendorId) {
      return this.error('Vendor ID is required', 400);
    }
    const today = new Date().toISOString().split('T')[0];
    const bookings = await select('bookings', {
      vendor_id: vendorId,
      booking_date: today,
    });
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    return this.success({
      stats: {
        todayBookings: bookings.length,
        todayRevenue: totalRevenue,
      },
    });
  }
}

class GetStaffStatsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorId = context.event.pathParameters?.vendorId;
    const staffId = context.event.pathParameters?.staffId;
    if (!vendorId || !staffId) {
      return this.error('Vendor ID and Staff ID are required', 400);
    }
    const bookings = await select('bookings', {
      vendor_id: vendorId,
      staff_id: staffId,
    });
    const completed = bookings.filter(b => b.status === 'completed').length;
    return this.success({
      stats: {
        appointments: bookings.length,
        completed,
      },
    });
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerVendorSetupEndpoints(app: Hono) {
  // Phase 12: Post-Approval Setup
  app.get('/vendor/:vendorId/setup-status', async (c) => {
    const handler = new GetVendorSetupStatusHandler();
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await handler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/vendor/:vendorId/setup/complete', async (c) => {
    const handler = new CompleteVendorSetupHandler();
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await handler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/vendor/:vendorId/availability', async (c) => {
    const handler = new GetVendorAvailabilityHandler();
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await handler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.put('/vendor/:vendorId/availability', async (c) => {
    const handler = new UpdateVendorAvailabilityHandler();
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await handler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/vendor/:vendorId/services/available', async (c) => {
    const handler = new GetAvailableServicesHandler();
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await handler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/vendor/:vendorId/services/select', async (c) => {
    const handler = new SelectVendorServicesHandler();
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await handler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/vendor/services/config', async (c) => {
    const handler = new GetServiceConfigsHandler();
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await handler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/vendor/services/configure', async (c) => {
    const handler = new ConfigureVendorServicesHandler();
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await handler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Phase 13: Dashboard & Landing
  app.get('/vendor/status/:vendorId', async (c) => {
    const handler = new GetVendorStatusHandler();
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await handler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/vendor/:vendorId/solo-info', async (c) => {
    const handler = new GetSoloProviderInfoHandler();
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await handler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/vendor/:vendorId/center/stats', async (c) => {
    const handler = new GetCenterStatsHandler();
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { vendorId: c.req.param('vendorId') };
    const context = createLambdaContext();
    const result = await handler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/vendor/:vendorId/staff/:staffId/stats', async (c) => {
    const handler = new GetStaffStatsHandler();
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = {
      vendorId: c.req.param('vendorId'),
      staffId: c.req.param('staffId'),
    };
    const context = createLambdaContext();
    const result = await handler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

// Helper functions
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
    functionName: 'vendor-setup-handler',
    functionVersion: '$LATEST',
  };
}

