import type { Context } from 'hono';
import * as customer_content_pages_slug_getRepo from '../repos/customer_content_pages_slug_get.repo';
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

export async function executecustomerContentPagesSlugGet(c: Context) {
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
      const placeholders = uniqueVariations.map((_, i) => `${i + 1}`).join(', ');
      const queryParams = uniqueVariations;
      
      const pageResult = await customer_content_pages_slug_getRepo.dbCustomerContentPagesSlugGet0(placeholders, slug, queryParams).catch((err) => {
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
        
        const caseInsensitiveResult = await customer_content_pages_slug_getRepo.dbCustomerContentPagesSlugGet1(slug).catch(() => ({ rows: [] }));

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
        const allPages = await customer_content_pages_slug_getRepo.dbCustomerContentPagesSlugGet2().catch(() => ({ rows: [] }));
        
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
}