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

export async function customerArticlesSlugGetHandler(c: Context) {
    try {
      let slug = c.req.param('slug') || '';
      try {
        slug = slug ? decodeURIComponent(slug) : '';
      } catch {
        // keep raw slug if decode fails
      }
      if (!slug) {
        return c.json({ success: false, error: 'Slug is required' }, 400);
      }

      const encoded = encodeURIComponent(slug);
      const forwardUrl = c.req.url.replace(
        /\/customer\/articles\/[^/?]+/,
        `/customer/content/pages/${encoded}`
      );

      const resp = await app.fetch(
        new Request(forwardUrl, {
          method: 'GET',
          headers: c.req.raw.headers,
        })
      );

      const data: { success?: boolean; page?: Record<string, unknown>; error?: string } = await resp
        .json()
        .catch(() => ({}));

      if (!resp.ok || !data?.success || !data?.page) {
        const status = resp.status === 404 ? 404 : resp.status >= 400 ? resp.status : 404;
        return c.json(
          { success: false, error: (data as { error?: string })?.error || 'Article not found' },
          status
        );
      }

      const p = data.page;
      return c.json({
        success: true,
        article: {
          id: p.id,
          title: p.title,
          slug: p.slug,
          content: p.content,
          category: p.category,
          readTime: p.readTime,
          featured: p.featured,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch article';
      console.error('[customer/articles/:slug]', message);
      return c.json({ success: false, error: message }, 500);
    }
}
