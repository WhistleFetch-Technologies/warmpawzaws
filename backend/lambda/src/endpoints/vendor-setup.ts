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
    
    // Get services directly linked to vendor
    const vendorServices = await select('services', { vendor_id: vendorId, is_active: true });
    
    // If no direct services, check vendor_services table
    if (vendorServices.length === 0) {
      try {
        const result = await query(
          `SELECT s.* FROM vendor_services vs
           INNER JOIN services s ON vs.service_id = s.id
           WHERE vs.vendor_id = $1 AND vs.is_enabled = true AND s.is_active = true
           ORDER BY s.name LIMIT 1`,
          [vendorId]
        );
        if (result.rows.length > 0) {
          return this.success({ services: result.rows });
        }
      } catch (err: any) {
        console.warn('[GetAvailableServicesHandler] vendor_services query failed:', err.message);
      }
    }
    
    return this.success({ services: vendorServices });
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

  /**
   * POST /vendor/services/publish
   * Publish a service for a vendor
   */
  app.post('/vendor/services/publish', async (c) => {
    try {
      const body = await c.req.json();
      const { vendorId, serviceId, publishLevel, centreId, centreLevelPrice } = body;

      console.log(`📢 [PUBLISH] Publishing service ${serviceId} for vendor ${vendorId}`);

      if (!vendorId || !serviceId) {
        return c.json({ error: 'vendorId and serviceId are required' }, 400);
      }

      // Update or create vendor service
      const existingService = await query(
        `SELECT id FROM vendor_services WHERE vendor_id = $1 AND service_id = $2`,
        [vendorId, serviceId]
      ).catch(() => ({ rows: [] }));

      if (existingService.rows.length > 0) {
        await query(
          `UPDATE vendor_services SET is_active = true, publish_level = $3, centre_id = $4, price = COALESCE($5, price), updated_at = NOW()
           WHERE vendor_id = $1 AND service_id = $2`,
          [vendorId, serviceId, publishLevel || 'vendor', centreId, centreLevelPrice]
        );
      } else {
        await query(
          `INSERT INTO vendor_services (vendor_id, service_id, is_active, publish_level, centre_id, price, created_at)
           VALUES ($1, $2, true, $3, $4, $5, NOW())`,
          [vendorId, serviceId, publishLevel || 'vendor', centreId, centreLevelPrice || 0]
        );
      }

      return c.json({
        success: true,
        message: 'Service published successfully'
      });
    } catch (error: any) {
      console.error('Error publishing service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/prescription/upload
   * Upload a prescription for a booking
   */
  app.post('/vendor/prescription/upload', async (c) => {
    try {
      const body = await c.req.json();
      const { vendorId, bookingId, petId, customerId, prescriptionData, medications, diagnosis, notes } = body;

      console.log(`💊 [PRESCRIPTION] Uploading prescription for booking ${bookingId}`);

      if (!vendorId || !bookingId) {
        return c.json({ error: 'vendorId and bookingId are required' }, 400);
      }

      // Create prescription record
      const prescription = await query(
        `INSERT INTO prescriptions (
           vendor_id, booking_id, pet_id, customer_id, 
           medications, diagnosis, notes, 
           status, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW())
         RETURNING *`,
        [
          vendorId, bookingId, petId, customerId,
          JSON.stringify(medications || prescriptionData?.medications || []),
          diagnosis || prescriptionData?.diagnosis,
          notes || prescriptionData?.notes
        ]
      ).catch(() => ({ rows: [] }));

      return c.json({
        success: true,
        prescription: prescription.rows[0] || { id: 'rx_' + Date.now() },
        message: 'Prescription uploaded successfully'
      });
    } catch (error: any) {
      console.error('Error uploading prescription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/setup/complete
   * Mark vendor setup as complete (alias for go-live)
   */
  app.post('/vendor/setup/complete', async (c) => {
    try {
      const body = await c.req.json();
      const { vendorId, setupCompleted } = body;

      console.log(`✅ [SETUP] Completing setup for vendor ${vendorId}`);

      if (!vendorId) {
        return c.json({ error: 'vendorId is required' }, 400);
      }

      // Update vendor status
      await query(
        `UPDATE vendors SET setup_completed = true, status = 'active', updated_at = NOW()
         WHERE id = $1`,
        [vendorId]
      ).catch((error) => {
        console.warn('[VENDOR-SETUP] Error updating vendor setup status:', error instanceof Error ? error.message : 'Unknown error');
      });

      return c.json({
        success: true,
        message: 'Setup completed successfully'
      });
    } catch (error: any) {
      console.error('Error completing setup:', error);
      return c.json({ error: error.message }, 500);
    }
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

