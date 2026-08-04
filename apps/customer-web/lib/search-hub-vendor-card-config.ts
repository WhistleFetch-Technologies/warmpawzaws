import {
  isBoardingCategory,
  isCafeCategory,
  isGroomingCategory,
  isPharmacyCategory,
  isResortCategory,
  isSittingCategory,
  isTrainingCategory,
  isVetLikeCategory,
  isWalkerCategory,
} from '@/lib/search-category-detect';

export type SearchHubVendorCardMeta = {
  category: string;
  categoryLabelFallback: string;
};

/** Maps effective search category → SearchHubVendorCard props. */
export function resolveSearchHubVendorCardMeta(
  effectiveCategory: string,
  roleDisplayName?: string,
): SearchHubVendorCardMeta {
  const c = (effectiveCategory || '').trim().toLowerCase();
  if (c === 'vet' || isVetLikeCategory(c)) {
    return { category: 'vet', categoryLabelFallback: 'Veterinary' };
  }
  if (c === 'grooming' || isGroomingCategory(c)) {
    return { category: 'grooming', categoryLabelFallback: 'Grooming' };
  }
  if (c === 'training' || isTrainingCategory(c)) {
    return { category: 'training', categoryLabelFallback: 'Training' };
  }
  if (c === 'boarding' || isBoardingCategory(c)) {
    return { category: 'boarding', categoryLabelFallback: 'Boarding' };
  }
  if (c === 'walker' || isWalkerCategory(c)) {
    return { category: 'walker', categoryLabelFallback: 'Walker' };
  }
  if (c === 'sitting' || isSittingCategory(c)) {
    return { category: 'sitting', categoryLabelFallback: 'Pet Sitting' };
  }
  if (c === 'cafe' || isCafeCategory(c)) {
    return { category: 'cafe', categoryLabelFallback: 'Pet Cafe' };
  }
  if (c === 'resort' || isResortCategory(c)) {
    return { category: 'resort', categoryLabelFallback: 'Resort' };
  }
  if (c === 'pharmacy' || isPharmacyCategory(c)) {
    return { category: 'pharmacy', categoryLabelFallback: 'Pharmacy' };
  }
  return {
    category: effectiveCategory || 'vet',
    categoryLabelFallback: roleDisplayName || effectiveCategory || 'Provider',
  };
}
