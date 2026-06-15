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
import { query, select } from '../database/rds-connection';
import {
  resolveFeaturedVendorsRequestScreen,
  canonicalScreenForSpotlightRow,
} from '../utils/featured-vendor-service-context';

export function registerCustomerContentEndpoints(app: Hono) {
  /**
   * GET /customer/banners
   * Get active banners for customer home screen
   * Query params: position (optional), limit (optional)
   */
  app.get("/customer/banners", async (c) => {
    try {
      // position query param: home_top -> main (banners.type), all -> all types
      const positionParam = c.req.query('position') || 'home_top';
      const bannerType = positionParam === 'all' ? 'all' : (positionParam === 'home_top' ? 'main' : positionParam);
      const rawLimit = parseInt(c.req.query('limit') || '10', 10);
      const limit = Math.min(Math.max(rawLimit, 1), 25);

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
        ORDER BY display_order ASC, created_at DESC
        LIMIT $3`,
        [bannerType, now, limit]
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
      const banners = (bannersResult.rows || [])
        .filter((b: any) => !legacyHeroTitles.has(String(b.title || '').trim()))
        .map((b: any) => {
        const meta = parseMetadata(b.metadata);
        return {
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: b.image_url,
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
        };
      });

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
  });

  /**
   * ✅ Alias: GET /marketing/banners
   * Backward-compatible admin/content endpoint
   */
  app.get("/marketing/banners", async (c) => {
    return app.fetch(new Request(c.req.url.replace('/marketing/banners', '/customer/banners'), c.req.raw));
  });

  /**
   * GET /customer/articles
   * Get published articles for customer home screen
   * Query params: category (optional), limit (optional), featured (optional)
   */
  app.get("/customer/articles", async (c) => {
    const startTime = Date.now();
    try {
      const category = c.req.query('category');
      const limit = parseInt(c.req.query('limit') || '5', 10);
      const featured = c.req.query('featured') === 'true';

      let articlesQuery = `
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
        AND category IN ('marketing', 'tips', 'article', 'nutrition', 'health', 'grooming', 'insurance', 'behavior')
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (category) {
        articlesQuery += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (featured) {
        articlesQuery += ` AND (metadata->>'featured')::boolean = true`;
      }

      articlesQuery += ` ORDER BY 
        CASE WHEN (metadata->>'featured')::boolean = true THEN 0 ELSE 1 END,
        updated_at DESC
        LIMIT $${paramIndex}`;
      params.push(limit);

      const articlesResult = await query(articlesQuery, params).catch((err: any) => {
        const duration = Date.now() - startTime;
        // ✅ Enhanced logging for 503 diagnosis
        console.warn(`[articles] Query failed after ${duration}ms:`, err?.message || err);
        if (err?.message?.includes('connection pool') || err?.message?.includes('too many clients')) {
          console.error('[articles] ⚠️ Connection pool exhausted - returning default articles');
        }
        return { rows: [] };
      });

      // Map articles to frontend format
      const articles = (articlesResult.rows || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        slug: a.slug,
        category: a.category,
        readTime: a.metadata?.read_time || '5 min',
        featured: a.metadata?.featured || false,
        excerpt: a.content?.substring(0, 150) + '...',
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      }));

      return c.json({
        success: true,
        articles,
        total: articles.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer articles:', error);
      // Return default articles on error
      return c.json({
        success: true,
        articles: [
          {
            id: 'default-1',
            title: '10 Tips for Puppy Training',
            category: 'Training',
            readTime: '5 min',
            icon: '🐕',
          },
          {
            id: 'default-2',
            title: 'Best Foods for Senior Dogs',
            category: 'Nutrition',
            readTime: '7 min',
            icon: '🥗',
          },
          {
            id: 'default-3',
            title: 'Understanding Pet Insurance',
            category: 'Insurance',
            readTime: '6 min',
            icon: '🛡️',
          },
        ],
        total: 3,
        isDefault: true,
      });
    }
  });

  /**
   * ✅ Alias: GET /marketing/articles
   * Backward-compatible admin/content endpoint
   */
  app.get("/marketing/articles", async (c) => {
    return app.fetch(new Request(c.req.url.replace('/marketing/articles', '/customer/articles'), c.req.raw));
  });

  /**
   * GET /customer/announcements
   * Get active announcements for "What's New" section
   * Query params: limit (optional)
   */
  app.get("/customer/announcements", async (c) => {
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
  });

  /**
   * ✅ Alias: GET /marketing/announcements
   * Backward-compatible admin/content endpoint
   */
  app.get("/marketing/announcements", async (c) => {
    return app.fetch(new Request(c.req.url.replace('/marketing/announcements', '/customer/announcements'), c.req.raw));
  });

  /**
   * GET /customer/featured-vendors
   * Spotlight/featured vendor cards for service dashboards only (not global home).
   * Query: `service` — required for a non-empty list (e.g. grooming, vet, boarding, training, sitting, veterinary).
   *        Mirrors PromotionBanner `service` and promotion-navigation slugs. Omit or unknown → { vendors: [] }.
   * Reads from spotlight_offers (admin-configured); does not use payment policy.
   */
  app.get("/customer/featured-vendors", async (c) => {
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

      const rows = (result.rows || []) as any[];
      const matched: any[] = [];
      for (const r of rows) {
        if (matched.length >= limit) break;
        const bucket = canonicalScreenForSpotlightRow(r.service_category, r.role_id);
        if (bucket === requested) matched.push(r);
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
  });

  /**
   * GET /customer/featured-packages
   * Get featured service packages for home screen
   */
  app.get("/customer/featured-packages", async (c) => {
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
  });

  /**
   * GET /customer/adoption-stats
   * Get aggregated adoption statistics
   */
  app.get("/customer/adoption-stats", async (c) => {
    try {
      // Get counts from various tables
      const [petsResult, breedersResult, rehomingResult] = await Promise.all([
        query(`SELECT COUNT(*) as count FROM adoption_pets WHERE status = 'available'`).catch(() => ({ rows: [{ count: '50' }] })),
        query(`SELECT COUNT(*) as count FROM vendors WHERE vendor_type = 'breeder' AND status = 'approved'`).catch(() => ({ rows: [{ count: '30' }] })),
        query(`SELECT COUNT(*) as count FROM adoption_pets WHERE listing_type = 'rehoming' AND status = 'available'`).catch(() => ({ rows: [{ count: '20' }] })),
      ]);

      return c.json({
        success: true,
        stats: {
          adoptablePets: parseInt(petsResult.rows[0]?.count || '50', 10),
          certifiedBreeders: parseInt(breedersResult.rows[0]?.count || '30', 10),
          rehomingListings: parseInt(rehomingResult.rows[0]?.count || '20', 10),
        },
      });
    } catch (error: any) {
      console.error('Error fetching adoption stats:', error);
      return c.json({
        success: true,
        stats: {
          adoptablePets: 50,
          certifiedBreeders: 30,
          rehomingListings: 20,
        },
      });
    }
  });
}
