import {
  buildResidualSearchText,
  resolveSearchTaxonomy,
} from '../../../../lib/search-taxonomy';
import { mapHubSlugToWpayCategory } from '../shared/map-hub-slug-to-wpay-category';

export type WpayVendorsSearchContext = {
  /** Category filter passed to catalogue SQL (`all` = no category filter). */
  categoryFilter: string | null;
  /** Residual name tokens (AND ILIKE on business_name). */
  nameTokens: string[];
  /** Taxonomy-mapped Pay category (for UI chip sync), null when no hub resolved. */
  resolvedCategory: string | null;
  searchText: string;
  taxonomyHub: string | null;
};

/**
 * Resolve optional natural-language `q` into Pay catalogue filters using shared search taxonomy.
 * Explicit chip category wins when not `all`; otherwise taxonomy hub maps to Pay category.
 */
export async function resolveWpayVendorsSearch(
  q: string | null | undefined,
  explicitCategory: string | null | undefined,
): Promise<WpayVendorsSearchContext> {
  const trimmedQ = String(q ?? '').trim();
  const explicit = String(explicitCategory ?? '').trim() || null;

  if (!trimmedQ) {
    return {
      categoryFilter: explicit,
      nameTokens: [],
      resolvedCategory: null,
      searchText: '',
      taxonomyHub: null,
    };
  }

  const taxonomy = await resolveSearchTaxonomy(trimmedQ);
  const categorySource = taxonomy.topHubSlug ? ('taxonomy' as const) : ('none' as const);
  const residual = buildResidualSearchText(trimmedQ, {
    categorySource,
    topHubSlug: taxonomy.topHubSlug,
    topMatchedPhrase: taxonomy.topMatchedPhrase,
  });

  const taxonomyPayCategory = mapHubSlugToWpayCategory(taxonomy.topHubSlug);

  let categoryFilter = explicit;
  if (!categoryFilter || categoryFilter === 'all') {
    categoryFilter = taxonomyPayCategory ?? explicit ?? 'all';
  }

  return {
    categoryFilter,
    nameTokens: residual.tokens,
    resolvedCategory: taxonomyPayCategory,
    searchText: residual.searchText,
    taxonomyHub: taxonomy.topHubSlug,
  };
}
