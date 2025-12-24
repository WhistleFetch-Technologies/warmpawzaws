/**
 * ============================================================================
 * PROMOTION MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Handles active promotions, eligibility, and application
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2024-12-23
 * Migration: Phase 1, Task 1.3 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getPromotionsRepository } from "../../lib/repositories/promotions.ts";

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

      // ✅ SQL: Get active promotions
      const filters: { roleId?: string; serviceStyle?: string } = {};
      if (vendorRoleId && vendorRoleId !== 'all') {
        filters.roleId = vendorRoleId;
      }
      if (serviceType && serviceType !== 'all') {
        filters.serviceStyle = serviceType;
      }
      
      const activePromotions = await promotionsRepo.findActive(filters);

      // Map to API response format
      const promotions = activePromotions.map((promo) => ({
        id: promo.id,
        title: promo.name,
        description: promo.description,
        discountPercentage: promo.discount_type === 'percentage' ? promo.discount_value : null,
        discountAmount: promo.discount_type === 'fixed' ? promo.discount_value : null,
        maxDiscountAmount: promo.max_discount_amount,
        minOrderAmount: promo.min_order_amount || 0,
        startDate: promo.start_date,
        endDate: promo.end_date,
        applicableServices: promo.applicable_services || [],
        applicableRoles: promo.applicable_roles || [],
        priority: promo.priority || 0,
        isActive: promo.is_active,
        usageLimit: promo.usage_limit,
        usageCount: promo.usage_count || 0,
      }));

      console.log(`✅ [PROMOTIONS-SQL] Found ${promotions.length} active promotions`);
      
      return sendSuccess(c, { 
        promotions,
        count: promotions.length
      });
    } catch (error) {
      console.error('❌ [PROMOTIONS-SQL] Error fetching active promotions:', error);
      return sendError(c, `Failed to fetch promotions: ${String(error)}`, 500);
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
      const startDate = new Date(promotion.start_date);
      const endDate = new Date(promotion.end_date);

      if (!promotion.is_active || now < startDate || now > endDate) {
        return sendError(c, 'Promotion is not active', 400);
      }

      // Check usage limit
      if (promotion.usage_limit && (promotion.usage_count || 0) >= promotion.usage_limit) {
        return sendError(c, 'Promotion usage limit reached', 400);
      }

      // Check eligibility
      if (promotion.min_order_amount && amount < promotion.min_order_amount) {
        return sendError(c, `Minimum order amount of ₹${promotion.min_order_amount} required`, 400);
      }

      // Calculate discount
      let discount = 0;
      if (promotion.discount_type === 'percentage' && promotion.discount_value) {
        discount = (amount * promotion.discount_value) / 100;
        if (promotion.max_discount_amount) {
          discount = Math.min(discount, promotion.max_discount_amount);
        }
      } else if (promotion.discount_type === 'fixed' && promotion.discount_value) {
        discount = promotion.discount_value;
      }

      // Increment usage count
      if (promotion.usage_limit) {
        await promotionsRepo.update(promotionId, {
          usage_count: (promotion.usage_count || 0) + 1
        });
      }

      console.log(`✅ [PROMOTIONS-SQL] Applied promotion ${promotionId}, discount: ₹${discount}`);

      return sendSuccess(c, {
        promotion: {
          id: promotion.id,
          name: promotion.name,
          discountPercentage: promotion.discount_type === 'percentage' ? promotion.discount_value : null,
          discountAmount: discount,
        },
        discountAmount: discount,
        discountPercentage: promotion.discount_type === 'percentage' ? promotion.discount_value : null,
        finalAmount: amount - discount
      });
    } catch (error) {
      console.error('❌ [PROMOTIONS-SQL] Error applying promotion:', error);
      return sendError(c, `Failed to apply promotion: ${String(error)}`, 500);
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
        discountAmount,
        maxDiscountAmount,
        minOrderAmount,
        startDate,
        endDate,
        applicableServices,
        applicableRoles,
        priority,
        isActive,
        usageLimit
      } = await c.req.json();

      if (!title || (!discountPercentage && !discountAmount) || !startDate || !endDate) {
        return sendError(c, 'Missing required fields: title, discount (percentage or amount), startDate, endDate', 400);
      }

      // Determine discount type and value
      const discountType = discountPercentage !== undefined ? 'percentage' : 'fixed';
      const discountValue = discountPercentage !== undefined ? parseFloat(discountPercentage) : parseFloat(discountAmount);

      // ✅ SQL: Create promotion
      const promotion = await promotionsRepo.create({
        name: title,
        description: description || '',
        promotion_type: 'discount',
        discount_type: discountType,
        discount_value: discountValue,
        max_discount_amount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
        min_order_amount: minOrderAmount ? parseFloat(minOrderAmount) : 0,
        start_date: startDate,
        end_date: endDate,
        priority: priority || 0,
        applicable_services: applicableServices || [],
        applicable_roles: applicableRoles || [],
        usage_limit: usageLimit || null,
        usage_count: 0,
        is_active: isActive !== false,
      });

      console.log(`✅ [PROMOTIONS-SQL] Created promotion: ${promotion.id}`);

      return sendSuccess(c, { 
        promotion: {
          id: promotion.id,
          title: promotion.name,
          description: promotion.description,
          discountPercentage: promotion.discount_type === 'percentage' ? promotion.discount_value : null,
          discountAmount: promotion.discount_type === 'fixed' ? promotion.discount_value : null,
          maxDiscountAmount: promotion.max_discount_amount,
          minOrderAmount: promotion.min_order_amount,
          startDate: promotion.start_date,
          endDate: promotion.end_date,
          applicableServices: promotion.applicable_services || [],
          applicableRoles: promotion.applicable_roles || [],
          priority: promotion.priority || 0,
          isActive: promotion.is_active,
          usageLimit: promotion.usage_limit,
          usageCount: promotion.usage_count || 0,
        }
      }, 'Promotion created successfully');
    } catch (error) {
      console.error('❌ [PROMOTIONS-SQL] Error creating promotion:', error);
      return sendError(c, `Failed to create promotion: ${String(error)}`, 500);
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
      
      const promotions = allPromotions.map((promo) => ({
        id: promo.id,
        title: promo.name,
        description: promo.description,
        discountPercentage: promo.discount_type === 'percentage' ? promo.discount_value : null,
        discountAmount: promo.discount_type === 'fixed' ? promo.discount_value : null,
        maxDiscountAmount: promo.max_discount_amount,
        minOrderAmount: promo.min_order_amount || 0,
        startDate: promo.start_date,
        endDate: promo.end_date,
        applicableServices: promo.applicable_services || [],
        applicableRoles: promo.applicable_roles || [],
        priority: promo.priority || 0,
        isActive: promo.is_active,
        usageLimit: promo.usage_limit,
        usageCount: promo.usage_count || 0,
        createdAt: promo.created_at,
        updatedAt: promo.updated_at,
      }));

      console.log(`✅ [PROMOTIONS-SQL] Found ${promotions.length} promotions`);
      
      return sendSuccess(c, { promotions });
    } catch (error) {
      console.error('❌ [PROMOTIONS-SQL] Error fetching promotions:', error);
      return sendError(c, `Failed to fetch promotions: ${String(error)}`, 500);
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

      // Map API fields to database fields
      const updateData: any = {};
      if (updates.title !== undefined) updateData.name = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.discountPercentage !== undefined) {
        updateData.discount_type = 'percentage';
        updateData.discount_value = parseFloat(updates.discountPercentage);
      }
      if (updates.discountAmount !== undefined) {
        updateData.discount_type = 'fixed';
        updateData.discount_value = parseFloat(updates.discountAmount);
      }
      if (updates.maxDiscountAmount !== undefined) updateData.max_discount_amount = parseFloat(updates.maxDiscountAmount);
      if (updates.minOrderAmount !== undefined) updateData.min_order_amount = parseFloat(updates.minOrderAmount);
      if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
      if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
      if (updates.priority !== undefined) updateData.priority = parseInt(updates.priority);
      if (updates.applicableServices !== undefined) updateData.applicable_services = updates.applicableServices;
      if (updates.applicableRoles !== undefined) updateData.applicable_roles = updates.applicableRoles;
      if (updates.usageLimit !== undefined) updateData.usage_limit = updates.usageLimit ? parseInt(updates.usageLimit) : null;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

      // ✅ SQL: Update promotion
      const promotion = await promotionsRepo.update(promotionId, updateData);

      console.log(`✅ [PROMOTIONS-SQL] Updated promotion: ${promotionId}`);

      return sendSuccess(c, { 
        promotion: {
          id: promotion.id,
          title: promotion.name,
          description: promotion.description,
          discountPercentage: promotion.discount_type === 'percentage' ? promotion.discount_value : null,
          discountAmount: promotion.discount_type === 'fixed' ? promotion.discount_value : null,
          maxDiscountAmount: promotion.max_discount_amount,
          minOrderAmount: promotion.min_order_amount,
          startDate: promotion.start_date,
          endDate: promotion.end_date,
          applicableServices: promotion.applicable_services || [],
          applicableRoles: promotion.applicable_roles || [],
          priority: promotion.priority || 0,
          isActive: promotion.is_active,
          usageLimit: promotion.usage_limit,
          usageCount: promotion.usage_count || 0,
        }
      }, 'Promotion updated successfully');
    } catch (error) {
      console.error('❌ [PROMOTIONS-SQL] Error updating promotion:', error);
      return sendError(c, `Failed to update promotion: ${String(error)}`, 500);
    }
  });

  /**
   * DELETE /admin/promotions/:promotionId
   * Delete a promotion (Admin) - Soft delete by setting is_active to false
   */
  app.delete(`${BASE_PATH}/admin/promotions/:promotionId`, async (c) => {
    try {
      const { promotionId } = c.req.param();

      // ✅ SQL: Soft delete promotion
      await promotionsRepo.delete(promotionId);

      console.log(`✅ [PROMOTIONS-SQL] Deleted promotion: ${promotionId}`);

      return sendSuccess(c, {}, 'Promotion deleted successfully');
    } catch (error) {
      console.error('❌ [PROMOTIONS-SQL] Error deleting promotion:', error);
      return sendError(c, `Failed to delete promotion: ${String(error)}`, 500);
    }
  });

  console.log('✅ [PROMOTIONS-SQL] Promotion endpoints registered (SQL-only)');
}

