/**
 * Resolve GST % from Admin Catalogue category + vendor role (GST Configuration).
 * Used for service checkout — not service_catalog.tax_category_id / hsn_code_id.
 * Missing category+role config must not silently default to 18%.
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
  const role = params.vendorRoleId || '(unknown role)';
  return new GstConfigurationError(
    `Missing GST configuration for catalogue category ${category} and vendor role ${role}. Configure Admin Finance → GST Configuration → Tax Categories (catalogue category + applicable role).`,
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
    return emptyResolution(
      cat,
      role,
      scope,
      'Admin tax category exists for this catalogue category but not for the vendor role',
    );
  }

  candidates.sort((a, b) => b.score - a.score);
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
