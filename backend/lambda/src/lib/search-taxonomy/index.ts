export type {
  SearchCategoryMatch,
  SearchTaxonomyKeywordRow,
  SearchTaxonomyResolveResult,
  CategorySource,
} from './types';
export { normalizeSearchPhrase, slugifyCategoryLabel } from './normalize';
export { resolveHubSlugForCategory, isValidHubSlug } from './hub-map';
export { resolveSearchCategories, loadSearchTaxonomyRows, invalidateSearchTaxonomyCache } from './cache';
export { resolveSearchCategoriesFromRows, buildPhraseIndex } from './resolver';
export { resolveSearchTaxonomy, logSearchTaxonomyDebug } from './resolve-taxonomy';
export type { SearchTaxonomyFullResult } from './resolve-taxonomy';
export { buildResidualSearchText, SEARCH_INTENT_PHRASES, SEARCH_INTENT_TOKENS } from './search-retrieval-text';
export type { ResidualSearchText } from './search-retrieval-text';
export { findTopHubMatchedPhrase } from './resolver';