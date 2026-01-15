/**
 * ============================================================================
 * ADMIN GOVERNANCE ENHANCED - CAPABILITY REFRESH & SYNC SYSTEMS
 * ============================================================================
 * 
 * Enhanced admin governance features:
 * - Capability refresh system (auto-refresh vendor capabilities)
 * - Service catalog sync (sync service catalog across platform)
 * - Tier & commission auto-application
 * - Tax rules engine
 * - Banner management
 * 
 * Date: 2026-01-27
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update, deleteRows } from '../database/rds-connection';
import { publishToSNS } from '../utils/aws-clients';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// CAPABILITY REFRESH SYSTEM
// ============================================================================

class RefreshCapabilitiesHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { vendorId, forceRefresh = false } = body;

    try {
      if (vendorId) {
        // Refresh capabilities for specific vendor
        await this.refreshVendorCapabilities(vendorId, forceRefresh);
        return this.success({
          message: `Capabilities refreshed for vendor ${vendorId}`,
          vendorId,
        });
      } else {
        // Refresh capabilities for all vendors
        const vendors = await select('vendors', { status: 'active' });
        const results = [];

        for (const vendor of vendors) {
          try {
            await this.refreshVendorCapabilities(vendor.id, forceRefresh);
            results.push({ vendorId: vendor.id, status: 'success' });
          } catch (error: any) {
            results.push({ vendorId: vendor.id, status: 'error', error: error.message });
          }
        }

        return this.success({
          message: `Capabilities refreshed for ${results.length} vendors`,
          results,
        });
      }
    } catch (error: any) {
      console.error('Error refreshing capabilities:', error);
      return this.error(`Capability refresh failed: ${error.message}`, 500);
    }
  }

  private async refreshVendorCapabilities(vendorId: string, forceRefresh: boolean) {
    // Get vendor's current role
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length === 0) {
      throw new Error('Vendor not found');
    }

    const vendor = vendors[0];
    const roleId = vendor.role_id;

    if (!roleId) {
      throw new Error('Vendor has no role assigned');
    }

    // Get role capabilities
    const roles = await select('roles', { id: roleId });
    if (roles.length === 0) {
      throw new Error('Role not found');
    }

    const role = roles[0];
    const capabilities = role.capabilities || [];

    // Update vendor capabilities
    await update('vendors', { id: vendorId }, {
      capabilities: capabilities,
      capabilities_refreshed_at: new Date(),
      updated_at: new Date(),
    });

    // Publish capability refresh event
    await publishToSNS('vendor-capability-refresh', {
      vendorId,
      roleId,
      capabilities,
      refreshedAt: new Date().toISOString(),
    });
  }
}

// ============================================================================
// SERVICE CATALOG SYNC
// ============================================================================

class SyncServiceCatalogHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { vendorId, serviceId, syncType = 'full' } = body;

    try {
      if (syncType === 'full') {
        // Full catalog sync - update all services
        await this.syncFullCatalog();
        return this.success({
          message: 'Service catalog synced successfully',
          syncType: 'full',
        });
      } else if (vendorId) {
        // Sync services for specific vendor
        await this.syncVendorServices(vendorId);
        return this.success({
          message: `Services synced for vendor ${vendorId}`,
          vendorId,
        });
      } else if (serviceId) {
        // Sync specific service
        await this.syncService(serviceId);
        return this.success({
          message: `Service ${serviceId} synced successfully`,
          serviceId,
        });
      } else {
        return this.error('vendorId or serviceId required for partial sync', 400);
      }
    } catch (error: any) {
      console.error('Error syncing service catalog:', error);
      return this.error(`Service catalog sync failed: ${error.message}`, 500);
    }
  }

  private async syncFullCatalog() {
    // Get all active services
    const services = await query(`
      SELECT s.*, v.status as vendor_status
      FROM services s
      JOIN vendors v ON s.vendor_id = v.id
      WHERE v.status = 'active' AND s.is_active = true
    `);

    const rows = Array.isArray(services) ? services : (services as any).rows || [];

    // Update service catalog cache/metadata
    for (const service of rows) {
      await this.updateServiceCatalogEntry(service);
    }

    // Publish catalog sync event
    await publishToSNS('service-catalog-sync', {
      syncType: 'full',
      servicesCount: rows.length,
      syncedAt: new Date().toISOString(),
    });
  }

  private async syncVendorServices(vendorId: string) {
    const services = await select('services', { vendor_id: vendorId, is_active: true });
    
    for (const service of services) {
      await this.updateServiceCatalogEntry(service);
    }

    await publishToSNS('service-catalog-sync', {
      syncType: 'vendor',
      vendorId,
      servicesCount: services.length,
      syncedAt: new Date().toISOString(),
    });
  }

  private async syncService(serviceId: string) {
    const services = await select('services', { id: serviceId });
    if (services.length > 0) {
      await this.updateServiceCatalogEntry(services[0]);
    }
  }

  private async updateServiceCatalogEntry(service: any) {
    // Update service metadata with latest info
    const metadata = {
      ...(service.metadata || {}),
      lastSynced: new Date().toISOString(),
      catalogVersion: Date.now(),
    };

    await update('services', { id: service.id }, {
      metadata,
      updated_at: new Date(),
    });
  }
}

// ============================================================================
// TIER & COMMISSION AUTO-APPLICATION
// ============================================================================

class ApplyTierCommissionsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { vendorId, recalculateAll = false } = body;

    try {
      if (recalculateAll) {
        // Recalculate commissions for all vendors
        const vendors = await select('vendors', { status: 'active' });
        const results = [];

        for (const vendor of vendors) {
          try {
            await this.applyTierCommission(vendor.id);
            results.push({ vendorId: vendor.id, status: 'success' });
          } catch (error: any) {
            results.push({ vendorId: vendor.id, status: 'error', error: error.message });
          }
        }

        return this.success({
          message: `Tier commissions applied to ${results.length} vendors`,
          results,
        });
      } else if (vendorId) {
        await this.applyTierCommission(vendorId);
        return this.success({
          message: `Tier commission applied for vendor ${vendorId}`,
          vendorId,
        });
      } else {
        return this.error('vendorId required or set recalculateAll=true', 400);
      }
    } catch (error: any) {
      console.error('Error applying tier commissions:', error);
      return this.error(`Tier commission application failed: ${error.message}`, 500);
    }
  }

  private async applyTierCommission(vendorId: string) {
    const vendors = await select('vendors', { id: vendorId });
    if (vendors.length === 0) {
      throw new Error('Vendor not found');
    }

    const vendor = vendors[0];
    const tier = vendor.tier || 'Bronze';

    // Get tier configuration
    const tierConfig = await query(`
      SELECT * FROM tiers WHERE name = $1
    `, [tier]);

    const tierRows = Array.isArray(tierConfig) ? tierConfig : (tierConfig as any).rows || [];
    const tierData = tierRows[0];

    if (tierData) {
      // Update vendor with tier commission
      await update('vendors', { id: vendorId }, {
        commission_percentage: tierData.commission_rate || tierData.commission_percentage,
        tier: tier,
        tier_applied_at: new Date(),
        updated_at: new Date(),
      });

      // Publish tier application event
      await publishToSNS('tier-commission-applied', {
        vendorId,
        tier,
        commissionRate: tierData.commission_rate || tierData.commission_percentage,
        appliedAt: new Date().toISOString(),
      });
    }
  }
}

// ============================================================================
// TAX RULES ENGINE
// ============================================================================

class CalculateTaxHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const { amount, serviceType, vendorId, location } = body;

    this.validateRequired(body, ['amount']);

    try {
      const taxRules = await this.getTaxRules(serviceType, location);
      const taxCalculation = this.calculateTax(amount, taxRules);

      return this.success({
        amount,
        taxRules,
        taxCalculation,
        totalAmount: amount + taxCalculation.totalTax,
      });
    } catch (error: any) {
      console.error('Error calculating tax:', error);
      return this.error(`Tax calculation failed: ${error.message}`, 500);
    }
  }

  private async getTaxRules(serviceType?: string, location?: any) {
    // Get applicable tax rules
    let queryStr = `
      SELECT * FROM gst_rules
      WHERE enabled = true
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (serviceType) {
      queryStr += ` AND (applicable_services IS NULL OR $${paramIndex} = ANY(applicable_services))`;
      params.push(serviceType);
      paramIndex++;
    }

    if (location?.state) {
      queryStr += ` AND (applicable_states IS NULL OR $${paramIndex} = ANY(applicable_states))`;
      params.push(location.state);
      paramIndex++;
    }

    queryStr += ` ORDER BY priority DESC LIMIT 1`;

    const result = await query(queryStr, params);
    const rows = Array.isArray(result) ? result : (result as any).rows || [];

    if (rows.length > 0) {
      return rows[0];
    }

    // Default tax rule (GST 18%)
    return {
      gst_rate: 18,
      cgst_rate: 9,
      sgst_rate: 9,
      igst_rate: 18,
    };
  }

  private calculateTax(amount: number, taxRules: any) {
    const gstRate = parseFloat(taxRules.gst_rate || '18');
    const cgstRate = parseFloat(taxRules.cgst_rate || (gstRate / 2));
    const sgstRate = parseFloat(taxRules.sgst_rate || (gstRate / 2));
    const igstRate = parseFloat(taxRules.igst_rate || gstRate);

    // For now, use IGST (interstate) - can be enhanced based on location
    const taxAmount = (amount * igstRate) / 100;

    return {
      baseAmount: amount,
      gstRate,
      cgstRate,
      sgstRate,
      igstRate,
      taxAmount,
      cgst: (amount * cgstRate) / 100,
      sgst: (amount * sgstRate) / 100,
      igst: taxAmount,
      totalTax: taxAmount,
    };
  }
}

// ============================================================================
// BANNER MANAGEMENT
// ============================================================================

class GetBannersHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const queryParams = context.event.queryStringParameters || {};
    const { position, isActive } = queryParams;

    try {
      let queryStr = 'SELECT * FROM banners WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (position) {
        // Check if position is a valid banner type, otherwise use it as-is
        queryStr += ` AND type = $${paramIndex}::text`;
        params.push(position);
        paramIndex++;
      }

      if (isActive !== undefined) {
        queryStr += ` AND is_active = $${paramIndex}`;
        params.push(isActive === 'true');
        paramIndex++;
      }

      queryStr += ` ORDER BY display_order ASC, created_at DESC`;

      const result = await query(queryStr, params);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];

      return this.success({ banners: rows, total: rows.length });
    } catch (error: any) {
      console.error('Error fetching banners:', error);
      // If table doesn't exist, return empty array instead of error
      if (error.message && (error.message.includes('does not exist') || error.message.includes('operator does not exist'))) {
        console.warn('⚠️ banners table does not exist or has schema issue - returning empty array');
        return this.success({ banners: [], total: 0, message: 'Banners table not initialized. Run migrations first.' });
      }
      // For 503/timeout errors, return empty array gracefully
      if (error.message && (error.message.includes('timeout') || error.message.includes('connection'))) {
        console.warn('⚠️ Database connection issue - returning empty array');
        return this.success({ banners: [], total: 0, message: 'Database connection issue. Please try again later.' });
      }
      return this.error(`Failed to fetch banners: ${error.message}`, 500);
    }
  }
}

class CreateBannerHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const {
      title,
      description,
      imageUrl,
      linkUrl,
      position,
      priority = 0,
      startDate,
      endDate,
      isActive = true,
    } = body;

    this.validateRequired(body, ['title', 'imageUrl', 'position']);

    try {
      const banner = await insert('banners', {
        title,
        description,
        image_url: imageUrl,
        link_url: linkUrl,
        position,
        priority,
        start_date: startDate ? new Date(startDate) : new Date(),
        end_date: endDate ? new Date(endDate) : null,
        is_active: isActive,
      });

      // Publish banner change event
      await publishToSNS('banner-change', {
        action: 'create',
        bannerId: banner[0].id,
        position,
      });

      return this.success({
        banner: banner[0],
        message: 'Banner created successfully',
      });
    } catch (error: any) {
      console.error('Error creating banner:', error);
      return this.error(`Failed to create banner: ${error.message}`, 500);
    }
  }
}

class UpdateBannerHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bannerId = context.event.pathParameters?.id;
    if (!bannerId) {
      return this.error('Banner ID is required', 400);
    }

    const body = this.parseBody(context.event);
    const {
      title,
      description,
      imageUrl,
      linkUrl,
      position,
      priority,
      startDate,
      endDate,
      isActive,
      ctaText,
    } = body;

    try {
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (imageUrl !== undefined) updateData.image_url = imageUrl;
      if (linkUrl !== undefined) updateData.link_url = linkUrl;
      if (position !== undefined) updateData.position = position;
      if (priority !== undefined) updateData.priority = priority;
      if (startDate !== undefined) updateData.start_date = startDate ? new Date(startDate) : null;
      if (endDate !== undefined) updateData.end_date = endDate ? new Date(endDate) : null;
      if (isActive !== undefined) updateData.is_active = isActive;
      if (ctaText !== undefined) updateData.cta_text = ctaText;
      updateData.updated_at = new Date().toISOString();

      await update('banners', { id: bannerId }, updateData);

      // Publish banner change event
      await publishToSNS('banner-change', {
        action: 'update',
        bannerId,
        position: position || undefined,
      });

      // Use explicit UUID casting in query to avoid "uuid = text" errors
      const updated = await query(
        'SELECT * FROM banners WHERE id = $1::uuid',
        [bannerId]
      );
      const rows = Array.isArray(updated) ? updated : (updated as any).rows || [];
      return this.success({
        banner: rows[0],
        message: 'Banner updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating banner:', error);
      return this.error(`Failed to update banner: ${error.message}`, 500);
    }
  }
}

class DeleteBannerHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bannerId = context.event.pathParameters?.id;
    if (!bannerId) {
      return this.error('Banner ID is required', 400);
    }

    try {
      const banner = await select('banners', { id: bannerId });
      if (banner.length === 0) {
        return this.error('Banner not found', 404);
      }

      await deleteRows('banners', { id: bannerId });

      // Publish banner change event
      await publishToSNS('banner-change', {
        action: 'delete',
        bannerId,
        position: banner[0].position || banner[0].type,
      });

      return this.success({
        message: 'Banner deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting banner:', error);
      return this.error(`Failed to delete banner: ${error.message}`, 500);
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerAdminGovernanceEnhancedEndpoints(app: Hono) {
  const refreshCapabilitiesHandler = new RefreshCapabilitiesHandler();
  const syncCatalogHandler = new SyncServiceCatalogHandler();
  const applyTierHandler = new ApplyTierCommissionsHandler();
  const calculateTaxHandler = new CalculateTaxHandler();
  const getBannersHandler = new GetBannersHandler();
  const createBannerHandler = new CreateBannerHandler();
  const updateBannerHandler = new UpdateBannerHandler();
  const deleteBannerHandler = new DeleteBannerHandler();

  // Capability refresh
  app.post('/admin/capabilities/refresh', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await refreshCapabilitiesHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Service catalog sync
  app.post('/admin/service-catalog/sync', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await syncCatalogHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Tier & commission application
  app.post('/admin/tiers/apply-commissions', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await applyTierHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Tax calculation (enhanced with tax calculation service)
  app.post('/admin/tax/calculate', async (c) => {
    try {
      const body = await c.req.json();
      const { amount, gstRate, cgstRate, sgstRate, igstRate } = body;
      
      if (!amount || !gstRate) {
        return c.json({ error: 'amount and gstRate are required' }, 400);
      }

      // Simple tax calculation
      const baseAmount = parseFloat(amount);
      const gst = (baseAmount * parseFloat(gstRate)) / 100;
      const total = baseAmount + gst;

      // Calculate CGST/SGST or IGST based on rates provided
      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (cgstRate && sgstRate) {
        cgst = (baseAmount * parseFloat(cgstRate)) / 100;
        sgst = (baseAmount * parseFloat(sgstRate)) / 100;
      } else if (igstRate) {
        igst = (baseAmount * parseFloat(igstRate)) / 100;
      }

      return c.json({
        success: true,
        taxCalculation: {
          baseAmount,
          gst,
          cgst,
          sgst,
          igst,
          total,
        },
      });
    } catch (error: any) {
      console.error('Error calculating tax:', error);
      return c.json({ error: error.message || 'Failed to calculate tax' }, 500);
    }
  });

  // Banner management
  app.get('/admin/banners', async (c) => {
    try {
      const event = createApiGatewayEvent(c.req);
      event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
      const context = createLambdaContext();
      const result = await getBannersHandler.execute(event, context);
      return c.json(JSON.parse(result.body), result.statusCode);
    } catch (error: any) {
      // If table doesn't exist, return empty array instead of error (for graceful degradation)
      if (error.message && error.message.includes('does not exist')) {
        console.warn('⚠️ banners table does not exist - returning empty array');
        return c.json({ success: true, banners: [], total: 0, message: 'Banners table not initialized. Run migrations first.' });
      }
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/admin/banners', async (c) => {
    const event = createApiGatewayEvent(c.req);
    const context = createLambdaContext();
    const result = await createBannerHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.put('/admin/banners/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await updateBannerHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.delete('/admin/banners/:id', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { id: c.req.param('id') };
    const context = createLambdaContext();
    const result = await deleteBannerHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: Object.fromEntries(req.headers || []),
    body: JSON.stringify(req.body || {}),
    pathParameters: {},
    queryStringParameters: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams),
    requestContext: {
      requestId: crypto.randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: crypto.randomUUID(),
    functionName: 'admin-governance-enhanced',
    functionVersion: '$LATEST',
  };
}

