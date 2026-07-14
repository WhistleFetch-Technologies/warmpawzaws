/**
 * Ads & Recommendations Endpoints
 * 
 * Handles:
 * - Sponsored ads display & tracking
 * - Top providers ranking
 * - Similar services/products recommendations
 * - Impression & click tracking
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import { calculateBestCartPromotionAsync, discountsWithinTolerance, normalizePromotionRow, type CartLineItem } from '../utils/vendor-promotion-engine';
import { countPriorVendorOrders, recordVendorPromotionUsage } from '../utils/vendor-promotion-usage';
import { resolveCommercialCampaignDiscount } from '../utils/resolve-commercial-campaign';
import { selectEcommercePromotionWinnerAsync } from '../utils/ecommerce-promo-policy-winner';
import {
  clampRecommendationLimit,
  resolveProductRecommendations,
} from '../lib/ecommerce/recommendation-resolver';
import { STOREFRONT_EXCLUDE_MEAL_PRODUCTS_SQL } from '../utils/ecommerce-storefront-product-filter';

// ============================================================================
// SPONSORED ADS ENDPOINTS
// ============================================================================

export function registerAdsRecommendationEndpoints(app: Hono) {
  /**
   * GET /ads/sponsored-providers
   * Get sponsored providers for a category/listing page
   */
  app.get('/ads/sponsored-providers', async (c) => {
  try {
    const category = c.req.query('category');
    const limit = parseInt(c.req.query('limit') || '3');

    // Get active sponsored campaigns - simplified query
    const sql = `
      SELECT 
        ac.id as campaign_id,
        ac.vendor_id,
        ac.ad_creative,
        ac.cost_per_click,
        v.full_name as vendor_name,
        v.business_name,
        v.photo,
        v.rating,
        v.review_count,
        v.vendor_type,
        v.specialization,
        v.is_verified,
        v.city
      FROM advertising_campaigns ac
      JOIN vendors v ON ac.vendor_id = v.id
      WHERE ac.status = 'active'
        AND ac.campaign_type IN ('sponsored', 'ppc')
        AND ac.start_date <= CURRENT_DATE
        AND (ac.end_date IS NULL OR ac.end_date >= CURRENT_DATE)
        AND ac.spent_amount < ac.budget_amount
      ORDER BY ac.cost_per_click DESC, v.rating DESC
      LIMIT $1
    `;
    
    const result = await query(sql, [limit]);

    const providers = (result.rows || []).map((row: any) => {
      const reviewCount = parseInt(row.review_count || '0', 10);
      const raw = row.rating != null ? parseFloat(String(row.rating)) : NaN;
      const rating =
        reviewCount > 0 && Number.isFinite(raw) ? raw : null;
      return {
        id: row.campaign_id,
        vendorId: row.vendor_id,
        campaignId: row.campaign_id,
        name: row.vendor_name,
        businessName: row.business_name,
        photo: row.photo,
        rating,
        reviewCount,
        specialization: row.specialization,
        isVerified: row.is_verified,
        adCreative: row.ad_creative || {},
      };
    });

    return c.json({ success: true, providers });
  } catch (error: any) {
    console.error('Error fetching sponsored providers:', error);
    return c.json({ success: false, error: error.message, providers: [] });
  }
});

/**
 * POST /ads/impressions
 * Track ad impression
 */
