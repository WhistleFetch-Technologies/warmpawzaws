/**
 * ============================================================================
 * VENDOR SERVICES MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles vendor service management:
 * - Get vendor services (by style)
 * - Add/update/delete services
 * - Enable/disable services
 * - Custom service creation
 * 
 * Migrated from: supabase/functions/make-server-vendor/vendor-services-endpoints.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query } from '../database/rds-connection';

export function registerVendorServicesEndpoints(app: Hono) {
  /**
   * GET /vendor/:vendorId/services
   * Get all services for a vendor (grouped by style)
   */
  app.get("/vendor/:vendorId/services", async (c) => {
    try {
      const { vendorId } = c.req.param();

      const serviceStyles = ['at_home', 'at_center', 'tele'];
      const servicesByStyle: Record<string, any> = {};

      for (const style of serviceStyles) {
        const services = await query(
          `SELECT vs.*, s.name as base_service_name, s.description as base_description
           FROM vendor_services vs
           LEFT JOIN services s ON vs.service_id = s.id
           WHERE vs.vendor_id = $1
           AND vs.service_style = $2
           AND vs.is_enabled = true
           AND vs.publish_status IN ('published', 'auto_published')
           ORDER BY vs.created_at DESC`,
          [vendorId, style]
        );

        servicesByStyle[style] = {
          services: services.rows.map((s: any) => ({
            id: s.id,
            serviceId: s.service_id,
            serviceName: s.service_name || s.base_service_name,
            name: s.service_name || s.base_service_name,
            description: s.description || s.base_description,
            category: s.category,
            subCategory: s.sub_category,
            price: parseFloat(s.price || s.custom_price || '0'),
            duration: s.duration_minutes || s.custom_duration || 30,
            serviceStyle: s.service_style,
            publishStatus: s.publish_status,
            isEnabled: s.is_enabled,
            isCustomService: s.is_custom_service,
            metadata: s.metadata || {},
          })),
          count: services.rows.length,
        };
      }

      const allServices = Object.values(servicesByStyle).flatMap((style: any) => style.services);

      return c.json({
        success: true,
        services: servicesByStyle,
        allServices,
        totalEnabled: allServices.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendor services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/services/:serviceStyle
   * Get services for a specific style
   */
  app.get("/vendor/:vendorId/services/:serviceStyle", async (c) => {
    try {
      const { vendorId, serviceStyle } = c.req.param();

      if (!['at_home', 'at_center', 'tele'].includes(serviceStyle)) {
        return c.json({ error: 'Invalid service style' }, 400);
      }

      const services = await query(
        `SELECT vs.*, s.name as base_service_name
         FROM vendor_services vs
         LEFT JOIN services s ON vs.service_id = s.id
         WHERE vs.vendor_id = $1
         AND vs.service_style = $2
         AND vs.is_enabled = true
         ORDER BY vs.created_at DESC`,
        [vendorId, serviceStyle]
      );

      return c.json({
        success: true,
        services: services.rows,
        total: services.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching vendor services:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/services
   * Add a service to vendor catalog
   */
  app.post("/vendor/:vendorId/services", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const serviceData = await c.req.json();
      const {
        serviceId,
        serviceStyle,
        customPrice,
        customDuration,
        isEnabled,
        publishStatus,
        isCustomService,
      } = serviceData;

      if (!serviceId || !serviceStyle) {
        return c.json({ error: 'serviceId and serviceStyle are required' }, 400);
      }

      // Check if service already exists
      const existing = await query(
        `SELECT id FROM vendor_services
         WHERE vendor_id = $1 AND service_id = $2 AND service_style = $3`,
        [vendorId, serviceId, serviceStyle]
      );

      if (existing.rows.length > 0) {
        return c.json({ error: 'Service already exists for this style' }, 409);
      }

      // Get base service info
      const baseServices = await select('services', { id: serviceId });
      if (baseServices.length === 0) {
        return c.json({ error: 'Base service not found' }, 404);
      }

      const baseService = baseServices[0];

      const vendorService = await insert('vendor_services', {
        vendor_id: vendorId,
        service_id: serviceId,
        service_name: baseService.name,
        category: baseService.category,
        service_style: serviceStyle,
        price: customPrice || baseService.base_price || baseService.price,
        custom_price: customPrice || null,
        duration_minutes: customDuration || baseService.duration_minutes || 30,
        custom_duration: customDuration || null,
        is_enabled: isEnabled !== false,
        publish_status: publishStatus || 'published',
        is_custom_service: isCustomService || false,
      });

      return c.json({
        success: true,
        service: vendorService[0],
        message: 'Service added successfully',
      });
    } catch (error: any) {
      console.error('Error adding vendor service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/services/:serviceId
   * Update vendor service
   */
  app.put("/vendor/:vendorId/services/:serviceId", async (c) => {
    try {
      const { vendorId, serviceId } = c.req.param();
      const serviceData = await c.req.json();

      const updated = await update('vendor_services',
        { id: serviceId, vendor_id: vendorId },
        {
          price: serviceData.price || serviceData.customPrice,
          custom_price: serviceData.customPrice,
          duration_minutes: serviceData.duration || serviceData.customDuration,
          custom_duration: serviceData.customDuration,
          is_enabled: serviceData.isEnabled,
          publish_status: serviceData.publishStatus,
        }
      );

      if (updated.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }

      return c.json({
        success: true,
        service: updated[0],
        message: 'Service updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating vendor service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/services/:serviceId
   * Remove service from vendor catalog
   */
  app.delete("/vendor/:vendorId/services/:serviceId", async (c) => {
    try {
      const { vendorId, serviceId } = c.req.param();

      await query(
        'DELETE FROM vendor_services WHERE id = $1 AND vendor_id = $2',
        [serviceId, vendorId]
      );

      return c.json({
        success: true,
        message: 'Service removed successfully',
      });
    } catch (error: any) {
      console.error('Error removing vendor service:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/services/custom
   * Create custom service
   */
  app.post("/vendor/:vendorId/services/custom", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const serviceData = await c.req.json();
      const {
        serviceName,
        description,
        category,
        subCategory,
        serviceStyle,
        price,
        duration,
      } = serviceData;

      if (!serviceName || !serviceStyle || !price) {
        return c.json({ error: 'serviceName, serviceStyle, and price are required' }, 400);
      }

      // Create base service first
      const baseService = await insert('services', {
        name: serviceName,
        description: description || null,
        category: category || null,
        base_price: price,
        duration_minutes: duration || 30,
        service_style: serviceStyle,
        is_global: false,
        is_active: true,
      });

      // Create vendor service link
      const vendorService = await insert('vendor_services', {
        vendor_id: vendorId,
        service_id: baseService[0].id,
        service_name: serviceName,
        category: category || null,
        sub_category: subCategory || null,
        service_style: serviceStyle,
        price: price,
        custom_price: price,
        duration_minutes: duration || 30,
        custom_duration: duration || 30,
        is_enabled: true,
        publish_status: 'published',
        is_custom_service: true,
      });

      return c.json({
        success: true,
        service: vendorService[0],
        message: 'Custom service created successfully',
      });
    } catch (error: any) {
      console.error('Error creating custom service:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

