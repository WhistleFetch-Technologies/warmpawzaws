/**
 * ============================================================================
 * SQL-BASED COUPON ENDPOINTS
 * ============================================================================
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All operations wrapped in transactions
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient, withTransaction } from "../../lib/db.ts";

export function couponEndpointsSQL(app: Hono) {
  const client = getDbClient();

  /**
   * Validate coupon - SQL-BASED
   * POST /make-server-3dd53475/coupons/validate
   */
  app.post("/make-server-3dd53475/coupons/validate", async (c) => {
    try {
      const { code, customerId, amount } = await c.req.json();

      if (!code) {
        return sendError(c, 'Coupon code is required', 400);
      }

      const { data: coupon, error } = await client
        .from('coupons')
        .select('*')
        .eq('code', code.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !coupon) {
        return sendError(c, 'Invalid or expired coupon', 404);
      }

      // Check expiry (use end_date from schema)
      const endDate = coupon.end_date || coupon.expires_at;
      if (endDate && new Date(endDate) < new Date()) {
        return sendError(c, 'Coupon has expired', 400);
      }

      // Check start date
      const startDate = coupon.start_date;
      if (startDate && new Date(startDate) > new Date()) {
        return sendError(c, 'Coupon is not yet active', 400);
      }

      // Check minimum amount (use min_order_amount from schema)
      const minAmount = coupon.min_order_amount || coupon.minimum_amount;
      if (amount && minAmount && amount < minAmount) {
        return sendError(c, `Minimum order amount is ₹${minAmount}`, 400);
      }

      // Check usage limit
      if (coupon.max_uses) {
        const { data: usages, error: usageError } = await client
          .from('coupon_usages')
          .select('id')
          .eq('coupon_id', coupon.id);

        if (!usageError && usages && usages.length >= coupon.max_uses) {
          return sendError(c, 'Coupon usage limit reached', 400);
        }
      }

      // Check customer usage limit
      if (customerId && coupon.max_uses_per_customer) {
        const { data: customerUsages, error: customerUsageError } = await client
          .from('coupon_usages')
          .select('id')
          .eq('coupon_id', coupon.id)
          .eq('customer_id', customerId);

        if (!customerUsageError && customerUsages && customerUsages.length >= coupon.max_uses_per_customer) {
          return sendError(c, 'You have already used this coupon', 400);
        }
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.discount_type === 'percentage') {
        discountAmount = (amount * Number(coupon.discount_value)) / 100;
        // Note: max_discount may not exist in schema, check if it does
        if (coupon.max_discount) {
          discountAmount = Math.min(discountAmount, Number(coupon.max_discount));
        }
      } else {
        discountAmount = Number(coupon.discount_value);
      }

      return sendSuccess(c, {
        valid: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          discountType: coupon.discount_type,
          discountValue: coupon.discount_value,
          discountAmount,
        }
      });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to validate coupon', 500);
    }
  });

  /**
   * Apply coupon - SQL-BASED
   * POST /make-server-3dd53475/coupons/apply
   */
  app.post("/make-server-3dd53475/coupons/apply", async (c) => {
    try {
      const { code, customerId, bookingId, orderId } = await c.req.json();

      if (!code) {
        return sendError(c, 'Coupon code is required', 400);
      }

      return await withTransaction(async (txClient) => {
        // Validate coupon
        const { data: coupon, error: couponError } = await txClient
          .from('coupons')
          .select('*')
          .eq('code', code.toUpperCase())
          .eq('is_active', true)
          .single();

        if (couponError || !coupon) {
          return sendError(c, 'Invalid coupon', 404);
        }

        // Record usage
        await txClient.from('coupon_usages').insert({
          coupon_id: coupon.id,
          customer_id: customerId,
          booking_id: bookingId,
          order_id: orderId,
        });

        return sendSuccess(c, {
          couponId: coupon.id,
          code: coupon.code,
          discountType: coupon.discount_type,
          discountValue: coupon.discount_value,
        });
      });
    } catch (error: any) {
      return sendError(c, error.message || 'Failed to apply coupon', 500);
    }
  });
}

