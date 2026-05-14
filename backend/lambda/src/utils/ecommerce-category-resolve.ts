/**
 * Resolve bulk-upload / free-text category names to ecommerce_categories rows.
 * Matches vendor create flow: category_id is canonical; `category` stores display name.
 */

import { query } from '../database/rds-connection';

export type EcommerceCategoryRow = { id: string; name: string };

/**
 * Active catalog categories keyed by lowercase trimmed display name (first row wins if duplicates).
 */
export async function loadActiveEcommerceCategoryMap(): Promise<Map<string, EcommerceCategoryRow>> {
  const result = await query(
    `SELECT id, name FROM ecommerce_categories
     WHERE is_active = true AND TRIM(COALESCE(name, '')) <> ''
     ORDER BY display_order NULLS LAST, name ASC`
  );
  const map = new Map<string, EcommerceCategoryRow>();
  for (const row of result.rows as { id: string; name: string }[]) {
    const name = String(row.name ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { id: String(row.id), name });
    }
  }
  return map;
}

export function resolveEcommerceCategoryByName(
  map: Map<string, EcommerceCategoryRow>,
  raw: string | null | undefined
): EcommerceCategoryRow | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  return map.get(s.toLowerCase()) ?? null;
}
