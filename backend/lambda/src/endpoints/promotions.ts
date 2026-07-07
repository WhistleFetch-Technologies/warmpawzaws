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
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, insert, update, query, deleteRows } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';
import {
  listApplicableBookingPromotions,
  resolveBookingPromotions,
} from '../lib/services/booking-promotion-service';
import { validateCouponInternal as validatePlatformCouponInternal } from '../lib/services/platform-coupon-service';
import {
  getAnalyticsEngine,
  isAnalyticsAuthoritative,
  isAnalyticsEnabled,
} from '../discount-engine/analytics';
import {
  shadowPlatformInlineEligibility,
} from '../discount-engine/rules/adapters/shadow-adapters';
import {
  buildPromotionPersistenceFromAdminBody,
  mergeAdminPromotionUpdateBody,
  normalizePromotionDiscountType as normalizeAdminPromotionDiscountType,
  parseDateInput as parseAdminDateInput,
} from '../utils/promotion-admin-persistence';
import { isPromotionLiveInIst } from '../utils/promotion-date-bounds';
import { promotionCategoriesMatch } from '../utils/platform-promotion-matching';

async function persistPromotionInsert(promotionData: Record<string, unknown>) {
  const payload = { ...promotionData };
  for (;;) {
    try {
      return await insert('promotions', payload);
    } catch (insertError: unknown) {
      const msg = String((insertError as { message?: string })?.message || '');
      if (msg.includes('column "code"') && payload.code) {
        console.warn('[Promotions] Code column does not exist, retrying without code');
        delete payload.code;
        continue;
      }
      if (msg.includes('column "applicable_to"') && payload.applicable_to !== undefined) {
        console.warn('[Promotions] applicable_to column missing, persisting in metadata');
        const baseMeta =
          payload.metadata && typeof payload.metadata === 'object'
            ? { ...(payload.metadata as Record<string, unknown>) }
            : {};
        baseMeta.applicableTo = payload.applicable_to;
        payload.metadata = baseMeta;
        delete payload.applicable_to;
        continue;
      }
      if (
        (msg.includes('column "max_uses"') || msg.includes('column "max_uses_per_user"')) &&
        (payload.max_uses !== undefined || payload.max_uses_per_user !== undefined)
      ) {
        console.warn('[Promotions] max_uses column(s) missing, persisting via usage_limit/metadata');
        if (payload.max_uses !== undefined && payload.usage_limit === undefined) {
          payload.usage_limit = payload.max_uses;
        }
        if (payload.max_uses_per_user !== undefined) {
          const baseMeta =
            payload.metadata && typeof payload.metadata === 'object'
              ? { ...(payload.metadata as Record<string, unknown>) }
              : {};
          baseMeta.maxUsesPerUser = payload.max_uses_per_user;
          payload.metadata = baseMeta;
        }
        delete payload.max_uses;
        delete payload.max_uses_per_user;
        continue;
      }
      throw insertError;
    }
  }
}

async function persistPromotionUpdate(id: string, updateData: Record<string, unknown>) {
  const payload = { ...updateData };
  for (;;) {
    try {
      await update('promotions', { id }, payload);
      return;
    } catch (updateError: unknown) {
      const msg = String((updateError as { message?: string })?.message || '');
      if (msg.includes('column "applicable_to"') && payload.applicable_to !== undefined) {
        console.warn('[Promotions] applicable_to column missing on update, persisting in metadata');
        const baseMeta =
          payload.metadata && typeof payload.metadata === 'object'
            ? { ...(payload.metadata as Record<string, unknown>) }
            : {};
        baseMeta.applicableTo = payload.applicable_to;
        payload.metadata = baseMeta;
        delete payload.applicable_to;
        continue;
      }
      if (
        (msg.includes('column "max_uses"') || msg.includes('column "max_uses_per_user"')) &&
        (payload.max_uses !== undefined || payload.max_uses_per_user !== undefined)
      ) {
        console.warn('[Promotions] max_uses column(s) missing on update, persisting via usage_limit/metadata');
        if (payload.max_uses !== undefined && payload.usage_limit === undefined) {
          payload.usage_limit = payload.max_uses;
        }
        if (payload.max_uses_per_user !== undefined) {
          const baseMeta =
            payload.metadata && typeof payload.metadata === 'object'
              ? { ...(payload.metadata as Record<string, unknown>) }
              : {};
          baseMeta.maxUsesPerUser = payload.max_uses_per_user;
          payload.metadata = baseMeta;
        }
        delete payload.max_uses;
        delete payload.max_uses_per_user;
        continue;
      }
      throw updateError;
    }
  }
}

