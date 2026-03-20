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
import { query, select } from '../../../database/rds-connection';

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
      const limit = parseInt(c.req.query('limit') || '10', 10);

      const now = new Date().toISOString();

      // Fetch active banners (banners table has type: main, spotlight, category, service)
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
        AND (type = $1 OR $1 = 'all')
        AND (start_date IS NULL OR start_date <= $2)
        AND (end_date IS NULL OR end_date >= $2)
        ORDER BY display_order ASC, created_at DESC
        LIMIT $3`,
        [bannerType, now, limit]
      ).catch(() => ({ rows: [] }));

      // Map banners to frontend format (type exposed as position for backward compat)
      const banners = (bannersResult.rows || []).map((b: any) => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        imageUrl: b.image_url,
        ctaText: b.cta_text || 'Learn More',
        ctaLink: b.cta_link,
        position: b.type || 'main',
        displayOrder: b.display_order || 0,
        // Extract gradient colors from metadata or use defaults
        gradientFrom: b.metadata?.gradient_from || '#FF8C42',
        gradientTo: b.metadata?.gradient_to || '#FF6B35',
        icon: b.metadata?.icon,
      }));

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
            id: 'default-1',
            title: 'Get 50% OFF',
            subtitle: 'First Grooming Session',
            gradientFrom: '#FF8C42',
            gradientTo: '#FF6B35',
            ctaText: 'Claim Now',
            ctaLink: '/grooming',
            icon: '✂️',
          },
          {
            id: 'default-2',
            title: 'Free Health Checkup',
            subtitle: 'Book Vet Appointment Today',
            gradientFrom: '#4CAF50',
            gradientTo: '#2E7D32',
            ctaText: 'Book Now',
            ctaLink: '/vet',
            icon: '🩺',
          },
          {
            id: 'default-3',
            title: 'Premium Pet Food',
            subtitle: '20% OFF on First Order',
            gradientFrom: '#FF6B9D',
            gradientTo: '#C44569',
            ctaText: 'Shop Now',
            ctaLink: '/shop',
            icon: '🦴',
          },
        ],
        total: 3,
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

      // Include all categories: both admin categories (legal, help, marketing, other) 
      // and customer-facing categories (tips, article, nutrition, health, grooming, insurance, behavior)
      let articlesQuery = `
        SELECT 
          id,
          title,
          slug,
          content,
          category,
          is_published,
          created_at,
          updated_at
        FROM content_pages
        WHERE is_published = true
        AND category IN ('marketing', 'tips', 'article', 'nutrition', 'health', 'grooming', 'insurance', 'behavior', 'legal', 'help', 'other')
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (category) {
        articlesQuery += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      // Note: featured filter removed since metadata column doesn't exist
      // if (featured) {
      //   articlesQuery += ` AND (metadata->>'featured')::boolean = true`;
      // }

      articlesQuery += ` ORDER BY 
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
      const articles = (articlesResult.rows || []).map((a: any) => {
        const raw = typeof a.content === 'string' ? a.content : '';
        const excerpt =
          raw.length > 150 ? `${raw.substring(0, 150).trim()}…` : raw || '';
        return {
          id: a.id,
          title: a.title,
          slug: a.slug,
          category: a.category,
          readTime: a.metadata?.read_time || '5 min',
          featured: a.metadata?.featured || false,
          excerpt,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        };
      });

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

  const ARTICLE_CATEGORIES = [
    'marketing', 'tips', 'article', 'nutrition', 'health', 'grooming', 'insurance', 'behavior',
  ];

  /**
   * GET /customer/articles/:articleRef
   * Single published article by UUID id or slug (from Admin → Marketing → Articles / content_pages).
   */
  app.get("/customer/articles/:articleRef", async (c) => {
    try {
      const articleRef = c.req.param('articleRef');
      if (!articleRef || articleRef.length > 512) {
        return c.json({ success: false, error: 'Invalid article reference' }, 400);
      }

      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const isUuid = uuidRe.test(articleRef);

      const rows = isUuid
        ? await query(
            `SELECT id, title, slug, content, category, is_published, metadata, created_at, updated_at
             FROM content_pages
             WHERE is_published = true
             AND category = ANY($2::text[])
             AND id = $1::uuid
             LIMIT 1`,
            [articleRef, ARTICLE_CATEGORIES]
          ).catch(() => ({ rows: [] }))
        : await query(
            `SELECT id, title, slug, content, category, is_published, metadata, created_at, updated_at
             FROM content_pages
             WHERE is_published = true
             AND category = ANY($2::text[])
             AND slug = $1
             LIMIT 1`,
            [articleRef, ARTICLE_CATEGORIES]
          ).catch(() => ({ rows: [] }));

      const row = rows.rows?.[0];
      if (!row) {
        return c.json({ success: false, error: 'Article not found' }, 404);
      }

      const a = row as any;
      return c.json({
        success: true,
        article: {
          id: a.id,
          title: a.title,
          slug: a.slug,
          content: a.content || '',
          category: a.category,
          readTime: a.metadata?.read_time || '5 min',
          featured: a.metadata?.featured || false,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        },
      });
    } catch (error: any) {
      console.error('Error fetching customer article:', error);
      return c.json({ success: false, error: error.message || 'Failed to load article' }, 500);
    }
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
            subtitle: 'Instant location-based dispatch',
            badgeText: 'SOS',
            badgeColor: 'red',
            icon: '📞',
            ctaText: 'SOS ALERT',
            ctaLink: '/ambulance',
            announcementType: 'emergency',
          },
          {
            id: 'default-premium',
            title: 'WarmPawz Plus',
            subtitle: 'Unlimited services at best prices',
            badgeText: 'PREMIUM',
            badgeColor: 'purple',
            icon: '⭐',
            announcementType: 'premium',
          },
          {
            id: 'default-articles',
            title: 'Pet care articles',
            subtitle: 'Tips on pets, pet care, services & vendors',
            badgeText: 'TIPS',
            badgeColor: 'teal',
            icon: '📖',
            ctaLink: 'articles',
            announcementType: 'articles',
          },
        ],
        total: 4,
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
   * Get spotlight/featured vendors for customer home "Featured" block.
   * Reads from spotlight_offers (admin-configured); does not use payment policy.
   */
  app.get("/customer/featured-vendors", async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') || '6', 10);
      const now = new Date().toISOString();

      const result = await query(
        `SELECT id, title, subtitle, image_url, cta_text, cta_link, role_id, service_category, metadata, display_order
         FROM spotlight_offers
         WHERE is_active = true
         AND (start_date IS NULL OR start_date <= $1)
         AND (end_date IS NULL OR end_date >= $1)
         ORDER BY display_order ASC, created_at DESC
         LIMIT $2`,
        [now, limit]
      ).catch(() => ({ rows: [] }));

      const vendors = (result.rows || []).map((r: any) => ({
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
          created_at,
          updated_at
        FROM content_pages
        WHERE slug IN (${placeholders}) AND (is_published = true OR is_published = 'true')
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
            created_at,
            updated_at
          FROM content_pages
          WHERE LOWER(TRIM(slug)) = LOWER(TRIM($1)) AND (is_published = true OR is_published = 'true')
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
              readTime: '5 min', // Default since metadata column doesn't exist
              featured: false,
              imageUrl: null,
              seoTitle: page.title,
              seoDescription: page.content?.substring(0, 160) || '',
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
          readTime: '5 min', // Default since metadata column doesn't exist
          featured: false,
          imageUrl: null,
          seoTitle: page.title,
          seoDescription: page.content?.substring(0, 160) || '',
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
        readTime: '5 min', // Default since metadata column doesn't exist
        featured: false, // Default since metadata column doesn't exist
        imageUrl: null, // Default since metadata column doesn't exist
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
