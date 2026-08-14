import type { Context } from 'hono';
import {
  paginateServiceCardPage,
  resolveServiceListPage,
} from '../../../../utils/discovery-list-pagination';
import { resolveVendorById } from '../../../vendor/endpoints/vendorProfile.vendor';
import { vendorRowIsOnline } from '../repos/legacy-helpers.repo';
import { dbFetchVendorServicesList } from '../repos/vendor-services-list.repo';
import { shouldOmitVendorServicePricing } from './wappt-catalogue-discovery.service';
import { filterVendorServicesByStyle } from './vendor-services/filter-by-style';
import { mapVendorServiceRows } from './vendor-services/map-vendor-service-rows';
import { loadVendorServicePackageInclusions } from './vendor-services/package-inclusions';
import {
  buildVendorServicesCardResponse,
  buildVendorServicesLegacyResponse,
  stripVendorServicePrices,
} from './vendor-services/wappt-pricing';

export async function executevendorServices(c: Context) {
  try {
    const { vendorId } = c.req.param();
    const category = c.req.query('category');
    const serviceStyle =
      c.req.query('serviceStyle') || c.req.query('service_style') || c.req.query('style');
    const customerPhone = c.req.query('customerPhone') || c.req.query('phone');

    const vendor = await resolveVendorById(vendorId);
    if (!vendor || !vendorRowIsOnline(vendor.is_online)) {
      return c.json({ error: 'Vendor not found', success: false }, 404);
    }
    const resolvedVendorId = vendor.id;

    const inclusions = await loadVendorServicePackageInclusions(customerPhone, resolvedVendorId);
    const result = await dbFetchVendorServicesList({
      vendorId: resolvedVendorId,
      category,
      serviceStyle,
      vendorDetailListing: true,
    });

    let combined = mapVendorServiceRows(
      (result.rows || []) as Record<string, unknown>[],
      inclusions,
    );
    combined = filterVendorServicesByStyle(combined, serviceStyle);

    const hasActivePackageForVendor =
      inclusions.includedVendorServiceIds.size > 0 ||
      inclusions.includedLegacyServiceIds.size > 0;

    const normalizedStyle = String(serviceStyle ?? '').toLowerCase().trim();
    const isTeleStyle =
      normalizedStyle === 'tele' ||
      normalizedStyle === 'online' ||
      normalizedStyle === 'video_consultation';
    const omitPricing =
      !isTeleStyle && (await shouldOmitVendorServicePricing(resolvedVendorId));

    const servicePage = resolveServiceListPage(c.req.query('limit'), c.req.query('cursor'));
    if (servicePage.cardMode) {
      const slice = combined.slice(servicePage.offset, servicePage.offset + servicePage.limit);
      const fetchedExtra = slice.length > servicePage.pageSize;
      const { page, nextCursor } = paginateServiceCardPage(
        slice,
        servicePage.pageSize,
        servicePage.offset,
        fetchedExtra,
      );
      return c.json(
        buildVendorServicesCardResponse({
          page: page as Record<string, unknown>[],
          nextCursor,
          omitPricing,
        }),
      );
    }

    const legacyServices = omitPricing
      ? stripVendorServicePrices(combined as Record<string, unknown>[])
      : combined;

    return c.json(
      buildVendorServicesLegacyResponse({
        services: legacyServices as Record<string, unknown>[],
        hasActivePackage: hasActivePackageForVendor,
        omitPricing,
      }),
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch services';
    console.error('Error fetching vendor services:', error);
    return c.json({ success: false, error: message, services: [] }, 500);
  }
}
