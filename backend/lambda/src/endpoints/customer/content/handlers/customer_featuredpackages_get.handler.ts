import type { Context } from 'hono';
/**
 * ============================================================================
 * CUSTOMER CONTENT ENDPOINTS
 * ============================================================================
 * 
 * Provides content endpoints for customer home page:
 * - GET /customer/banners - Get active banners for home screen
 * - GET /customer/articles - Get published articles for home screen
 * - GET /customer/announcements - Get active announcements (What's New)
 * - GET /customer/featured-packages - Get featured service packages
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select } from '../../../../database/rds-connection';
import {
  resolveFeaturedVendorsRequestScreen,
  canonicalScreenForSpotlightRow,
} from '../../../../utils/featured-vendor-service-context';
import {
  enrichBannersWithNavTargets,
  resolveBannerCtaNavigation,
} from '../../../../utils/banner-cta-resolver';
import { listPublishedCustomerArticlesForCustomer } from '../../../../utils/content-page-articles';
import { presignBannerImageForDisplay } from '../../../../utils/banner-s3-image';
import {
  createLaunchGeoFilter,
  shouldIncludeFeaturedSpotlightRow,
} from '../../../../lib/customer-launch-geo-filter';

export async function customerFeaturedpackagesGetHandler(c: Context) {
    try {
      const limit = parseInt(c.req.query('limit') || '3', 10);

      // Try to get featured packages from promotions
      const packagesResult = await query(
        `SELECT 
          id,
          name,
          description,
          discount_type,
          discount_value,
          min_order_amount,
          applicable_services,
          metadata
        FROM promotions
        WHERE is_active = true
        AND is_spotlight = true
        AND published = true
        AND (start_date IS NULL OR start_date <= NOW())
        AND (end_date IS NULL OR end_date >= NOW())
        ORDER BY priority ASC, created_at DESC
        LIMIT $1`,
        [limit]
      ).catch(() => ({ rows: [] }));

      const packages = (packagesResult.rows || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        discountType: p.discount_type,
        discountValue: p.discount_value,
        originalPrice: p.metadata?.original_price,
        finalPrice: p.metadata?.final_price,
        services: p.applicable_services || [],
        badge: p.metadata?.badge || 'TRENDING',
      }));

      return c.json({
        success: true,
        packages,
        total: packages.length,
      });
    } catch (error: any) {
      console.error('Error fetching featured packages:', error);
      return c.json({
        success: true,
        packages: [],
        total: 0,
      });
    }
}