app.post('/ads/impressions', async (c) => {
  try {
    const body = await c.req.json();
    const {
      campaignId,
      vendorId,
      impressionType,
      targetId,
      targetType,
      customerId,
      sessionId,
      position,
      category,
    } = body;

    if (!campaignId || !vendorId) {
      return c.json({ success: false, error: 'campaignId and vendorId required' }, 400);
    }

    // Insert impression
    const insertSql = `
      INSERT INTO ad_impressions (
        campaign_id, vendor_id, impression_type, target_id, target_type,
        customer_id, session_id, location
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    await query(insertSql, [
      campaignId,
      vendorId,
      impressionType || 'vendor',
      targetId,
      targetType || 'vendor',
      customerId || null,
      sessionId || null,
      JSON.stringify({ position, category }),
    ]);

    // Update campaign metrics
    const updateSql = `
      UPDATE advertising_campaigns 
      SET total_impressions = total_impressions + 1,
          updated_at = NOW()
      WHERE id = $1
    `;
    await query(updateSql, [campaignId]);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error tracking impression:', error);
    return c.json({ success: true }); // Don't fail requests for tracking issues
  }
});

/**
 * POST /ads/clicks
 * Track ad click
 */
app.post('/ads/clicks', async (c) => {
  try {
    const body = await c.req.json();
    const {
      campaignId,
      vendorId,
      clickType,
      targetId,
      targetType,
      customerId,
      sessionId,
      position,
      category,
    } = body;

    if (!campaignId || !vendorId) {
      return c.json({ success: false, error: 'campaignId and vendorId required' }, 400);
    }

    // Get campaign CPC
    const cpcResult = await query(
      'SELECT cost_per_click FROM advertising_campaigns WHERE id = $1',
      [campaignId]
    );
    const cpc = parseFloat(cpcResult.rows?.[0]?.cost_per_click || '0');

    // Insert click
    const clickSql = `
      INSERT INTO ad_clicks (
        campaign_id, vendor_id, click_type, target_id, target_type,
        customer_id, session_id, location
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    const clickResult = await query(clickSql, [
      campaignId,
      vendorId,
      clickType || 'vendor',
      targetId,
      targetType || 'vendor',
      customerId || null,
      sessionId || null,
      JSON.stringify({ position, category }),
    ]);

    // Update campaign metrics and spend
    const updateSql = `
      UPDATE advertising_campaigns 
      SET total_clicks = total_clicks + 1,
          spent_amount = spent_amount + $2,
          click_through_rate = CASE WHEN total_impressions > 0 
            THEN ((total_clicks + 1)::float / total_impressions * 100)::numeric(5,2)
            ELSE 0 END,
          updated_at = NOW()
      WHERE id = $1
    `;
    await query(updateSql, [campaignId, cpc]);

    // Record budget transaction
    if (cpc > 0 && clickResult.rows?.[0]?.id) {
      const txnSql = `
        INSERT INTO ad_budget_transactions (
          campaign_id, vendor_id, transaction_type, amount, click_id
        ) VALUES ($1, $2, 'click', $3, $4)
      `;
      await query(txnSql, [campaignId, vendorId, cpc, clickResult.rows[0].id]);
    }

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error tracking click:', error);
    return c.json({ success: true }); // Don't fail requests for tracking issues
  }
});

// ============================================================================
// TOP PROVIDERS (RANKING ALGORITHM)
// ============================================================================

/**
 * GET /providers/top
 * Get top-ranked providers using algorithmic scoring
 */
app.get('/providers/top', async (c) => {
  try {
    const category = c.req.query('category');
    const limit = parseInt(c.req.query('limit') || '10');
    const roleId = c.req.query('roleId');

    // Build params array
    const params: any[] = [];
    let paramIdx = 1;
    
    let whereClause = `WHERE v.status = 'approved' AND v.is_active = true`;
    
    if (category) {
      whereClause += ` AND v.vendor_type = $${paramIdx++}`;
      params.push(category);
    }
    
    if (roleId) {
      whereClause += ` AND v.role_id = $${paramIdx++}`;
      params.push(roleId);
    }
    
    params.push(limit);

    const sql = `
      WITH provider_stats AS (
        SELECT 
          v.id,
          v.full_name as name,
          v.business_name,
          v.photo,
          v.rating,
          v.review_count,
          v.vendor_type,
          v.specialization,
          v.is_verified,
          v.city,
          v.experience_years,
          (
            (COALESCE(v.rating, 0) / 5.0 * 40) +
            (LEAST(COALESCE(v.review_count, 0), 100) / 100.0 * 20) +
            (CASE WHEN v.is_verified THEN 10 ELSE 0 END) +
            (COALESCE(v.experience_years, 0) / 20.0 * 15) +
            (CASE WHEN v.updated_at > NOW() - INTERVAL '7 days' THEN 15 ELSE 5 END)
          ) as score,
          (
            SELECT MIN(slot_start::time)::text
            FROM availability_slots 
            WHERE vendor_id = v.id 
              AND slot_start::date = CURRENT_DATE
              AND is_available = true
          ) as next_available_slot,
          (
            SELECT MIN(vs.price)
            FROM vendor_services vs
            WHERE vs.vendor_id = v.id AND vs.is_enabled = true
          ) as starting_price,
          (
            SELECT COUNT(*) 
            FROM bookings b 
            WHERE b.vendor_id = v.id 
              AND b.status = 'completed'
          ) as completed_services
        FROM vendors v
        ${whereClause}
      )
      SELECT * FROM provider_stats
      ORDER BY score DESC
      LIMIT $${paramIdx}
    `;
    
    const result = await query(sql, params);

    const providers = (result.rows || []).map((row: any) => {
      const reviewCount = parseInt(row.review_count || '0', 10);
      const raw = row.rating != null ? parseFloat(String(row.rating)) : NaN;
      const rating =
        reviewCount > 0 && Number.isFinite(raw) ? raw : null;
      return {
        providerId: row.id,
        vendorId: row.id,
        name: row.name,
        businessName: row.business_name,
        photo: row.photo,
        rating,
        reviewCount,
        specialization: row.specialization,
        isVerified: row.is_verified,
        nextAvailableSlot: row.next_available_slot,
        startingPrice: row.starting_price ? parseFloat(row.starting_price) : null,
        completedServices: parseInt(row.completed_services || '0'),
        score: parseFloat(row.score || '0'),
      };
    });

    return c.json({ success: true, providers });
  } catch (error: any) {
    console.error('Error fetching top providers:', error);
    return c.json({ success: false, error: error.message, providers: [] });
  }
});

// ============================================================================
// SIMILAR SERVICES/PRODUCTS RECOMMENDATIONS
// ============================================================================

/**
 * GET /services/similar
 * Get similar services based on category
 */
app.get('/services/similar', async (c) => {
  try {
    const category = c.req.query('category');
    const excludeId = c.req.query('excludeId');
    const limit = parseInt(c.req.query('limit') || '4');

    const params: any[] = [];
    let paramIdx = 1;
    
    let sql = `
      SELECT 
        s.id,
        s.name,
        s.description,
        s.price,
        s.duration,
        s.category,
        s.icon,
        s.image_url
      FROM services s
      WHERE s.is_active = true
    `;

    if (category) {
      sql += ` AND s.category = $${paramIdx++}`;
      params.push(category);
    }

    if (excludeId) {
      sql += ` AND s.id != $${paramIdx++}`;
      params.push(excludeId);
    }

    sql += ` ORDER BY s.popularity DESC, s.created_at DESC LIMIT $${paramIdx}`;
    params.push(limit);

    const result = await query(sql, params);

    const services = (result.rows || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      price: row.price ? parseFloat(row.price) : null,
      duration: row.duration,
      category: row.category,
      icon: row.icon,
      imageUrl: row.image_url,
    }));

    return c.json({ success: true, services });
  } catch (error: any) {
    console.error('Error fetching similar services:', error);
    return c.json({ success: false, error: error.message, services: [] });
  }
});

