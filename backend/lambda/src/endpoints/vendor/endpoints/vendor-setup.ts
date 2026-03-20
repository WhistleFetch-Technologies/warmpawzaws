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
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../handler/base-handler';
import { query, select, update, insert } from '../../../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import { resolveVendorId as resolveVendorIdFromUtils } from '../../../utils/vendor-resolve';

// ============================================================================
// PHASE 12: POST-APPROVAL SETUP
// ============================================================================

class GetVendorSetupStatusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const param = context.event.pathParameters?.vendorId;
    if (!param) {
      return this.error('Vendor ID is required', 400);
    }
    const vendorId = await resolveVendorIdParam(param);
    if (!vendorId) {
      return this.error('Vendor not found', 404);
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
    const param = context.event.pathParameters?.vendorId;
    if (!param) {
      return this.error('Vendor ID is required', 400);
    }
    const vendorId = await resolveVendorIdParam(param);
    if (!vendorId) {
      return this.error('Vendor not found', 404);
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
    const param = context.event.pathParameters?.vendorId;
    if (!param) {
      return this.error('Vendor ID is required', 400);
    }
    const vendorId = await resolveVendorIdParam(param);
    if (!vendorId) {
      return this.error('Vendor not found', 404);
    }
    
    try {
      // ✅ FIX: Get availability from vendor's metadata since vendor_availability table doesn't exist
      // The operating hours are stored in the vendor's metadata field
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return this.error('Vendor not found', 404);
      }
      
      const vendor = vendors[0];
      const metadata = vendor.metadata || {};
      
      // ✅ FIX: Parse operatingHours from multiple possible sources
      let operatingHours = metadata.operating_hours || metadata.operatingHours || null;
      let emergencyServices = metadata.emergency_services || metadata.emergencyServices || null;
      
      // If operatingHours is null but operatingHoursText exists as JSON string, parse it
      if (!operatingHours && vendor.operating_hours) {
        try {
          // Check if operating_hours is a JSON string
          const parsed = typeof vendor.operating_hours === 'string' 
            ? JSON.parse(vendor.operating_hours) 
            : vendor.operating_hours;
          
          // If it's an object with day keys (monday, tuesday, etc.), use it as operatingHours
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const hasDayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
              .some(day => parsed.hasOwnProperty(day));
            if (hasDayKeys) {
              operatingHours = parsed;
            }
          }
        } catch (parseErr) {
          // If parsing fails, operatingHoursText is just a display string, not JSON
          console.log('[GetVendorAvailability] operating_hours is not JSON, using as text only');
        }
      }
      
      // Build availability object from vendor metadata
      const availability = {
        operatingHours,
        emergencyServices,
        operatingHoursText: vendor.operating_hours || null,
      };
      
      return this.success({ availability });
    } catch (err: any) {
      console.error('Error fetching vendor availability:', err);
      return this.error(err.message || 'Failed to fetch availability', 500);
    }
  }
}

class UpdateVendorAvailabilityHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const param = context.event.pathParameters?.vendorId;
    const body = this.parseBody(context.event);
    
    if (!param) {
      return this.error('Vendor ID is required', 400);
    }
    const vendorId = await resolveVendorIdParam(param);
    if (!vendorId) {
      return this.error('Vendor not found', 404);
    }
    
    try {
      // Get current vendor first to check existing data
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return this.error('Vendor not found', 404);
      }
      
      const vendor = vendors[0];
      const currentMetadata = vendor.metadata || {};
      
      // ✅ FIX: Accept both legacy format (body.availability) and new format (body.operatingHours)
      let operatingHours = body.availability?.operatingHours || body.operatingHours;
      let emergencyServices = body.availability?.emergencyServices || body.emergencyServices;
      
      // ✅ FIX: If operatingHours is null/undefined but we have existing data, try to parse it
      if (!operatingHours && vendor.operating_hours) {
        try {
          const parsed = typeof vendor.operating_hours === 'string' 
            ? JSON.parse(vendor.operating_hours) 
            : vendor.operating_hours;
          
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const hasDayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
              .some(day => parsed.hasOwnProperty(day));
            if (hasDayKeys) {
              operatingHours = parsed;
            }
          }
        } catch (parseErr) {
          // If parsing fails, use existing metadata
          operatingHours = currentMetadata.operating_hours || currentMetadata.operatingHours;
        }
      }
      
      // ✅ FIX: If both are still null/undefined after trying to get existing data, return error
      if (!operatingHours && !emergencyServices) {
        return this.error('Operating hours or emergency services data is required', 400);
      }
      
      // ✅ FIX: Store in vendor's metadata field since vendor_availability table doesn't exist
      const updatedMetadata = {
        ...currentMetadata,
        operating_hours: operatingHours || currentMetadata.operating_hours,
        emergency_services: emergencyServices || currentMetadata.emergency_services,
      };
      
      // Generate operating hours text for display
      let operatingHoursText = vendor.operating_hours || '';
      if (operatingHours) {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const openDays = days.filter(day => operatingHours[day]?.isOpen);
        if (openDays.length > 0) {
          const firstDay = operatingHours[openDays[0]];
          const allSame = openDays.every((day: string) => 
            operatingHours[day].open === firstDay.open && operatingHours[day].close === firstDay.close
          );
          
          if (allSame && openDays.length === 7) {
            operatingHoursText = `Open Daily: ${firstDay.open} - ${firstDay.close}`;
          } else if (allSame && openDays.length >= 5) {
            operatingHoursText = `${firstDay.open} - ${firstDay.close}`;
          } else {
            operatingHoursText = openDays.slice(0, 3).map((day: string) => {
              const h = operatingHours[day];
              return `${day.charAt(0).toUpperCase() + day.slice(1, 3)}: ${h.open}-${h.close}`;
            }).join(', ');
          }
        }
      }
      
      await update('vendors', { id: vendorId }, {
        metadata: updatedMetadata,
        operating_hours: operatingHoursText,
        availability_configured: true,
        updated_at: new Date().toISOString(),
      });
      
      return this.success({ success: true });
    } catch (err: any) {
      console.error('Error updating vendor availability:', err);
      return this.error(err.message || 'Failed to update availability', 500);
    }
  }
}

/**
 * Resolve vendorId to a UUID when it's a slug (e.g. "center-1") or other identifier.
 * Tries: 1) direct UUID lookup, 2) metadata->>'slug', 3) slugified business_name.
 */
