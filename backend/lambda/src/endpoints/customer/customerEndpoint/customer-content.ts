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
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { query, select } from '../../../database/rds-connection';
import {
  resolveFeaturedVendorsRequestScreen,
  canonicalScreenForSpotlightRow,
} from '../../../utils/featured-vendor-service-context';
import {
  enrichBannersWithNavTargets,
  resolveBannerCtaNavigation,
} from '../../../utils/banner-cta-resolver';
import { listPublishedCustomerArticlesForCustomer } from '../../../utils/content-page-articles';
import { presignBannerImageForDisplay } from '../../../utils/banner-s3-image';
import {
  createLaunchGeoFilter,
  shouldIncludeFeaturedSpotlightRow,
} from '../../../lib/customer-launch-geo-filter';

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
  });

  /**
   * ✅ Alias: GET /marketing/banners
   * Backward-compatible admin/content endpoint
   */
  app.get("/marketing/banners", async (c) => {
    return app.fetch(new Request(c.req.url.replace('/marketing/banners', '/customer/banners'), c.req.raw));
  });

  /**
   * GET /customer/banners/resolve-cta
   * Resolve `/persona/vendor-name` + banner title → booking navigation (fallback when navTarget absent).
   */
  app.get("/customer/banners/resolve-cta", async (c) => {
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
  });

  /**
   * GET /customer/articles/:slug
   * Single published article for the customer article viewer (ArticleDetailClient).
   * Delegates to the same lookup as GET /customer/content/pages/:slug but returns { article }.
   */
  app.get('/customer/articles/:slug', async (c) => {
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

      const data: { success?: boolean; page?: Record<string, unknown>; error?: string } = (await resp
        .json()
        .catch(() => ({}))) as { success?: boolean; page?: Record<string, unknown>; error?: string };

      if (!resp.ok || !data?.success || !data?.page) {
        const status = resp.status === 404 ? 404 : resp.status >= 400 ? resp.status : 404;
        return c.json(
          { success: false, error: (data as { error?: string })?.error || 'Article not found' },
          status as ContentfulStatusCode
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
   *        Same service context as service-dashboard spotlights / promotion-navigation slugs. Omit or unknown → { vendors: [] }.
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

  /**
   * GET /customer/content/pages/:slug
   * Get a single content page by slug for full page display
   */
  app.get("/customer/content/pages/:slug", async (c) => {
    try {
      const rawSlug = c.req.param('slug');
      
      // Hono's param() may already decode, but handle both cases
      let slug: string;
      try {
        // Try decoding - if already decoded, this will work fine
        slug = rawSlug ? decodeURIComponent(rawSlug) : '';
      } catch (e) {
        // If decode fails, use raw value (might already be decoded)
        slug = rawSlug || '';
      }

      console.log('[ContentPageViewer API] Received slug:', { rawSlug, decodedSlug: slug });

      if (!slug) {
        return c.json({ success: false, error: 'Slug is required' }, 400);
      }

      // Try multiple slug variations to handle different storage formats
      const slugVariations = [
        slug,                                    // Exact match
        slug.replace(/\s+/g, '-'),               // Spaces to hyphens
        slug.replace(/\s+/g, '_'),               // Spaces to underscores
        slug.toLowerCase(),                      // Lowercase
        slug.toLowerCase().replace(/\s+/g, '-'), // Lowercase + hyphens
        slug.toLowerCase().replace(/\s+/g, '_'), // Lowercase + underscores
      ];

      // Remove duplicates
      const uniqueVariations = [...new Set(slugVariations)];

      console.log('[ContentPageViewer API] Searching with variations:', uniqueVariations);

      // Build query with all variations
      const placeholders = uniqueVariations.map((_, i) => `$${i + 1}`).join(', ');
      const queryParams = uniqueVariations;
      
      const pageResult = await query(
        `SELECT 
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
        WHERE slug IN (${placeholders}) AND is_published = true
        LIMIT 1`,
        queryParams
      ).catch((err) => {
        console.error('[ContentPageViewer API] Database query error:', err);
        return { rows: [] };
      });

      console.log('[ContentPageViewer API] Query result:', {
        found: pageResult.rows?.length > 0,
        matchedSlug: pageResult.rows?.[0]?.slug,
      });

      if (!pageResult.rows || pageResult.rows.length === 0) {
        // Try case-insensitive search as fallback
        console.log('[ContentPageViewer API] Exact match failed, trying case-insensitive search');
        
        const caseInsensitiveResult = await query(
          `SELECT 
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
          WHERE LOWER(TRIM(slug)) = LOWER(TRIM($1)) AND is_published = true
          LIMIT 1`,
          [slug]
        ).catch(() => ({ rows: [] }));

        if (caseInsensitiveResult.rows && caseInsensitiveResult.rows.length > 0) {
          console.log('[ContentPageViewer API] Found via case-insensitive search');
          const page = caseInsensitiveResult.rows[0];
          
          return c.json({
            success: true,
            page: {
              id: page.id,
              title: page.title,
              slug: page.slug,
              content: page.content,
              category: page.category,
              readTime: page.metadata?.read_time || '5 min',
              featured: page.metadata?.featured || false,
              imageUrl: page.metadata?.image_url,
              seoTitle: page.metadata?.seo_title || page.title,
              seoDescription: page.metadata?.seo_description || page.content?.substring(0, 160),
              createdAt: page.created_at,
              updatedAt: page.updated_at,
            },
          });
        }

        // Log available slugs for debugging
        const allPages = await query(
          `SELECT slug, title, is_published, category FROM content_pages ORDER BY updated_at DESC LIMIT 20`
        ).catch(() => ({ rows: [] }));
        
        const availablePages = allPages.rows.map((p: any) => ({
          slug: p.slug,
          slugLength: p.slug?.length || 0,
          slugEncoded: encodeURIComponent(p.slug || ''),
          title: p.title,
          isPublished: p.is_published,
          category: p.category,
        }));
        
        console.log('[ContentPageViewer API] Available pages:', JSON.stringify(availablePages, null, 2));
        console.log('[ContentPageViewer API] Searched variations:', JSON.stringify(uniqueVariations.map(s => ({
          slug: s,
          length: s.length,
          encoded: encodeURIComponent(s),
        })), null, 2));
        
        return c.json({ 
          success: false, 
          error: `Page not found. Searched for: ${uniqueVariations.join(', ')}`,
          debug: {
            searchedVariations: uniqueVariations,
            availableSlugs: allPages.rows.map((p: any) => p.slug),
            rawSlug: rawSlug,
            decodedSlug: slug,
          }
        }, 404);
      }

      const page = pageResult.rows[0];
      
      return c.json({
        success: true,
        page: {
          id: page.id,
          title: page.title,
          slug: page.slug,
          content: page.content,
          category: page.category,
          readTime: page.metadata?.read_time || '5 min',
          featured: page.metadata?.featured || false,
          imageUrl: page.metadata?.image_url,
          seoTitle: page.metadata?.seo_title || page.title,
          seoDescription: page.metadata?.seo_description || page.content?.substring(0, 160),
          createdAt: page.created_at,
          updatedAt: page.updated_at,
        },
      });
    } catch (error: any) {
      console.error('Error fetching content page:', error);
      return c.json({ 
        success: false, 
        error: error.message || 'Failed to fetch page' 
      }, 500);
    }
  });

  /**
   * GET /customer/content/pages
   * Get all published content pages with optional filtering
   * Query params: category (optional), limit (optional), offset (optional)
   */
  app.get("/customer/content/pages", async (c) => {
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
  });
}
