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

export async function customerAnnouncementsGetHandler(c: Context) {
    try {
      const limit = parseInt(c.req.query('limit') || '5', 10);

      // Fetch announcements from platform_settings
      const settingsResult = await query(
        `SELECT setting_value FROM platform_settings WHERE setting_key = 'home_announcements'`
      ).catch(() => ({ rows: [] }));

      let announcements: any[] = [];

      if (settingsResult.rows && settingsResult.rows.length > 0) {
        const settingValue = settingsResult.rows[0].setting_value;
        if (Array.isArray(settingValue)) {
          announcements = settingValue;
        } else if (typeof settingValue === 'string') {
          try {
            announcements = JSON.parse(settingValue);
          } catch {
            announcements = [];
          }
        }
      }

      // Filter active announcements and apply limit
      const activeAnnouncements = announcements
        .filter((a: any) => a.is_active !== false)
        .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
        .slice(0, limit)
        .map((a: any) => ({
          id: a.id,
          title: a.title,
          subtitle: a.subtitle,
          badgeText: a.badge_text || 'NEW',
          badgeColor: a.badge_color || 'green',
          icon: a.icon || '✨',
          ctaText: a.cta_text,
          ctaLink: a.cta_link,
          announcementType: a.announcement_type || 'feature',
          displayOrder: a.display_order || 0,
          comingSoon: Boolean(a.coming_soon ?? a.comingSoon),
        }));

      return c.json({
        success: true,
        announcements: activeAnnouncements,
        total: activeAnnouncements.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer announcements:', error);
      // Return default announcements on error
      return c.json({
        success: true,
        announcements: [
          {
            id: 'default-ai',
            title: 'AI Pet Assistant',
            subtitle: 'Get instant answers about pet care',
            badgeText: 'NEW',
            badgeColor: 'green',
            icon: '🤖',
            announcementType: 'feature',
          },
          {
            id: 'default-sos',
            title: 'Emergency Ambulance',
            subtitle: 'Coming soon — instant location-based dispatch when we launch',
            badgeText: 'SOON',
            badgeColor: 'amber',
            icon: '📞',
            ctaText: 'COMING SOON',
            announcementType: 'emergency',
            comingSoon: true,
          },
          {
            id: 'default-premium',
            title: 'WarmPawz Plus',
            subtitle: 'Coming soon — unlimited services at best prices when we launch',
            badgeText: 'SOON',
            badgeColor: 'amber',
            icon: '⭐',
            ctaText: 'COMING SOON',
            announcementType: 'premium',
            comingSoon: true,
          },
        ],
        total: 3,
        isDefault: true,
      });
    }
}
