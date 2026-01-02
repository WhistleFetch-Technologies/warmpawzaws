/**
 * ============================================================================
 * SQL-BASED CUSTOMER SERVICES ENDPOINTS
 * ============================================================================
 * 
 * Migrated from: customer-services.tsx (KV-based)
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Service publishing validation
 * ✅ Vendor status validation
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { Hono } from 'hono';
import { sendSuccess, sendError } from "./response-utils";
import { getServicesRepository } from "../../lib/repositories/services";
import { getVendorsRepository } from "../../lib/repositories/vendors";
import { getDbClient } from "../../lib/db";

export function registerCustomerServicesSQL(app: Hono) {
  const servicesRepo = getServicesRepository();
  const vendorsRepo = getVendorsRepository();
  const client = getDbClient();

  /**
   * GET /make-server-3dd53475/customer/services
   * Get all published services for customers - SQL-BASED
   */
  app.get("/make-server-3dd53475/customer/services", async (c) => {
    try {
      const category = c.req.query('category');
      const serviceStyle = c.req.query('serviceStyle');
      const location = c.req.query('location');
      const petType = c.req.query('petType');
      const roleId = c.req.query('roleId');
      
      console.log('🛍️ [CUSTOMER-SERVICES-SQL] Fetching published services');

      // ✅ SQL-BASED: Get published services with vendor info
      let query = client
        .from('service_publishing')
        .select(`
          *,
          services (*),
          vendors (*)
        `)
        .eq('publish_status', 'published');

      if (serviceStyle) {
        query = query.eq('service_style', serviceStyle);
      }

      const { data: publishedServices, error } = await query;

      if (error) throw error;

      // Filter and enrich services
      const enrichedServices: any[] = [];

      for (const pub of publishedServices || []) {
        const service = pub.services;
        const vendor = pub.vendors;

        if (!service || !vendor) continue;

        // ✅ SQL-BASED: Validate vendor status
        if (vendor.status !== 'active') continue;

        // Apply filters
        if (category && service.category !== category) continue;
        if (roleId && vendor.role_id !== roleId) continue;

        const enrichedService = {
          id: service.id,
          serviceName: service.name,
          description: service.description,
          price: Number(service.price),
          duration: service.duration_minutes,
          categoryName: service.category,
          serviceStyle: pub.service_style,
          vendorId: vendor.id,
          vendorName: vendor.business_name,
          vendorRating: 4.5, // TODO: Get from reviews table
          vendorReviewCount: 0, // TODO: Get from reviews table
          vendorLocation: vendor.address,
          vendorType: vendor.category,
          vendorRoleId: vendor.role_id,
          publishedAt: pub.published_at,
        };

        enrichedServices.push(enrichedService);
      }

      return sendSuccess(c, { 
        services: enrichedServices,
        count: enrichedServices.length
      });
    } catch (error: any) {
      console.error('[CUSTOMER-SERVICES-SQL] Error:', error);
      return sendError(c, error.message || 'Failed to get services', 500);
    }
  });
}

