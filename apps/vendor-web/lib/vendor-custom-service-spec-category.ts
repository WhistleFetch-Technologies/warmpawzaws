export type CatalogCategoryRow = {
  id?: string;
  name?: string;
  category_id?: string;
};

/**
 * Resolve catalogue key for GET /vendor/specializations/by-category.
 * Prefers platform UUID, then category_id slug, then normalized display name.
 */
export function resolveVendorCustomServiceSpecCategoryId(input: {
  platformCategoryId?: string | null;
  categoryName?: string | null;
  catalogCategories?: CatalogCategoryRow[];
}): string | null {
  const platformId = String(input.platformCategoryId ?? '').trim();
  if (platformId) return platformId;

  const categoryName = String(input.categoryName ?? '').trim();
  if (!categoryName || categoryName === 'other') return null;

  const selNorm = categoryName.toLowerCase();
  const selKey = selNorm.replace(/\s+/g, '_').replace(/-/g, '_');

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(categoryName)) {
    return categoryName;
  }

  const catalogCategories = input.catalogCategories ?? [];
  const row = catalogCategories.find((c) => {
    const name = String(c.name || '').toLowerCase();
    const slug = String(c.category_id || '')
      .toLowerCase()
      .replace(/-/g, '_');
    const idKey = String(c.id || '')
      .toLowerCase()
      .replace(/-/g, '_');
    return (
      idKey === selKey ||
      name === selNorm ||
      slug === selKey ||
      name.replace(/\s+/g, '_').replace(/-/g, '_') === selKey
    );
  });

  const categorySlug = row?.category_id != null ? String(row.category_id).trim() : '';
  if (categorySlug) return categorySlug;

  const idStr = row?.id != null ? String(row.id).trim() : '';
  if (idStr) return idStr;

  return selKey || null;
}
