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

export async function marketingArticlesGetHandler(c: Context) {
    return app.fetch(new Request(c.req.url.replace('/marketing/articles', '/customer/articles'), c.req.raw));
}
