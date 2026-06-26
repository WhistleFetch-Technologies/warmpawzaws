/**
 * Category-aware variant preset suggestions for vendor single/bulk upload.
 * Suggestions are hints only — vendors may use any attribute names within MAX_VARIANT_ATTRIBUTES.
 */

import { MAX_VARIANT_ATTRIBUTES } from './product-variant-limits';

export type VariantAxisPresetKind = 'size' | 'color' | 'weight' | 'pack' | 'custom';

export type VariantPresetAxis = {
  key: string;
  label: string;
  preset?: VariantAxisPresetKind;
};

export type VariantPresetSuggestion = {
  id: string;
  label: string;
  description?: string;
  axes: VariantPresetAxis[];
};

export type BulkVariantHints = {
  attr1Examples: string[];
  attr2Examples: string[];
  attr3Examples: string[];
  sampleCombos: string[];
};

export type CategoryVariantGuide = {
  categoryNames: string[];
  suggestions: VariantPresetSuggestion[];
  bulkHints: BulkVariantHints;
};

function axis(
  key: string,
  label: string,
  preset?: VariantAxisPresetKind,
): VariantPresetAxis {
  return { key, label, preset: preset ?? 'custom' };
}

function suggestion(
  id: string,
  label: string,
  axes: VariantPresetAxis[],
  description?: string,
): VariantPresetSuggestion {
  return { id, label, axes: axes.slice(0, MAX_VARIANT_ATTRIBUTES), description };
}

export const DEFAULT_VARIANT_SUGGESTIONS: VariantPresetSuggestion[] = [
  suggestion('pack', 'Pack', [axis('pack', 'Pack', 'pack')]),
  suggestion('weight', 'Weight', [axis('weight', 'Weight', 'weight')]),
  suggestion('size', 'Size only', [axis('size', 'Size', 'size')]),
  suggestion('color', 'Color only', [axis('color', 'Color', 'color')]),
  suggestion('size_color', 'Size + Color', [
    axis('size', 'Size', 'size'),
    axis('color', 'Color', 'color'),
  ]),
];

function bulkHints(
  attr1: string[],
  attr2: string[],
  attr3: string[],
  combos: string[],
): BulkVariantHints {
  return {
    attr1Examples: attr1,
    attr2Examples: attr2,
    attr3Examples: attr3,
    sampleCombos: combos,
  };
}

