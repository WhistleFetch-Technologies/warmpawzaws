import type { Context } from 'hono';
import * as customer_featuredpackages_getRepo from '../repos/customer_featuredpackages_get.repo';
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

export async function executecustomerFeaturedpackagesGet(c: Context) {
    try {
      const limit = parseInt(c.req.query('limit') || '3', 10);

      // Try to get featured packages from promotions
      const packagesResult = await customer_featuredpackages_getRepo.dbCustomerFeaturedpackagesGet0(name, description, discount_type, discount_value, min_order_amount, applicable_services).catch(() => ({ rows: [] }));

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
}