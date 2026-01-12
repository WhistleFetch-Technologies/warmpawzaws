/**
 * ============================================================================
 * PROMOTIONS & COUPONS ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles promotions and coupons:
 * - Get active promotions
 * - Apply promotions/coupons
 * - Validate eligibility
 * 
 * Migrated from: supabase/functions/make-server-3dd53475/promotion-endpoints-sql.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query, deleteRows } from '../database/rds-connection';

export function registerPromotionEndpoints(app: Hono) {
  // ============================================================================
  // SPOTLIGHT ENDPOINTS
  // ============================================================================

  /**
   * GET /marketing/spotlights
   * Get all spotlight offers
   */
  app.get("/marketing/spotlights", async (c) => {
    try {
      const { roleId, category, active } = c.req.query();
      
      let queryStr = 'SELECT * FROM spotlight_offers WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (roleId) {
        queryStr += ` AND role_id = $${paramIndex}::text`;
        params.push(roleId);
        paramIndex++;
      }

      if (category) {
        queryStr += ` AND service_category = $${paramIndex}::text`;
        params.push(category);
        paramIndex++;
      }

      if (active === 'true' || active === undefined) {
        queryStr += ` AND is_active = true AND (end_date IS NULL OR end_date >= NOW())`;
      }

      queryStr += ` ORDER BY display_order ASC, created_at DESC`;

      const result = await query(queryStr, params);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];

      return c.json({
        success: true,
        spotlights: rows,
        total: rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching spotlights:', error);
      // If table doesn't exist, return empty array
      if (error.message && error.message.includes('does not exist')) {
        return c.json({ success: true, spotlights: [], total: 0 });
      }
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /marketing/spotlights
   * Create spotlight offer
   */
  app.post("/marketing/spotlights", async (c) => {
    try {
      const body = await c.req.json();
      const {
        vendorId,
        vendorName,
        type,
        durationDays,
        startDate,
        status,
        roleId,
        serviceCategory,
        title,
        subtitle,
        discountType,
        discountValue,
        badgeText,
        icon,
        imageUrl,
        ctaText,
        ctaLink,
      } = body;

      // Map vendor spotlight to spotlight_offers table
      const spotlight = await insert('spotlight_offers', {
        role_id: roleId || type || 'veterinarian',
        service_category: serviceCategory || null,
        title: title || `${vendorName} - Featured`,
        subtitle: subtitle || `Special offer from ${vendorName}`,
        discount_type: discountType || 'percentage',
        discount_value: discountValue || 0,
        badge_text: badgeText || 'Featured',
        icon: icon || '⭐',
        image_url: imageUrl || null,
        cta_text: ctaText || 'Book Now',
        cta_link: ctaLink || null,
        start_date: startDate ? new Date(startDate) : new Date(),
        end_date: durationDays ? new Date(Date.now() + parseInt(durationDays) * 24 * 60 * 60 * 1000) : null,
        is_active: status === 'active' || true,
        metadata: vendorId ? { vendorId, vendorName, type } : null,
      });

      return c.json({
        success: true,
        spotlight: spotlight[0],
        message: 'Spotlight created successfully',
      });
    } catch (error: any) {
      console.error('Error creating spotlight:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /marketing/spotlights/:id
   * Delete spotlight offer
   */
  app.delete("/marketing/spotlights/:id", async (c) => {
    try {
      const { id } = c.req.param();
      
      const spotlights = await select('spotlight_offers', { id });
      if (spotlights.length === 0) {
        return c.json({ error: 'Spotlight not found' }, 404);
      }

      await deleteRows('spotlight_offers', { id });

      return c.json({
        success: true,
        message: 'Spotlight deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting spotlight:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // PROMOTION ENDPOINTS
  // ============================================================================
  /**
   * GET /promotions/active
   * Get active promotions
   */
  app.get("/promotions/active", async (c) => {
    try {
      const serviceType = c.req.query('serviceType') || 'all';
      const customerId = c.req.query('customerId');
      const vendorRoleId = c.req.query('vendorRoleId');

      const now = new Date().toISOString().split('T')[0];

      let promotionsQuery = `
        SELECT * FROM promotions
        WHERE is_active = true
        AND start_date <= $1
        AND (end_date IS NULL OR end_date >= $1)
      `;

      const params: any[] = [now];
      let paramIndex = 2;

      if (serviceType !== 'all') {
        promotionsQuery += ` AND ($${paramIndex} = ANY(applicable_services) OR applicable_services IS NULL)`;
        params.push(serviceType);
        paramIndex++;
      }

      if (vendorRoleId) {
        promotionsQuery += ` AND ($${paramIndex} = ANY(applicable_roles) OR applicable_roles IS NULL)`;
        params.push(vendorRoleId);
        paramIndex++;
      }

      promotionsQuery += ` ORDER BY priority DESC, created_at DESC`;

      const promotions = await query(promotionsQuery, params);

      return c.json({
        success: true,
        promotions: promotions.rows,
        total: promotions.rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching promotions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /promotions/apply
   * Apply promotion to booking/order
   */
  app.post("/promotions/apply", async (c) => {
    try {
      const { promotionId, bookingId, orderId, amount } = await c.req.json();

      if (!promotionId || !amount) {
        return c.json({ error: 'promotionId and amount are required' }, 400);
      }

      // Get promotion with explicit UUID casting
      const promotions = await query(
        'SELECT * FROM promotions WHERE id = $1::uuid AND is_active = true',
        [promotionId]
      );
      const promoRows = Array.isArray(promotions) ? promotions : (promotions as any).rows || [];
      if (promoRows.length === 0) {
        return c.json({ error: 'Promotion not found or inactive' }, 404);
      }

      const promotion = promoRows[0];

      // Check eligibility
      const now = new Date();
      const startDate = new Date(promotion.start_date);
      const endDate = promotion.end_date ? new Date(promotion.end_date) : null;

      if (now < startDate || (endDate && now > endDate)) {
        return c.json({ error: 'Promotion is not currently active' }, 400);
      }

      if (promotion.min_order_amount && amount < parseFloat(promotion.min_order_amount)) {
        return c.json({
          error: `Minimum order amount of ₹${promotion.min_order_amount} required`,
        }, 400);
      }

      // Calculate discount
      let discountAmount = 0;
      if (promotion.discount_type === 'percentage') {
        discountAmount = (amount * parseFloat(promotion.discount_value || '0')) / 100;
        if (promotion.max_discount_amount) {
          discountAmount = Math.min(discountAmount, parseFloat(promotion.max_discount_amount));
        }
      } else if (promotion.discount_type === 'fixed') {
        discountAmount = parseFloat(promotion.discount_value || '0');
      }

      const finalAmount = Math.max(0, amount - discountAmount);

      return c.json({
        success: true,
        promotion: {
          id: promotion.id,
          name: promotion.name,
          discountType: promotion.discount_type,
          discountValue: promotion.discount_value,
        },
        originalAmount: amount,
        discountAmount,
        finalAmount,
      });
    } catch (error: any) {
      console.error('Error applying promotion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /coupons/validate/:couponCode
   * Validate coupon code
   */
  app.get("/coupons/validate/:couponCode", async (c) => {
    try {
      const { couponCode } = c.req.param();
      const amount = parseFloat(c.req.query('amount') || '0');

      const coupons = await select('coupons', { code: couponCode.toUpperCase(), is_active: true });
      if (coupons.length === 0) {
        return c.json({ error: 'Invalid coupon code' }, 404);
      }

      const coupon = coupons[0];

      // Check validity
      const now = new Date();
      const startDate = new Date(coupon.start_date);
      const endDate = coupon.end_date ? new Date(coupon.end_date) : null;

      if (now < startDate || (endDate && now > endDate)) {
        return c.json({ error: 'Coupon has expired' }, 400);
      }

      if (coupon.min_order_amount && amount < parseFloat(coupon.min_order_amount)) {
        return c.json({
          error: `Minimum order amount of ₹${coupon.min_order_amount} required`,
        }, 400);
      }

      // Check usage limit
      if (coupon.max_uses) {
        const usageCount = await query(
          'SELECT COUNT(*) as count FROM coupon_usages WHERE coupon_id = $1',
          [coupon.id]
        ).catch(() => ({ rows: [{ count: '0' }] }));

        if (parseInt(usageCount.rows[0]?.count || '0', 10) >= coupon.max_uses) {
          return c.json({ error: 'Coupon usage limit reached' }, 400);
        }
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.discount_type === 'percentage') {
        discountAmount = (amount * parseFloat(coupon.discount_value || '0')) / 100;
        if (coupon.max_discount_amount) {
          discountAmount = Math.min(discountAmount, parseFloat(coupon.max_discount_amount));
        }
      } else if (coupon.discount_type === 'fixed') {
        discountAmount = parseFloat(coupon.discount_value || '0');
      }

      return c.json({
        success: true,
        valid: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discount_type,
          discountValue: coupon.discount_value,
        },
        discountAmount,
      });
    } catch (error: any) {
      console.error('Error validating coupon:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /coupons/apply
   * Apply coupon code
   */
  app.post("/coupons/apply", async (c) => {
    try {
      const { couponCode, bookingId, orderId, customerId, amount } = await c.req.json();

      if (!couponCode || !amount) {
        return c.json({ error: 'couponCode and amount are required' }, 400);
      }

      // Validate coupon (reuse validation logic)
      const validation: any = await fetch(`/coupons/validate/${couponCode}?amount=${amount}`).then(r => r.json());
      if (!validation.success || !validation.valid) {
        return c.json({ error: validation.error || 'Invalid coupon' }, 400);
      }

      // Record usage
      if (customerId) {
        await insert('coupon_usages', {
          coupon_id: validation.coupon.id,
          customer_id: customerId,
          booking_id: bookingId || null,
          order_id: orderId || null,
          discount_amount: validation.discountAmount,
        }).catch(() => {
          // Graceful fallback if table doesn't exist
        });
      }

      return c.json({
        success: true,
        coupon: validation.coupon,
        discountAmount: validation.discountAmount,
        finalAmount: amount - validation.discountAmount,
      });
    } catch (error: any) {
      console.error('Error applying coupon:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // ADMIN ENDPOINTS - PROMOTIONS CRUD
  // ============================================================================

  /**
   * GET /admin/promotions/stats
   * Get promotion statistics
   */
  app.get("/admin/promotions/stats", async (c) => {
    try {
      const activePromotions = await query(
        'SELECT COUNT(*) as count FROM promotions WHERE is_active = true AND (end_date IS NULL OR end_date >= NOW())'
      );
      const totalConversions = await query(
        'SELECT COUNT(*) as count FROM promotion_usages'
      ).catch(() => ({ rows: [{ count: '0' }] }));
      const totalRevenue = await query(
        'SELECT COALESCE(SUM(discount_amount), 0) as total FROM promotion_usages'
      ).catch(() => ({ rows: [{ total: '0' }] }));
      const avgDiscount = await query(
        'SELECT COALESCE(AVG(discount_amount), 0) as avg FROM promotion_usages'
      ).catch(() => ({ rows: [{ avg: '0' }] }));

      return c.json({
        success: true,
        stats: {
          activePromotions: parseInt(activePromotions.rows[0]?.count || '0', 10),
          totalConversions: parseInt(totalConversions.rows[0]?.count || '0', 10),
          totalRevenue: parseFloat(totalRevenue.rows[0]?.total || '0'),
          avgDiscountGiven: parseFloat(avgDiscount.rows[0]?.avg || '0'),
        },
      });
    } catch (error: any) {
      console.error('Error fetching promotion stats:', error);
      return c.json({ 
        success: true, 
        stats: { 
          activePromotions: 0, 
          totalConversions: 0, 
          totalRevenue: 0, 
          avgDiscountGiven: 0 
        } 
      });
    }
  });

  /**
   * GET /admin/promotions
   * Get all promotions (admin)
   */
  app.get("/admin/promotions", async (c) => {
    try {
      const { type, status } = c.req.query();
      
      let queryStr = 'SELECT * FROM promotions WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (type) {
        queryStr += ` AND discount_type = $${paramIndex}::text`;
        params.push(type);
        paramIndex++;
      }

      if (status === 'active') {
        queryStr += ` AND is_active = true AND (end_date IS NULL OR end_date >= NOW())`;
      } else if (status === 'inactive') {
        queryStr += ` AND is_active = false`;
      } else if (status === 'expired') {
        queryStr += ` AND end_date < NOW()`;
      }

      queryStr += ` ORDER BY created_at DESC`;

      const result = await query(queryStr, params);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];

      return c.json({
        success: true,
        promotions: rows,
        total: rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching promotions:', error);
      // Graceful fallback for schema issues
      if (error.message && error.message.includes('operator does not exist')) {
        console.warn('⚠️ Schema issue with promotions query - returning empty array');
        return c.json({ success: true, promotions: [], total: 0 });
      }
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /admin/marketing/promotions
   * Alias for /admin/promotions (for compatibility)
   */
  app.get("/admin/marketing/promotions", async (c) => {
    // Forward to the main promotions endpoint
    return app.fetch(new Request(c.req.url.replace('/admin/marketing/promotions', '/admin/promotions'), c.req.raw));
  });

  /**
   * POST /admin/promotions
   * Create promotion (admin)
   */
  app.post("/admin/promotions", async (c) => {
    try {
      const body = await c.req.json();
      const {
        code,
        name,
        description,
        discount_type,
        discount_value,
        min_order_value,
        max_discount,
        valid_from,
        valid_until,
        usage_limit,
        usage_limit_per_user,
        applicable_to,
        is_active = true,
      } = body;

      if (!code || !name || !discount_type || discount_value === undefined) {
        return c.json({ error: 'code, name, discount_type, and discount_value are required' }, 400);
      }

      const promotion = await insert('promotions', {
        code: code.toUpperCase(),
        name,
        description,
        discount_type,
        discount_value,
        min_order_amount: min_order_value,
        max_discount_amount: max_discount,
        start_date: valid_from ? new Date(valid_from) : new Date(),
        end_date: valid_until ? new Date(valid_until) : null,
        max_uses: usage_limit,
        max_uses_per_user: usage_limit_per_user,
        applicable_to: applicable_to || 'all',
        is_active,
      });

      return c.json({
        success: true,
        promotion: promotion[0],
        message: 'Promotion created successfully',
      });
    } catch (error: any) {
      console.error('Error creating promotion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /admin/promotions/:id
   * Update promotion (admin)
   */
  app.put("/admin/promotions/:id", async (c) => {
    try {
      const { id } = c.req.param();
      const body = await c.req.json();

      const updateData: any = {};
      if (body.code !== undefined) updateData.code = body.code.toUpperCase();
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.discount_type !== undefined) updateData.discount_type = body.discount_type;
      if (body.discount_value !== undefined) updateData.discount_value = body.discount_value;
      if (body.min_order_value !== undefined) updateData.min_order_amount = body.min_order_value;
      if (body.max_discount !== undefined) updateData.max_discount_amount = body.max_discount;
      if (body.valid_from !== undefined) updateData.start_date = new Date(body.valid_from);
      if (body.valid_until !== undefined) updateData.end_date = body.valid_until ? new Date(body.valid_until) : null;
      if (body.usage_limit !== undefined) updateData.max_uses = body.usage_limit;
      if (body.usage_limit_per_user !== undefined) updateData.max_uses_per_user = body.usage_limit_per_user;
      if (body.applicable_to !== undefined) updateData.applicable_to = body.applicable_to;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      await update('promotions', { id }, updateData);

      // Use explicit UUID casting to avoid "uuid = text" errors
      const updated = await query(
        'SELECT * FROM promotions WHERE id = $1::uuid',
        [id]
      );
      const promoRows = Array.isArray(updated) ? updated : (updated as any).rows || [];
      return c.json({
        success: true,
        promotion: promoRows[0],
        message: 'Promotion updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating promotion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /admin/promotions/:id
   * Delete promotion (admin)
   */
  app.delete("/admin/promotions/:id", async (c) => {
    try {
      const { id } = c.req.param();

      await deleteRows('promotions', { id });

      return c.json({
        success: true,
        message: 'Promotion deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting promotion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // ADMIN ENDPOINTS - COUPONS CRUD
  // ============================================================================

  /**
   * GET /admin/coupons
   * Get all coupons (admin)
   */
  app.get("/admin/coupons", async (c) => {
    try {
      const { type, status } = c.req.query();
      
      let queryStr = 'SELECT * FROM coupons WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (type) {
        queryStr += ` AND discount_type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      if (status === 'active') {
        queryStr += ` AND is_active = true AND (end_date IS NULL OR end_date >= NOW())`;
      } else if (status === 'inactive') {
        queryStr += ` AND is_active = false`;
      } else if (status === 'expired') {
        queryStr += ` AND end_date < NOW()`;
      }

      queryStr += ` ORDER BY created_at DESC`;

      const result = await query(queryStr, params);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];

      return c.json({
        success: true,
        coupons: rows,
        total: rows.length,
      });
    } catch (error: any) {
      console.error('Error fetching coupons:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/coupons
   * Create coupon (admin)
   */
  app.post("/admin/coupons", async (c) => {
    try {
      const body = await c.req.json();
      const {
        code,
        discount_type,
        discount_value,
        min_order_value,
        max_discount,
        valid_from,
        valid_until,
        usage_limit,
        is_active = true,
      } = body;

      if (!code || !discount_type || discount_value === undefined) {
        return c.json({ error: 'code, discount_type, and discount_value are required' }, 400);
      }

      const coupon = await insert('coupons', {
        code: code.toUpperCase(),
        discount_type,
        discount_value,
        min_order_amount: min_order_value,
        max_discount_amount: max_discount,
        start_date: valid_from ? new Date(valid_from) : new Date(),
        end_date: valid_until ? new Date(valid_until) : null,
        max_uses: usage_limit,
        is_active,
      });

      return c.json({
        success: true,
        coupon: coupon[0],
        message: 'Coupon created successfully',
      });
    } catch (error: any) {
      console.error('Error creating coupon:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /admin/coupons/:id
   * Update coupon (admin)
   */
  app.put("/admin/coupons/:id", async (c) => {
    try {
      const { id } = c.req.param();
      const body = await c.req.json();

      const updateData: any = {};
      if (body.code !== undefined) updateData.code = body.code.toUpperCase();
      if (body.discount_type !== undefined) updateData.discount_type = body.discount_type;
      if (body.discount_value !== undefined) updateData.discount_value = body.discount_value;
      if (body.min_order_value !== undefined) updateData.min_order_amount = body.min_order_value;
      if (body.max_discount !== undefined) updateData.max_discount_amount = body.max_discount;
      if (body.valid_from !== undefined) updateData.start_date = new Date(body.valid_from);
      if (body.valid_until !== undefined) updateData.end_date = body.valid_until ? new Date(body.valid_until) : null;
      if (body.usage_limit !== undefined) updateData.max_uses = body.usage_limit;
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      await update('coupons', { id }, updateData);

      // Use explicit UUID casting to avoid "uuid = text" errors
      const updated = await query(
        'SELECT * FROM coupons WHERE id = $1::uuid',
        [id]
      );
      const couponRows = Array.isArray(updated) ? updated : (updated as any).rows || [];
      return c.json({
        success: true,
        coupon: couponRows[0],
        message: 'Coupon updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating coupon:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /admin/coupons/:id
   * Delete coupon (admin)
   */
  app.delete("/admin/coupons/:id", async (c) => {
    try {
      const { id } = c.req.param();

      await deleteRows('coupons', { id });

      return c.json({
        success: true,
        message: 'Coupon deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting coupon:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

