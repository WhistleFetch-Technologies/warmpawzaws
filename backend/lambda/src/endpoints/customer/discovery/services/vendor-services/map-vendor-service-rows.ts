import {
  parseVendorServiceMetadataForCustomer,
  vendorServicePackagePresentationForCustomer,
} from '../../repos/legacy-helpers.repo';
import type { VendorServicePackageInclusions } from './package-inclusions';

export function mapVendorServiceRows(
  rows: Record<string, unknown>[],
  inclusions: VendorServicePackageInclusions
) {
  const { includedVendorServiceIds, includedLegacyServiceIds, vendorServiceIdToPackagePurchaseId } =
    inclusions;

  return rows.map((row) => {
    const price =
      row.custom_price != null
        ? parseFloat(String(row.custom_price))
        : row.price != null
          ? parseFloat(String(row.price))
          : 0;
    const duration = (row.custom_duration ?? row.duration_minutes ?? 30) as number;
    const name = String(
      row.service_name || row.base_name || row.catalog_name || row.catalog_display_name || 'Service'
    );
    const description = String(
      row.custom_description || row.base_description || row.catalog_description || ''
    );
    const shortDescription = description.length > 200 ? `${description.slice(0, 200)}…` : description;
    const rawSpec = row.catalog_specialization_ids;
    const specializationIds = Array.isArray(rawSpec)
      ? rawSpec
      : rawSpec != null
        ? [].concat(rawSpec as never)
        : [];
    const metadata = parseVendorServiceMetadataForCustomer(row.vs_metadata);
    const { isPackage, packageDetails } = vendorServicePackagePresentationForCustomer(
      metadata,
      duration
    );
    const inActivePackage =
      includedVendorServiceIds.has(String(row.id)) ||
      includedLegacyServiceIds.has(String(row.service_id));
    const activePackagePurchaseId = vendorServiceIdToPackagePurchaseId.get(String(row.id));

    return {
      id: row.id,
      serviceId: row.service_id,
      service_id: row.service_id,
      name,
      service_name: name,
      shortDescription,
      longDescription: description || null,
      description,
      durationMinutes: duration,
      base_price: row.price != null ? parseFloat(String(row.price)) : 0,
      price,
      custom_price: row.custom_price != null ? parseFloat(String(row.custom_price)) : undefined,
      duration,
      category: row.resolved_category || row.category,
      categoryName: row.resolved_category || row.category,
      categorySlug: row.category,
      catalogCategoryId: row.catalog_category_id ?? null,
      catalogServiceId: row.catalog_service_id ?? null,
      serviceStyle: row.service_style || null,
      specializationIds,
      specialization_ids: specializationIds,
      metadata,
      isPackage,
      packageDetails,
      taxCategoryId: metadata?.taxCategoryId ?? metadata?.tax_category ?? null,
      couponEligible: metadata?.couponEligible !== false,
      publishStatus: row.publish_status || 'published',
      isEnabled: true,
      requiresPetProfile: false,
      requiresAddress: false,
      inActivePackage: !!inActivePackage,
      activePackagePurchaseId: inActivePackage ? activePackagePurchaseId : undefined,
    };
  });
}
