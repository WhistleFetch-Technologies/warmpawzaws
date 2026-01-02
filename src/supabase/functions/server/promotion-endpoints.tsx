// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { Hono } from "hono";
import { sendSuccess, sendError } from "./response-utils";
import { getPromotionsRepository } from '../../../supabase/lib/repositories/index';

/**
 * PROMOTION MANAGEMENT ENDPOINTS
 * Handles active promotions, eligibility, and application
 */

export function promotionEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  /**
   * GET /promotions/active
   * Get active promotions for a service type or all
   */
  app.get(`${BASE_PATH}/promotions/active`, async (c) => {
    try {
      const serviceType = c.req.query('serviceType') || 'all';
      const customerId = c.req.query('customerId');
      const vendorRoleId = c.req.query('vendorRoleId');

      // ✅ SQL: Get all promotions from promotions table
      const promotionsRepo = getPromotionsRepository();
      const allPromotions = await promotionsRepo.findAll({});
      
      // ✅ SQL: Use repository method to filter active promotions
      const activePromotions = await promotionsRepo.findActive({
        roleId: vendorRoleId || undefined,
        serviceStyle: serviceType !== 'all' ? serviceType : undefined
      });
      
      // Additional filter by service type if needed (repository may not handle all cases)
      const filtered = activePromotions.filter((promo: any) => {
        if (serviceType !== 'all' && promo.applicable_services && promo.applicable_services.length > 0 && !promo.applicable_services.includes(serviceType)) {
          return false;
        }
        return true;
      });

      // Sort by priority (higher priority first) - already sorted by repository
      const sortedPromotions = filtered.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));

      return sendSuccess(c, { 
        promotions: sortedPromotions,
        count: sortedPromotions.length
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

      // ✅ SQL: Get promotion from promotions table
      const promotionsRepo = getPromotionsRepository();
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

      const discountPercentage = promotion.discount_value || 0;
      const discountType = promotion.discount_type || 'percentage';
      
      let discount = 0;
      if (discountType === 'percentage') {
        discount = (amount * discountPercentage) / 100;
      } else {
        discount = discountPercentage; // fixed amount
      }

      if (promotion.max_discount_amount) {
        discount = Math.min(discount, promotion.max_discount_amount);
        return sendSuccess(c, {
          promotion,
          discountAmount: discount,
          discountPercentage: discountType === 'percentage' ? discountPercentage : null,
          finalAmount: amount - discount
        });
      }

      return sendSuccess(c, {
        promotion,
        discountAmount: discount,
        discountPercentage: discountType === 'percentage' ? discountPercentage : null,
        finalAmount: amount - discount
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

      // ✅ SQL: Create promotion in promotions table
      const promotionsRepo = getPromotionsRepository();
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
      // ✅ SQL: Get all promotions from promotions table
      const promotionsRepo = getPromotionsRepository();
      const allPromotions = await promotionsRepo.findAll({});
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

      // ✅ SQL: Update promotion in promotions table
      const promotionsRepo = getPromotionsRepository();
      const existing = await promotionsRepo.findById(promotionId);

      if (!existing) {
        return sendError(c, 'Promotion not found', 404);
      }

      // Map updates to repository format
      const updateData: any = {};
      if (updates.title) updateData.name = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.discountPercentage !== undefined) updateData.discount_value = updates.discountPercentage;
      if (updates.maxDiscountAmount !== undefined) updateData.max_discount_amount = updates.maxDiscountAmount;
      if (updates.minOrderAmount !== undefined) updateData.min_order_amount = updates.minOrderAmount;
      if (updates.startDate) updateData.start_date = updates.startDate;
      if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
      if (updates.applicableServices) updateData.applicable_services = updates.applicableServices;
      if (updates.applicableRoles) updateData.applicable_roles = updates.applicableRoles;
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

      const updatedPromotion = await promotionsRepo.update(promotionId, updateData);

      return sendSuccess(c, { promotion: updatedPromotion }, 'Promotion updated successfully');
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

      // ✅ SQL: Soft delete promotion (set is_active = false)
      const promotionsRepo = getPromotionsRepository();
      await promotionsRepo.delete(promotionId);

      return sendSuccess(c, {}, 'Promotion deleted successfully');
    } catch (error) {
      console.error('Error deleting promotion:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Promotion endpoints registered');
}

