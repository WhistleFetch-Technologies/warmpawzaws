import type { SearchTaxonomyKeywordRow } from './types';
import { normalizeSearchPhrase, slugifyCategoryLabel } from './normalize';

/** Hub → display label for categories[] when using built-in fallback (DB empty). */
const HUB_DISPLAY: Record<string, string> = {
  vet: 'Veterinary & Healthcare',
  grooming: 'Grooming',
  walker: 'Walking & Sitting',
  boarding: 'Boarding & Daycare',
  training: 'Training & Behaviour',
  nutritionist: 'Nutrition & Wellness',
  shop: 'Ecommerce – Food',
  pharmacy: 'Ecommerce – Health Products',
  insurance: 'Insurance',
  adoption: 'Adoption',
  photography: 'Lifestyle & Discovery',
  resort: 'Lifestyle & Discovery',
  cafes: 'Lifestyle & Discovery',
  breeder: 'Lifestyle & Discovery',
  relocation: 'Lifestyle & Discovery',
  holiday: 'Lifestyle & Discovery',
  ambulance: 'Location & Convenience',
  'pet-sitter': 'Walking & Sitting',
};

/**
 * Approved keyword → hub phrases (mirrors scripts/lib/search-taxonomy-import-rules.js).
 * Used when search_taxonomy_keywords table is empty or unavailable.
 */
const BUILTIN_KEYWORD_HUB: Record<string, string> = {
  'dog doctor': 'vet',
  'cat doctor': 'vet',
  'pet surgery': 'vet',
  'pet clinic': 'vet',
  'animal hospital': 'vet',
  'vet near me': 'vet',
  'dog grooming': 'grooming',
  'pet nutritionist': 'nutritionist',
  'pet photography': 'photography',
  'pet resort': 'resort',
  'pet adoption': 'adoption',
  'pet friendly cafe': 'cafes',
  'pet breeder': 'breeder',
  'pet relocation': 'relocation',
  'pet travel': 'relocation',
  'pet holiday': 'holiday',
  'dog walker': 'walker',
  'daily dog walk': 'walker',
  'puppy walk': 'walker',
  'pet sitter': 'pet-sitter',
  'cat sitter': 'pet-sitter',
  'pet nanny': 'pet-sitter',
  '24 hour vet': 'vet',
  'emergency vet': 'vet',
  'same day grooming': 'grooming',
  'pet ambulance': 'ambulance',
  'animal ambulance': 'ambulance',
  'at home vet': 'vet',
  'at home grooming': 'grooming',
  'at home training': 'training',
  'at home nutrition': 'nutritionist',
};

let cachedBuiltinRows: SearchTaxonomyKeywordRow[] | null = null;

export function getBuiltinTaxonomyRows(): SearchTaxonomyKeywordRow[] {
  if (cachedBuiltinRows) return cachedBuiltinRows;
  const rows: SearchTaxonomyKeywordRow[] = [];
  let i = 0;
  for (const [phrase, hub] of Object.entries(BUILTIN_KEYWORD_HUB)) {
    const display = HUB_DISPLAY[hub] || hub;
    const categorySlug = slugifyCategoryLabel(display);
    rows.push({
      id: `builtin-${++i}`,
      category_slug: categorySlug,
      category_display_name: display,
      subcategory: null,
      keyword: phrase,
      keyword_normalized: normalizeSearchPhrase(phrase),
      hub_slug: hub,
      weight: 100,
      is_active: true,
    });
  }
  cachedBuiltinRows = rows;
  return rows;
}
