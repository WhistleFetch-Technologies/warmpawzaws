/**
 * Resolve GST % from Admin Catalogue category + vendor role (GST Configuration).
 * Used for service checkout — not service_catalog.tax_category_id / hsn_code_id.
 */

import { query } from '../../database/rds-connection';

function coerceRate(value: unknown, fallback: number): number {
  if (value == null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function taxCategoryRowRate(row: Record<string, unknown>): number {
  const t = coerceRate(row.tax_rate, NaN);
  if (Number.isFinite(t) && t !== 0) return t;
  const d = coerceRate(row.default_gst_rate, NaN);
  if (Number.isFinite(d)) return d;
  if (Number.isFinite(t)) return t;
  return 18;
}

/** Resolve service_categories.id from slug, uuid string, or name. */
export async function resolveCatalogCategoryUuidFromRef(
  ref: string | null | undefined
): Promise<string | null> {
  if (ref == null || String(ref).trim() === '') return null;
  const s = String(ref).trim();
  try {
    const result = await query(
      `SELECT id::text AS id FROM service_categories
       WHERE id::text = $1 OR LOWER(TRIM(category_id)) = LOWER(TRIM($1)) OR LOWER(TRIM(name)) = LOWER(TRIM($1))
       LIMIT 1`,
      [s]
    );
    const rows = (result as { rows?: { id?: string }[] })?.rows ?? [];
    return rows[0]?.id ? String(rows[0].id) : null;
  } catch {
    return null;
  }
}

export type CatalogRoleGstResolution = { rate: number; taxCategoryId: string | null };

/**
 * Prefer tax row where junction includes vendor role; else row with no junction rows (wildcard).
 */
export async function resolveGstRateForCatalogAndRole(
  catalogCategoryUuid: string,
  vendorRoleUuid: string | null | undefined
): Promise<CatalogRoleGstResolution> {
  const cat = String(catalogCategoryUuid).trim();
  const role =
    vendorRoleUuid && String(vendorRoleUuid).trim() !== '' ? String(vendorRoleUuid).trim() : null;

  const result = await query(
    `SELECT tc.*,
            (SELECT COUNT(*)::int FROM tax_category_roles tcr WHERE tcr.tax_category_id = tc.id) AS jcnt
     FROM tax_categories tc
     WHERE tc.is_active = true AND tc.catalog_category_id IS NOT NULL AND tc.catalog_category_id::text = $1`,
    [cat]
  );
  const list = (result as { rows?: Record<string, unknown>[] })?.rows ?? [];
  if (list.length === 0) return { rate: 18, taxCategoryId: null };

  const candidates: { row: Record<string, unknown>; score: number }[] = [];

  for (const raw of list) {
    const jcnt = Number(raw.jcnt) || 0;
    if (jcnt === 0) {
      candidates.push({ row: raw, score: 1 });
      continue;
    }
    if (role) {
      const hit = await query(
        `SELECT 1 FROM tax_category_roles WHERE tax_category_id = $1::uuid AND role_id::text = $2 LIMIT 1`,
        [String(raw.id), role]
      );
      const rows = (hit as { rows?: unknown[] })?.rows ?? [];
      if (rows.length > 0) candidates.push({ row: raw, score: 2 });
    }
  }

  if (candidates.length === 0) return { rate: 18, taxCategoryId: null };

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0].row;
  const rate = taxCategoryRowRate(best);
  return { rate, taxCategoryId: best.id != null ? String(best.id) : null };
}
