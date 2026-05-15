/**
 * Resolve GST % from Admin Catalogue category + vendor role (GST Configuration).
 * Used for service checkout — not service_catalog.tax_category_id / hsn_code_id.
 */

import { query } from '../../database/rds-connection';

function taxCategoryRowRate(row: Record<string, unknown>): number {
  const rawTax = row.tax_rate;
  if (rawTax != null && rawTax !== '') {
    const t = Number(rawTax);
    if (Number.isFinite(t)) return Math.min(100, Math.max(0, t));
  }
  const rawDefault = row.default_gst_rate;
  if (rawDefault != null && rawDefault !== '') {
    const d = Number(rawDefault);
    if (Number.isFinite(d)) return Math.min(100, Math.max(0, d));
  }
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

/** Service checkout vs meal plan food — same catalogue category, different tax_categories rows. */
export type GstApplicationScope = 'service_booking' | 'meal_plan_food' | 'meal_plan_delivery';

/**
 * Prefer tax row where junction includes vendor role; else row with no junction rows (wildcard).
 * @param applicationScope service_booking (default) = existing GST rows; meal_plan_food = meal-only rows.
 */
export async function resolveGstRateForCatalogAndRole(
  catalogCategoryUuid: string,
  vendorRoleUuid: string | null | undefined,
  applicationScope: GstApplicationScope = 'service_booking',
): Promise<CatalogRoleGstResolution> {
  const cat = String(catalogCategoryUuid).trim();
  const role =
    vendorRoleUuid && String(vendorRoleUuid).trim() !== '' ? String(vendorRoleUuid).trim() : null;
  const scope: GstApplicationScope =
    applicationScope === 'meal_plan_food'
      ? 'meal_plan_food'
      : applicationScope === 'meal_plan_delivery'
        ? 'meal_plan_delivery'
        : 'service_booking';

  const result = await query(
    `SELECT tc.*,
            (SELECT COUNT(*)::int FROM tax_category_roles tcr WHERE tcr.tax_category_id = tc.id) AS jcnt
     FROM tax_categories tc
     WHERE tc.is_active = true
       AND tc.catalog_category_id IS NOT NULL
       AND tc.catalog_category_id::text = $1
       AND (
         ($2::text = 'meal_plan_food' AND tc.gst_application_scope = 'meal_plan_food')
         OR ($2::text = 'meal_plan_delivery' AND tc.gst_application_scope = 'meal_plan_delivery')
         OR (
           $2::text = 'service_booking'
           AND COALESCE(tc.gst_application_scope, 'service_booking') = 'service_booking'
         )
       )`,
    [cat, scope],
  );
  const list = (result as { rows?: Record<string, unknown>[] })?.rows ?? [];
  if (list.length === 0) {
    return scope === 'service_booking'
      ? { rate: 18, taxCategoryId: null }
      : { rate: 0, taxCategoryId: null };
  }

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

  if (candidates.length === 0) {
    return scope === 'service_booking'
      ? { rate: 18, taxCategoryId: null }
      : { rate: 0, taxCategoryId: null };
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0].row;
  const rate = taxCategoryRowRate(best);
  return { rate, taxCategoryId: best.id != null ? String(best.id) : null };
}
