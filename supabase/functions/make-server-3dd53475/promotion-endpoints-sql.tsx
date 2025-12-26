/**
 * ✅ PROMOTION MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 * 
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * KV Operations: 9 → 0
 * 
 * Handles active promotions, eligibility, and application
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getPromotionsRepository } from '../../lib/repositories/promotions.ts';

export function promotionEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const promotionsRepo = getPromotionsRepository();

  /**
   * GET /promotions/active
   * Get active promotions for a service type or all
   */
  app.get(`${BASE_PATH}/promotions/active`, async (c) => {
    try {
      const serviceType = c.req.query('serviceType') || 'all';
      const customerId = c.req.query('customerId');
      const vendorRoleId = c.req.query('vendorRoleId');

      // ✅ SQL: Get all promotions
      const allPromotions = await promotionsRepo.findAll({ is_active: true });
      
      // Filter active promotions
      const now = new Date();
      const activePromotions = allPromotions.filter((promo: any) => {
        if (!promo.is_active) return false;
        
        const startDate = new Date(promo.start_date || 0);
        const endDate = promo.end_date ? new Date(promo.end_date) : null;
        
        if (now < startDate) return false;
        if (endDate && now > endDate) return false;
        
        // Filter by service type if specified
        if (serviceType !== 'all' && promo.applicable_services && !promo.applicable_services.includes(serviceType)) {
          return false;
        }
        
        // Filter by vendor role if specified
        if (vendorRoleId && promo.applicable_roles && !promo.applicable_roles.includes(vendorRoleId)) {
          return false;
        }
        
        return true;
      });

      // Sort by priority (higher priority first)
      activePromotions.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));

      return sendSuccess(c, { 
        promotions: activePromotions,
        count: activePromotions.length
      });
    } catch (error) {
      console.error('Error fetching active promotions:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /promotions/apply
   * Apply a promotion to a booking/order
   */
  app.post(`${BASE_PATH}/promotions/apply`, async (c) => {
    try {
      const { promotionId, bookingId, orderId, customerId, amount } = await c.req.json();

      if (!promotionId || !amount) {
        return sendError(c, 'Missing required fields: promotionId, amount', 400);
      }

      // ✅ SQL: Get promotion
      const promotion = await promotionsRepo.findById(promotionId);

      if (!promotion) {
        return sendError(c, 'Promotion not found', 404);
      }

      // Check if promotion is active
      const now = new Date();
      const startDate = new Date(promotion.start_date || 0);
      const endDate = promotion.end_date ? new Date(promotion.end_date) : null;

      if (!promotion.is_active || now < startDate || (endDate && now > endDate)) {
        return sendError(c, 'Promotion is not active', 400);
      }

      // Check eligibility
      if (promotion.min_order_amount && amount < promotion.min_order_amount) {
        return sendError(c, `Minimum order amount of ₹${promotion.min_order_amount} required`, 400);
      }

      // Calculate discount
      let discountAmount = 0;
      if (promotion.discount_type === 'percentage' && promotion.discount_value) {
        discountAmount = (amount * promotion.discount_value) / 100;
        if (promotion.max_discount_amount) {
          discountAmount = Math.min(discountAmount, promotion.max_discount_amount);
        }
      } else if (promotion.discount_type === 'fixed' && promotion.discount_value) {
        discountAmount = promotion.discount_value;
      }

      return sendSuccess(c, {
        promotion,
        discountAmount,
        discountPercentage: promotion.discount_type === 'percentage' ? promotion.discount_value : null,
        finalAmount: amount - discountAmount
      });
    } catch (error) {
      console.error('Error applying promotion:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/promotions
   * Create a new promotion (Admin only)
   */
  app.post(`${BASE_PATH}/admin/promotions`, async (c) => {
    try {
      const {
        title,
        description,
        discountPercentage,
        maxDiscountAmount,
        minOrderAmount,
        startDate,
        endDate,
        applicableServices,
        applicableRoles,
        priority,
        isActive
      } = await c.req.json();

      if (!title || !discountPercentage || !startDate) {
        return sendError(c, 'Missing required fields: title, discountPercentage, startDate', 400);
      }

      // ✅ SQL: Create promotion
      const promotion = await promotionsRepo.create({
        name: title,
        description: description || '',
        promotion_type: 'discount',
        discount_type: 'percentage',
        discount_value: Number(discountPercentage),
        max_discount_amount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
        min_order_amount: minOrderAmount ? Number(minOrderAmount) : 0,
        start_date: startDate,
        end_date: endDate || null,
        applicable_services: applicableServices || [],
        applicable_roles: applicableRoles || [],
        priority: priority || 0,
        is_active: isActive !== false
      });

      return sendSuccess(c, { promotion }, 'Promotion created successfully');
    } catch (error) {
      console.error('Error creating promotion:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/promotions
   * Get all promotions (Admin)
   */
  app.get(`${BASE_PATH}/admin/promotions`, async (c) => {
    try {
      // ✅ SQL: Get all promotions
      const allPromotions = await promotionsRepo.findAll();
      return sendSuccess(c, { promotions: allPromotions });
    } catch (error) {
      console.error('Error fetching promotions:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /admin/promotions/:promotionId
   * Update a promotion (Admin)
   */
  app.put(`${BASE_PATH}/admin/promotions/:promotionId`, async (c) => {
    try {
      const { promotionId } = c.req.param();
      const updates = await c.req.json();

      // ✅ SQL: Check if promotion exists
      const existing = await promotionsRepo.findById(promotionId);
      if (!existing) {
        return sendError(c, 'Promotion not found', 404);
      }

      // ✅ SQL: Update promotion
      const promotion = await promotionsRepo.update(promotionId, {
        ...updates,
        updated_at: new Date().toISOString()
      });

      return sendSuccess(c, { promotion }, 'Promotion updated successfully');
    } catch (error) {
      console.error('Error updating promotion:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /admin/promotions/:promotionId
   * Delete a promotion (Admin)
   */
  app.delete(`${BASE_PATH}/admin/promotions/:promotionId`, async (c) => {
    try {
      const { promotionId } = c.req.param();

      // ✅ SQL: Delete promotion
      await promotionsRepo.delete(promotionId);

      return sendSuccess(c, {}, 'Promotion deleted successfully');
    } catch (error) {
      console.error('Error deleting promotion:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Promotion endpoints (SQL-only) registered');
}
