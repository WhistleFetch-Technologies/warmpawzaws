/**
 * ============================================================================
 * SPOTLIGHT OFFERS ENDPOINTS (SQL-ONLY)
 * ============================================================================
 * 
 * Complete spotlight offers management with SQL persistence.
 * Replaces: Hardcoded spotlight offers in customer app components
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ Full lifecycle: create, read, update, delete, analytics
 * 
 * Date: 2025-01-22
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getSpotlightOffersRepository } from '../../lib/repositories/spotlight-offers.ts';
import { sendSuccess, sendError } from "./response-utils.ts";

export function registerSpotlightEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const spotlightRepo = getSpotlightOffersRepository();

  /**
   * GET /customer/spotlight-offers
   * Get active spotlight offers for customer app (by role/category)
   */
  app.get(`${BASE_PATH}/customer/spotlight-offers`, async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const serviceCategory = c.req.query('serviceCategory');

      if (!roleId) {
        return sendError(c, 'roleId query parameter is required', 400);
      }

      const offers = await spotlightRepo.findActiveByRole(roleId, serviceCategory || undefined);

      return sendSuccess(c, {
        offers,
        count: offers.length
      });
    } catch (error) {
      console.error('Error fetching spotlight offers:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/spotlight-offers
   * Get all spotlight offers with filters (Admin)
   */
  app.get(`${BASE_PATH}/admin/spotlight-offers`, async (c) => {
    try {
      const roleId = c.req.query('roleId');
      const serviceCategory = c.req.query('serviceCategory');
      const isActive = c.req.query('isActive');
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = (page - 1) * limit;

      const offers = await spotlightRepo.findAll({
        role_id: roleId || undefined,
        service_category: serviceCategory || undefined,
        is_active: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        limit,
        offset
      });

      return sendSuccess(c, {
        offers,
        total: offers.length,
        page,
        limit
      });
    } catch (error) {
      console.error('Error fetching spotlight offers:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /admin/spotlight-offers/:offerId
   * Get a specific spotlight offer (Admin)
   */
  app.get(`${BASE_PATH}/admin/spotlight-offers/:offerId`, async (c) => {
    try {
      const { offerId } = c.req.param();
      
      const offer = await spotlightRepo.findById(offerId);
      if (!offer) {
        return sendError(c, 'Spotlight offer not found', 404);
      }

      return sendSuccess(c, { offer });
    } catch (error) {
      console.error('Error fetching spotlight offer:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/spotlight-offers
   * Create a new spotlight offer (Admin)
   */
  app.post(`${BASE_PATH}/admin/spotlight-offers`, async (c) => {
    try {
      const body = await c.req.json();
      const {
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
        metadata,
        startDate,
        endDate,
        displayOrder,
        isActive
      } = body;

      if (!roleId || !title || !discountType) {
        return sendError(c, 'Missing required fields: roleId, title, discountType', 400);
      }

      const offer = await spotlightRepo.create({
        role_id: roleId,
        service_category: serviceCategory,
        title,
        subtitle,
        discount_type: discountType,
        discount_value: discountValue,
        badge_text: badgeText,
        icon,
        image_url: imageUrl,
        cta_text: ctaText,
        cta_link: ctaLink,
        metadata,
        start_date: startDate,
        end_date: endDate,
        display_order: displayOrder,
        is_active: isActive !== false
      });

      return sendSuccess(c, { offer }, 'Spotlight offer created successfully');
    } catch (error) {
      console.error('Error creating spotlight offer:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /admin/spotlight-offers/:offerId
   * Update a spotlight offer (Admin)
   */
  app.put(`${BASE_PATH}/admin/spotlight-offers/:offerId`, async (c) => {
    try {
      const { offerId } = c.req.param();
      const body = await c.req.json();

      const updateData: any = {};
      if (body.roleId !== undefined) updateData.role_id = body.roleId;
      if (body.serviceCategory !== undefined) updateData.service_category = body.serviceCategory;
      if (body.title !== undefined) updateData.title = body.title;
      if (body.subtitle !== undefined) updateData.subtitle = body.subtitle;
      if (body.discountType !== undefined) updateData.discount_type = body.discountType;
      if (body.discountValue !== undefined) updateData.discount_value = body.discountValue;
      if (body.badgeText !== undefined) updateData.badge_text = body.badgeText;
      if (body.icon !== undefined) updateData.icon = body.icon;
      if (body.imageUrl !== undefined) updateData.image_url = body.imageUrl;
      if (body.ctaText !== undefined) updateData.cta_text = body.ctaText;
      if (body.ctaLink !== undefined) updateData.cta_link = body.ctaLink;
      if (body.metadata !== undefined) updateData.metadata = body.metadata;
      if (body.startDate !== undefined) updateData.start_date = body.startDate;
      if (body.endDate !== undefined) updateData.end_date = body.endDate;
      if (body.displayOrder !== undefined) updateData.display_order = body.displayOrder;
      if (body.isActive !== undefined) updateData.is_active = body.isActive;

      const offer = await spotlightRepo.update(offerId, updateData);

      return sendSuccess(c, { offer }, 'Spotlight offer updated successfully');
    } catch (error) {
      console.error('Error updating spotlight offer:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * DELETE /admin/spotlight-offers/:offerId
   * Delete a spotlight offer (soft delete) (Admin)
   */
  app.delete(`${BASE_PATH}/admin/spotlight-offers/:offerId`, async (c) => {
    try {
      const { offerId } = c.req.param();

      await spotlightRepo.delete(offerId);

      return sendSuccess(c, { message: 'Spotlight offer deleted successfully' });
    } catch (error) {
      console.error('Error deleting spotlight offer:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /customer/spotlight-offers/:offerId/track
   * Track spotlight offer view, click, or apply (analytics)
   */
  app.post(`${BASE_PATH}/customer/spotlight-offers/:offerId/track`, async (c) => {
    try {
      const { offerId } = c.req.param();
      const body = await c.req.json();
      const { eventType, customerId } = body; // eventType: 'view' | 'click' | 'apply'

      if (!eventType || !['view', 'click', 'apply'].includes(eventType)) {
        return sendError(c, 'Invalid eventType. Must be "view", "click", or "apply"', 400);
      }

      // Verify offer exists
      const offer = await spotlightRepo.findById(offerId);
      if (!offer) {
        return sendError(c, 'Spotlight offer not found', 404);
      }

      // Record analytics
      await spotlightRepo.recordAnalytics(
        offerId,
        eventType as 'view' | 'click' | 'apply',
        customerId
      );

      return sendSuccess(c, { message: 'Analytics recorded' });
    } catch (error) {
      console.error('Error recording spotlight analytics:', error);
      return sendError(c, error, 500);
    }
  });
}

