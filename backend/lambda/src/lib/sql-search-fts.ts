import { query } from '../database/rds-connection';

export type SearchEntityIds = {
  vendorIds: string[];
  serviceIds: string[];
  productIds: string[];
};

const EMPTY: SearchEntityIds = { vendorIds: [], serviceIds: [], productIds: [] };

/**
 * Resolve vendor/service/product IDs from search_index full-text search.
 * Uses a single joined query string (same tokens as ILIKE path).
 */
export async function resolveSearchEntityIds(tokens: string[]): Promise<SearchEntityIds> {
  const searchText = tokens.map((t) => t.trim()).filter(Boolean).join(' ').trim();
  if (!searchText) return { ...EMPTY };

  try {
    const { rows } = await query(
      `SELECT entity_type, entity_id
       FROM search_index
       WHERE search_vector @@ plainto_tsquery('english', $1)
         AND entity_type IN ('vendor', 'service', 'product')
       LIMIT 200`,
      [searchText]
    );

    const vendorIds: string[] = [];
    const serviceIds: string[] = [];
    const productIds: string[] = [];

    for (const row of rows as Array<{ entity_type: string; entity_id: string }>) {
      const id = String(row.entity_id ?? '').trim();
      if (!id) continue;
      switch (row.entity_type) {
        case 'vendor':
          vendorIds.push(id);
          break;
        case 'service':
          serviceIds.push(id);
          break;
        case 'product':
          productIds.push(id);
          break;
      }
    }

    return { vendorIds, serviceIds, productIds };
  } catch (err) {
    console.warn('resolveSearchEntityIds failed, falling back to ILIKE:', err);
    return { ...EMPTY };
  }
}

export function hasFtsEntityIds(ids: SearchEntityIds): boolean {
  return ids.vendorIds.length > 0 || ids.serviceIds.length > 0 || ids.productIds.length > 0;
}
