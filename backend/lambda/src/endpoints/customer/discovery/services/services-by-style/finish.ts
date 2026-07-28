import type { Context } from 'hono';
import { buildAppointmentVendorListResponse } from '../../../../../utils/appointment-list-response';
import { paginateEnrichedVendorPage } from '../../../../../utils/discovery-list-pagination';
import {
  applyDiscoveryRadiusFilter,
  filterDiscoveryCardsByMinRating,
  sortDiscoveryVendorCards,
} from '../../../../../utils/discovery-vendor-list-post-process';
import { buildVendorListResponse } from '../../../../../utils/discovery-list-response';
import type { ServicesByStyleDiscoveryOptions } from './discovery-options';
import type { ServicesByStyleCategoryContext, ServicesByStyleParsed, VendorRadiusLookup } from './types';

export function finishServicesByStyleResponse(
  c: Context,
  parsed: ServicesByStyleParsed,
  categoryCtx: ServicesByStyleCategoryContext,
  providers: Record<string, unknown>[],
  vendorRowCount: number,
  vendorRadiusLookupByStyle: VendorRadiusLookup,
  specializationApplied: string | null,
  discoveryOptions: ServicesByStyleDiscoveryOptions = {}
) {
  const {
    serviceStyle,
    serviceStyleNormByStyle,
    roleId,
    customerLat,
    customerLng,
    maxDistanceKm,
    minRatingVal,
    sortBy,
    radius,
    rules,
    pageSizeByStyle,
    resultOffsetByStyle,
    sqlLimitByStyle,
    sqlOffsetByStyle,
  } = parsed;
  const { catTextExact } = categoryCtx;

  const sittingRelaxedByStyle = Boolean(
    catTextExact.some((c) =>
      ['sitting', 'pet_sitter', 'sitter', 'sitter_solo'].includes(c)
    ) ||
      (Boolean(roleId) &&
        ['pet_sitter', 'sitter', 'sitter_solo', 'pet_sitter_solo', 'pet_sitter_saas'].includes(
          String(roleId).toLowerCase().replace(/-/g, '_')
        ))
  );

  let results = providers;
  results = filterDiscoveryCardsByMinRating(results, minRatingVal);

  const platformHomeByStyle = rules.discovery_radius_km_home ?? 10;
  results = applyDiscoveryRadiusFilter(results, {
    serviceStyleNorm: serviceStyleNormByStyle,
    customerLat,
    customerLng,
    maxDistanceKm,
    radius,
    platformHomeKm: platformHomeByStyle,
    sittingRelaxed: sittingRelaxedByStyle,
    vendorRadiusLookup: vendorRadiusLookupByStyle,
  });

  sortDiscoveryVendorCards(
    results,
    discoveryOptions.omitPricing && sortBy === 'price' ? 'relevance' : sortBy
  );

  const { page: pageCardsByStyle, nextCursor: nextCursorByStyle } = paginateEnrichedVendorPage(
    results,
    pageSizeByStyle,
    resultOffsetByStyle,
    vendorRowCount,
    sqlLimitByStyle,
    sqlOffsetByStyle
  );

  const responseBody = discoveryOptions.appointmentListResponse
    ? buildAppointmentVendorListResponse({
        style: serviceStyle,
        enrichedCards: pageCardsByStyle,
        nextCursor: nextCursorByStyle,
        serviceStyleNorm: serviceStyleNormByStyle,
        specializationApplied,
        appliedFilters: {
          minRating: minRatingVal,
          maxDistance:
            maxDistanceKm ??
            (customerLat != null &&
            customerLng != null &&
            radius != null &&
            radius > 0
              ? radius
              : undefined),
          homeDiscoveryFallbackKm:
            serviceStyleNormByStyle === 'at_home' ? platformHomeByStyle : undefined,
          sortBy: discoveryOptions.omitPricing && sortBy === 'price' ? 'relevance' : sortBy,
        },
      })
    : buildVendorListResponse({
        style: serviceStyle,
        enrichedCards: pageCardsByStyle,
        nextCursor: nextCursorByStyle,
        serviceStyleNorm: serviceStyleNormByStyle,
        specializationApplied,
        warmpawzAppointments: discoveryOptions.markWarmpawzAppointments === true,
        appliedFilters: {
          minRating: minRatingVal,
          maxDistance:
            maxDistanceKm ??
            (customerLat != null &&
            customerLng != null &&
            radius != null &&
            radius > 0
              ? radius
              : undefined),
          homeDiscoveryFallbackKm:
            serviceStyleNormByStyle === 'at_home' ? platformHomeByStyle : undefined,
          sortBy,
        },
      });

  return c.json(responseBody);
}
