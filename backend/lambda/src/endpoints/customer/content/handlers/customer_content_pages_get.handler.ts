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

export async function customerContentPagesGetHandler(c: Context) {
    try {
      const category = c.req.query('category');
      const limit = parseInt(c.req.query('limit') || '20', 10);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      let pagesQuery = `
        SELECT 
          id,
          title,
          slug,
          content,
          category,
          is_published,
          metadata,
          created_at,
          updated_at
        FROM content_pages
        WHERE is_published = true
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (category) {
        pagesQuery += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      pagesQuery += ` ORDER BY 
        CASE WHEN (metadata->>'featured') IN ('true', 't', '1', 'yes') THEN 0 ELSE 1 END,
        updated_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const pagesResult = await query(pagesQuery, params).catch(() => ({ rows: [] }));

      const pages = (pagesResult.rows || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        category: p.category,
        excerpt: p.content?.substring(0, 150) + '...',
        readTime: p.metadata?.read_time || '5 min',
        featured: p.metadata?.featured || false,
        imageUrl: p.metadata?.image_url,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));

      return c.json({
        success: true,
        pages,
        total: pages.length,
        limit,
        offset,
      });
    } catch (error: any) {
      console.error('Error fetching content pages:', error);
      return c.json({ 
        success: false, 
        error: error.message || 'Failed to fetch pages',
        pages: [],
        total: 0,
      }, 500);
    }
}
