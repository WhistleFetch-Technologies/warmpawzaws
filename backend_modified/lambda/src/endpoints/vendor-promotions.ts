/**
 * ============================================================================
 * VENDOR PROMOTIONS ENDPOINTS
 * ============================================================================
 * 
 * Handles vendor-level promotions for both products (sellers) and services:
 * - Product promotions (for sellers)
 * - Service promotions (for groomers, vets, trainers, etc.)
 * - Flash sales, BOGO, seasonal, combos, loyalty
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query, deleteRows } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows } from '../utils/entity-extractor';

export function registerVendorPromotionsEndpoints(app: Hono) {
  // ============================================================================
  // VENDOR PRODUCT PROMOTIONS (for Sellers)
  // ============================================================================

  /**
   * GET /vendor/:vendorId/promotions
   * Get all promotions for a vendor (products)
   */
  app.get("/vendor/:vendorId/promotions", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { status, type } = c.req.query();

      let queryStr = `
        SELECT * FROM vendor_promotions 
        WHERE vendor_id = $1::uuid
      `;
      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (status === 'active') {
        queryStr += ` AND is_active = true AND start_date <= NOW() AND end_date >= NOW()`;
      } else if (status === 'scheduled') {
        queryStr += ` AND start_date > NOW()`;
      } else if (status === 'expired') {
        queryStr += ` AND end_date < NOW()`;
      }

      if (type) {
        queryStr += ` AND promotion_type = $${paramIndex}::text`;
        params.push(type);
        paramIndex++;
      }

      queryStr += ` ORDER BY created_at DESC`;

      const result = await query(queryStr, params);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];

      return c.json({
        success: true,
        promotions: normalizeDbRows(rows),
        total: rows.length
      });
    } catch (error: any) {
      console.error('Error fetching vendor promotions:', error);
      // Return empty if table doesn't exist
      if (error.message?.includes('does not exist')) {
        return c.json({ success: true, promotions: [], total: 0 });
      }
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/promotions
   * Create a new promotion for vendor products
   */
  app.post("/vendor/:vendorId/promotions", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();

      const {
        name,
        description,
        code,
        promotion_type = 'flash_sale',
        discount_type = 'percentage',
        discount_value,
        min_order_value,
        max_discount_amount,
        start_date,
        end_date,
        is_active = true,
        usage_limit,
        target_audience = 'all',
        applicable_products,
        applicable_categories,
        // BOGO
        buy_quantity,
        get_quantity,
        get_discount_percent,
        // Bundle
        bundle_products,
        bundle_discount
      } = body;

      if (!name || !discount_value || !start_date || !end_date) {
        return c.json({ error: 'name, discount_value, start_date, and end_date are required' }, 400);
      }

      // Check for duplicate code
      if (code) {
        const existingCode = await query(
          'SELECT id FROM vendor_promotions WHERE code = $1 AND vendor_id = $2::uuid',
          [code.toUpperCase(), vendorId]
        );
        const codeRows = Array.isArray(existingCode) ? existingCode : (existingCode as any).rows || [];
        if (codeRows.length > 0) {
          return c.json({ error: 'Promotion code already exists' }, 400);
        }
      }

      const promotion = await insert('vendor_promotions', {
        vendor_id: vendorId,
        name,
        description: description || '',
        code: code ? code.toUpperCase() : null,
        promotion_type,
        discount_type,
        discount_value: parseFloat(discount_value),
        min_order_value: min_order_value ? parseFloat(min_order_value) : null,
        max_discount_amount: max_discount_amount ? parseFloat(max_discount_amount) : null,
        start_date: new Date(start_date).toISOString(),
        end_date: new Date(end_date).toISOString(),
        is_active,
        usage_limit: usage_limit || null,
        usage_count: 0,
        target_audience,
        applicable_products: applicable_products ? JSON.stringify(applicable_products) : null,
        applicable_categories: applicable_categories ? JSON.stringify(applicable_categories) : null,
        buy_quantity: buy_quantity || null,
        get_quantity: get_quantity || null,
        get_discount_percent: get_discount_percent || null,
        bundle_products: bundle_products ? JSON.stringify(bundle_products) : null,
        bundle_discount: bundle_discount || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      return c.json({
        success: true,
        promotion: normalizeDbRow(promotion[0]),
        message: 'Promotion created successfully'
      });
    } catch (error: any) {
      console.error('Error creating vendor promotion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/promotions/:promoId
   * Update a vendor promotion
   */
  app.put("/vendor/:vendorId/promotions/:promoId", async (c) => {
    try {
      const { vendorId, promoId } = c.req.param();
      const body = await c.req.json();

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      // Map all possible fields
      const fields = [
        'name', 'description', 'promotion_type', 'discount_type', 'is_active',
        'target_audience', 'buy_quantity', 'get_quantity', 'get_discount_percent', 'bundle_discount'
      ];
      
      fields.forEach(field => {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      });

      // Numeric fields
      if (body.discount_value !== undefined) updateData.discount_value = parseFloat(body.discount_value);
      if (body.min_order_value !== undefined) updateData.min_order_value = body.min_order_value ? parseFloat(body.min_order_value) : null;
      if (body.max_discount_amount !== undefined) updateData.max_discount_amount = body.max_discount_amount ? parseFloat(body.max_discount_amount) : null;
      if (body.usage_limit !== undefined) updateData.usage_limit = body.usage_limit || null;

      // Date fields
      if (body.start_date !== undefined) updateData.start_date = new Date(body.start_date).toISOString();
      if (body.end_date !== undefined) updateData.end_date = new Date(body.end_date).toISOString();

      // Code (uppercase)
      if (body.code !== undefined) updateData.code = body.code ? body.code.toUpperCase() : null;

      // JSON fields
      if (body.applicable_products !== undefined) updateData.applicable_products = body.applicable_products ? JSON.stringify(body.applicable_products) : null;
      if (body.applicable_categories !== undefined) updateData.applicable_categories = body.applicable_categories ? JSON.stringify(body.applicable_categories) : null;
      if (body.bundle_products !== undefined) updateData.bundle_products = body.bundle_products ? JSON.stringify(body.bundle_products) : null;

      await update('vendor_promotions', { id: promoId, vendor_id: vendorId }, updateData);

      const updated = await query(
        'SELECT * FROM vendor_promotions WHERE id = $1::uuid AND vendor_id = $2::uuid',
        [promoId, vendorId]
      );
      const rows = Array.isArray(updated) ? updated : (updated as any).rows || [];

      return c.json({
        success: true,
        promotion: normalizeDbRow(rows[0]),
        message: 'Promotion updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating vendor promotion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/promotions/:promoId
   * Delete a vendor promotion
   */
  app.delete("/vendor/:vendorId/promotions/:promoId", async (c) => {
    try {
      const { vendorId, promoId } = c.req.param();

      await deleteRows('vendor_promotions', { id: promoId, vendor_id: vendorId });

      return c.json({
        success: true,
        message: 'Promotion deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting vendor promotion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // VENDOR SERVICE PROMOTIONS (for Service Providers)
  // ============================================================================

  /**
   * GET /vendor/:vendorId/service-promotions
   * Get all service promotions for a vendor
   */
  app.get("/vendor/:vendorId/service-promotions", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { status, type } = c.req.query();

      let queryStr = `
        SELECT * FROM vendor_service_promotions 
        WHERE vendor_id = $1::uuid
      `;
      const params: any[] = [vendorId];
      let paramIndex = 2;

      if (status === 'active') {
        queryStr += ` AND is_active = true AND start_date <= NOW() AND end_date >= NOW()`;
      } else if (status === 'scheduled') {
        queryStr += ` AND start_date > NOW()`;
      } else if (status === 'expired') {
        queryStr += ` AND end_date < NOW()`;
      }

      if (type) {
        queryStr += ` AND promotion_type = $${paramIndex}::text`;
        params.push(type);
        paramIndex++;
      }

      queryStr += ` ORDER BY created_at DESC`;

      const result = await query(queryStr, params);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];

      return c.json({
        success: true,
        promotions: normalizeDbRows(rows),
        total: rows.length
      });
    } catch (error: any) {
      console.error('Error fetching service promotions:', error);
      if (error.message?.includes('does not exist')) {
        return c.json({ success: true, promotions: [], total: 0 });
      }
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /vendor/:vendorId/service-promotions
   * Create a new service promotion
   */
  app.post("/vendor/:vendorId/service-promotions", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const body = await c.req.json();

      const {
        name,
        description,
        code,
        promotion_type = 'flash_sale',
        discount_type = 'percentage',
        discount_value,
        min_booking_value,
        max_discount_amount,
        start_date,
        end_date,
        is_active = true,
        usage_limit,
        target_audience = 'all',
        applicable_services,
        applicable_service_styles,
        // Combo
        combo_services,
        combo_discount,
        // Loyalty
        visits_required,
        loyalty_discount
      } = body;

      if (!name || !start_date || !end_date) {
        return c.json({ error: 'name, start_date, and end_date are required' }, 400);
      }

      // Check for duplicate code
      if (code) {
        const existingCode = await query(
          'SELECT id FROM vendor_service_promotions WHERE code = $1 AND vendor_id = $2::uuid',
          [code.toUpperCase(), vendorId]
        );
        const codeRows = Array.isArray(existingCode) ? existingCode : (existingCode as any).rows || [];
        if (codeRows.length > 0) {
          return c.json({ error: 'Promotion code already exists' }, 400);
        }
      }

      const promotion = await insert('vendor_service_promotions', {
        vendor_id: vendorId,
        name,
        description: description || '',
        code: code ? code.toUpperCase() : null,
        promotion_type,
        discount_type,
        discount_value: discount_value ? parseFloat(discount_value) : null,
        min_booking_value: min_booking_value ? parseFloat(min_booking_value) : null,
        max_discount_amount: max_discount_amount ? parseFloat(max_discount_amount) : null,
        start_date: new Date(start_date).toISOString(),
        end_date: new Date(end_date).toISOString(),
        is_active,
        usage_limit: usage_limit || null,
        usage_count: 0,
        target_audience,
        applicable_services: applicable_services ? JSON.stringify(applicable_services) : null,
        applicable_service_styles: applicable_service_styles ? JSON.stringify(applicable_service_styles) : null,
        combo_services: combo_services ? JSON.stringify(combo_services) : null,
        combo_discount: combo_discount || null,
        visits_required: visits_required || null,
        loyalty_discount: loyalty_discount || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      return c.json({
        success: true,
        promotion: normalizeDbRow(promotion[0]),
        message: 'Service promotion created successfully'
      });
    } catch (error: any) {
      console.error('Error creating service promotion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/service-promotions/:promoId
   * Update a service promotion
   */
  app.put("/vendor/:vendorId/service-promotions/:promoId", async (c) => {
    try {
      const { vendorId, promoId } = c.req.param();
      const body = await c.req.json();

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      // Map fields
      const fields = [
        'name', 'description', 'promotion_type', 'discount_type', 'is_active',
        'target_audience', 'combo_discount', 'visits_required', 'loyalty_discount'
      ];
      
      fields.forEach(field => {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      });

      // Numeric fields
      if (body.discount_value !== undefined) updateData.discount_value = body.discount_value ? parseFloat(body.discount_value) : null;
      if (body.min_booking_value !== undefined) updateData.min_booking_value = body.min_booking_value ? parseFloat(body.min_booking_value) : null;
      if (body.max_discount_amount !== undefined) updateData.max_discount_amount = body.max_discount_amount ? parseFloat(body.max_discount_amount) : null;
      if (body.usage_limit !== undefined) updateData.usage_limit = body.usage_limit || null;

      // Date fields
      if (body.start_date !== undefined) updateData.start_date = new Date(body.start_date).toISOString();
      if (body.end_date !== undefined) updateData.end_date = new Date(body.end_date).toISOString();

      // Code (uppercase)
      if (body.code !== undefined) updateData.code = body.code ? body.code.toUpperCase() : null;

      // JSON fields
      if (body.applicable_services !== undefined) updateData.applicable_services = body.applicable_services ? JSON.stringify(body.applicable_services) : null;
      if (body.applicable_service_styles !== undefined) updateData.applicable_service_styles = body.applicable_service_styles ? JSON.stringify(body.applicable_service_styles) : null;
      if (body.combo_services !== undefined) updateData.combo_services = body.combo_services ? JSON.stringify(body.combo_services) : null;

      await update('vendor_service_promotions', { id: promoId, vendor_id: vendorId }, updateData);

      const updated = await query(
        'SELECT * FROM vendor_service_promotions WHERE id = $1::uuid AND vendor_id = $2::uuid',
        [promoId, vendorId]
      );
      const rows = Array.isArray(updated) ? updated : (updated as any).rows || [];

      return c.json({
        success: true,
        promotion: normalizeDbRow(rows[0]),
        message: 'Service promotion updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating service promotion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /vendor/:vendorId/service-promotions/:promoId
   * Delete a service promotion
   */
  app.delete("/vendor/:vendorId/service-promotions/:promoId", async (c) => {
    try {
      const { vendorId, promoId } = c.req.param();

      await deleteRows('vendor_service_promotions', { id: promoId, vendor_id: vendorId });

      return c.json({
        success: true,
        message: 'Service promotion deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting service promotion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // ADMIN ENDPOINTS - View all vendor promotions
  // ============================================================================

  /**
   * GET /admin/vendor-promotions
   * Get all vendor promotions (product & service) for admin dashboard
   */
  app.get("/admin/vendor-promotions", async (c) => {
    try {
      const { status, type, vendorId, category } = c.req.query();

      let promotions: any[] = [];

      // Fetch product promotions
      if (category !== 'service') {
        let productQuery = `
          SELECT vp.*, v.name as vendor_name, v.phone as vendor_phone, 'product' as promo_category
          FROM vendor_promotions vp
          LEFT JOIN vendors v ON vp.vendor_id = v.id
          WHERE 1=1
        `;
        const productParams: any[] = [];
        let paramIndex = 1;

        if (vendorId) {
          productQuery += ` AND vp.vendor_id = $${paramIndex}::uuid`;
          productParams.push(vendorId);
          paramIndex++;
        }

        if (status === 'active') {
          productQuery += ` AND vp.is_active = true AND vp.start_date <= NOW() AND vp.end_date >= NOW()`;
        } else if (status === 'scheduled') {
          productQuery += ` AND vp.start_date > NOW()`;
        } else if (status === 'expired') {
          productQuery += ` AND vp.end_date < NOW()`;
        }

        if (type) {
          productQuery += ` AND vp.promotion_type = $${paramIndex}::text`;
          productParams.push(type);
          paramIndex++;
        }

        productQuery += ` ORDER BY vp.created_at DESC LIMIT 100`;

        const productResult = await query(productQuery, productParams);
        const productRows = Array.isArray(productResult) ? productResult : (productResult as any).rows || [];
        promotions = promotions.concat(productRows);
      }

      // Fetch service promotions
      if (category !== 'product') {
        let serviceQuery = `
          SELECT vsp.*, v.name as vendor_name, v.phone as vendor_phone, 'service' as promo_category
          FROM vendor_service_promotions vsp
          LEFT JOIN vendors v ON vsp.vendor_id = v.id
          WHERE 1=1
        `;
        const serviceParams: any[] = [];
        let paramIndex = 1;

        if (vendorId) {
          serviceQuery += ` AND vsp.vendor_id = $${paramIndex}::uuid`;
          serviceParams.push(vendorId);
          paramIndex++;
        }

        if (status === 'active') {
          serviceQuery += ` AND vsp.is_active = true AND vsp.start_date <= NOW() AND vsp.end_date >= NOW()`;
        } else if (status === 'scheduled') {
          serviceQuery += ` AND vsp.start_date > NOW()`;
        } else if (status === 'expired') {
          serviceQuery += ` AND vsp.end_date < NOW()`;
        }

        if (type) {
          serviceQuery += ` AND vsp.promotion_type = $${paramIndex}::text`;
          serviceParams.push(type);
          paramIndex++;
        }

        serviceQuery += ` ORDER BY vsp.created_at DESC LIMIT 100`;

        const serviceResult = await query(serviceQuery, serviceParams);
        const serviceRows = Array.isArray(serviceResult) ? serviceResult : (serviceResult as any).rows || [];
        promotions = promotions.concat(serviceRows);
      }

      // Sort by created_at
      promotions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return c.json({
        success: true,
        promotions: normalizeDbRows(promotions),
        total: promotions.length,
        stats: {
          total: promotions.length,
          active: promotions.filter(p => p.is_active && new Date(p.start_date) <= new Date() && new Date(p.end_date) >= new Date()).length,
          product: promotions.filter(p => p.promo_category === 'product').length,
          service: promotions.filter(p => p.promo_category === 'service').length
        }
      });
    } catch (error: any) {
      console.error('Error fetching admin vendor promotions:', error);
      return c.json({ success: true, promotions: [], total: 0, stats: { total: 0, active: 0, product: 0, service: 0 } });
    }
  });

  /**
   * PUT /admin/vendor-promotions/:promoId/toggle
   * Toggle a vendor promotion active status (admin action)
   */
  app.put("/admin/vendor-promotions/:promoId/toggle", async (c) => {
    try {
      const { promoId } = c.req.param();
      const { category, is_active } = await c.req.json();

      const table = category === 'service' ? 'vendor_service_promotions' : 'vendor_promotions';
      
      await query(`
        UPDATE ${table} 
        SET is_active = $1, updated_at = NOW() 
        WHERE id = $2::uuid
      `, [is_active, promoId]);

      return c.json({
        success: true,
        message: `Promotion ${is_active ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error: any) {
      console.error('Error toggling vendor promotion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // PUBLIC ENDPOINTS - For Customer App
  // ============================================================================

  /**
   * GET /vendors/:vendorId/active-promotions
   * Get active promotions for a vendor (public, for customer display)
   */
  app.get("/vendors/:vendorId/active-promotions", async (c) => {
    try {
      const { vendorId } = c.req.param();
      const { type } = c.req.query(); // 'product' or 'service'

      const now = new Date().toISOString();
      
      let promotions: any[] = [];

      if (type !== 'service') {
        // Get product promotions
        const productPromos = await query(`
          SELECT * FROM vendor_promotions 
          WHERE vendor_id = $1::uuid 
            AND is_active = true 
            AND start_date <= $2 
            AND end_date >= $2
          ORDER BY discount_value DESC
        `, [vendorId, now]);
        const productRows = Array.isArray(productPromos) ? productPromos : (productPromos as any).rows || [];
        promotions = promotions.concat(productRows.map((p: any) => ({ ...p, promo_category: 'product' })));
      }

      if (type !== 'product') {
        // Get service promotions
        const servicePromos = await query(`
          SELECT * FROM vendor_service_promotions 
          WHERE vendor_id = $1::uuid 
            AND is_active = true 
            AND start_date <= $2 
            AND end_date >= $2
          ORDER BY discount_value DESC
        `, [vendorId, now]);
        const serviceRows = Array.isArray(servicePromos) ? servicePromos : (servicePromos as any).rows || [];
        promotions = promotions.concat(serviceRows.map((p: any) => ({ ...p, promo_category: 'service' })));
      }

      return c.json({
        success: true,
        promotions: normalizeDbRows(promotions),
        total: promotions.length
      });
    } catch (error: any) {
      console.error('Error fetching active promotions:', error);
      return c.json({ success: true, promotions: [], total: 0 });
    }
  });

  /**
   * POST /promotions/validate-code
   * Validate a promotion/coupon code for checkout
   */
  app.post("/promotions/validate-code", async (c) => {
    try {
      const { code, vendorId, orderAmount, bookingAmount, orderType } = await c.req.json();

      if (!code) {
        return c.json({ valid: false, message: 'Coupon code is required' }, 400);
      }

      const now = new Date().toISOString();
      const amount = orderAmount || bookingAmount || 0;

      // Check in vendor promotions (products)
      if (orderType !== 'service') {
        const vendorPromo = await query(`
          SELECT * FROM vendor_promotions 
          WHERE code = $1 
            AND is_active = true 
            AND start_date <= $2 
            AND end_date >= $2
            ${vendorId ? 'AND vendor_id = $3::uuid' : ''}
          LIMIT 1
        `, vendorId ? [code.toUpperCase(), now, vendorId] : [code.toUpperCase(), now]);
        
        const vendorRows = Array.isArray(vendorPromo) ? vendorPromo : (vendorPromo as any).rows || [];
        
        if (vendorRows.length > 0) {
          const promo = normalizeDbRow(vendorRows[0]);
          
          // Check min order value
          if (promo.min_order_value && amount < promo.min_order_value) {
            return c.json({
              valid: false,
              message: `Minimum order value of ₹${promo.min_order_value} required`
            });
          }

          // Check usage limit
          if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
            return c.json({
              valid: false,
              message: 'This promotion has reached its usage limit'
            });
          }

          // Calculate discount
          let discountAmount = 0;
          if (promo.discount_type === 'percentage') {
            discountAmount = (amount * promo.discount_value) / 100;
            if (promo.max_discount_amount) {
              discountAmount = Math.min(discountAmount, promo.max_discount_amount);
            }
          } else {
            discountAmount = promo.discount_value;
          }

          return c.json({
            valid: true,
            promotion: promo,
            discount_amount: discountAmount,
            final_amount: Math.max(0, amount - discountAmount),
            promo_category: 'product'
          });
        }
      }

      // Check in vendor service promotions
      if (orderType !== 'product') {
        const servicePromo = await query(`
          SELECT * FROM vendor_service_promotions 
          WHERE code = $1 
            AND is_active = true 
            AND start_date <= $2 
            AND end_date >= $2
            ${vendorId ? 'AND vendor_id = $3::uuid' : ''}
          LIMIT 1
        `, vendorId ? [code.toUpperCase(), now, vendorId] : [code.toUpperCase(), now]);
        
        const serviceRows = Array.isArray(servicePromo) ? servicePromo : (servicePromo as any).rows || [];
        
        if (serviceRows.length > 0) {
          const promo = normalizeDbRow(serviceRows[0]);
          
          // Check min booking value
          if (promo.min_booking_value && amount < promo.min_booking_value) {
            return c.json({
              valid: false,
              message: `Minimum booking value of ₹${promo.min_booking_value} required`
            });
          }

          // Check usage limit
          if (promo.usage_limit && promo.usage_count >= promo.usage_limit) {
            return c.json({
              valid: false,
              message: 'This promotion has reached its usage limit'
            });
          }

          // Calculate discount
          let discountAmount = 0;
          if (promo.discount_type === 'percentage') {
            discountAmount = (amount * promo.discount_value) / 100;
            if (promo.max_discount_amount) {
              discountAmount = Math.min(discountAmount, promo.max_discount_amount);
            }
          } else {
            discountAmount = promo.discount_value || 0;
          }

          return c.json({
            valid: true,
            promotion: promo,
            discount_amount: discountAmount,
            final_amount: Math.max(0, amount - discountAmount),
            promo_category: 'service'
          });
        }
      }

      // Check platform-wide promotions
      const platformPromo = await query(`
        SELECT * FROM promotions 
        WHERE code = $1 
          AND is_active = true 
          AND start_date <= $2 
          AND end_date >= $2
          AND published = true
        LIMIT 1
      `, [code.toUpperCase(), now]);
      
      const platformRows = Array.isArray(platformPromo) ? platformPromo : (platformPromo as any).rows || [];
      
      if (platformRows.length > 0) {
        const promo = normalizeDbRow(platformRows[0]);
        
        // Check min order value
        if (promo.min_order_amount && amount < promo.min_order_amount) {
          return c.json({
            valid: false,
            message: `Minimum order value of ₹${promo.min_order_amount} required`
          });
        }

        // Calculate discount
        let discountAmount = 0;
        if (promo.discount_type === 'percentage') {
          discountAmount = (amount * promo.discount_value) / 100;
          if (promo.max_discount_amount) {
            discountAmount = Math.min(discountAmount, promo.max_discount_amount);
          }
        } else {
          discountAmount = promo.discount_value || 0;
        }

        return c.json({
          valid: true,
          promotion: promo,
          discount_amount: discountAmount,
          final_amount: Math.max(0, amount - discountAmount),
          promo_category: 'platform'
        });
      }

      return c.json({
        valid: false,
        message: 'Invalid or expired promotion code'
      });
    } catch (error: any) {
      console.error('Error validating promotion code:', error);
      return c.json({ valid: false, message: 'Error validating code' }, 500);
    }
  });

  /**
   * POST /promotions/apply
   * Apply a promotion and increment usage count
   */
  app.post("/promotions/apply-vendor", async (c) => {
    try {
      const { promotionId, promoCategory, bookingId, orderId, customerId, discountAmount } = await c.req.json();

      if (!promotionId) {
        return c.json({ error: 'promotionId is required' }, 400);
      }

      const table = promoCategory === 'service' ? 'vendor_service_promotions' : 'vendor_promotions';

      // Increment usage count
      await query(`
        UPDATE ${table} 
        SET usage_count = COALESCE(usage_count, 0) + 1,
            updated_at = NOW()
        WHERE id = $1::uuid
      `, [promotionId]);

      // Log usage
      try {
        await insert('promotion_usages', {
          promotion_id: promotionId,
          promotion_type: promoCategory,
          booking_id: bookingId || null,
          order_id: orderId || null,
          customer_id: customerId || null,
          discount_amount: discountAmount || 0,
          created_at: new Date().toISOString()
        });
      } catch (e) {
        // Table might not exist, ignore
      }

      return c.json({
        success: true,
        message: 'Promotion applied successfully'
      });
    } catch (error: any) {
      console.error('Error applying promotion:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