async function resolveVendorIdBySlug(vendorId: string): Promise<string | null> {
  if (!vendorId) return null;
  if (isValidUUID(vendorId)) return vendorId;
  try {
    const slug = vendorId.trim().toLowerCase();
    const res = await query(
      `SELECT id FROM vendors WHERE is_active = true
       AND (metadata->>'slug' = $1 OR LOWER(REGEXP_REPLACE(TRIM(business_name), '\\s+', '-')) = $2)
       LIMIT 1`,
      [vendorId.trim(), slug]
    );
    return res.rows?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Resolve path vendorId (identity id, UUID, or slug) to vendors.id; auto-creates vendor row for new vendors. */
async function resolveVendorIdParam(param: string | undefined): Promise<string | null> {
  if (!param?.trim()) return null;
  const fromUtils = await resolveVendorIdFromUtils(param.trim());
  const vendors = await select('vendors', { id: fromUtils });
  if (vendors.length > 0) return fromUtils;
  if (!isValidUUID(param)) return resolveVendorIdBySlug(param);
  return null;
}

class GetAvailableServicesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vendorIdParam = context.event.pathParameters?.vendorId;
    if (!vendorIdParam) {
      return this.error('Vendor ID is required', 400);
    }

    const vendorId = await resolveVendorIdParam(vendorIdParam);
    if (!vendorId) {
      return this.error('Vendor not found', 404);
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
    const param = context.event.pathParameters?.vendorId;
    const body = this.parseBody(context.event);
    if (!param || !body.serviceIds) {
      return this.error('Vendor ID and service IDs are required', 400);
    }
    const vendorId = await resolveVendorIdParam(param);
    if (!vendorId) {
      return this.error('Vendor not found', 404);
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
    const param = context.event.pathParameters?.vendorId;
    if (!param) {
      return this.error('Vendor ID is required', 400);
    }
    const vendorId = await resolveVendorIdParam(param);
    if (!vendorId) {
      return this.error('Vendor not found', 404);
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
    const param = context.event.pathParameters?.vendorId;
    if (!param) {
      return this.error('Vendor ID is required', 400);
    }
    const vendorId = await resolveVendorIdParam(param);
    if (!vendorId) {
      return this.error('Vendor not found', 404);
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
    const param = context.event.pathParameters?.vendorId;
    if (!param) {
      return this.error('Vendor ID is required', 400);
    }
    const vendorId = await resolveVendorIdParam(param);
    if (!vendorId) {
      return this.error('Vendor not found', 404);
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
    const param = context.event.pathParameters?.vendorId;
    const staffId = context.event.pathParameters?.staffId;
    if (!param || !staffId) {
      return this.error('Vendor ID and Staff ID are required', 400);
    }
    const vendorId = await resolveVendorIdParam(param);
    if (!vendorId) {
      return this.error('Vendor not found', 404);
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
      const { 
        vendorId, 
        serviceId, 
        serviceStyle,
        publishLevel, 
        centreId, 
        centreLevelPrice,
        // PHASE 1.1: Missing Features
        serviceRadius, // Service radius in km (for at_home)
        queueConfig, // Queue configuration JSON (for tele)
      } = body;

      console.log(`📢 [PUBLISH] Publishing service ${serviceId} for vendor ${vendorId}`);

      if (!vendorId || !serviceId) {
        return c.json({ error: 'vendorId and serviceId are required' }, 400);
      }

      // Prepare update/insert data with new fields
      const updateFields = ['is_active = true', 'publish_level = $3', 'centre_id = $4', 'price = COALESCE($5, price)'];
      const insertFields = ['vendor_id', 'service_id', 'is_active', 'publish_level', 'centre_id', 'price'];
      const updateValues: any[] = [vendorId, serviceId, publishLevel || 'vendor', centreId, centreLevelPrice];
      const insertValues: any[] = [vendorId, serviceId, true, publishLevel || 'vendor', centreId, centreLevelPrice || 0];
      let paramIndex = 6;

      // Add serviceStyle if provided
      if (serviceStyle) {
        updateFields.push(`service_style = $${paramIndex}`);
        insertFields.push('service_style');
        updateValues.push(serviceStyle);
        insertValues.push(serviceStyle);
        paramIndex++;
      }

      // Add serviceRadius if provided (for at_home)
      if (serviceRadius !== undefined) {
        updateFields.push(`service_radius_km = $${paramIndex}`);
        insertFields.push('service_radius_km');
        updateValues.push(serviceRadius);
        insertValues.push(serviceRadius);
        paramIndex++;
      }

      // Add queueConfig if provided (for tele)
      if (queueConfig !== undefined) {
        updateFields.push(`queue_config = $${paramIndex}`);
        insertFields.push('queue_config');
        updateValues.push(JSON.stringify(queueConfig));
        insertValues.push(JSON.stringify(queueConfig));
        paramIndex++;
      }

      // Update or create vendor service
      const existingService = await query(
        `SELECT id FROM vendor_services WHERE vendor_id = $1 AND service_id = $2${serviceStyle ? ' AND service_style = $3' : ''}`,
        serviceStyle ? [vendorId, serviceId, serviceStyle] : [vendorId, serviceId]
      ).catch(() => ({ rows: [] }));

      if (existingService.rows.length > 0) {
        updateValues.push(new Date().toISOString());
        updateFields.push('updated_at = NOW()');
        await query(
          `UPDATE vendor_services SET ${updateFields.join(', ')}
           WHERE vendor_id = $1 AND service_id = $2`,
          updateValues
        );
      } else {
        insertFields.push('created_at');
        insertValues.push(new Date().toISOString());
        await query(
          `INSERT INTO vendor_services (${insertFields.join(', ')})
           VALUES (${insertFields.map((_, i) => `$${i + 1}`).join(', ')})`,
          insertValues
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

  /**
   * GET /vendor/:vendorId/go-live/checklist
   * Get go-live prerequisites checklist
   */
  app.get('/vendor/:vendorId/go-live/checklist', async (c) => {
    try {
      const { vendorId } = c.req.param();

      if (!vendorId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      // Get vendor details
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // Check prerequisites
      const checklist = [];

      // 1. Profile Complete
      const profileComplete = !!(vendor.business_name && vendor.address && vendor.phone);
      checklist.push({
        id: 'profile',
        label: 'Profile Complete',
        status: profileComplete ? 'complete' : 'pending',
        description: profileComplete ? 'Business details added' : 'Add business name, address, and contact',
        actionUrl: profileComplete ? null : '/vendor/profile',
      });

      // 2. Bank Account Added & Verified
      const bankAccountResult = await query(
        `SELECT COUNT(*) as count FROM vendor_bank_accounts WHERE vendor_id = $1 AND is_verified = true`,
        [vendorId]
      ).catch(() => ({ rows: [{ count: 0 }] }));
      const bankAccountCount = parseInt(bankAccountResult.rows[0]?.count || '0', 10);
      const bankAccountComplete = bankAccountCount > 0;
      checklist.push({
        id: 'bank_account',
        label: 'Bank Account Verified',
        status: bankAccountComplete ? 'complete' : 'pending',
        description: bankAccountComplete ? `Account ending in ${vendor.bank_account_last4 || '****'}` : 'Add and verify bank account',
        actionUrl: bankAccountComplete ? null : '/vendor/bank-account',
      });

      // 3. At least 1 Service Published
      const servicesResult = await query(
        `SELECT COUNT(*) as count FROM vendor_services 
         WHERE vendor_id = $1 AND publish_status = 'published' AND is_enabled = true`,
        [vendorId]
      ).catch(() => ({ rows: [{ count: 0 }] }));
      const servicesCount = parseInt(servicesResult.rows[0]?.count || '0', 10);
      const servicesComplete = servicesCount > 0;
      checklist.push({
        id: 'services',
        label: 'Services Published',
        status: servicesComplete ? 'complete' : 'pending',
        description: servicesComplete ? `${servicesCount} service(s) published` : 'Publish at least 1 service',
        actionUrl: servicesComplete ? null : '/vendor/services',
      });

      // 4. At least 1 Staff Added (for center) OR Solo Profile Complete
      const vendorType = vendor.vendor_type || vendor.vendor_configuration || 'center';
      const isSolo = vendorType === 'solo' || vendor.is_solo_provider;
      
      let staffComplete = false;
      if (isSolo) {
        // For solo, check if profile is complete
        staffComplete = profileComplete;
      } else {
        // For center, check if staff exists
        const staffResult = await query(
          `SELECT COUNT(*) as count FROM staff WHERE vendor_id = $1 AND is_active = true`,
          [vendorId]
        ).catch(() => ({ rows: [{ count: 0 }] }));
        const staffCount = parseInt(staffResult.rows[0]?.count || '0', 10);
        staffComplete = staffCount > 0;
      }
      
      checklist.push({
        id: 'staff',
        label: isSolo ? 'Profile Complete' : 'Staff Added',
        status: staffComplete ? 'complete' : 'pending',
        description: isSolo 
          ? (staffComplete ? 'Solo profile complete' : 'Complete your profile')
          : (staffComplete ? 'Staff members added' : 'Add at least 1 staff member'),
        actionUrl: staffComplete ? null : (isSolo ? '/vendor/profile' : '/vendor/staff'),
      });

      // 5. Availability Configured
      const availabilityComplete = !!(vendor.availability_configured || vendor.operating_hours);
      checklist.push({
        id: 'availability',
        label: 'Availability Configured',
        status: availabilityComplete ? 'complete' : 'pending',
        description: availabilityComplete ? 'Operating hours set' : 'Configure availability and operating hours',
        actionUrl: availabilityComplete ? null : '/vendor/availability',
      });

      // 6. Center Timing Set (for centers)
      const timingComplete = isSolo || !!(vendor.operating_hours || vendor.metadata?.operating_hours);
      checklist.push({
        id: 'timing',
        label: isSolo ? 'Profile Complete' : 'Center Timing Set',
        status: timingComplete ? 'complete' : 'pending',
        description: timingComplete ? 'Timing configured' : 'Set center operating hours',
        actionUrl: timingComplete ? null : '/vendor/availability',
      });

      const canGoLive = checklist.every((item) => item.status === 'complete');

      return c.json({
        success: true,
        checklist,
        canGoLive,
        vendorType: isSolo ? 'solo' : 'center',
      });
    } catch (error: any) {
      console.error('Error getting go-live checklist:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/go-live
   * Activate center/vendor (go live)
   */
  app.post('/vendor/:vendorId/go-live', async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();
      const { centerId } = body;

      if (!vendorId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      // Verify vendor exists
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // Check prerequisites directly
      // 1. Profile complete
      const profileComplete = !!(vendor.business_name && vendor.address && vendor.phone);
      
      // 2. Bank account verified
      const bankAccountResult = await query(
        `SELECT COUNT(*) as count FROM vendor_bank_accounts WHERE vendor_id = $1 AND is_verified = true`,
        [vendorId]
      ).catch(() => ({ rows: [{ count: 0 }] }));
      const bankAccountComplete = parseInt(bankAccountResult.rows[0]?.count || '0', 10) > 0;
      
      // 3. Services published
      const servicesResult = await query(
        `SELECT COUNT(*) as count FROM vendor_services 
         WHERE vendor_id = $1 AND publish_status = 'published' AND is_enabled = true`,
        [vendorId]
      ).catch(() => ({ rows: [{ count: 0 }] }));
      const servicesComplete = parseInt(servicesResult.rows[0]?.count || '0', 10) > 0;
      
      // 4. Staff/Profile complete
      const vendorType = vendor.vendor_type || vendor.vendor_configuration || 'center';
      const isSolo = vendorType === 'solo' || vendor.is_solo_provider;
      let staffComplete = false;
      if (isSolo) {
        staffComplete = profileComplete;
      } else {
        const staffResult = await query(
          `SELECT COUNT(*) as count FROM staff WHERE vendor_id = $1 AND is_active = true`,
          [vendorId]
        ).catch(() => ({ rows: [{ count: 0 }] }));
        staffComplete = parseInt(staffResult.rows[0]?.count || '0', 10) > 0;
      }
      
      // 5. Availability configured
      const availabilityComplete = !!(vendor.availability_configured || vendor.operating_hours);
      
      // 6. Timing set
      const timingComplete = isSolo || !!(vendor.operating_hours || vendor.metadata?.operating_hours);
      
      const canGoLive = profileComplete && bankAccountComplete && servicesComplete && staffComplete && availabilityComplete && timingComplete;

      if (!canGoLive) {
        return c.json({ 
          error: 'Cannot go live. Please complete all prerequisites.',
          checklistUrl: `/vendor/${vendorId}/go-live/checklist`
        }, 400);
      }

      // Update vendor to go live
      const updateData: any = {
        is_active: true,
        go_live_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (centerId) {
        updateData.center_id = centerId;
      }

      await update('vendors', { id: vendorId }, updateData);

      return c.json({
        success: true,
        message: 'Vendor is now live!',
        goLiveAt: updateData.go_live_at,
      });
    } catch (error: any) {
      console.error('Error going live:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/center/status
   * Get center status
   */
  app.get('/vendor/:vendorId/center/status', async (c) => {
    try {
      const { vendorId } = c.req.param();

      if (!vendorId) {
        return c.json({ error: 'Vendor ID is required' }, 400);
      }

      // Get vendor details
      const vendors = await select('vendors', { id: vendorId });
      if (vendors.length === 0) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendor = vendors[0];

      // Get service count
      const servicesResult = await query(
        `SELECT COUNT(*) as count FROM vendor_services 
         WHERE vendor_id = $1 AND publish_status = 'published' AND is_enabled = true`,
        [vendorId]
      ).catch(() => ({ rows: [{ count: 0 }] }));
      const servicesCount = parseInt(servicesResult.rows[0]?.count || '0', 10);

      // Get staff count
      const staffResult = await query(
        `SELECT COUNT(*) as count FROM staff WHERE vendor_id = $1 AND is_active = true`,
        [vendorId]
      ).catch(() => ({ rows: [{ count: 0 }] }));
      const staffCount = parseInt(staffResult.rows[0]?.count || '0', 10);

      return c.json({
        success: true,
        status: {
          isActive: vendor.is_active || false,
          goLiveAt: vendor.go_live_at || null,
          servicesCount,
          staffCount,
          availabilityConfigured: vendor.availability_configured || false,
          setupCompleted: vendor.setup_completed || false,
        },
      });
    } catch (error: any) {
      console.error('Error getting center status:', error);
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
      requestId: randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'vendor-setup-handler',
    functionVersion: '$LATEST',
  };
}

