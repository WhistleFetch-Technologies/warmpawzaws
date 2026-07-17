import type { Context } from 'hono';
import { Hono } from 'hono';
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

export async function executecustomerArticlesGet(c: Context) {
    const startTime = Date.now();
    try {
      const category = c.req.query('category');
      const limit = parseInt(c.req.query('limit') || '5', 10);
      const featured = c.req.query('featured') === 'true';

      let articles: Awaited<ReturnType<typeof listPublishedCustomerArticlesForCustomer>>;
      try {
        articles = await listPublishedCustomerArticlesForCustomer({
          category: category || undefined,
          limit,
          featured,
        });
      } catch (err: any) {
        const duration = Date.now() - startTime;
        console.error('[articles] Query failed', {
          durationMs: duration,
          code: err?.code,
          message: err?.message || String(err),
        });
        const poolExhausted =
          typeof err?.message === 'string' &&
          (err.message.includes('connection pool') || err.message.includes('too many clients'));
        if (poolExhausted) {
          console.error('[articles] Connection pool exhausted');
        }
        return c.json({
          success: true,
          articles: [],
          total: 0,
          degraded: true,
        });
      }

      return c.json({
        success: true,
        articles,
        total: articles.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer articles:', error);
      return c.json(
        {
          success: false,
          articles: [],
          total: 0,
          error: 'Articles could not be loaded. Please try again shortly.',
          code: 'ARTICLES_ERROR',
        },
        500
      );
    }
}
