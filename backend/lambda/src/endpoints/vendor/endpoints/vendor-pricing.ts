/**
 * ============================================================================
 * VENDOR PRICING ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles vendor service pricing management:
 * - Update service pricing
 * - Get service pricing
 * - Bulk pricing updates
 * 
 * Date: 2026-01-16
 * Created for: Phase 2 - Complete Lifecycle Implementation
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, update, query } from '../../../database/rds-connection';
import { checkVendorCapability } from '../../../middleware/capability-enforcement';
import { normalizeDbRow } from '../../../utils/entity-extractor';
import {
  validateServicePricing,
  validateBulkPricing,
  normalizePricingData,
  formatPricingResponse,
  validatePriceChange,
  applyPricingRules,
  type ServicePricingData,
  type BulkPricingData,
} from '../../../lib/services/pricing-service';

export function registerVendorPricingEndpoints(app: Hono) {
  /**
   * PUT /vendor/services/:serviceId/pricing
   * Update service pricing
   * Requires: service_pricing capability
   */
  app.put("/vendor/services/:serviceId/pricing", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const pricingData: ServicePricingData = await c.req.json();
      
      // Get service to find vendorId
      const services = await select('vendor_services', { id: serviceId });
      if (services.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      const service = services[0];
      const vendorId = service.vendor_id;
      
      // Check capability
      const hasPricingCapability = await checkVendorCapability(vendorId, 'service_pricing');
      if (!hasPricingCapability) {
        return c.json({ error: 'Vendor does not have service pricing capability' }, 403);
      }

      // Validate using functional model
      pricingData.serviceId = serviceId;
      const validation = validateServicePricing(pricingData);
      if (!validation.isValid) {
        return c.json({ error: 'Validation failed', errors: validation.errors }, 400);
      }

      // Validate price change (prevent drastic changes)
      const oldPrice = service.custom_price || service.base_price || 0;
      if (pricingData.price !== undefined && pricingData.price !== oldPrice) {
        const priceChangeValidation = validatePriceChange(oldPrice, pricingData.price);
        if (!priceChangeValidation.isValid) {
          return c.json({ error: 'Price change validation failed', errors: priceChangeValidation.errors }, 400);
        }
      }

      // Apply pricing rules
      const pricingRules = applyPricingRules(pricingData.price, service.service_type);
      if (pricingRules.warnings.length > 0) {
        console.warn('Pricing warnings:', pricingRules.warnings);
      }
      
      // Normalize pricing data
      const normalizedData = normalizePricingData({ ...pricingData, price: pricingRules.finalPrice });
      
      // Update pricing
      const updateData: any = {
        custom_price: normalizedData.price,
        base_price: normalizedData.price, // Also update base_price
      };
      if (normalizedData.duration_minutes !== undefined) {
        updateData.custom_duration = normalizedData.duration_minutes;
        updateData.duration_minutes = normalizedData.duration_minutes;
      }
      
      const updated = await update('vendor_services', { id: serviceId }, updateData);
      
      if (updated.length === 0) {
        return c.json({ error: 'Failed to update pricing' }, 500);
      }
      
      return c.json({
        success: true,
        pricing: formatPricingResponse({ ...normalizedData, updated_at: updated[0].updated_at }),
        warnings: pricingRules.warnings,
        message: 'Pricing updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating service pricing:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /vendor/services/:serviceId/pricing
   * Get service pricing
   * Requires: service_pricing capability
   */
  app.get("/vendor/services/:serviceId/pricing", async (c) => {
    try {
      const { serviceId } = c.req.param();
      
      // Get service
      const services = await select('vendor_services', { id: serviceId });
      if (services.length === 0) {
        return c.json({ error: 'Service not found' }, 404);
      }
      
      const service = services[0];
      const vendorId = service.vendor_id;
      
      // Check capability
      const hasPricingCapability = await checkVendorCapability(vendorId, 'service_pricing');
      if (!hasPricingCapability) {
        return c.json({ error: 'Vendor does not have service pricing capability' }, 403);
      }
      
      return c.json({
        success: true,
        pricing: formatPricingResponse({
          service_id: service.id,
          price: service.custom_price || service.base_price || 0,
          duration_minutes: service.custom_duration || service.duration_minutes || 30,
          currency: 'INR',
          updated_at: service.updated_at,
        }),
      });
    } catch (error: any) {
      console.error('Error fetching service pricing:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/services/pricing/bulk
   * Bulk update pricing for multiple services
   * Requires: service_pricing capability
   */
  app.post("/vendor/services/pricing/bulk", async (c) => {
    try {
      const bulkData: BulkPricingData = await c.req.json();
      const { vendorId, updates } = bulkData;
      
      if (!vendorId || !Array.isArray(updates)) {
        return c.json({ error: 'vendorId and updates array are required' }, 400);
      }
      
      // Check capability
      const hasPricingCapability = await checkVendorCapability(vendorId, 'service_pricing');
      if (!hasPricingCapability) {
        return c.json({ error: 'Vendor does not have service pricing capability' }, 403);
      }

      // Validate bulk pricing data using functional model
      const validation = validateBulkPricing(bulkData);
      if (!validation.isValid) {
        return c.json({ error: 'Validation failed', errors: validation.errors }, 400);
      }
      
      const results = [];
      for (const updateItem of updates) {
        const { serviceId, price, duration } = updateItem;
        
        // Verify service belongs to vendor
        const services = await select('vendor_services', { id: serviceId, vendor_id: vendorId });
        if (services.length === 0) {
          results.push({ serviceId, error: 'Service not found or does not belong to vendor' });
          continue;
        }
        
        const service = services[0];
        const oldPrice = service.custom_price || service.base_price || 0;

        // Validate individual pricing update
        const pricingValidation = validateServicePricing({ serviceId, price, duration });
        if (!pricingValidation.isValid) {
          results.push({ serviceId, error: `Validation failed: ${pricingValidation.errors.join(', ')}` });
          continue;
        }

        // Validate price change
        if (price !== oldPrice) {
          const priceChangeValidation = validatePriceChange(oldPrice, price);
          if (!priceChangeValidation.isValid) {
            results.push({ serviceId, error: `Price change validation failed: ${priceChangeValidation.errors.join(', ')}` });
            continue;
          }
        }

        // Apply pricing rules
        const pricingRules = applyPricingRules(price, service.service_type);
        
        // Normalize pricing data
        const normalizedData = normalizePricingData({ serviceId, price: pricingRules.finalPrice, duration });
        
        // Update pricing
        const updateData: any = {
          custom_price: normalizedData.price,
          base_price: normalizedData.price,
        };
        if (normalizedData.duration_minutes !== undefined) {
          updateData.custom_duration = normalizedData.duration_minutes;
          updateData.duration_minutes = normalizedData.duration_minutes;
        }
        
        try {
          const updated = await update('vendor_services', { id: serviceId }, updateData);
          results.push({
            serviceId,
            success: true,
            pricing: formatPricingResponse({ ...normalizedData, updated_at: updated[0].updated_at }),
            warnings: pricingRules.warnings,
          });
        } catch (error: any) {
          results.push({ serviceId, error: error.message });
        }
      }
      
      return c.json({
        success: true,
        results,
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => r.error).length,
      });
    } catch (error: any) {
      console.error('Error bulk updating pricing:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
