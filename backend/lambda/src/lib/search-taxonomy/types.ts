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

export type SearchCategoryMatch = {
  categorySlug: string;
  displayName: string;
  subcategory: string | null;
  hubSlug: string;
  score: number;
};

export type SearchTaxonomyResolveResult = {
  categories: SearchCategoryMatch[];
};

export type CategorySource = 'explicit' | 'taxonomy' | 'none';
