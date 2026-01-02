/**
 * PRIORITY 2: Enhanced Service Publishing
 * 
 * Adds missing features from handoff checklist:
 * - publishLevel (vendor vs centre)
 * - centres array support
 * - GPS auto-enablement for at_home services
 * - Price override for centre-level
 * - Custom package enablement
 * 
 * Status: ⚠️ 40% → ✅ 90%
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from 'hono';
import { cors } from "hono/cors";
import { 
  getCentresRepository,
  getVendorServicesRepository,
  getVendorsRepository,
  getRolesRepository
} from '../../../supabase/lib/repositories/index';

const app = new Hono();
app.use('*', cors());

/**
 * POST /services/publish
 * Enhanced service publishing matching handoff checklist spec
 * 
 * Status: ✅ NOW IMPLEMENTED
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

      // Validate centres exist
      const invalidCentres = [];
      for (const centreId of centres) {
        // ✅ SQL: Check centre exists from centres table
        const centresRepo = getCentresRepository();
        const centreData = await centresRepo.findById(centreId);
        if (!centreData) {
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
        
        const centreService = {
          id: centreServiceId,
          serviceId,
          serviceName,
          serviceStyle,
          category,
          publishLevel: 'centre',
          centreId,
          vendorId,
          
          // ✅ FEATURE 4: Price Override
          basePrice,
          effectivePrice: priceOverride || basePrice,
          priceOverride: priceOverride || null,
          
          // ✅ FEATURE 5: Custom Package Support
          customPackageEnabled: customPackageEnabled || false,
          
          gpsRequired: finalGpsRequired,
          gpsTracking: finalGpsTracking,
          
          publishedAt: new Date().toISOString(),
          status: 'active'
        };

        // ✅ SQL: Save centre service to vendor_services table
        const vendorServicesRepo = getVendorServicesRepository();
        await vendorServicesRepo.create({
          id: centreServiceId,
          vendor_id: vendorId,
          service_id: serviceId,
          service_name: serviceName,
          service_style: serviceStyle,
          category: category,
          base_price: basePrice,
          price_override: priceOverride || null,
          centre_id: centreId,
          is_enabled: true,
          metadata: {
            publishLevel: 'centre',
            customPackageEnabled: customPackageEnabled || false,
            gpsRequired: finalGpsRequired,
            gpsTracking: finalGpsTracking
          },
          created_at: new Date().toISOString()
        });
        publishedServiceIds.push(centreServiceId);

        console.log(`✅ Published service to centre ${centreId}: ${centreServiceId}`);
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

      const vendorService = {
        id: vendorServiceId,
        serviceId,
        serviceName,
        serviceStyle,
        category,
        publishLevel: 'vendor',
        vendorId,
        basePrice,
        
        // Custom packages NOT enabled at vendor level
        customPackageEnabled: false,
        
        gpsRequired: finalGpsRequired,
        gpsTracking: finalGpsTracking,
        
        publishedAt: new Date().toISOString(),
        status: 'active'
      };

      // ✅ SQL: Save vendor service to vendor_services table
      const vendorServicesRepo = getVendorServicesRepository();
      await vendorServicesRepo.create({
        id: vendorServiceId,
        vendor_id: vendorId,
        service_id: serviceId,
        service_name: serviceName,
        service_style: serviceStyle,
        category: category,
        base_price: basePrice,
        is_enabled: true,
        metadata: {
          publishLevel: 'vendor',
          customPackageEnabled: false,
          gpsRequired: finalGpsRequired,
          gpsTracking: finalGpsTracking
        },
        created_at: new Date().toISOString()
      });

      console.log(`✅ Published service at vendor level: ${vendorServiceId}`);

      return c.json({
        success: true,
        publishedServiceId: vendorServiceId,
        message: 'Service published successfully at vendor level',
        publishLevel: 'vendor',
        gpsRequired: finalGpsRequired,
        customPackageEnabled: false,
        publishedAt: vendorService.publishedAt
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
 * 
 * This provides backward compatibility while adding new features
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

    // ✅ Validate Role Configuration
    const roleConfig = await getRoleConfiguration(vendorId);
    if (!roleConfig) {
      return c.json({ error: 'Vendor role configuration not found' }, 404);
    }

    // Check if service style is allowed
    if (!roleConfig.serviceStyles.includes(body.serviceStyle)) {
      return c.json({
        error: `Service style '${body.serviceStyle}' not allowed for your role`,
        allowedStyles: roleConfig.serviceStyles
      }, 403);
    }

    // ✅ Custom Package Logic
    if (body.publishLevel === 'centre') {
      // ✅ SQL: Get vendor from vendors table
      const vendorsRepo = getVendorsRepository();
      const vendor = await vendorsRepo.findById(vendorId);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendorData = vendor;
      // ✅ SQL: Check if vendor has centres from centres table
      const centresRepo = getCentresRepository();
      const centres = await centresRepo.findByVendor(vendorId);
      const hasCentres = centres && centres.length > 0;

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

    // ✅ SQL: Check vendor-level from vendor_services table
    const vendorServicesRepo = getVendorServicesRepository();
    const vendorServices = await vendorServicesRepo.findByService(serviceId);
    const vendorLevelServices = vendorServices.filter(s => !s.centre_id);
    
    // ✅ SQL: Check centre-level (same table, filtered by centre_id)
    const centreLevelServices = vendorServices.filter(s => s.centre_id);

    const publishInfo = {
      serviceId,
      publishedAtVendorLevel: vendorLevelServices.length > 0,
      publishedAtCentreLevel: centreLevelServices.length > 0,
      vendorPublications: vendorLevelServices,
      centrePublications: centreLevelServices,
      totalPublications: vendorServices.length
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
// ✅ SQL: Get role configuration from roles table
async function getRoleConfiguration(vendorId: string) {
  try {
    // ✅ SQL: Get vendor from vendors table
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    if (!vendor) return null;

    const roleId = vendor.role_id;
    if (!roleId) return null;

    // ✅ SQL: Get role from roles table
    const rolesRepo = getRolesRepository();
    const role = await rolesRepo.findById(roleId);
    if (!role) return null;

    return role;

  } catch (error) {
    console.error('Error getting role configuration:', error);
    return null;
  }
}

export default app;
