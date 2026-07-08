import { buildBoardingVendorListFromRows, type BoardingListVendor } from '@/lib/boarding-vendor-discovery-map';
import {
  isCafeCategory,
  isPharmacyCategory,
  isResortCategory,
  isSittingCategory,
  isWalkerCategory,
  resolveEffectiveSearchCategory,
} from '@/lib/search-category-detect';

export interface SearchVendorCardLike {
  id: string;
  name: string;
  category: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  distanceKm?: number | null;
  photo?: string;
  roleDisplayName?: string;
}

/** Map GET /search vendor row to BoardingListVendor for BoardingVendorExpandableCard. */
export function searchCardToBoardingListVendor(
  card: SearchVendorCardLike,
  activeHubChip: string,
  searchQuery?: string
): BoardingListVendor {
  const effectiveCategory = resolveEffectiveSearchCategory(card.category, activeHubChip, searchQuery);
  const row: Record<string, unknown> = {
    id: card.id,
    vendorId: card.id,
    businessName: card.name,
    name: card.name,
    address: card.address,
    rating: card.rating ?? 0,
    review_count: card.reviewCount ?? 0,
    distanceKm: card.distanceKm,
    photo: card.photo,
    roleDisplayName:
      effectiveCategory === 'training'
        ? 'Training'
        : effectiveCategory === 'grooming'
          ? 'Grooming'
          : effectiveCategory === 'boarding'
            ? 'Boarding'
            : effectiveCategory === 'walker' || isWalkerCategory(effectiveCategory)
              ? 'Walker'
              : effectiveCategory === 'sitting' || isSittingCategory(effectiveCategory)
                ? 'Sitting'
                : effectiveCategory === 'cafe' || isCafeCategory(effectiveCategory)
                  ? 'Pet Cafe'
                  : effectiveCategory === 'resort' || isResortCategory(effectiveCategory)
                    ? 'Resort'
                    : effectiveCategory === 'pharmacy' || isPharmacyCategory(effectiveCategory)
                      ? 'Pharmacy'
                      : card.roleDisplayName || effectiveCategory,
    category: effectiveCategory,
    timing: '9 AM - 8 PM',
  };

  const { list } = buildBoardingVendorListFromRows([row], 'all');
  if (list[0]) return list[0];

  return {
    id: card.id,
    name: card.name,
    address: card.address?.trim() || 'Location on booking',
    rating: card.rating ?? 0,
    review_count: card.reviewCount ?? 0,
    distance:
      card.distanceKm != null && Number.isFinite(card.distanceKm)
        ? `${card.distanceKm.toFixed(1)} km`
        : null,
    distanceKm: card.distanceKm ?? null,
    timing: '9 AM - 8 PM',
    services: [],
    price_label: '',
    planRows: [],
    needsServiceFetch: true,
    photo: card.photo,
    raw: row,
  };
}
