/**
 * Resolve GST % from Admin Catalogue category → Tax Category (GST Configuration).
 * Used for service/package checkout — not service_catalog.tax_category_id / hsn_code_id.
 * Vendor role is optional preference when multiple cards exist; it must not block a
 * valid category-level card. Missing category or missing tax card must not silent-18%.
 */

import { query } from '../../database/rds-connection';
import { pickTaxCategoryConfiguredRate } from '../../utils/tax-category-display-rate';

export class GstConfigurationError extends Error {
  readonly code = 'GST_CONFIGURATION_MISSING';
  readonly catalogCategoryId: string | null;
  readonly vendorRoleId: string | null;

  constructor(
    message: string,
    details?: { catalogCategoryId?: string | null; vendorRoleId?: string | null },
  ) {
    super(message);
    this.name = 'GstConfigurationError';
    this.catalogCategoryId = details?.catalogCategoryId ?? null;
    this.vendorRoleId = details?.vendorRoleId ?? null;
  }
}

export function isGstConfigurationError(err: unknown): err is GstConfigurationError {
  return (
    err instanceof GstConfigurationError ||
    (typeof err === 'object' &&
      err != null &&
      (err as { code?: string }).code === 'GST_CONFIGURATION_MISSING')
  );
}

export function missingServiceGstConfigError(params: {
  catalogCategoryId?: string | null;
  vendorRoleId?: string | null;
}): GstConfigurationError {
  const category = params.catalogCategoryId || '(unknown category)';
  return new GstConfigurationError(
    `Missing GST configuration for catalogue category ${category}. Configure Admin Finance → GST Configuration → Tax Categories (catalogue category + GST rate).`,
    params,
  );
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

export type CatalogRoleGstResolution = {
  found: boolean;
  rate: number;
  taxCategoryId: string | null;
  catalogCategoryId: string;
  vendorRoleId: string | null;
  applicationScope: GstApplicationScope;
  reason?: string;
};

/** Service checkout vs meal plan food — same catalogue category, different tax_categories rows. */
export type GstApplicationScope = 'service_booking' | 'meal_plan_food' | 'meal_plan_delivery';

function emptyResolution(
  catalogCategoryId: string,
  vendorRoleId: string | null,
  applicationScope: GstApplicationScope,
  reason: string,
): CatalogRoleGstResolution {
  return {
    found: false,
    rate: 0,
    taxCategoryId: null,
    catalogCategoryId,
    vendorRoleId,
    applicationScope,
    reason,
  };
}

/**
 * Category-authoritative GST: any active Admin tax card for the catalogue + scope is enough.
 * Vendor role is a preference when several cards exist; a missing role mapping does not fail.
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
    return emptyResolution(
      cat,
      role,
      scope,
      'No active Admin tax category for this catalogue category and GST scope',
    );
  }

  const candidates: { row: Record<string, unknown>; score: number }[] = [];

  for (const raw of list) {
    const jcnt = Number(raw.jcnt) || 0;
    let score = 0;
    if (jcnt === 0) {
      score = 1;
    } else if (role) {
      const hit = await query(
        `SELECT 1 FROM tax_category_roles WHERE tax_category_id = $1::uuid AND role_id::text = $2 LIMIT 1`,
        [String(raw.id), role]
      );
      const rows = (hit as { rows?: unknown[] })?.rows ?? [];
      if (rows.length > 0) score = 2;
    }
    candidates.push({ row: raw, score });
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.row.id ?? '').localeCompare(String(b.row.id ?? ''));
  });
  const best = candidates[0].row;
  const rate = pickTaxCategoryConfiguredRate(best);
  if (rate == null) {
    return emptyResolution(
      cat,
      role,
      scope,
      'Matched Admin tax category has no configured GST rate',
    );
  }
  return {
    found: true,
    rate,
    taxCategoryId: best.id != null ? String(best.id) : null,
    catalogCategoryId: cat,
    vendorRoleId: role,
    applicationScope: scope,
  };
}
