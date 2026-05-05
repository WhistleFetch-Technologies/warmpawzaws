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
      const r = row.rating != null && row.rating !== '' ? parseFloat(String(row.rating)) : NaN;
      const rating = reviewCount > 0 && Number.isFinite(r) ? r : null;
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
      const r = row.rating != null && row.rating !== '' ? parseFloat(String(row.rating)) : NaN;
      const rating = reviewCount > 0 && Number.isFinite(r) ? r : null;
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
    const limit = parseInt(c.req.query('limit') || '4');

    const params: any[] = [];
    let paramIdx = 1;
    
    let sql = `
      SELECT 
        p.id,
        p.product_name as name,
        p.description,
        p.unit_price as price,
        p.compare_at_price,
        p.category_name as category,
        p.image_url,
        p.vendor_id,
        v.business_name as vendor_name
      FROM products p
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE p.is_active = true
        AND p.stock_quantity > 0
    `;

    if (category) {
      sql += ` AND p.category_name = $${paramIdx++}`;
      params.push(category);
    }

    if (excludeId) {
      sql += ` AND p.id != $${paramIdx++}`;
      params.push(excludeId);
    }

    if (vendorId) {
      sql += ` ORDER BY CASE WHEN p.vendor_id = $${paramIdx++} THEN 0 ELSE 1 END, p.sales_count DESC`;
      params.push(vendorId);
    } else {
      sql += ` ORDER BY p.sales_count DESC, p.created_at DESC`;
    }

    sql += ` LIMIT $${paramIdx}`;
    params.push(limit);

    const result = await query(sql, params);

    const products = (result.rows || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      price: row.price ? parseFloat(row.price) : null,
      compareAtPrice: row.compare_at_price ? parseFloat(row.compare_at_price) : null,
      category: row.category,
      imageUrl: row.image_url,
      vendorId: row.vendor_id,
      vendorName: row.vendor_name,
    }));

    return c.json({ success: true, products });
  } catch (error: any) {
    console.error('Error fetching similar products:', error);
    return c.json({ success: false, error: error.message, products: [] });
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
    const { items, vendorId } = body;

    if (!items || !Array.isArray(items)) {
      return c.json({ success: false, error: 'items array required' }, 400);
    }

    // Get applicable promotions
    let promotions: any[] = [];

    // Get vendor product promotions if vendorId provided
    if (vendorId) {
      const vendorPromosSql = `
        SELECT * FROM vendor_promotions
        WHERE vendor_id = $1
          AND is_active = true
          AND start_date <= CURRENT_TIMESTAMP
          AND end_date >= CURRENT_TIMESTAMP
          AND (usage_limit IS NULL OR usage_count < usage_limit)
      `;
      const vendorPromosResult = await query(vendorPromosSql, [vendorId]);
      promotions.push(...(vendorPromosResult.rows || []));
    }

    // Calculate cart total
    const cartTotal = items.reduce(
      (sum: number, item: any) => sum + (item.price * item.quantity),
      0
    );

    // Find applicable promotions
    const applicablePromotions: any[] = [];
    
    for (const promo of promotions) {
      // Check min order value
      if (promo.min_order_value && cartTotal < parseFloat(promo.min_order_value)) {
        continue;
      }

      // BOGO calculation
      if (promo.promotion_type === 'buy_x_get_y') {
        const buyQty = promo.buy_quantity || 2;
        const getQty = promo.get_quantity || 1;
        const discountPercent = promo.get_discount_percent || 100;

        // Check if applicable products are in cart
        const applicableProds = promo.applicable_products || [];
        const applicableCats = promo.applicable_categories || [];
        
        const applicableItems = items.filter((item: any) => {
          if (applicableProds.length === 0 && applicableCats.length === 0) {
            return true;
          }
          if (applicableProds.includes(item.productId || item.id)) {
            return true;
          }
          if (applicableCats.includes(item.categoryId || item.category)) {
            return true;
          }
          return false;
        });

        const totalQty = applicableItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
        const setSize = buyQty + getQty;
        const completeSets = Math.floor(totalQty / setSize);

        if (completeSets > 0) {
          const sortedByPrice = [...applicableItems].sort((a: any, b: any) => a.price - b.price);
          let freeQty = completeSets * getQty;
          let discount = 0;

          for (const item of sortedByPrice) {
            if (freeQty <= 0) break;
            const freeFromThis = Math.min(freeQty, item.quantity);
            discount += (item.price * freeFromThis * discountPercent) / 100;
            freeQty -= freeFromThis;
          }

          if (promo.max_discount_amount && discount > parseFloat(promo.max_discount_amount)) {
            discount = parseFloat(promo.max_discount_amount);
          }

          applicablePromotions.push({
            ...promo,
            calculatedDiscount: discount,
            description: discountPercent === 100 
              ? `Buy ${buyQty} Get ${getQty} FREE!`
              : `Buy ${buyQty} Get ${getQty} at ${discountPercent}% OFF!`,
            type: 'bogo',
          });
        }
      }
      // Standard percentage/fixed discount
      else {
        let discount = 0;
        if (promo.discount_type === 'percentage') {
          discount = (cartTotal * promo.discount_value) / 100;
        } else {
          discount = promo.discount_value || 0;
        }

        if (promo.max_discount_amount && discount > parseFloat(promo.max_discount_amount)) {
          discount = parseFloat(promo.max_discount_amount);
        }

        discount = Math.min(discount, cartTotal);

        applicablePromotions.push({
          ...promo,
          calculatedDiscount: discount,
          description: promo.discount_type === 'percentage'
            ? `${promo.discount_value}% OFF`
            : `₹${promo.discount_value} OFF`,
          type: promo.discount_type,
        });
      }
    }

    // Sort by discount amount (best first)
    applicablePromotions.sort((a, b) => b.calculatedDiscount - a.calculatedDiscount);

    // Auto-apply best promotion
    const bestPromotion = applicablePromotions.length > 0 ? applicablePromotions[0] : null;

    return c.json({
      success: true,
      originalTotal: cartTotal,
      bestPromotion,
      allPromotions: applicablePromotions,
      discountedTotal: bestPromotion 
        ? cartTotal - bestPromotion.calculatedDiscount 
        : cartTotal,
      totalSavings: bestPromotion?.calculatedDiscount || 0,
    });
  } catch (error: any) {
    console.error('Error calculating cart promotions:', error);
    return c.json({ success: false, error: error.message });
  }
  });
}