export function registerPromotionEndpoints(app: Hono) {
  const normalizePromotionDiscountType = (raw: unknown): 'percentage' | 'fixed' => {
    const value = String(raw || 'percentage').trim().toLowerCase();
    if (value === 'flat') return 'fixed';
    if (value === 'fixed') return 'fixed';
    return 'percentage';
  };

  const parseDateInput = (raw: unknown): string | null => {
    if (raw === null || raw === undefined) return null;
    const value = String(raw).trim();
    if (!value) return null;

    // Accept datetime-local (`YYYY-MM-DDTHH:mm`) and date inputs.
    const normalized = value.includes('T') ? value : `${value}T00:00:00`;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split('T')[0];
  };

  const normalizeStyle = (raw: unknown): string => {
    const value = String(raw || '').trim().toLowerCase();
    if (!value) return '';
    if (value === 'home' || value === 'at_home' || value === 'home_visit') return 'at_home';
    if (value === 'clinic' || value === 'center' || value === 'at_center') return 'at_center';
    if (value === 'online') return 'tele';
    return value;
  };

  const parseServicesList = (raw: unknown): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map((x) => String(x).trim()).filter(Boolean) : [];
      } catch {
        return [raw.trim()].filter(Boolean);
      }
    }
    return [];
  };

  const extractPromotionStyle = (promotion: any): string => {
    const services = parseServicesList(promotion?.applicable_services);
    const fromServices = services.find((s) => s.startsWith('style:'));
    if (fromServices) return normalizeStyle(fromServices.replace(/^style:/, ''));
    return normalizeStyle(
      promotion?.service_style ??
      promotion?.metadata?.serviceStyle ??
      promotion?.metadata?.promotionTarget?.serviceStyle
    );
  };

  const extractPromotionCategory = (promotion: any): string => {
    const services = parseServicesList(promotion?.applicable_services);
    const fromServices = services.find((s) => !String(s).startsWith('style:'));
    return String(
      promotion?.service_category ??
      promotion?.serviceCategory ??
      promotion?.metadata?.serviceCategory ??
      promotion?.metadata?.promotionTarget?.serviceCategory ??
      fromServices ??
      ''
    ).trim().toLowerCase();
  };

  const isPromotionEligible = (promotion: any, params: { category?: string; serviceStyle?: string; serviceIds?: string[]; amount?: number }) => {
    const now = new Date();
    const startIso = promotion.start_date ? String(promotion.start_date) : new Date(0).toISOString();
    const endIso = promotion.end_date ? String(promotion.end_date) : new Date('2099-12-31').toISOString();
    let legacy: { eligible: boolean; reason: string | null };
    if (!isPromotionLiveInIst(startIso, endIso, now)) {
      legacy = { eligible: false, reason: 'Promotion is not active' };
    } else if (
      (promotion.usage_limit != null && promotion.usage_count >= promotion.usage_limit) ||
      (promotion.max_uses != null && promotion.usage_count >= promotion.max_uses)
    ) {
      legacy = { eligible: false, reason: 'Promotion has reached its usage limit' };
    } else {
      const amount = Number(params.amount || 0);
      const minOrder = promotion.min_order_amount != null ? parseFloat(String(promotion.min_order_amount)) : 0;
      if (minOrder > 0 && amount > 0 && amount < minOrder) {
        legacy = { eligible: false, reason: `Minimum order amount of ₹${minOrder} required` };
      } else {
        const category = String(params.category || '').trim().toLowerCase();
        const style = normalizeStyle(params.serviceStyle || '');
        const serviceIds = (params.serviceIds || []).map((x) => String(x).trim()).filter(Boolean);
        const configured = parseServicesList(promotion.applicable_services);
        const configuredCategories = configured.filter((x) => !x.startsWith('style:'));
        const configuredStyles = configured
          .filter((x) => x.startsWith('style:'))
          .map((x) => normalizeStyle(x.replace(/^style:/, '')));
        const configuredServiceIds = configured.filter((x) => isValidUUID(String(x)));

        if (
          category &&
          category !== 'all' &&
          configuredCategories.length > 0 &&
          !configuredCategories.some((token) => promotionCategoriesMatch(category, token))
        ) {
          legacy = { eligible: false, reason: 'Promotion not applicable for this category' };
        } else if (
          style &&
          style !== 'all' &&
          configuredStyles.length > 0 &&
          !configuredStyles.includes(style)
        ) {
          legacy = { eligible: false, reason: 'Promotion not applicable for this service style' };
        } else if (
          serviceIds.length > 0 &&
          configuredServiceIds.length > 0 &&
          !serviceIds.some((sid) => configuredServiceIds.includes(sid))
        ) {
          legacy = { eligible: false, reason: 'Promotion not applicable for selected service' };
        } else {
          legacy = { eligible: true, reason: null };
        }
      }
    }
    return shadowPlatformInlineEligibility(promotion, { ...params, now }, legacy);
  };

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
        is_active,
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
        display_order,
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
        is_active: is_active !== false && status !== 'inactive',
        display_order: display_order ?? 0,
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
   * GET /promotions/list
   * Phase 0.1: Get promotions filtered by service and published status
   * Query params: service, published (true/false), spotlight (optional)
   */
  app.get("/promotions/list", async (c) => {
    try {
      const service = c.req.query('service');
      const published = c.req.query('published');
      const spotlight = c.req.query('spotlight');

      const now = new Date().toISOString().split('T')[0];

      let queryStr = `
        SELECT * FROM promotions
        WHERE is_active = true
        AND start_date <= $1
        AND (end_date IS NULL OR end_date >= $1)
      `;
      const params: any[] = [now];
      let paramIndex = 2;

      // Filter by published status
      if (published === 'true') {
        queryStr += ` AND published = true`;
      } else if (published === 'false') {
        queryStr += ` AND published = false`;
      }

      // Filter by spotlight
      if (spotlight === 'true') {
        queryStr += ` AND is_spotlight = true`;
      }

      // Filter by service (check applicable_services JSONB array)
      if (service && service !== 'all') {
        queryStr += ` AND (
          applicable_services IS NULL 
          OR applicable_services = '[]'::jsonb
          OR applicable_services @> $${paramIndex}::jsonb
        )`;
        params.push(JSON.stringify([service]));
        paramIndex++;
      }

      // Order: spotlight first, then by priority (lower number = higher priority)
      queryStr += ` ORDER BY is_spotlight DESC, priority ASC, created_at DESC`;

      const result = await query(queryStr, params);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      const promotions = rows.map((row: any) => {
        const serviceCategory = extractPromotionCategory(row);
        const serviceStyle = extractPromotionStyle(row);
        const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        return {
          ...row,
          service_category: row.service_category ?? serviceCategory ?? null,
          service_style: row.service_style ?? serviceStyle ?? null,
          serviceCategory: row.serviceCategory ?? row.service_category ?? serviceCategory ?? null,
          serviceStyle: row.serviceStyle ?? row.service_style ?? serviceStyle ?? null,
          metadata: {
            ...(metadata as Record<string, unknown>),
            promotionTarget: {
              ...(((metadata as any)?.promotionTarget || {}) as Record<string, unknown>),
              serviceCategory: (metadata as any)?.promotionTarget?.serviceCategory ?? (metadata as any)?.serviceCategory ?? serviceCategory ?? null,
              serviceStyle: (metadata as any)?.promotionTarget?.serviceStyle ?? (metadata as any)?.serviceStyle ?? serviceStyle ?? null,
            },
            serviceCategory: (metadata as any)?.serviceCategory ?? serviceCategory ?? null,
            serviceStyle: (metadata as any)?.serviceStyle ?? serviceStyle ?? null,
          },
        };
      });

      return c.json({
        success: true,
        promotions,
        total: promotions.length,
      });
    } catch (error: any) {
      console.error('Error fetching promotions list:', error);
      // Graceful fallback if schema fields don't exist yet
      if (error.message && (error.message.includes('does not exist') || error.message.includes('column'))) {
        console.warn('⚠️ Schema issue - returning empty array');
        return c.json({ success: true, promotions: [], total: 0 });
      }
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /promotions/active
   * Get active promotions
   */
  const handleActivePromotions = async (c: any) => {
    try {
      const serviceType = c.req.query('serviceType') || 'all';
      const customerId = c.req.query('customerId');
      const vendorRoleId = c.req.query('vendorRoleId');

      const now = new Date().toISOString().split('T')[0];

      let promotionsQuery = `
        SELECT * FROM promotions
        WHERE is_active = true
        AND published = true
        AND start_date <= $1
        AND (end_date IS NULL OR end_date >= $1)
        AND (usage_limit IS NULL OR usage_count < usage_limit)
        AND (max_uses IS NULL OR usage_count < max_uses)
      `;

      const params: any[] = [now];
      let paramIndex = 2;

      if (serviceType !== 'all') {
        const isProductScope = serviceType === 'product' || serviceType === 'shop';
        promotionsQuery += ` AND (
          applicable_services IS NULL
          OR COALESCE(LOWER(applicable_to), 'all') IN ('all', 'products')
          OR (
            metadata IS NOT NULL
            AND (
              metadata->'targetScopes' @> '"products"'::jsonb
              OR LOWER(COALESCE(metadata->>'applicableTo', '')) = 'products'
            )
          )
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(applicable_services) = 'array' THEN applicable_services ELSE '[]'::jsonb END
            ) AS svc(val)
            WHERE svc.val = $${paramIndex}
               OR (${isProductScope} AND svc.val IN ('product', 'shop', 'ecom', 'ecommerce'))
               OR (${isProductScope} AND svc.val ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
          )
        )`;
        params.push(serviceType);
        paramIndex++;
      }

      if (vendorRoleId) {
        promotionsQuery += ` AND (
          applicable_roles IS NULL
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(applicable_roles) = 'array' THEN applicable_roles ELSE '[]'::jsonb END
            ) AS role(val)
            WHERE role.val = $${paramIndex}
          )
        )`;
        params.push(vendorRoleId);
        paramIndex++;
      }

      promotionsQuery += ` ORDER BY priority DESC, created_at DESC`;

      const promotions = await query(promotionsQuery, params);
      const promotionRows = promotions.rows ?? [];

      let couponRows: Record<string, unknown>[] = [];
      try {
        const couponResult = await query(
          `SELECT id, code, name, description, discount_type, discount_value,
                  COALESCE(min_order_amount, min_amount) AS min_order_amount,
                  COALESCE(max_discount_amount, max_discount) AS max_discount_amount,
                  start_date, end_date,
                  COALESCE(max_uses, usage_limit) AS max_uses,
                  usage_count
           FROM coupons
           WHERE is_active = true
             AND (start_date IS NULL OR start_date <= $1)
             AND (end_date IS NULL OR end_date >= $1)
             AND (COALESCE(max_uses, usage_limit) IS NULL
                  OR COALESCE(usage_count, 0) < COALESCE(max_uses, usage_limit))`,
          [now]
        );
        couponRows = couponResult.rows ?? [];
      } catch (couponErr) {
        console.warn('[promotions/active] coupons merge skipped', couponErr);
      }

      const couponAsPromotions = couponRows.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        title: c.name,
        description: c.description,
        discount_type: c.discount_type,
        discount_value: c.discount_value,
        min_order_amount: c.min_order_amount,
        max_discount_amount: c.max_discount_amount,
        start_date: c.start_date,
        end_date: c.end_date,
        valid_from: c.start_date,
        valid_until: c.end_date,
        source: 'platform_coupon',
        published: true,
        is_active: true,
      }));

      const seenCodes = new Set<string>();
      const merged = [...promotionRows, ...couponAsPromotions].filter((row) => {
        const code = String(row.code ?? '').trim().toUpperCase();
        if (!code) return true;
        if (seenCodes.has(code)) return false;
        seenCodes.add(code);
        return true;
      });

      return c.json({
        success: true,
        promotions: merged,
        total: merged.length,
      });
    } catch (error: any) {
      console.error('Error fetching promotions:', error);
      return c.json({ error: error.message }, 500);
    }
  };

  app.get("/promotions/active", handleActivePromotions);
  // Backward-compat alias for older customer web builds
  app.get("/ecommerce/promotions/active", handleActivePromotions);

  /**
   * POST /promotions/apply
   * Apply promotion to booking/order
   */
  app.post("/promotions/apply", async (c) => {
    try {
      const {
        promotionId,
        bookingId,
        orderId,
        amount,
        category,
        serviceStyle,
        serviceId,
        selectedServiceIds,
      } = await c.req.json();
      const serviceIds = [
        ...(Array.isArray(selectedServiceIds) ? selectedServiceIds : []),
        ...(serviceId ? [serviceId] : []),
      ].map((x) => String(x).trim()).filter(Boolean);

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

      const eligibility = isPromotionEligible(promotion, { category, serviceStyle, serviceIds, amount });
      if (!eligibility.eligible) {
        return c.json({
          success: false,
          promotionId: promotion.id,
          discountAmount: 0,
          finalAmount: Number(amount),
          reasonIfRejected: eligibility.reason || 'Promotion is not eligible',
        }, 200);
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
        promotionId: promotion.id,
        discountAmount,
        finalAmount,
        reasonIfRejected: null,
        promotion: {
          id: promotion.id,
          name: promotion.name,
          discountType: promotion.discount_type,
          discountValue: promotion.discount_value,
        },
      });
    } catch (error: any) {
      console.error('Error applying promotion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /promotions/validate?code=XXX
   * ✅ Phase 2.3: Validate promotion code (alias for coupons/validate)
   * Customer-facing endpoint for promotion validation
   */
  app.get("/promotions/validate", async (c) => {
    try {
      const promotionCode = c.req.query('code');
      if (!promotionCode) {
        return c.json({ valid: false, message: 'Promotion code is required' }, 400);
      }

      // Use same validation logic as coupons
      const result = await query(
        `SELECT * FROM promotions 
         WHERE code = $1 
         AND is_active = true 
         AND (start_date IS NULL OR start_date <= NOW())
         AND (end_date IS NULL OR end_date >= NOW())
         AND published = true
         AND (usage_limit IS NULL OR usage_count < usage_limit)
         AND (max_uses IS NULL OR usage_count < max_uses)
         LIMIT 1`,
        [promotionCode]
      );

      const rows = Array.isArray(result) ? result : (result as any).rows || [];
      
      if (rows.length === 0) {
        return c.json({
          valid: false,
          message: 'Invalid or expired promotion code'
        });
      }

      const promotion = normalizeDbRow(rows[0]);
      
      return c.json({
        valid: true,
        promotion: {
          id: promotion.id,
          name: promotion.name || promotion.title,
          code: promotion.code,
          discount_type: promotion.discount_type,
          discount_value: promotion.discount_value,
          description: promotion.description,
          applicable_services: promotion.applicable_services || [],
        }
      });
    } catch (error: any) {
      console.error('Error validating promotion:', error);
      return c.json({ valid: false, error: error.message }, 500);
    }
  });

  /**
   * GET /coupons/validate/:couponCode
   * Validate coupon code
   */
  app.get("/coupons/validate/:couponCode", async (c) => {
    try {
      const { couponCode } = c.req.param();
      const amount = parseFloat(c.req.query('amount') || c.req.query('orderAmount') || '0');

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
   * @deprecated Legacy inline validation — delegates to platform-coupon-service (Phase 8B).
   * Retained for handler compatibility; removal candidate Phase 8C.
   */
  async function validateCouponInternal(couponCode: string, amount: number): Promise<{
    success: boolean;
    valid: boolean;
    coupon?: { id: string; code: string; name: string; discountType: string; discountValue: string };
    discountAmount?: number;
    error?: string;
  }> {
    return validatePlatformCouponInternal(couponCode, amount);
  }

  /**
   * POST /coupons/apply
   * Apply coupon code
   * ✅ FIX GAP 7.1: Uses internal validation function instead of fetch()
   */
  app.post("/coupons/apply", async (c) => {
    try {
      const { couponCode, bookingId, orderId, customerId, amount } = await c.req.json();

      if (!couponCode || !amount) {
        return c.json({ error: 'couponCode and amount are required' }, 400);
      }

      // ✅ FIX: Use internal validation function instead of fetch()
      // fetch() with relative URL won't work in Lambda environment
      const validation = await validateCouponInternal(couponCode, amount);
      if (!validation.success || !validation.valid) {
        return c.json({ error: validation.error || 'Invalid coupon' }, 400);
      }

      // Record usage
      if (customerId && validation.coupon) {
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
        finalAmount: amount - (validation.discountAmount || 0),
      });
    } catch (error: any) {
      console.error('Error applying coupon:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // BOOKING PROMOTIONS (service providers — auto-apply)
  // ============================================================================

  /**
   * POST /promotions/calculate-booking
   * Server source of truth for service booking promotion stack.
   */
  app.post('/promotions/calculate-booking', async (c) => {
    try {
      const body = await c.req.json();
      const vendorId = String(body.vendorId || body.vendor_id || '').trim();
      const amount = parseFloat(String(body.amount ?? body.bookingAmount ?? 0)) || 0;
      const serviceStyle = body.serviceStyle || body.service_style;
      const customerId = body.customerId || body.customer_id;
      const serviceCategory = body.serviceCategory || body.service_category || body.category;
      const serviceIdsRaw = body.serviceIds || body.service_ids || body.selectedServiceIds;
      const serviceIds = Array.isArray(serviceIdsRaw)
        ? serviceIdsRaw.map((x: unknown) => String(x)).filter(Boolean)
        : body.serviceId || body.service_id
          ? [String(body.serviceId || body.service_id)]
          : [];

      if (!vendorId || amount <= 0) {
        return c.json({ success: false, error: 'vendorId and amount are required' }, 400);
      }

      const couponCode = body.couponCode || body.coupon_code;

      const result = await resolveBookingPromotions({
        vendorId,
        serviceIds,
        serviceStyle,
        amount,
        customerId: customerId ? String(customerId) : undefined,
        serviceCategory: serviceCategory ? String(serviceCategory) : undefined,
        couponCode: couponCode ? String(couponCode).trim() : undefined,
      });

      return c.json({
        success: true,
        originalAmount: result.originalAmount,
        vendorDiscountAmount: result.vendorDiscountAmount,
        platformDiscountAmount: result.platformDiscountAmount,
        totalSavings: result.totalSavings,
        finalAmount: result.finalAmount,
        applied: result.applied,
        vendorPromotionId: result.vendorPromotionId,
        platformPromotionId: result.platformPromotionId,
        bestPromotion: result.applied[0]
          ? {
              id: result.applied[0].id,
              source: result.applied[0].source,
              name: result.applied[0].name,
              calculatedDiscount: result.applied[0].discountAmount,
            }
          : null,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('Error calculating booking promotions:', msg);
      return c.json({ success: false, error: msg }, 500);
    }
  });

  // ============================================================================
  // PUBLIC: APPLICABLE PROMOTIONS (customer checkout – no admin auth)
  // ============================================================================

  /**
   * GET /promotions/applicable
   * Get applicable promotions for checkout. Used by customer-web (UniversalPaymentPage).
   * Not under /admin/* so customers are not blocked by requireAdmin().
   * Query params: category, serviceStyle, amount
   */
  app.get("/promotions/applicable", async (c) => {
    try {
      const category = c.req.query('category') || 'all';
      const serviceStyle = c.req.query('serviceStyle') || 'all';
      const vendorId = c.req.query('vendorId') || c.req.query('vendor_id');
      const customerId = c.req.query('customerId') || c.req.query('customer_id');
      const serviceId = c.req.query('serviceId');
      const selectedServiceIdsRaw = c.req.query('selectedServiceIds');
      const selectedServiceIds = String(selectedServiceIdsRaw || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (serviceId) selectedServiceIds.push(String(serviceId));
      const amount = parseFloat(c.req.query('amount') || '0');

      if (vendorId && vendorId !== 'default' && amount > 0) {
        const offers = await listApplicableBookingPromotions({
          vendorId: String(vendorId),
          serviceIds: selectedServiceIds,
          serviceStyle: serviceStyle !== 'all' ? serviceStyle : undefined,
          amount,
          customerId: customerId ? String(customerId) : undefined,
          serviceCategory: category !== 'all' ? category : undefined,
        });

        const promotions = offers.map((o) => ({
          id: o.id,
          source: o.source,
          name: o.title,
          title: o.title,
          description: o.description,
          discountType: o.discountType,
          discountValue: o.discountValue,
          discountAmount: o.discountAmount,
          promotion_type: o.promotionType || (o.isSpotlight ? 'spotlight' : 'flash_sale'),
          autoApplyEligible: o.autoApplyEligible,
          is_spotlight: o.isSpotlight === true,
        }));

        return c.json({
          success: true,
          promotions,
          total: promotions.length,
        });
      }

      const now = new Date().toISOString().split('T')[0];

      let queryStr = `
        SELECT * FROM promotions
        WHERE is_active = true
        AND published = true
        AND (start_date IS NULL OR start_date <= $1)
        AND (end_date IS NULL OR end_date >= $1)
        AND (usage_limit IS NULL OR usage_count < usage_limit)
        AND (max_uses IS NULL OR usage_count < max_uses)
      `;

      const params: any[] = [now];
      let paramIndex = 2;

      if (amount > 0) {
        queryStr += ` AND (min_order_amount IS NULL OR min_order_amount <= $${paramIndex})`;
        params.push(amount);
        paramIndex++;
      }

      queryStr += ` ORDER BY priority DESC, discount_value DESC LIMIT 20`;

      const result = await query(queryStr, params);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];

      const promotions = rows
        .filter((promo: any) =>
          isPromotionEligible(promo, { category, serviceStyle, serviceIds: selectedServiceIds, amount }).eligible
        )
        .map((promo: any) => ({
        id: promo.id,
        code: promo.code,
        name: promo.name || promo.title,
        description: promo.description,
        discountType: promo.discount_type,
        discountValue: parseFloat(promo.discount_value || '0'),
        minOrderAmount: parseFloat(promo.min_order_amount || '0'),
        maxDiscountAmount: parseFloat(promo.max_discount_amount || '0'),
        applicableServices: promo.applicable_services,
        serviceStyle: extractPromotionStyle(promo) || 'all',
        expiresAt: promo.end_date,
      }));

      return c.json({
        success: true,
        promotions,
        total: promotions.length,
      });
    } catch (error: any) {
      console.error('Error fetching applicable promotions:', error);
      if (error.message && (error.message.includes('does not exist') || error.message.includes('column'))) {
        return c.json({ success: true, promotions: [], total: 0 });
      }
      return c.json({ success: true, promotions: [], total: 0 });
    }
  });

  // ============================================================================
  // ADMIN ENDPOINTS - PROMOTIONS CRUD
  // ============================================================================

  /**
   * GET /admin/promotions/applicable
   * Get applicable promotions for checkout (admin UI; same logic as /promotions/applicable)
   * Query params: category, serviceStyle, amount
   */
  app.get("/admin/promotions/applicable", async (c) => {
    try {
      const category = c.req.query('category') || 'all';
      const serviceStyle = c.req.query('serviceStyle') || 'all';
      const serviceId = c.req.query('serviceId');
      const selectedServiceIdsRaw = c.req.query('selectedServiceIds');
      const selectedServiceIds = String(selectedServiceIdsRaw || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (serviceId) selectedServiceIds.push(String(serviceId));
      const amount = parseFloat(c.req.query('amount') || '0');

      const now = new Date().toISOString().split('T')[0];

      let queryStr = `
        SELECT * FROM promotions
        WHERE is_active = true
        AND (start_date IS NULL OR start_date <= $1)
        AND (end_date IS NULL OR end_date >= $1)
        AND (usage_limit IS NULL OR usage_count < usage_limit)
        AND (max_uses IS NULL OR usage_count < max_uses)
      `;
      
      const params: any[] = [now];
      let paramIndex = 2;

      // Filter by minimum order amount
      if (amount > 0) {
        queryStr += ` AND (min_order_amount IS NULL OR min_order_amount <= $${paramIndex})`;
        params.push(amount);
        paramIndex++;
      }

      queryStr += ` ORDER BY priority DESC, discount_value DESC LIMIT 20`;

      const result = await query(queryStr, params);
      const rows = Array.isArray(result) ? result : (result as any).rows || [];

      // Format promotions for frontend
      const promotions = rows
        .filter((promo: any) =>
          isPromotionEligible(promo, { category, serviceStyle, serviceIds: selectedServiceIds, amount }).eligible
        )
        .map((promo: any) => ({
        id: promo.id,
        code: promo.code,
        name: promo.name || promo.title,
        description: promo.description,
        discountType: promo.discount_type,
        discountValue: parseFloat(promo.discount_value || '0'),
        minOrderAmount: parseFloat(promo.min_order_amount || '0'),
        maxDiscountAmount: parseFloat(promo.max_discount_amount || '0'),
        applicableServices: promo.applicable_services,
        serviceStyle: extractPromotionStyle(promo) || 'all',
        expiresAt: promo.end_date,
      }));

      return c.json({
        success: true,
        promotions,
        total: promotions.length,
      });
    } catch (error: any) {
      console.error('Error fetching applicable promotions:', error);
      // Return empty array on error, not 500
      if (error.message && (error.message.includes('does not exist') || error.message.includes('column'))) {
        return c.json({ success: true, promotions: [], total: 0 });
      }
      return c.json({ success: true, promotions: [], total: 0 });
    }
  });

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
        ...(isAnalyticsEnabled() && isAnalyticsAuthoritative()
          ? {
              engineStats: (await getAnalyticsEngine().generateReport({ domain: 'ALL' }))?.promotions
                ?.totals,
            }
          : {}),
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
   * GET /marketing/promotions
   * Get all promotions (admin UI endpoint)
   */
  app.get("/marketing/promotions", async (c) => {
    try {
      const { type, status, active } = c.req.query();
      
      let queryStr = 'SELECT * FROM promotions WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      // Only filter by active status if explicitly requested
      // By default, return ALL promotions (both active and inactive) for admin UI
      if (active === 'true') {
        queryStr += ` AND is_active = true AND (end_date IS NULL OR end_date >= NOW())`;
      } else if (active === 'false') {
        queryStr += ` AND (is_active = false OR end_date < NOW())`;
      }
      // If active is undefined, don't filter - return all promotions

      if (type) {
        queryStr += ` AND promotion_type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      if (status) {
        queryStr += ` AND is_active = $${paramIndex}`;
        params.push(status === 'active');
        paramIndex++;
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
      if (error.message && error.message.includes('does not exist')) {
        return c.json({ success: true, promotions: [], total: 0 });
      }
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /marketing/promotions
   * Create promotion (admin UI endpoint)
   */
  app.post("/marketing/promotions", async (c) => {
    try {
      const body = await c.req.json();
      const {
        name,
        title, // Frontend sends 'title' instead of 'name'
        code: codeInput,
        description,
        subtitle, // Frontend may send 'subtitle' as description
        promotionType,
        type,
        discountType,
        discountValue,
        discount_type, // Backend format
        discount_value, // Backend format
        minOrderAmount,
        min_order_amount,
        maxDiscountAmount,
        max_discount_amount,
        startDate,
        endDate,
        validFrom,
        validUntil,
        isActive = true,
        active,
        applicableServices,
        applicable_services,
        applicableRoles,
        serviceCategory,
        serviceStyle,
        metadata,
        priority = 0,
        is_spotlight = false,
        published,
      } = body;

      // Support both frontend field names (title, discountType, discountValue) and backend names (name, discount_type, discount_value)
      const finalName = name || title || '';
      const finalDescription = description || subtitle || '';
      const finalDiscountType = normalizePromotionDiscountType(discountType || discount_type);
      const finalDiscountValue = discountValue !== undefined ? discountValue : (discount_value !== undefined ? discount_value : 0);
      const finalPromotionType = promotionType || type || 'flash_sale';

      if (!finalName || !finalDiscountType || finalDiscountValue === undefined) {
        return c.json({ 
          error: 'name/title, discountType/discount_type, and discountValue/discount_value are required',
          received: {
            name: finalName || null,
            title: title || null,
            discountType: finalDiscountType || null,
            discountValue: finalDiscountValue !== undefined ? finalDiscountValue : null,
            promotionType: finalPromotionType || null,
          }
        }, 400);
      }

      // Phase 0.1: Support both frontend field names and DB column names
      const finalStartDate = parseDateInput(startDate ?? validFrom) || new Date().toISOString().split('T')[0];
      const finalEndDate = parseDateInput(endDate ?? validUntil);
      const finalIsActive = active !== undefined ? active : (isActive !== false);
      const finalServiceCategory = String(serviceCategory || '').trim().toLowerCase();
      const finalServiceStyle = normalizeStyle(serviceStyle || '');
      const incomingMetadata = metadata && typeof metadata === 'object' ? metadata : {};
      const baseApplicableServices = parseServicesList(applicable_services || applicableServices);
      const finalApplicableServices = (() => {
        const next = [...baseApplicableServices];
        if (finalServiceCategory && finalServiceCategory !== 'all') next.push(finalServiceCategory);
        if (finalServiceStyle && finalServiceStyle !== 'all') next.push(`style:${finalServiceStyle}`);
        return Array.from(new Set(next));
      })();
      const finalPublished = published === undefined ? true : published === true;

      // Build promotion data, only include code if column exists
      const promotionData: any = {
        name: finalName,
        description: finalDescription,
        promotion_type: finalPromotionType,
        discount_type: finalDiscountType,
        discount_value: parseFloat(String(finalDiscountValue)),
        min_order_amount: (minOrderAmount || min_order_amount) ? parseFloat(String(minOrderAmount || min_order_amount)) : null,
        max_discount_amount: (maxDiscountAmount || max_discount_amount) ? parseFloat(String(maxDiscountAmount || max_discount_amount)) : null,
        start_date: finalStartDate,
        end_date: finalEndDate,
        is_active: finalIsActive,
        applicable_services: finalApplicableServices.length > 0 ? JSON.stringify(finalApplicableServices) : null,
        service_category: finalServiceCategory || null,
        service_style: finalServiceStyle || null,
        applicable_roles: applicableRoles || null,
        metadata: {
          ...(incomingMetadata as Record<string, unknown>),
          promotionTarget: {
            ...(((incomingMetadata as any)?.promotionTarget || {}) as Record<string, unknown>),
            serviceCategory: finalServiceCategory || 'all',
            serviceStyle: finalServiceStyle || 'all',
          },
          serviceCategory: finalServiceCategory || 'all',
          serviceStyle: finalServiceStyle || 'all',
        },
        priority: parseInt(String(priority)) || 0,
        is_spotlight: is_spotlight === true,
        published: finalPublished,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Only add code if provided (column may not exist in all environments)
      if (codeInput) {
        promotionData.code = String(codeInput).toUpperCase();
      }

      let promotion;
      try {
        promotion = await insert('promotions', promotionData);
      } catch (insertError: any) {
        // If error is about missing 'code' column, retry without it
        if (insertError.message && insertError.message.includes('column "code"') && promotionData.code) {
          console.warn('[Promotions] Code column does not exist, retrying without code');
          delete promotionData.code;
          promotion = await insert('promotions', promotionData);
        } else {
          throw insertError;
        }
      }

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
   * PUT /marketing/promotions/:id
   * Update promotion (admin UI endpoint)
   */
  app.put("/marketing/promotions/:id", async (c) => {
    try {
      const { id } = c.req.param();
      const body = await c.req.json();

      const promotions = await select('promotions', { id });
      if (promotions.length === 0) {
        return c.json({ error: 'Promotion not found' }, 404);
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.code !== undefined) updateData.code = String(body.code).toUpperCase();
      if (body.description !== undefined) updateData.description = body.description;
      if (body.promotionType !== undefined) updateData.promotion_type = body.promotionType;
      if (body.type !== undefined) updateData.promotion_type = body.type;
      if (body.discountType !== undefined) updateData.discount_type = normalizePromotionDiscountType(body.discountType);
      if (body.discount_type !== undefined) updateData.discount_type = normalizePromotionDiscountType(body.discount_type);
      if (body.discountValue !== undefined) updateData.discount_value = parseFloat(body.discountValue);
      if (body.minOrderAmount !== undefined) updateData.min_order_amount = body.minOrderAmount ? parseFloat(body.minOrderAmount) : null;
      if (body.maxDiscountAmount !== undefined) updateData.max_discount_amount = body.maxDiscountAmount ? parseFloat(body.maxDiscountAmount) : null;
      if (body.startDate !== undefined) updateData.start_date = parseDateInput(body.startDate) || new Date().toISOString().split('T')[0];
      if (body.validFrom !== undefined) updateData.start_date = parseDateInput(body.validFrom) || new Date().toISOString().split('T')[0];
      if (body.endDate !== undefined) updateData.end_date = parseDateInput(body.endDate);
      if (body.validUntil !== undefined) updateData.end_date = parseDateInput(body.validUntil);
      if (body.isActive !== undefined) updateData.is_active = body.isActive !== false;
      if (body.active !== undefined) updateData.is_active = body.active !== false;
      if (body.applicableServices !== undefined) updateData.applicable_services = body.applicableServices ? (Array.isArray(body.applicableServices) ? JSON.stringify(body.applicableServices) : body.applicableServices) : null;
      if (body.applicable_services !== undefined) updateData.applicable_services = body.applicable_services ? (Array.isArray(body.applicable_services) ? JSON.stringify(body.applicable_services) : body.applicable_services) : null;
      if (body.serviceCategory !== undefined) updateData.service_category = String(body.serviceCategory || '').trim().toLowerCase() || null;
      if (body.service_category !== undefined) updateData.service_category = String(body.service_category || '').trim().toLowerCase() || null;
      if (body.serviceStyle !== undefined) updateData.service_style = normalizeStyle(body.serviceStyle) || null;
      if (body.service_style !== undefined) updateData.service_style = normalizeStyle(body.service_style) || null;
      if (body.serviceCategory !== undefined || body.serviceStyle !== undefined) {
        const existing = parseServicesList(promotions[0].applicable_services);
        const withoutStyle = existing.filter((x) => !x.startsWith('style:'));
        const nextCategory = String(body.serviceCategory ?? withoutStyle[0] ?? 'all').trim().toLowerCase();
        const nextStyle = normalizeStyle(body.serviceStyle);
        const merged: string[] = [];
        if (nextCategory && nextCategory !== 'all') merged.push(nextCategory);
        if (nextStyle && nextStyle !== 'all') merged.push(`style:${nextStyle}`);
        updateData.applicable_services = merged.length > 0 ? JSON.stringify(Array.from(new Set(merged))) : null;
        updateData.service_category = nextCategory && nextCategory !== 'all' ? nextCategory : null;
        updateData.service_style = nextStyle && nextStyle !== 'all' ? nextStyle : null;
      }
      if (body.metadata !== undefined && body.metadata && typeof body.metadata === 'object') {
        updateData.metadata = body.metadata;
      }
      if (body.serviceCategory !== undefined || body.service_category !== undefined || body.serviceStyle !== undefined || body.service_style !== undefined) {
        const incomingMetadata = (updateData.metadata ?? promotions[0].metadata ?? {}) as Record<string, unknown>;
        const metadataCategory = String(updateData.service_category ?? (incomingMetadata as any)?.serviceCategory ?? '').trim().toLowerCase();
        const metadataStyle = normalizeStyle(updateData.service_style ?? (incomingMetadata as any)?.serviceStyle ?? '');
        updateData.metadata = {
          ...incomingMetadata,
          promotionTarget: {
            ...(((incomingMetadata as any)?.promotionTarget || {}) as Record<string, unknown>),
            serviceCategory: metadataCategory || 'all',
            serviceStyle: metadataStyle || 'all',
          },
          serviceCategory: metadataCategory || 'all',
          serviceStyle: metadataStyle || 'all',
        };
      }
      if (body.applicableRoles !== undefined) updateData.applicable_roles = body.applicableRoles;
      if (body.priority !== undefined) updateData.priority = parseInt(body.priority) || 0;
      // Phase 0.1: New fields
      if (body.is_spotlight !== undefined) updateData.is_spotlight = body.is_spotlight === true;
      if (body.published !== undefined) updateData.published = body.published === true;

      const updated = await update('promotions', { id }, updateData);

      return c.json({
        success: true,
        promotion: updated[0],
        message: 'Promotion updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating promotion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /marketing/promotions/:id
   * Delete promotion (admin UI endpoint)
   */
  app.delete("/marketing/promotions/:id", async (c) => {
    try {
      const { id } = c.req.param();
      
      const promotions = await select('promotions', { id });
      if (promotions.length === 0) {
        return c.json({ error: 'Promotion not found' }, 404);
      }

      // Soft delete: set is_active to false
      await update('promotions', { id }, {
        is_active: false,
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Promotion deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting promotion:', error);
      return c.json({ error: error.message }, 500);
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
   * Create promotion (admin — canonical Sprint A API with full targeting)
   */
  app.post("/admin/promotions", async (c) => {
    try {
      const body = await c.req.json();
      const record = buildPromotionPersistenceFromAdminBody(body) as Record<string, unknown>;

      if (!record.name || !record.discount_type || record.discount_value === undefined) {
        return c.json({ error: 'name, discount_type, and discount_value are required' }, 400);
      }

      const promotionData: any = {
        ...record,
        created_at: new Date().toISOString(),
      };

      const codeInput = body.code;
      if (codeInput) {
        promotionData.code = String(codeInput).toUpperCase();
      }

      let promotion;
      promotion = await persistPromotionInsert(promotionData);

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
   * Update promotion (admin — canonical with full targeting)
   */
  app.put("/admin/promotions/:id", async (c) => {
    try {
      const { id } = c.req.param();
      const body = await c.req.json();

      const promotions = await select('promotions', { id });
      if (promotions.length === 0) {
        return c.json({ error: 'Promotion not found' }, 404);
      }

      const updateData = mergeAdminPromotionUpdateBody(body, promotions[0]) as Record<string, unknown>;
      if (body.code !== undefined) {
        updateData.code = String(body.code).toUpperCase();
      }

      await persistPromotionUpdate(id, updateData);

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
   * Soft-delete promotion (backward compatible with /marketing/promotions)
   */
  app.delete("/admin/promotions/:id", async (c) => {
    try {
      const { id } = c.req.param();

      const promotions = await select('promotions', { id });
      if (promotions.length === 0) {
        return c.json({ error: 'Promotion not found' }, 404);
      }

      await update('promotions', { id }, {
        is_active: false,
        updated_at: new Date().toISOString(),
      });

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

      // Map database fields to frontend format
      const mappedCoupons = rows.map((coupon: any) => ({
        ...coupon,
        type: coupon.discount_type || coupon.type,
        value: coupon.discount_value || coupon.value,
        usageLimit: coupon.max_uses || coupon.usage_limit || coupon.usageLimit,
        usageCount: coupon.uses_count || coupon.current_uses || coupon.usage_count || 0,
        validUntil: coupon.end_date || coupon.expires_at || coupon.valid_until || coupon.validUntil,
        validFrom: coupon.start_date || coupon.starts_at || coupon.valid_from || coupon.validFrom,
        createdAt: coupon.created_at || coupon.createdAt,
      }));

      return c.json({
        success: true,
        coupons: mappedCoupons,
        total: mappedCoupons.length,
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
        type,
        value,
        discount_type,
        discount_value,
        minOrderAmount,
        min_order_value,
        maxDiscountAmount,
        max_discount,
        validFrom,
        valid_from,
        validUntil,
        valid_until,
        usageLimit,
        usage_limit,
        isActive,
        is_active = true,
      } = body;

      // Handle both UI format (type, value) and backend format (discount_type, discount_value)
      const finalCode = code || '';
      const finalDiscountType = discount_type || type || 'percentage';
      const finalDiscountValue = discount_value !== undefined ? discount_value : (value !== undefined ? value : 0);
      const finalMinOrder = min_order_value !== undefined ? min_order_value : (minOrderAmount !== undefined ? minOrderAmount : 0);
      const finalMaxDiscount = max_discount !== undefined ? max_discount : (maxDiscountAmount !== undefined ? maxDiscountAmount : 0);
      const finalValidFrom = valid_from || validFrom || new Date().toISOString().split('T')[0];
      const finalValidUntil = valid_until || validUntil || null;
      const finalUsageLimit = usage_limit !== undefined ? usage_limit : (usageLimit !== undefined ? usageLimit : 0);
      const finalIsActive = is_active !== undefined ? is_active : (isActive !== undefined ? isActive : true);

      if (!finalCode || !finalDiscountType || finalDiscountValue === undefined) {
        return c.json({ error: 'code, discount_type/type, and discount_value/value are required' }, 400);
      }

      // Use correct column names based on schema (no max_discount column in base schema)
      const couponData: any = {
        code: finalCode.toUpperCase(),
        name: finalCode.toUpperCase(), // Required field
        discount_type: finalDiscountType,
        discount_value: finalDiscountValue,
        min_order_amount: finalMinOrder > 0 ? finalMinOrder : null,
        start_date: finalValidFrom ? new Date(finalValidFrom) : new Date(),
        end_date: finalValidUntil ? new Date(finalValidUntil) : (finalValidFrom ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : new Date()),
        max_uses: finalUsageLimit > 0 ? finalUsageLimit : null,
        is_active: finalIsActive,
      };

      // Remove null values for optional fields
      if (couponData.min_order_amount === null) delete couponData.min_order_amount;
      if (couponData.max_uses === null) delete couponData.max_uses;

      const coupon = await insert('coupons', couponData);

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
   * POST /admin/coupons/create
   * Alias for POST /admin/coupons (UI compatibility)
   */
  app.post("/admin/coupons/create", async (c) => {
    try {
      const body = await c.req.json();
      const {
        code,
        type,
        value,
        discount_type,
        discount_value,
        minOrderAmount,
        min_order_value,
        maxDiscountAmount,
        max_discount,
        validFrom,
        valid_from,
        validUntil,
        valid_until,
        usageLimit,
        usage_limit,
        isActive,
        is_active = true,
      } = body;

      // Handle both UI format (type, value) and backend format (discount_type, discount_value)
      const finalCode = code || '';
      const finalDiscountType = discount_type || type || 'percentage';
      const finalDiscountValue = discount_value !== undefined ? discount_value : (value !== undefined ? value : 0);
      const finalMinOrder = min_order_value !== undefined ? min_order_value : (minOrderAmount !== undefined ? minOrderAmount : 0);
      const finalMaxDiscount = max_discount !== undefined ? max_discount : (maxDiscountAmount !== undefined ? maxDiscountAmount : 0);
      const finalValidFrom = valid_from || validFrom || new Date().toISOString().split('T')[0];
      const finalValidUntil = valid_until || validUntil || null;
      const finalUsageLimit = usage_limit !== undefined ? usage_limit : (usageLimit !== undefined ? usageLimit : 0);
      const finalIsActive = is_active !== undefined ? is_active : (isActive !== undefined ? isActive : true);

      if (!finalCode || !finalDiscountType || finalDiscountValue === undefined) {
        return c.json({ error: 'code, discount_type/type, and discount_value/value are required' }, 400);
      }

      // Use correct column names based on schema (no max_discount column in base schema)
      const couponData: any = {
        code: finalCode.toUpperCase(),
        name: finalCode.toUpperCase(), // Required field
        discount_type: finalDiscountType,
        discount_value: finalDiscountValue,
        min_order_amount: finalMinOrder > 0 ? finalMinOrder : null,
        start_date: finalValidFrom ? new Date(finalValidFrom) : new Date(),
        end_date: finalValidUntil ? new Date(finalValidUntil) : (finalValidFrom ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : new Date()),
        max_uses: finalUsageLimit > 0 ? finalUsageLimit : null,
        is_active: finalIsActive,
      };

      // Remove null values for optional fields
      if (couponData.min_order_amount === null) delete couponData.min_order_amount;
      if (couponData.max_uses === null) delete couponData.max_uses;

      const coupon = await insert('coupons', couponData);

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
      // Handle both frontend and backend field names
      if (body.code !== undefined) updateData.code = body.code.toUpperCase();
      if (body.discount_type !== undefined || body.type !== undefined) {
        updateData.discount_type = body.discount_type || body.type;
      }
      if (body.discount_value !== undefined || body.value !== undefined) {
        updateData.discount_value = body.discount_value !== undefined ? body.discount_value : body.value;
      }
      if (body.min_order_value !== undefined || body.minOrderAmount !== undefined) {
        updateData.min_order_amount = body.min_order_value !== undefined ? body.min_order_value : body.minOrderAmount;
      }
      if (body.max_discount !== undefined || body.maxDiscountAmount !== undefined) {
        updateData.max_discount_amount = body.max_discount !== undefined ? body.max_discount : body.maxDiscountAmount;
      }
      if (body.valid_from !== undefined || body.validFrom !== undefined) {
        updateData.start_date = new Date(body.valid_from || body.validFrom);
      }
      if (body.valid_until !== undefined || body.validUntil !== undefined) {
        const expiryDate = body.valid_until || body.validUntil;
        updateData.end_date = expiryDate ? new Date(expiryDate) : null;
      }
      if (body.usage_limit !== undefined || body.usageLimit !== undefined) {
        const limit = body.usage_limit !== undefined ? body.usage_limit : body.usageLimit;
        updateData.max_uses = limit > 0 ? limit : null;
      }
      if (body.is_active !== undefined || body.isActive !== undefined) {
        updateData.is_active = body.is_active !== undefined ? body.is_active : body.isActive;
      }

      await update('coupons', { id }, updateData);

      // Use explicit UUID casting to avoid "uuid = text" errors
      const updated = await query(
        'SELECT * FROM coupons WHERE id = $1::uuid',
        [id]
      );
      const couponRows = Array.isArray(updated) ? updated : (updated as any).rows || [];
      const coupon = couponRows[0];
      
      // Map database fields to frontend format
      const mappedCoupon = {
        ...coupon,
        type: coupon.discount_type || coupon.type,
        value: coupon.discount_value || coupon.value,
        usageLimit: coupon.max_uses || coupon.usage_limit || coupon.usageLimit,
        usageCount: coupon.uses_count || coupon.current_uses || coupon.usage_count || 0,
        validUntil: coupon.end_date || coupon.expires_at || coupon.valid_until || coupon.validUntil,
        validFrom: coupon.start_date || coupon.starts_at || coupon.valid_from || coupon.validFrom,
        createdAt: coupon.created_at || coupon.createdAt,
      };
      
      return c.json({
        success: true,
        coupon: mappedCoupon,
        message: 'Coupon updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating coupon:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /admin/coupons/bulk-generate
   * Generate multiple unique coupon codes (admin)
   */
  app.post("/admin/coupons/bulk-generate", async (c) => {
    try {
      const body = await c.req.json();
      const prefix = String(body.prefix || 'SAVE').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'SAVE';
      const quantity = Math.min(Math.max(parseInt(String(body.quantity || 10), 10) || 10, 1), 500);
      const length = Math.min(Math.max(parseInt(String(body.length || 6), 10) || 6, 4), 12);
      const finalDiscountType = normalizeAdminPromotionDiscountType(body.type ?? body.discount_type ?? 'percentage');
      const finalDiscountValue = Number(body.value ?? body.discount_value ?? 10);
      const finalMinOrder = Number(body.minOrderAmount ?? body.min_order_value ?? 0);
      const finalValidFrom = parseAdminDateInput(body.validFrom ?? body.valid_from) || new Date().toISOString().split('T')[0];
      const finalValidUntil = parseAdminDateInput(body.validUntil ?? body.valid_until);
      const finalUsageLimit = Number(body.usageLimit ?? body.usage_limit ?? 1);
      const finalIsActive = body.is_active !== undefined ? body.is_active !== false : body.isActive !== false;

      const generated: string[] = [];
      const maxAttempts = quantity * 20;
      let attempts = 0;

      while (generated.length < quantity && attempts < maxAttempts) {
        attempts += 1;
        const suffix = Math.random()
          .toString(36)
          .replace(/[^a-z0-9]/gi, '')
          .slice(0, length)
          .toUpperCase();
        const code = `${prefix}${suffix}`.slice(0, 20);
        if (generated.includes(code)) continue;

        const existing = await select('coupons', { code });
        if (existing.length > 0) continue;

        const couponData: any = {
          code,
          name: code,
          discount_type: finalDiscountType,
          discount_value: finalDiscountValue,
          min_order_amount: finalMinOrder > 0 ? finalMinOrder : null,
          start_date: new Date(finalValidFrom),
          end_date: finalValidUntil
            ? new Date(finalValidUntil)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          max_uses: finalUsageLimit > 0 ? finalUsageLimit : null,
          is_active: finalIsActive,
        };
        if (couponData.min_order_amount === null) delete couponData.min_order_amount;
        if (couponData.max_uses === null) delete couponData.max_uses;

        await insert('coupons', couponData);
        generated.push(code);
      }

      if (generated.length === 0) {
        return c.json({ success: false, error: 'Could not generate unique coupon codes' }, 400);
      }

      return c.json({
        success: true,
        message: `Generated ${generated.length} coupon${generated.length === 1 ? '' : 's'}`,
        codes: generated,
        count: generated.length,
      });
    } catch (error: any) {
      console.error('Error bulk-generating coupons:', error);
      return c.json({ success: false, error: error.message }, 500);
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

  /**
   * POST /promotions/apply
   * Apply promotion/coupon with vendor/platform distinction
   */
  app.post("/promotions/apply", async (c) => {
    try {
      const {
        code,
        bookingId,
        customerId,
        vendorId,
        amount,
      } = await c.req.json();

      if (!code || !amount) {
        return c.json({ error: 'code and amount are required' }, 400);
      }

      // Check if it's a vendor promotion or platform promotion
      const vendorPromo = await query(
        `SELECT * FROM vendor_promotions 
         WHERE code = $1 
         AND vendor_id = $2
         AND is_active = true
         AND (start_date IS NULL OR start_date <= NOW())
         AND (end_date IS NULL OR end_date >= NOW())`,
        [code, vendorId || '']
      );

      const platformPromo = await query(
        `SELECT * FROM platform_promotions 
         WHERE code = $1
         AND is_active = true
         AND (start_date IS NULL OR start_date <= NOW())
         AND (end_date IS NULL OR end_date >= NOW())`,
        [code]
      );

      let promotion: any = null;
      let discountSource: 'vendor' | 'platform' = 'platform';

      if (vendorPromo.rows.length > 0) {
        promotion = vendorPromo.rows[0];
        discountSource = 'vendor';
      } else if (platformPromo.rows.length > 0) {
        promotion = platformPromo.rows[0];
        discountSource = 'platform';
      } else {
        return c.json({ error: 'Invalid or expired promotion code' }, 400);
      }

      // Calculate discount
      let discountAmount = 0;
      if (promotion.discount_type === 'percentage') {
        discountAmount = (amount * parseFloat(promotion.discount_value)) / 100;
        if (promotion.max_discount_amount) {
          discountAmount = Math.min(discountAmount, parseFloat(promotion.max_discount_amount));
        }
      } else {
        discountAmount = parseFloat(promotion.discount_value);
      }

      const finalAmount = Math.max(0, amount - discountAmount);

      return c.json({
        success: true,
        discount: {
          amount: discountAmount,
          finalAmount,
          source: discountSource,
          promotionId: promotion.id,
          promotionName: promotion.name,
        },
      });
    } catch (error: any) {
      console.error('Error applying promotion:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /policy-acceptance
   * Accept booking/order policy before payment (before booking creation)
   * ✅ NEW: Endpoint for policy acceptance before booking is created
   */
  app.post("/policy-acceptance", async (c) => {
    try {
      const body = await c.req.json();
      const { 
        customerId, 
        policyType, 
        vendorId, 
        serviceId, 
        policyVersion, 
        acceptedAt 
      } = body;

      if (!customerId) {
        return c.json({ error: 'customerId is required' }, 400);
      }

      if (!policyVersion) {
        return c.json({ error: 'policyVersion is required' }, 400);
      }

      // Store policy acceptance (can be used later when booking is created)
      // For now, just log it - the actual policy acceptance will be recorded when booking is created
      // In the future, this could be stored in a policy_acceptances table
      console.log('[PolicyAcceptance] Policy accepted:', {
        customerId,
        policyType,
        vendorId,
        serviceId,
        policyVersion,
        acceptedAt: acceptedAt || new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Policy acceptance recorded',
        acceptedAt: acceptedAt || new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error recording policy acceptance:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /bookings/:bookingId/accept-policy
   * Accept booking policy before payment (after booking is created)
   */
  app.post("/bookings/:bookingId/accept-policy", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const body = await c.req.json();
      const { policyVersion, acceptedAt, customerSignature } = body;

      if (!policyVersion) {
        return c.json({ error: 'policyVersion is required' }, 400);
      }

      await update('bookings', { id: bookingId }, {
        policy_accepted: true,
        policy_version: policyVersion,
        policy_accepted_at: acceptedAt || new Date().toISOString(),
        customer_signature: customerSignature || null,
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Policy accepted',
      });
    } catch (error: any) {
      console.error('Error accepting policy:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /payments/create-subscription
   * Create payment for subscription (zero payment if already paid)
   */
  app.post("/payments/create-subscription", async (c) => {
    try {
      const {
        bookingId,
        subscriptionId,
        customerId,
        amount,
      } = await c.req.json();

      if (!bookingId || !subscriptionId || !customerId) {
        return c.json({ error: 'bookingId, subscriptionId, and customerId are required' }, 400);
      }

      // Check if subscription is already paid
      const subscriptions = await query(
        `SELECT * FROM subscriptions 
         WHERE id = $1 AND customer_id = $2 AND payment_status = 'paid'`,
        [subscriptionId, customerId]
      );

      if (subscriptions.rows.length > 0 && amount === 0) {
        // Zero payment for already-paid subscription
        const payment = await insert('payments', {
          booking_id: bookingId,
          customer_id: customerId,
          amount: 0,
          currency: 'INR',
          payment_method: 'subscription',
          payment_status: 'completed',
          subscription_id: subscriptionId,
        });

        // Update booking
        await update('bookings', { id: bookingId }, {
          payment_status: 'paid',
          payment_method: 'subscription',
        });

        return c.json({
          success: true,
          paymentId: payment[0].id,
          status: 'completed',
          message: 'Zero payment processed for subscription',
        });
      }

      // Regular payment flow for subscription
      const payment = await insert('payments', {
        booking_id: bookingId,
        customer_id: customerId,
        amount: amount || 0,
        currency: 'INR',
        payment_method: 'subscription',
        payment_status: amount === 0 ? 'completed' : 'pending',
        subscription_id: subscriptionId,
      });

      return c.json({
        success: true,
        paymentId: payment[0].id,
        status: payment[0].payment_status,
        message: 'Subscription payment created',
      });
    } catch (error: any) {
      console.error('Error creating subscription payment:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
