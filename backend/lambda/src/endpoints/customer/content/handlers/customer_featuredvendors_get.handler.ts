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

export async function customerFeaturedvendorsGetHandler(c: Context) {
    try {
      const limit = parseInt(c.req.query('limit') || '6', 10);
      const serviceQ = c.req.query('service') ?? c.req.query('Service');
      const requested = resolveFeaturedVendorsRequestScreen(
        Array.isArray(serviceQ) ? serviceQ[0] : serviceQ
      );
      if (!requested) {
        return c.json({ success: true, vendors: [], total: 0 });
      }

      const now = new Date().toISOString();

      const result = await query(
        `SELECT id, title, subtitle, image_url, cta_text, cta_link, role_id, service_category, metadata, display_order, created_at
         FROM spotlight_offers
         WHERE is_active = true
         AND (start_date IS NULL OR start_date <= $1)
         AND (end_date IS NULL OR end_date >= $1)
         ORDER BY display_order ASC, created_at DESC`,
        [now]
      ).catch(() => ({ rows: [] }));

      const phoneQ = c.req.query('phone') ?? c.req.query('customerPhone');
      const phone = Array.isArray(phoneQ) ? phoneQ[0] : phoneQ;
      const stateQ = c.req.query('state') ?? c.req.query('customerState');
      const cityQ = c.req.query('city') ?? c.req.query('customerCity');
      const launchFilter = await createLaunchGeoFilter({
        phone: String(phone || '').trim(),
        state: String(Array.isArray(stateQ) ? stateQ[0] : stateQ || '').trim(),
        city: String(Array.isArray(cityQ) ? cityQ[0] : cityQ || '').trim(),
      });

      const rows = (result.rows || []) as any[];
      const matched: any[] = [];
      for (const r of rows) {
        if (matched.length >= limit) break;
        const bucket = canonicalScreenForSpotlightRow(r.service_category, r.role_id);
        if (bucket !== requested) continue;
        if (!shouldIncludeFeaturedSpotlightRow(launchFilter, r)) continue;
        matched.push(r);
      }

      const vendors = matched.map((r) => ({
        id: r.id,
        vendorId: r.metadata?.vendorId || null,
        vendorName: r.metadata?.vendorName || r.title,
        title: r.title,
        subtitle: r.subtitle,
        imageUrl: r.image_url,
        ctaText: r.cta_text || 'Book Now',
        ctaLink: r.cta_link,
        roleId: r.role_id,
        serviceCategory: r.service_category,
      }));

      return c.json({ success: true, vendors, total: vendors.length });
    } catch (error: any) {
      console.error('Error fetching featured vendors:', error);
      return c.json({ success: true, vendors: [], total: 0 });
    }
}