export const CATEGORY_VARIANT_GUIDES: CategoryVariantGuide[] = [
  {
    categoryNames: ['Pet Food'],
    suggestions: [
      suggestion('pack', 'Pack', [axis('pack', 'Pack', 'pack')]),
      suggestion('weight', 'Weight', [axis('weight', 'Weight', 'weight')]),
      suggestion('flavour', 'Flavour', [axis('flavour', 'Flavour', 'custom')]),
      suggestion('flavour_pack', 'Flavour + Pack', [
        axis('flavour', 'Flavour', 'custom'),
        axis('pack', 'Pack', 'pack'),
      ]),
      suggestion('flavour_pack_size', 'Flavour + Pack + Size', [
        axis('flavour', 'Flavour', 'custom'),
        axis('pack', 'Pack', 'pack'),
        axis('size', 'Size', 'size'),
      ]),
    ],
    bulkHints: bulkHints(
      ['Flavour', 'Pack', 'Weight'],
      ['Pack', 'Size'],
      ['Size'],
      ['Flavour=Chicken, Pack=500g', 'Flavour=Fish, Pack=1kg, Size=Adult'],
    ),
  },
  {
    categoryNames: ['Pet Clothing'],
    suggestions: [
      suggestion('size', 'Size only', [axis('size', 'Size', 'size')]),
      suggestion('color', 'Color only', [axis('color', 'Color', 'color')]),
      suggestion('size_color', 'Size + Color', [
        axis('size', 'Size', 'size'),
        axis('color', 'Color', 'color'),
      ]),
      suggestion('size_color_material', 'Size + Color + Material', [
        axis('size', 'Size', 'size'),
        axis('color', 'Color', 'color'),
        axis('material', 'Material', 'custom'),
      ]),
    ],
    bulkHints: bulkHints(
      ['Size', 'Color'],
      ['Color', 'Material'],
      ['Material'],
      ['Size=Small, Color=Red', 'Size=Medium, Color=Blue, Material=Cotton'],
    ),
  },
  {
    categoryNames: ['Pet Accessories'],
    suggestions: [
      suggestion('size', 'Size only', [axis('size', 'Size', 'size')]),
      suggestion('color', 'Color only', [axis('color', 'Color', 'color')]),
      suggestion('size_color', 'Size + Color', [
        axis('size', 'Size', 'size'),
        axis('color', 'Color', 'color'),
      ]),
      suggestion('material', 'Material', [axis('material', 'Material', 'custom')]),
    ],
    bulkHints: bulkHints(
      ['Size', 'Color', 'Material'],
      ['Color'],
      [],
      ['Size=Medium, Color=Blue', 'Color=Red, Material=Leather'],
    ),
  },
  {
    categoryNames: ['Pet Grooming'],
    suggestions: [
      suggestion('size', 'Size only', [axis('size', 'Size', 'size')]),
      suggestion('pack', 'Pack', [axis('pack', 'Pack', 'pack')]),
      suggestion('weight', 'Weight', [axis('weight', 'Weight', 'weight')]),
    ],
    bulkHints: bulkHints(
      ['Size', 'Pack', 'Weight'],
      ['Pack'],
      [],
      ['Size=250ml', 'Pack=2X100'],
    ),
  },
  {
    categoryNames: ['Pet Beds & Furniture'],
    suggestions: [
      suggestion('size', 'Size only', [axis('size', 'Size', 'size')]),
      suggestion('color', 'Color only', [axis('color', 'Color', 'color')]),
      suggestion('size_color', 'Size + Color', [
        axis('size', 'Size', 'size'),
        axis('color', 'Color', 'color'),
      ]),
    ],
    bulkHints: bulkHints(
      ['Size', 'Color'],
      ['Color'],
      [],
      ['Size=Large, Color=Grey', 'Size=Medium, Color=Beige'],
    ),
  },
  {
    categoryNames: ['Pet Toys'],
    suggestions: [
      suggestion('size', 'Size only', [axis('size', 'Size', 'size')]),
      suggestion('color', 'Color only', [axis('color', 'Color', 'color')]),
      suggestion('size_color', 'Size + Color', [
        axis('size', 'Size', 'size'),
        axis('color', 'Color', 'color'),
      ]),
    ],
    bulkHints: bulkHints(
      ['Size', 'Color'],
      ['Color'],
      [],
      ['Size=Small, Color=Yellow', 'Size=Large, Color=Blue'],
    ),
  },
  {
    categoryNames: ['Pet Health', 'Pet Pharmacy'],
    suggestions: [
      suggestion('pack', 'Pack', [axis('pack', 'Pack', 'pack')]),
      suggestion('weight', 'Weight', [axis('weight', 'Weight', 'weight')]),
      suggestion('size', 'Size only', [axis('size', 'Size', 'size')]),
    ],
    bulkHints: bulkHints(
      ['Pack', 'Weight', 'Size'],
      ['Pack'],
      [],
      ['Pack=30 tablets', 'Weight=100g'],
    ),
  },
  {
    categoryNames: ['Pet Training'],
    suggestions: [
      suggestion('size', 'Size only', [axis('size', 'Size', 'size')]),
      suggestion('color', 'Color only', [axis('color', 'Color', 'color')]),
      suggestion('pack', 'Pack', [axis('pack', 'Pack', 'pack')]),
    ],
    bulkHints: bulkHints(
      ['Size', 'Color', 'Pack'],
      ['Color'],
      [],
      ['Size=Medium', 'Pack=5 sessions'],
    ),
  },
  {
    categoryNames: ['Pet Travel'],
    suggestions: [
      suggestion('size', 'Size only', [axis('size', 'Size', 'size')]),
      suggestion('color', 'Color only', [axis('color', 'Color', 'color')]),
      suggestion('size_color', 'Size + Color', [
        axis('size', 'Size', 'size'),
        axis('color', 'Color', 'color'),
      ]),
    ],
    bulkHints: bulkHints(
      ['Size', 'Color'],
      ['Color'],
      [],
      ['Size=Medium, Color=Black', 'Size=Large, Color=Grey'],
    ),
  },
];

function normalizeCategoryName(name: string): string {
  return String(name ?? '')
    .trim()
    .toLowerCase();
}

export function findCategoryVariantGuide(
  categoryName: string,
): CategoryVariantGuide | null {
  const norm = normalizeCategoryName(categoryName);
  if (!norm) return null;
  return (
    CATEGORY_VARIANT_GUIDES.find((g) =>
      g.categoryNames.some((n) => normalizeCategoryName(n) === norm),
    ) ?? null
  );
}

export function getVariantSuggestionsForCategory(
  _categoryId: string,
  categoryName: string,
): VariantPresetSuggestion[] {
  const guide = findCategoryVariantGuide(categoryName);
  return guide?.suggestions ?? DEFAULT_VARIANT_SUGGESTIONS;
}

export function getBulkVariantHintsForCategory(
  _categoryId: string,
  categoryName: string,
): BulkVariantHints {
  const guide = findCategoryVariantGuide(categoryName);
  if (guide) return guide.bulkHints;
  return bulkHints(
    ['Size', 'Color', 'Pack', 'Weight', 'Flavour'],
    ['Color', 'Pack', 'Size'],
    ['Size'],
    ['Size=Medium, Color=Red', 'Pack=500g, Flavour=Chicken'],
  );
}

/** Rows for bulk template "Variant Guide" worksheet. */
export function getVariantGuideSheetRows(): Array<{
  category: string;
  attr1: string;
  attr2: string;
  attr3: string;
  example1: string;
  example2: string;
}> {
  return CATEGORY_VARIANT_GUIDES.map((g) => {
    const hints = g.bulkHints;
    return {
      category: g.categoryNames[0] ?? '',
      attr1: hints.attr1Examples.join(', '),
      attr2: hints.attr2Examples.join(', '),
      attr3: hints.attr3Examples.join(', '),
      example1: hints.sampleCombos[0] ?? '',
      example2: hints.sampleCombos[1] ?? '',
    };
  });
}
