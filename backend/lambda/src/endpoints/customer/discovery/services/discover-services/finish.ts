import type { Context } from 'hono';
import type { CatalogueDiscoveryOptions } from '../shared/catalogue-discovery-options';
import { paginateEnrichedVendorPage } from '../../../../../utils/discovery-list-pagination';
import {
  applyDiscoveryRadiusFilter,
  filterDiscoveryCardsByMinRating,
  sortDiscoveryVendorCards,
} from '../../../../../utils/discovery-vendor-list-post-process';
import { buildVendorListResponse } from '../../../../../utils/discovery-list-response';
import type { DiscoverCategoryContext, DiscoverServicesParsed, VendorRadiusLookup } from './types';

export function finishDiscoverServicesResponse(
  c: Context,
  parsed: DiscoverServicesParsed,
  categoryCtx: DiscoverCategoryContext,
  providers: Record<string, unknown>[],
  vendorRowCount: number,
  vendorRadiusLookupDiscover: VendorRadiusLookup,
  discoveryOptions: CatalogueDiscoveryOptions = {},
) {
  const {
    serviceStyle,
    serviceStyleNormDiscover,
    customerLat,
    customerLng,
    maxDistanceKm,
    minRatingVal,
    sortBy,
    radius,
    rules,
    pageSize,
    resultOffset,
    sqlLimit,
    sqlOffset,
  } = parsed;
  const { sittingDiscoveryRelaxed } = categoryCtx;

  let results = providers;
  results = filterDiscoveryCardsByMinRating(results, minRatingVal);

  const platformHomeDiscover = rules.discovery_radius_km_home ?? 10;
  results = applyDiscoveryRadiusFilter(results, {
    serviceStyleNorm: serviceStyleNormDiscover,
    customerLat,
    customerLng,
    maxDistanceKm,
    radius,
    platformHomeKm: platformHomeDiscover,
    sittingRelaxed: sittingDiscoveryRelaxed,
    vendorRadiusLookup: vendorRadiusLookupDiscover,
  });

  sortDiscoveryVendorCards(
    results,
    discoveryOptions.omitPricing && sortBy === 'price' ? 'relevance' : sortBy
  );

  const { page: pageCards, nextCursor } = paginateEnrichedVendorPage(
    results,
    pageSize,
    resultOffset,
    vendorRowCount,
    sqlLimit,
    sqlOffset
  );

  return c.json(
    buildVendorListResponse({
      style: serviceStyle,
      enrichedCards: pageCards,
      nextCursor,
      serviceStyleNorm: serviceStyleNormDiscover,
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
          serviceStyleNormDiscover === 'at_home' ? platformHomeDiscover : undefined,
        sortBy: discoveryOptions.omitPricing && sortBy === 'price' ? 'relevance' : sortBy,
      },
    })
  );
}
