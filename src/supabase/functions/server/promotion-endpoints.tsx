import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

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

      // Get all promotions
      const allPromotions = await kv.get('platform:promotions') || [];
      
      // Filter active promotions
      const now = new Date();
      const activePromotions = allPromotions.filter((promo: any) => {
        if (!promo.isActive) return false;
        
        const startDate = new Date(promo.startDate || 0);
        const endDate = promo.endDate ? new Date(promo.endDate) : null;
        
        if (now < startDate) return false;
        if (endDate && now > endDate) return false;
        
        // Filter by service type if specified
        if (serviceType !== 'all' && promo.applicableServices && !promo.applicableServices.includes(serviceType)) {
          return false;
        }
        
        // Filter by vendor role if specified
        if (vendorRoleId && promo.applicableRoles && !promo.applicableRoles.includes(vendorRoleId)) {
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

      // Get promotion
      const allPromotions = await kv.get('platform:promotions') || [];
      const promotion = allPromotions.find((p: any) => p.id === promotionId);

      if (!promotion) {
        return sendError(c, 'Promotion not found', 404);
      }

      // Check if promotion is active
      const now = new Date();
      const startDate = new Date(promotion.startDate || 0);
      const endDate = promotion.endDate ? new Date(promotion.endDate) : null;

      if (!promotion.isActive || now < startDate || (endDate && now > endDate)) {
        return sendError(c, 'Promotion is not active', 400);
      }

      // Check eligibility
      if (promotion.minOrderAmount && amount < promotion.minOrderAmount) {
        return sendError(c, `Minimum order amount of ₹${promotion.minOrderAmount} required`, 400);
      }

      if (promotion.maxDiscountAmount) {
        const discount = Math.min(
          (amount * (promotion.discountPercentage || 0)) / 100,
          promotion.maxDiscountAmount
        );
        return sendSuccess(c, {
          promotion,
          discountAmount: discount,
          discountPercentage: promotion.discountPercentage,
          finalAmount: amount - discount
        });
      }

      const discount = (amount * (promotion.discountPercentage || 0)) / 100;

      return sendSuccess(c, {
        promotion,
        discountAmount: discount,
        discountPercentage: promotion.discountPercentage,
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

      const promotionId = `promo_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const promotion = {
        id: promotionId,
        title,
        description: description || '',
        discountPercentage: Number(discountPercentage),
        maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : null,
        minOrderAmount: minOrderAmount ? Number(minOrderAmount) : 0,
        startDate,
        endDate: endDate || null,
        applicableServices: applicableServices || [],
        applicableRoles: applicableRoles || [],
        priority: priority || 0,
        isActive: isActive !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const allPromotions = await kv.get('platform:promotions') || [];
      allPromotions.push(promotion);
      await kv.set('platform:promotions', allPromotions);

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
      const allPromotions = await kv.get('platform:promotions') || [];
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

      const allPromotions = await kv.get('platform:promotions') || [];
      const index = allPromotions.findIndex((p: any) => p.id === promotionId);

      if (index === -1) {
        return sendError(c, 'Promotion not found', 404);
      }

      allPromotions[index] = {
        ...allPromotions[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set('platform:promotions', allPromotions);

      return sendSuccess(c, { promotion: allPromotions[index] }, 'Promotion updated successfully');
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

      const allPromotions = await kv.get('platform:promotions') || [];
      const filtered = allPromotions.filter((p: any) => p.id !== promotionId);

      await kv.set('platform:promotions', filtered);

      return sendSuccess(c, {}, 'Promotion deleted successfully');
    } catch (error) {
      console.error('Error deleting promotion:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Promotion endpoints registered');
}

