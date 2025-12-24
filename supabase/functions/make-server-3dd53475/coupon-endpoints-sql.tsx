/**
 * ============================================================================
 * COUPON ENDPOINTS (SQL-ONLY)
 * ============================================================================
 * 
 * Complete coupon management with SQL persistence.
 * Replaces: marketing-routes-v2.tsx and grooming-booking-apis.tsx KV-based coupon operations
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Full lifecycle: create, read, update, delete, validate, apply, usage tracking
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getCouponsRepository } from '../../lib/repositories/coupons.ts';
import { sendSuccess, sendError } from "./response-utils.ts";

export function registerCouponEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const couponsRepo = getCouponsRepository();

  /**
   * POST /coupon/validate
   * Validate a coupon code for a booking/order
   */
  app.post(`${BASE_PATH}/coupon/validate`, async (c) => {
    try {
      const body = await c.req.json();
      const { code, amount, customerId } = body;

      if (!code) {
        return sendError(c, 'Coupon code is required', 400);
      }

      if (amount === undefined) {
        return sendError(c, 'Order amount is required', 400);
      }

      const result = await couponsRepo.validateCoupon(code, amount, customerId);

      if (!result.valid) {
        return sendSuccess(c, {
          valid: false,
          error: result.error
        });
      }

      return sendSuccess(c, {
        valid: true,
        coupon: result.coupon,
        discountAmount: result.discount_amount,
        finalAmount: amount - (result.discount_amount || 0)
      });
    } catch (error) {
      console.error('Error validating coupon:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /coupons/apply
   * Apply a coupon to a booking/order and record usage
   */
  app.post(`${BASE_PATH}/coupons/apply`, async (c) => {
    try {
      const body = await c.req.json();
      const { code, orderAmount, customerId, orderId, bookingId } = body;

      if (!code) {
        return sendError(c, 'Coupon code is required', 400);
      }

      if (orderAmount === undefined) {
        return sendError(c, 'Order amount is required', 400);
      }

      // Validate coupon
      const validation = await couponsRepo.validateCoupon(code, orderAmount, customerId);

      if (!validation.valid || !validation.coupon) {
        return sendError(c, validation.error || 'Invalid coupon', 400);
      }

      const coupon = validation.coupon;

      // Record usage
      const usage = await couponsRepo.recordUsage(
        coupon.id,
        customerId,
        bookingId,
        orderId
      );

      return sendSuccess(c, {
        usage,
        coupon,
        discountAmount: validation.discount_amount,
        finalAmount: orderAmount - (validation.discount_amount || 0)
      }, 'Coupon applied successfully');
    } catch (error) {
      console.error('Error applying coupon:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/coupons
   * Get all coupons with filters (Admin)
   */
  app.get(`${BASE_PATH}/admin/coupons`, async (c) => {
    try {
      const search = c.req.query('search');
      const status = c.req.query('status'); // 'all' | 'active' | 'inactive'
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = (page - 1) * limit;

      const isActive = status === 'active' ? true : status === 'inactive' ? false : undefined;

      const coupons = await couponsRepo.findAll({
        is_active: isActive,
        search: search || undefined,
        limit,
        offset
      });

      // Get usage counts for each coupon
      const couponsWithUsage = await Promise.all(
        coupons.map(async (coupon) => {
          const usageCount = await couponsRepo.getUsageCount(coupon.id);
          return {
            ...coupon,
            usageCount,
            remainingUses: coupon.max_uses ? Math.max(0, coupon.max_uses - usageCount) : null
          };
        })
      );

      return sendSuccess(c, {
        coupons: couponsWithUsage,
        total: couponsWithUsage.length,
        page,
        limit
      });
    } catch (error) {
      console.error('Error fetching coupons:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/coupons/:couponId
   * Get a specific coupon (Admin)
   */
  app.get(`${BASE_PATH}/admin/coupons/:couponId`, async (c) => {
    try {
      const { couponId } = c.req.param();
      
      const coupon = await couponsRepo.findById(couponId);
      if (!coupon) {
        return sendError(c, 'Coupon not found', 404);
      }

      const usageCount = await couponsRepo.getUsageCount(coupon.id);
      const usages = await couponsRepo.getUsages(coupon.id, { limit: 100 });

      return sendSuccess(c, {
        coupon: {
          ...coupon,
          usageCount,
          usages
        }
      });
    } catch (error) {
      console.error('Error fetching coupon:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/coupons/create
   * Create a new coupon (Admin)
   */
  app.post(`${BASE_PATH}/admin/coupons/create`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        code,
        name,
        description,
        type, // 'percentage' | 'fixed'
        value,
        maxDiscount,
        minimumAmount,
        validFrom,
        validUntil,
        usageLimit,
        usageLimitPerCustomer,
        isActive
      } = body;

      if (!code || !name || !type || value === undefined) {
        return sendError(c, 'Missing required fields: code, name, type, value', 400);
      }

      const coupon = await couponsRepo.create({
        code: code.toUpperCase(),
        name,
        description,
        discount_type: type,
        discount_value: value,
        max_discount: maxDiscount,
        minimum_amount: minimumAmount,
        starts_at: validFrom,
        expires_at: validUntil,
        max_uses: usageLimit,
        max_uses_per_customer: usageLimitPerCustomer,
        is_active: isActive !== false
      });

      return sendSuccess(c, { coupon }, 'Coupon created successfully');
    } catch (error) {
      console.error('Error creating coupon:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/coupons/bulk-generate
   * Generate multiple coupons in bulk (Admin)
   */
  app.post(`${BASE_PATH}/admin/coupons/bulk-generate`, async (c) => {
    try {
      const body = await c.req.json();
      const {
        prefix = 'SAVE',
        quantity = 10,
        format = 'alphanumeric', // 'alphanumeric' | 'numeric'
        length = 8,
        discountType,
        discountValue,
        maxDiscount,
        minimumAmount,
        validFrom,
        validUntil,
        usageLimit = 1,
        usageLimitPerCustomer = 1,
        isActive = true
      } = body;

      if (!discountType || discountValue === undefined) {
        return sendError(c, 'Missing required fields: discountType, discountValue', 400);
      }

      const generatedCoupons = [];
      const errors = [];

      for (let i = 0; i < quantity; i++) {
        try {
          // Generate unique code
          let code = prefix;
          if (format === 'numeric') {
            code += Math.floor(100000 + Math.random() * 900000).toString();
          } else {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
            for (let j = 0; j < length; j++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
          }

          const coupon = await couponsRepo.create({
            code,
            name: `${prefix} Coupon ${i + 1}`,
            description: `Bulk generated coupon`,
            discount_type: discountType,
            discount_value: discountValue,
            max_discount: maxDiscount,
            minimum_amount: minimumAmount,
            starts_at: validFrom,
            expires_at: validUntil,
            max_uses: usageLimit,
            max_uses_per_customer: usageLimitPerCustomer,
            is_active: isActive
          });

          generatedCoupons.push(coupon);
        } catch (error) {
          errors.push({ index: i, error: String(error) });
        }
      }

      return sendSuccess(c, {
        coupons: generatedCoupons,
        generated: generatedCoupons.length,
        failed: errors.length,
        errors
      }, `Generated ${generatedCoupons.length} coupons`);
    } catch (error) {
      console.error('Error bulk generating coupons:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /admin/coupons/:couponId
   * Update a coupon (Admin)
   */
  app.put(`${BASE_PATH}/admin/coupons/:couponId`, async (c) => {
    try {
      const { couponId } = c.req.param();
      const body = await c.req.json();

      const updateData: any = {};
      if (body.code !== undefined) updateData.code = body.code.toUpperCase();
      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.type !== undefined) updateData.discount_type = body.type;
      if (body.value !== undefined) updateData.discount_value = body.value;
      if (body.maxDiscount !== undefined) updateData.max_discount = body.maxDiscount;
      if (body.minimumAmount !== undefined) updateData.minimum_amount = body.minimumAmount;
      if (body.validFrom !== undefined) updateData.starts_at = body.validFrom;
      if (body.validUntil !== undefined) updateData.expires_at = body.validUntil;
      if (body.usageLimit !== undefined) updateData.max_uses = body.usageLimit;
      if (body.usageLimitPerCustomer !== undefined) updateData.max_uses_per_customer = body.usageLimitPerCustomer;
      if (body.isActive !== undefined) updateData.is_active = body.isActive;

      const coupon = await couponsRepo.update(couponId, updateData);

      return sendSuccess(c, { coupon }, 'Coupon updated successfully');
    } catch (error) {
      console.error('Error updating coupon:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /admin/coupons/:couponId
   * Delete a coupon (soft delete) (Admin)
   */
  app.delete(`${BASE_PATH}/admin/coupons/:couponId`, async (c) => {
    try {
      const { couponId } = c.req.param();

      await couponsRepo.delete(couponId);

      return sendSuccess(c, { message: 'Coupon deleted successfully' });
    } catch (error) {
      console.error('Error deleting coupon:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /coupons/active
   * Get active coupons for customer display
   */
  app.get(`${BASE_PATH}/coupons/active`, async (c) => {
    try {
      const coupons = await couponsRepo.findAll({
        is_active: true
      });

      const now = new Date().toISOString();
      
      // Filter by date range
      const activeCoupons = coupons.filter(coupon => {
        if (coupon.starts_at && new Date(coupon.starts_at) > new Date(now)) return false;
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date(now)) return false;
        return true;
      });

      return sendSuccess(c, {
        coupons: activeCoupons,
        count: activeCoupons.length
      });
    } catch (error) {
      console.error('Error fetching active coupons:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/coupons/:couponId/usages
   * Get usage history for a coupon (Admin)
   */
  app.get(`${BASE_PATH}/admin/coupons/:couponId/usages`, async (c) => {
    try {
      const { couponId } = c.req.param();
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = (page - 1) * limit;

      const coupon = await couponsRepo.findById(couponId);
      if (!coupon) {
        return sendError(c, 'Coupon not found', 404);
      }

      const usages = await couponsRepo.getUsages(couponId, { limit, offset });

      return sendSuccess(c, {
        usages,
        total: usages.length,
        page,
        limit
      });
    } catch (error) {
      console.error('Error fetching coupon usages:', error);
      return sendError(c, error, 500);
    }
  });
}

