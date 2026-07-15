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

export async function customerBannersGetHandler(c: Context) {
    try {
      // position query param: home_top -> main (banners.type), all -> all types
      const positionParam = c.req.query('position') || 'home_top';
      const bannerType = positionParam === 'all' ? 'all' : (positionParam === 'home_top' ? 'main' : positionParam);
      const rawLimit = parseInt(c.req.query('limit') || '10', 10);
      const limit = Math.min(Math.max(rawLimit, 1), 25);
      const customerState = (c.req.query('state') || '').trim();
      const customerCity = (c.req.query('city') || '').trim();

      const now = new Date().toISOString();

      // home_top (mapped to `main` for this query): legacy `main` + `home_top` only — not `home_middle`.
      // position=home_middle uses type = 'home_middle' via the third branch.
      const bannersResult = await query(
        `SELECT 
          id,
          title,
          subtitle,
          image_url,
          cta_text,
          cta_link,
          type,
          display_order,
          metadata,
          start_date,
          end_date
        FROM banners
        WHERE is_active = true
        AND (
          $1::text = 'all'
          OR ($1::text = 'main' AND type IN ('main', 'home_top'))
          OR (type = $1::text)
        )
        AND (start_date IS NULL OR start_date <= $2)
        AND (end_date IS NULL OR end_date >= $2)
        AND (
          (target_state IS NULL AND target_city IS NULL)
          OR (
            $4::text <> ''
            AND target_state IS NOT NULL
            AND target_city IS NULL
            AND LOWER(target_state) = LOWER($4::text)
          )
          OR (
            $5::text <> ''
            AND target_city IS NOT NULL
            AND LOWER(target_city) = LOWER($5::text)
            AND (
              target_state IS NULL
              OR ($4::text <> '' AND LOWER(target_state) = LOWER($4::text))
            )
          )
        )
        ORDER BY display_order ASC, created_at DESC
        LIMIT $3`,
        [bannerType, now, limit, customerState, customerCity]
      ).catch(() => ({ rows: [] }));

      const parseMetadata = (raw: unknown): Record<string, unknown> => {
        if (raw == null) return {};
        if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
        if (typeof raw === 'string') {
          try {
            const o = JSON.parse(raw);
            return typeof o === 'object' && o !== null && !Array.isArray(o) ? o : {};
          } catch {
            return {};
          }
        }
        return {};
      };

      // Legacy home hero promos removed from product (see migration 1006); omit if still in DB.
      const legacyHeroTitles = new Set(['Get 50% OFF', 'Premium Pet Food']);

      // Map banners to frontend format (type exposed as position for backward compat)
      const rawBanners = await Promise.all(
        (bannersResult.rows || [])
          .filter((b: any) => !legacyHeroTitles.has(String(b.title || '').trim()))
          .map(async (b: any) => {
            const meta = parseMetadata(b.metadata);
            return {
              id: b.id,
              title: b.title,
              subtitle: b.subtitle,
              imageUrl: await presignBannerImageForDisplay(b.image_url, String(b.id)),
              ctaText: b.cta_text || 'Learn More',
              ctaLink: b.cta_link,
              position:
                b.type === 'main' || b.type === 'home_top'
                  ? 'home_top'
                  : b.type || 'home_top',
              displayOrder: b.display_order || 0,
              gradientFrom: (meta.gradient_from as string) || '#FF8C42',
              gradientTo: (meta.gradient_to as string) || '#FF6B35',
              icon: meta.icon,
              metadata: meta,
            };
          })
      );

      const banners = await enrichBannersWithNavTargets(rawBanners);

      return c.json({
        success: true,
        banners,
        total: banners.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer banners:', error);
      // Return default banners on error
      return c.json({
        success: true,
        banners: [
          {
            id: 'default-vet-checkup',
            title: 'Free Health Checkup',
            subtitle: 'Book Vet Appointment Today',
            imageUrl: '/images/home/dog-peep.webp',
            gradientFrom: '#4CAF50',
            gradientTo: '#2E7D32',
            ctaText: 'Book Now',
            ctaLink: '/vet',
            icon: '🩺',
          },
        ],
        total: 1,
        isDefault: true,
      });
    }
}