/**
 * GET /products/similar
 * Get similar products based on category
 */
app.get('/products/similar', async (c) => {
  try {
    const category = c.req.query('category');
    const excludeId = c.req.query('excludeId');
    const vendorId = c.req.query('vendorId');
    const limit = parseInt(c.req.query('limit') || '4', 10);

    const params: unknown[] = [];
    let paramIdx = 1;

    let sql = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        p.compare_at_price,
        p.category,
        p.images,
        p.vendor_id,
        v.business_name as vendor_name
      FROM products p
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE p.is_active = true
        AND COALESCE(p.stock, 0) > 0
        ${STOREFRONT_EXCLUDE_MEAL_PRODUCTS_SQL}
    `;

    if (category) {
      sql += ` AND p.category = $${paramIdx++}`;
      params.push(category);
    }

    if (excludeId) {
      sql += ` AND p.id <> $${paramIdx++}::uuid`;
      params.push(excludeId);
    }

    if (vendorId) {
      sql += ` ORDER BY CASE WHEN p.vendor_id = $${paramIdx++}::uuid THEN 0 ELSE 1 END, p.sales_count DESC NULLS LAST`;
      params.push(vendorId);
    } else {
      sql += ` ORDER BY p.sales_count DESC NULLS LAST, p.created_at DESC`;
    }

    sql += ` LIMIT $${paramIdx}`;
    params.push(limit);

    const result = await query(sql, params);

    const products = (result.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      price: row.price != null ? parseFloat(String(row.price)) : null,
      original_price:
        row.compare_at_price != null ? parseFloat(String(row.compare_at_price)) : null,
      compareAtPrice:
        row.compare_at_price != null ? parseFloat(String(row.compare_at_price)) : null,
      category: row.category,
      images: row.images,
      vendor_id: row.vendor_id,
      vendor_name: row.vendor_name,
      vendorName: row.vendor_name,
    }));

    return c.json({ success: true, products });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching similar products:', msg);
    return c.json({ success: false, error: msg, products: [] });
  }
});

/**
 * GET /ads-recommendations/products/:productId/similar
 * Customer PDP alias — resolves category from product id then returns similar products.
 */
app.get('/ads-recommendations/products/:productId/similar', async (c) => {
  try {
    const productId = c.req.param('productId');
    const limit = clampRecommendationLimit(c.req.query('limit') || '4');
    const products = await resolveProductRecommendations({ productId, limit });
    return c.json({ success: true, products });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching product similar recommendations:', msg);
    return c.json({ success: false, error: msg, products: [] });
  }
});

// ============================================================================
// CART PROMOTIONS - BOGO & Auto-Apply
// ============================================================================

/**
 * POST /promotions/calculate-cart
 * Calculate all applicable promotions for cart items
 */
app.post('/promotions/calculate-cart', async (c) => {
  try {
    const body = await c.req.json();
    const { items, vendorId, customerId, manualCode } = body;

    if (!items || !Array.isArray(items)) {
      return c.json({ success: false, error: 'items array required' }, 400);
    }

    const cartLines = items.map((item: Record<string, unknown>) => {
      const rawId = String(item.productId || item.id || '');
      const sep = rawId.indexOf('::');
      const productId = sep > 0 ? rawId.slice(0, sep) : rawId;
      return {
        productId,
        quantity: parseInt(String(item.quantity ?? 1), 10) || 1,
        price: parseFloat(String(item.price ?? 0)) || 0,
        category: item.categoryId || item.category ? String(item.categoryId || item.category) : undefined,
        categoryId: item.categoryId || item.category ? String(item.categoryId || item.category) : undefined,
        id: productId || undefined,
      };
    });

    let promotions: Record<string, unknown>[] = [];

    if (vendorId) {
      const vendorPromosResult = await query(
        `SELECT * FROM vendor_promotions
         WHERE vendor_id = $1::uuid
           AND is_active = true
           AND start_date <= NOW()
           AND end_date >= NOW()
           AND (usage_limit IS NULL OR usage_count < usage_limit)`,
        [vendorId]
      );
      promotions = vendorPromosResult.rows || [];
    }

    let priorVendorOrderCount = 0;
    if (customerId && vendorId) {
      priorVendorOrderCount = await countPriorVendorOrders(String(customerId), String(vendorId));
    }

    const normalizedPromos = promotions.map((p) =>
      normalizePromotionRow(p as Record<string, unknown>)
    );

    const vendorAutoResult = await calculateBestCartPromotionAsync(normalizedPromos, cartLines, {
      vendorId,
      customerId,
      priorVendorOrderCount,
    });

    const vendorCodeResult = manualCode
      ? await calculateBestCartPromotionAsync(
          normalizedPromos,
          cartLines,
          {
            vendorId,
            customerId,
            priorVendorOrderCount,
            manualCode: String(manualCode).trim(),
          },
          { platformCouponCode: String(manualCode).trim() },
        )
      : null;

    const vendorAutoDiscount =
      vendorAutoResult.bestPromotion?.discountAmount ?? vendorAutoResult.totalSavings ?? 0;
    const vendorCodeDiscount =
      vendorCodeResult?.bestPromotion?.discountAmount ??
      vendorCodeResult?.totalSavings ??
      vendorCodeResult?.platformCouponDiscount ??
      0;
    const vendorDiscount = Math.max(vendorAutoDiscount, vendorCodeDiscount);
    const vendorBestEval =
      vendorCodeDiscount >= vendorAutoDiscount
        ? vendorCodeResult?.bestPromotion
        : vendorAutoResult.bestPromotion;

    let adminDiscount = 0;
    let adminBestEval = null as typeof vendorBestEval;
    try {
      const campaignResult = await resolveCommercialCampaignDiscount({
        cartLines,
        customerId: customerId ? String(customerId) : null,
      });
      adminDiscount = campaignResult.discountAmount;
      adminBestEval = campaignResult.evaluation;
    } catch (adminErr) {
      console.warn('[promotions/calculate-cart] admin campaign evaluation skipped:', adminErr);
    }

    const winner = await selectEcommercePromotionWinnerAsync({
      vendorDiscount,
      adminDiscount,
    });
    const winningDiscount = winner.discountAmount;
    const promotionSource = winner.promotionSource ?? undefined;

    const best =
      winner.promotionSource === 'admin'
        ? adminBestEval
        : winner.promotionSource === 'vendor'
          ? vendorBestEval
          : null;
    const originalTotal = vendorAutoResult.originalTotal;
    const discountedTotal = Math.max(0, originalTotal - winningDiscount);

    return c.json({
      success: true,
      originalTotal,
      bestPromotion: best
        ? {
            ...best.promotion,
            id: best.promotionId,
            calculatedDiscount: best.discountAmount,
            description: best.description,
            type: best.promotionType,
            promotionSource,
          }
        : null,
      allPromotions: vendorAutoResult.allPromotions.map((e) => ({
        ...e.promotion,
        calculatedDiscount: e.discountAmount,
        description: e.description,
        type: e.promotionType,
        promotionSource: 'vendor' as const,
      })),
      discountedTotal,
      totalSavings: winningDiscount,
      promotionSource: promotionSource ?? null,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error calculating cart promotions:', msg);
    return c.json({ success: false, error: msg });
  }
});
}
