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
  preferredServiceStyle?: string;
  serviceStyle?: string;
  nextAvailableSlot?: string;
}

/** Map GET /search vendor row to BoardingListVendor for SearchHubVendorCard. */
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
        ? card.roleDisplayName || 'Training'
        : effectiveCategory === 'grooming'
          ? card.roleDisplayName || 'Grooming'
          : effectiveCategory === 'boarding'
            ? card.roleDisplayName || 'Boarding'
            : effectiveCategory === 'vet' || effectiveCategory === 'veterinary'
              ? card.roleDisplayName || 'Veterinary'
              : effectiveCategory === 'walker' || isWalkerCategory(effectiveCategory)
                ? card.roleDisplayName || 'Walker'
                : effectiveCategory === 'sitting' || isSittingCategory(effectiveCategory)
                  ? card.roleDisplayName || 'Sitting'
                  : effectiveCategory === 'cafe' || isCafeCategory(effectiveCategory)
                    ? 'Pet Cafe'
                    : effectiveCategory === 'resort' || isResortCategory(effectiveCategory)
                      ? 'Resort'
                      : effectiveCategory === 'pharmacy' || isPharmacyCategory(effectiveCategory)
                        ? 'Pharmacy'
                        : card.roleDisplayName || effectiveCategory,
    preferredServiceStyle: card.preferredServiceStyle,
    serviceStyle: card.serviceStyle,
    category: effectiveCategory,
    timing: card.nextAvailableSlot ? `Next: ${card.nextAvailableSlot}` : '9 AM - 8 PM',
    nextAvailableSlot: card.nextAvailableSlot,
    availabilityText: card.nextAvailableSlot,
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
