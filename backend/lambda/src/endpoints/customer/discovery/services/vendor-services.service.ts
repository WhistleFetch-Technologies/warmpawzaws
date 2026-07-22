import type { Context } from 'hono';
import { resolveVendorById } from '../../../vendor/endpoints/vendorProfile.vendor';
import {
  paginateServiceCardPage,
  resolveServiceListPage,
} from '../../../../utils/discovery-list-pagination';
import { toServiceCardDTOList } from '../../../../utils/discovery-service-card-dto';
import { vendorRowIsOnline } from '../repos/legacy-helpers.repo';
import { dbFetchVendorServicesList } from '../repos/vendor-services-list.repo';
import { filterVendorServicesByStyle } from './vendor-services/filter-by-style';
import { mapVendorServiceRows } from './vendor-services/map-vendor-service-rows';
import { loadVendorServicePackageInclusions } from './vendor-services/package-inclusions';

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
    });

    let combined = mapVendorServiceRows(
      (result.rows || []) as Record<string, unknown>[],
      inclusions
    );
    combined = filterVendorServicesByStyle(combined, serviceStyle);

    const hasActivePackageForVendor =
      inclusions.includedVendorServiceIds.size > 0 ||
      inclusions.includedLegacyServiceIds.size > 0;

    const servicePage = resolveServiceListPage(c.req.query('limit'), c.req.query('cursor'));
    if (servicePage.cardMode) {
      const slice = combined.slice(servicePage.offset, servicePage.offset + servicePage.limit);
      const fetchedExtra = slice.length > servicePage.pageSize;
      const { page, nextCursor } = paginateServiceCardPage(
        slice,
        servicePage.pageSize,
        servicePage.offset,
        fetchedExtra
      );
      return c.json({
        success: true,
        services: toServiceCardDTOList(page as Record<string, unknown>[]),
        nextCursor,
        count: page.length,
      });
    }

    return c.json({
      success: true,
      services: combined,
      packages: combined.filter((s) => s.isPackage),
      count: combined.length,
      hasActivePackage: hasActivePackageForVendor,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch services';
    console.error('Error fetching vendor services:', error);
    return c.json({ success: false, error: message, services: [] }, 500);
  }
}
