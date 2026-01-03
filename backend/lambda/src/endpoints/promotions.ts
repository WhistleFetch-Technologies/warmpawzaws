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
import { select, insert, update, query } from '../database/rds-connection';

export function registerPromotionEndpoints(app: Hono) {
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

      // Get promotion
      const promotions = await select('promotions', { id: promotionId, is_active: true });
      if (promotions.length === 0) {
        return c.json({ error: 'Promotion not found or inactive' }, 404);
      }

      const promotion = promotions[0];

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
}

