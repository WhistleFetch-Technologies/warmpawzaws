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

export async function customerBannersResolvectaGetHandler(c: Context) {
    try {
      const ctaLink = c.req.query('ctaLink') || c.req.query('cta_link') || '';
      const title = c.req.query('title') || c.req.query('serviceName') || '';
      const subtitle = c.req.query('subtitle') || '';
      const vendorId = c.req.query('vendorId') || c.req.query('vendor_id') || '';
      const vendorServiceId = c.req.query('vendorServiceId') || c.req.query('vendor_service_id') || '';
      const serviceStyle = c.req.query('serviceStyle') || c.req.query('service_style') || '';

      let metadata: Record<string, unknown> | undefined;
      const metadataRaw = c.req.query('metadata');
      if (metadataRaw) {
        try {
          metadata = JSON.parse(metadataRaw);
        } catch {
          metadata = undefined;
        }
      }

      const navTarget = await resolveBannerCtaNavigation({
        ctaLink,
        title,
        subtitle,
        metadata,
        vendorId: vendorId || undefined,
        vendorServiceId: vendorServiceId || undefined,
        serviceStyle: serviceStyle || undefined,
      });
      if (!navTarget) {
        return c.json({ success: false, error: 'Could not resolve banner CTA' }, 404);
      }
      return c.json({ success: true, navTarget });
    } catch (error: any) {
      console.error('Error resolving banner CTA:', error);
      return c.json({ success: false, error: error.message || 'Failed to resolve banner CTA' }, 500);
    }
}
