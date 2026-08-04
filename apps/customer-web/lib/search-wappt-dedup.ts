import {
  isBoardingCategory,
  isBoardingHub,
  isBoardingVendorResult,
  isGroomingCategory,
  isGroomingHub,
  isGroomingVendorResult,
  isSittingCategory,
  isSittingHub,
  isSittingVendorResult,
  isTrainingCategory,
  isTrainingHub,
  isTrainingVendorResult,
  isVetHub,
  isVetLikeCategory,
  isVetVendorResult,
  isWalkerCategory,
  isWalkerHub,
  isWalkerVendorResult,
  resolveEffectiveSearchCategory,
} from '@/lib/search-category-detect';

type SearchVendorRow = {
  id: string;
  type: string;
  category?: string;
  name?: string;
};

type WapptSearchRow = {
  id: string;
  category: string;
};

type HubMatcher = {
  wapptCategory: string;
  isHubRow: (effective: string) => boolean;
  isVendorRow: (row: SearchVendorRow, effective: string) => boolean;
};

const WAPPT_HUB_MATCHERS: HubMatcher[] = [
  {
    wapptCategory: 'vet',
    isHubRow: (effective) => isVetHub(effective) || effective === 'vet',
    isVendorRow: (row, effective) =>
      isVetVendorResult(row) || isVetLikeCategory(effective) || effective === 'vet',
  },
  {
    wapptCategory: 'grooming',
    isHubRow: (effective) => isGroomingHub(effective),
    isVendorRow: (row, effective) =>
      isGroomingVendorResult(row) || isGroomingCategory(effective),
  },
  {
    wapptCategory: 'training',
    isHubRow: (effective) => isTrainingHub(effective),
    isVendorRow: (row, effective) =>
      isTrainingVendorResult(row) || isTrainingCategory(effective),
  },
  {
    wapptCategory: 'boarding',
    isHubRow: (effective) => isBoardingHub(effective),
    isVendorRow: (row, effective) =>
      isBoardingVendorResult(row) || isBoardingCategory(effective),
  },
  {
    wapptCategory: 'walker',
    isHubRow: (effective) => isWalkerHub(effective),
    isVendorRow: (row, effective) =>
      isWalkerVendorResult(row) || isWalkerCategory(effective),
  },
  {
    wapptCategory: 'sitting',
    isHubRow: (effective) => isSittingHub(effective),
    isVendorRow: (row, effective) =>
      isSittingVendorResult(row) || isSittingCategory(effective),
  },
];

/**
 * When WAPPT rows exist for appointment hubs, drop marketplace vendor duplicates
 * (e.g. generic "Business" rows) and keep only WAPPT-enriched ids per hub.
 */
export function filterMarketplaceRowsWhenWapptPresent<T extends SearchVendorRow>(
  rows: T[],
  wapptRows: WapptSearchRow[],
  activeHubChip: string,
  searchQuery: string,
): T[] {
  if (!wapptRows.length) return rows;

  const wapptIdsByCategory = new Map<string, Set<string>>();
  for (const row of wapptRows) {
    const cat = (row.category || '').trim().toLowerCase();
    if (!cat) continue;
    if (!wapptIdsByCategory.has(cat)) wapptIdsByCategory.set(cat, new Set());
    wapptIdsByCategory.get(cat)!.add(row.id);
  }

  const activeHubs = WAPPT_HUB_MATCHERS.filter((m) => wapptIdsByCategory.has(m.wapptCategory));
  if (!activeHubs.length) return rows;

  return rows.filter((row) => {
    if (row.type !== 'vendor') return true;
    const effective = resolveEffectiveSearchCategory(
      row.category || '',
      activeHubChip,
      searchQuery,
    );
    for (const matcher of activeHubs) {
      const wapptIds = wapptIdsByCategory.get(matcher.wapptCategory);
      if (!wapptIds?.size) continue;
      const hasWapptForHub = wapptRows.some((w) => w.category === matcher.wapptCategory);
      if (!hasWapptForHub) continue;
      const isHubVendor =
        matcher.isVendorRow(row, effective) || matcher.isHubRow(effective);
      if (!isHubVendor) continue;
      if (!wapptIds.has(row.id)) return false;
      return wapptIds.has(row.id);
    }
    return true;
  });
}
