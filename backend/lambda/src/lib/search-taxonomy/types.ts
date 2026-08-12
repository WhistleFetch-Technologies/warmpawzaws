export type SearchTaxonomyKeywordRow = {
  id: string;
  category_slug: string;
  category_display_name: string;
  subcategory: string | null;
  keyword: string;
  keyword_normalized: string;
  hub_slug: string;
  weight: number;
  is_active: boolean;
};

export type SearchIntentModifiers = {
  nearMe?: boolean;
  atHome?: boolean;
  sameDay?: boolean;
  openNow?: boolean;
};

export type SearchCategoryMatch = {
  categorySlug: string;
  displayName: string;
  subcategory: string | null;
  hubSlug: string;
  score: number;
  intentCode?: string;
  matchedSignals?: string[];
  matchKind?: 'phrase' | 'token_set' | 'intent_rule';
};

export type SearchTaxonomyResolveResult = {
  categories: SearchCategoryMatch[];
  intentCode?: string | null;
  modifiers?: SearchIntentModifiers;
  confidence?: number;
  blockedEcommerce?: boolean;
};

export type CategorySource = 'explicit' | 'taxonomy' | 'none';
