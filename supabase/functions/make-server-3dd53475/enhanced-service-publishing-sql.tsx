/**
 * ============================================================================
 * ENHANCED SERVICE PUBLISHING - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - publishLevel (vendor vs centre)
 * - centres array support
 * - GPS auto-enablement for at_home services
 * - Price override for centre-level
 * - Custom package enablement
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Services stored in `vendor_services` table
 * - Centres validated from `vendors` table (centres are vendors with specific role)
 * - Role configuration from `roles` table
 * 
 * Date: 2025-01-27
 * Migration: Batch 7 Phase 4 - KV to SQL
 * ============================================================================
 */

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { getDbClient } from '../../lib/db.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getRolesRepository } from '../../lib/repositories/roles.ts';

const app = new Hono();
app.use('*', cors());

/**
 * POST /services/publish
 * Enhanced service publishing matching handoff checklist spec
 */
app.post('/services/publish', async (c) => {
  try {
    const body = await c.req.json();
    const {
      serviceId,
      serviceName,
      serviceStyle,
      category,
      publishLevel,
      centres,
      basePrice,
      priceOverride,
      customPackageEnabled,
      gpsRequired,
      gpsTracking,
      vendorId
    } = body;

    // Validation
    if (!serviceId || !serviceName || !serviceStyle || !category) {
      return c.json({ 
        error: 'Missing required fields',
        required: ['serviceId', 'serviceName', 'serviceStyle', 'category']
      }, 400);
    }

    const db = getDbClient();

    // ✅ FEATURE 1: GPS Auto-Enablement for Home Services
    let finalGpsRequired = gpsRequired;
    let finalGpsTracking = gpsTracking;

    if (serviceStyle === 'at_home') {
      // GPS is MANDATORY for home services (non-toggleable)
      finalGpsRequired = true;
      finalGpsTracking = {
        enabled: true,
        mandatory: true,
        trackStaff: true,
        trackCustomer: false,
        ...(gpsTracking || {})
      };

      console.log(`✅ GPS auto-enabled for home service: ${serviceName}`);
    }

    // ✅ FEATURE 2: Publish Level (vendor vs centre)
    const effectivePublishLevel = publishLevel || 'vendor';

    if (effectivePublishLevel === 'centre') {
      // Centre-level publishing requires centres array
      if (!centres || centres.length === 0) {
        return c.json({
          error: 'At least one centre required for centre-level publishing',
          message: 'Please select centres to publish this service to',
          publishLevel: 'centre',
          centresProvided: centres
        }, 400);
      }

      // ✅ SQL: Validate centres exist (centres are vendors with specific role)
      const invalidCentres = [];
      for (const centreId of centres) {
        try {
          const centre = await getVendorsRepository().findById(centreId);
          if (!centre || !centre.is_active) {
            invalidCentres.push(centreId);
          }
        } catch (e) {
          invalidCentres.push(centreId);
        }
      }

      if (invalidCentres.length > 0) {
        return c.json({
          error: 'Invalid centre IDs',
          invalidCentres,
          message: 'Some centres do not exist'
        }, 400);
      }

      // ✅ FEATURE 3: Centre-Level Publishing with Price Override
      const publishedServiceIds = [];

      for (const centreId of centres) {
        const centreServiceId = `${serviceId}_centre_${centreId}`;
        
        // ✅ SQL: Insert centre-level service into vendor_services
        const { data: centreService, error: insertError } = await db
          .from('vendor_services')
          .insert({
            vendor_id: vendorId,
            service_id: serviceId,
            service_name: serviceName,
            category,
            price: priceOverride || basePrice,
            duration_minutes: 30, // Default, can be updated
            service_style: serviceStyle,
            publish_status: 'published',
            is_enabled: true,
            centre_id: centreId,
            publish_level: 'centre',
            price_override: priceOverride || null,
            custom_package_enabled: customPackageEnabled || false,
            gps_required: finalGpsRequired,
            gps_tracking: finalGpsTracking,
            metadata: {
              basePrice,
              effectivePrice: priceOverride || basePrice,
              publishedAt: new Date().toISOString()
            }
          })
          .select()
          .single();

        if (insertError || !centreService) {
          console.error('Error publishing centre service:', insertError);
          return c.json({ error: 'Failed to publish service to centre' }, 500);
        }

        publishedServiceIds.push(centreService.id);

        console.log(`✅ Published service to centre ${centreId}: ${centreService.id}`);
      }

      return c.json({
        success: true,
        message: `Service published to ${centres.length} centre(s)`,
        publishLevel: 'centre',
        publishedServiceIds,
        centres,
        effectivePrice: priceOverride || basePrice,
        customPackageEnabled: customPackageEnabled || false,
        gpsRequired: finalGpsRequired
      });

    } else {
      // ✅ VENDOR-LEVEL PUBLISHING
      const vendorServiceId = `${serviceId}_vendor_${vendorId}`;

      // ✅ SQL: Insert vendor-level service into vendor_services
      const { data: vendorService, error: insertError } = await db
        .from('vendor_services')
        .insert({
          vendor_id: vendorId,
          service_id: serviceId,
          service_name: serviceName,
          category,
          price: basePrice,
          duration_minutes: 30, // Default, can be updated
          service_style: serviceStyle,
          publish_status: 'published',
          is_enabled: true,
          publish_level: 'vendor',
          custom_package_enabled: false, // Not enabled at vendor level
          gps_required: finalGpsRequired,
          gps_tracking: finalGpsTracking,
          metadata: {
            publishedAt: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (insertError || !vendorService) {
        console.error('Error publishing vendor service:', insertError);
        return c.json({ error: 'Failed to publish service' }, 500);
      }

      console.log(`✅ Published service at vendor level: ${vendorService.id}`);

      return c.json({
        success: true,
        publishedServiceId: vendorService.id,
        message: 'Service published successfully at vendor level',
        publishLevel: 'vendor',
        gpsRequired: finalGpsRequired,
        customPackageEnabled: false,
        publishedAt: vendorService.created_at
      });
    }

  } catch (error: any) {
    console.error('Error publishing service:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /vendor/:vendorId/services/publish
 * Enhanced wrapper for existing vendor-scoped endpoint
 */
app.post('/vendor/:vendorId/services/publish', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const body = await c.req.json();

    // Add vendorId to body
    body.vendorId = vendorId;

    // ✅ GPS Auto-Enablement
    if (body.serviceStyle === 'at_home' && !body.gpsRequired) {
      console.log(`⚠️ GPS requirement auto-enabled for at_home service`);
      body.gpsRequired = true;
      body.gpsTracking = {
        enabled: true,
        mandatory: true,
        trackStaff: true,
        trackCustomer: false
      };
    }

    // ✅ SQL: Validate Role Configuration
    const roleConfig = await getRoleConfiguration(vendorId);
    if (!roleConfig) {
      return c.json({ error: 'Vendor role configuration not found' }, 404);
    }

    // Check if service style is allowed
    if (!roleConfig.serviceStyles || !roleConfig.serviceStyles.includes(body.serviceStyle)) {
      return c.json({
        error: `Service style '${body.serviceStyle}' not allowed for your role`,
        allowedStyles: roleConfig.serviceStyles || []
      }, 403);
    }

    // ✅ Custom Package Logic
    if (body.publishLevel === 'centre') {
      // ✅ SQL: Get vendor to check for centres
      const vendor = await getVendorsRepository().findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      // Check if vendor has centres (centres are child vendors)
      // For now, we'll check if centres array is provided
      const hasCentres = body.centres && body.centres.length > 0;

      if (!hasCentres) {
        return c.json({
          error: 'Centre-level publishing requires centres',
          message: 'Please add centres to your account first',
          customPackageEnabled: false
        }, 400);
      }

      // Enable custom packages if centres exist
      if (body.customPackageEnabled && hasCentres) {
        console.log(`✅ Custom packages enabled for centre-level service`);
      }
    } else {
      // Vendor-level cannot have custom packages
      if (body.customPackageEnabled) {
        console.log(`⚠️ Custom packages disabled at vendor level`);
        body.customPackageEnabled = false;
      }
    }

    // Call the standardized endpoint
    const request = new Request(c.req.url.replace(/\/vendor\/[^/]+/, ''), {
      method: 'POST',
      headers: c.req.raw.headers,
      body: JSON.stringify(body)
    });

    return app.fetch(request);

  } catch (error: any) {
    console.error('Error in vendor service publish:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /services/:serviceId/publish-info
 * Get publishing information for a service
 */
app.get('/services/:serviceId/publish-info', async (c) => {
  try {
    const serviceId = c.req.param('serviceId');
    const db = getDbClient();

    // ✅ SQL: Check vendor-level publications
    const { data: vendorServices } = await db
      .from('vendor_services')
      .select('*')
      .eq('service_id', serviceId)
      .eq('publish_level', 'vendor')
      .eq('publish_status', 'published');
    
    // ✅ SQL: Check centre-level publications
    const { data: centreServices } = await db
      .from('vendor_services')
      .select('*')
      .eq('service_id', serviceId)
      .eq('publish_level', 'centre')
      .eq('publish_status', 'published');

    const publishInfo = {
      serviceId,
      publishedAtVendorLevel: (vendorServices || []).length > 0,
      publishedAtCentreLevel: (centreServices || []).length > 0,
      vendorPublications: vendorServices || [],
      centrePublications: centreServices || [],
      totalPublications: (vendorServices || []).length + (centreServices || []).length
    };

    return c.json({
      success: true,
      ...publishInfo
    });

  } catch (error: any) {
    console.error('Error fetching publish info:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Helper: Get role configuration
 */
async function getRoleConfiguration(vendorId: string) {
  try {
    // ✅ SQL: Get vendor from vendors table
    const vendor = await getVendorsRepository().findById(vendorId);
    if (!vendor || !vendor.role_id) return null;

    // ✅ SQL: Get role configuration from roles table
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(vendor.role_id);
    
    if (!role) return null;

    // Return role configuration
    return {
      roleId: role.id,
      roleName: role.name,
      serviceStyles: role.service_styles || [],
      capabilities: role.capabilities || []
    };

  } catch (error) {
    console.error('Error getting role configuration:', error);
    return null;
  }
}

export default app;

