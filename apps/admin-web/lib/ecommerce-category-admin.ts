/**
 * Map ecommerce category rows between admin UI and API payloads.
 */

export interface EcommerceCategoryForm {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  order: number;
  enabled: boolean;
  parentId?: string | null;
}

export function mapApiCategoryToForm(row: Record<string, unknown>): EcommerceCategoryForm {
  const enabled =
    row.is_active !== undefined
      ? row.is_active !== false && row.is_active !== 'false'
      : row.enabled !== false && row.enabled !== 'false';

  const name = String(row.name ?? '').trim();
  const imageUrl = String(row.image_url ?? row.imageUrl ?? '').trim() || undefined;

  return {
    id: String(row.id ?? ''),
    name,
    slug:
      String(row.slug ?? '').trim() ||
      name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    description: row.description != null ? String(row.description) : undefined,
    imageUrl,
    order:
      parseInt(String(row.display_order ?? row.order ?? 0), 10) ||
      0,
    enabled,
    parentId: (row.parent_category_id ?? row.parentId ?? null) as string | null,
  };
}

export function mapFormCategoryToApiPayload(cat: EcommerceCategoryForm): Record<string, unknown> {
  return {
    id: cat.id,
    name: cat.name.trim(),
    description: cat.description ?? '',
    slug: cat.slug,
    display_order: cat.order,
    order: cat.order,
    is_active: cat.enabled,
    enabled: cat.enabled,
    image_url: cat.imageUrl?.trim() || null,
    imageUrl: cat.imageUrl?.trim() || null,
    parent_category_id: cat.parentId ?? null,
  };
}

export function mapFormCategoriesToPutBody(
  categories: EcommerceCategoryForm[]
): { categories: Record<string, unknown>[] } {
  return {
    categories: categories.map(mapFormCategoryToApiPayload),
  };
}
