/**
 * Resolve a vendor_services row that is actually diagnostic/lab — never the
 * vendor's first service of any category (that incorrectly pulled vet 0% GST).
 */

import { query } from '../database/rds-connection';

const DIAGNOSTIC_SLUGS = ['diagnostic', 'lab-diagnostics', 'diagnostics'] as const;

/** Hardcoded sentinel used when a lab has diagnostic_tests but no vendor_services row. */
export const DIAGNOSTIC_LAB_SERVICE_SENTINEL_ID = 'a1b2c3d4-e5f6-4789-a012-345678901234';

function isDiagnosticCategoryText(raw: string | null | undefined): boolean {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (!s) return false;
  if ((DIAGNOSTIC_SLUGS as readonly string[]).includes(s)) return true;
  if (s === 'diagnostics & lab' || s === 'lab tests' || s === 'lab test') return true;
  return /\bdiagnos|\blab\b/.test(s);
}

/**
 * Find an existing diagnostic vendor_services.id for this vendor.
 * Returns vendor_services.id (not catalog service_id) for booking/GST.
 */
export async function findDiagnosticVendorServiceId(
  vendorId: string,
): Promise<{ vendorServiceId: string; catalogServiceId: string | null } | null> {
  const vid = String(vendorId || '').trim();
  if (!vid) return null;

  const result = await query(
    `SELECT vs.id::text AS vs_id,
            vs.service_id::text AS catalog_service_id,
            vs.category AS vs_category,
            vs.category_id::text AS vs_category_id,
            sc.category_id AS sc_category_id,
            sc.category_name AS sc_category_name,
            vs.service_name
     FROM vendor_services vs
     LEFT JOIN service_catalog sc ON sc.id = vs.service_id
     LEFT JOIN service_categories cat ON cat.id = vs.category_id
     WHERE vs.vendor_id = $1::uuid
       AND COALESCE(vs.is_enabled, true) = true
       AND (
         LOWER(TRIM(COALESCE(sc.category_id, ''))) = ANY($2::text[])
         OR LOWER(TRIM(COALESCE(cat.category_id, ''))) = ANY($2::text[])
         OR LOWER(TRIM(COALESCE(vs.category, ''))) = ANY($2::text[])
         OR LOWER(TRIM(COALESCE(vs.category, ''))) IN ('diagnostics & lab', 'lab tests', 'lab test')
         OR LOWER(TRIM(COALESCE(sc.category_name, ''))) ILIKE '%diagnostic%'
         OR LOWER(TRIM(COALESCE(vs.service_name, ''))) ILIKE '%lab test%'
         OR LOWER(TRIM(COALESCE(vs.service_name, ''))) ILIKE '%diagnostic%'
       )
     ORDER BY
       CASE
         WHEN LOWER(TRIM(COALESCE(sc.category_id, ''))) IN ('diagnostic', 'lab-diagnostics') THEN 0
         WHEN LOWER(TRIM(COALESCE(cat.category_id, ''))) IN ('diagnostic', 'lab-diagnostics') THEN 1
         ELSE 2
       END,
       vs.updated_at DESC NULLS LAST,
       vs.created_at DESC NULLS LAST
     LIMIT 1`,
    [vid, [...DIAGNOSTIC_SLUGS]],
  ).catch(() => ({ rows: [] }));

  const row = (result as { rows?: Record<string, unknown>[] })?.rows?.[0];
  if (!row?.vs_id) return null;
  return {
    vendorServiceId: String(row.vs_id),
    catalogServiceId: row.catalog_service_id != null ? String(row.catalog_service_id) : null,
  };
}

async function lookupDiagnosticCatalogCategoryId(): Promise<string | null> {
  const result = await query(
    `SELECT id::text AS id, category_id
     FROM service_categories
     WHERE LOWER(TRIM(category_id)) IN ('diagnostic', 'lab-diagnostics')
     ORDER BY CASE LOWER(TRIM(category_id))
       WHEN 'diagnostic' THEN 0
       WHEN 'lab-diagnostics' THEN 1
       ELSE 2
     END
     LIMIT 1`,
  ).catch(() => ({ rows: [] }));
  const row = (result as { rows?: { id?: string }[] })?.rows?.[0];
  return row?.id ? String(row.id) : null;
}

/**
 * Resolve diagnostic vendor_services for booking/GST.
 * Never falls back to ORDER BY created_at on all vendor services.
 * If the vendor has diagnostic_tests but no diagnostic VS row, creates a Lab Tests
 * row linked to the diagnostic catalogue category (Admin GST card).
 */
export async function resolveOrEnsureDiagnosticVendorService(
  vendorId: string,
): Promise<{ vendorServiceId: string; catalogServiceId: string | null } | null> {
  const existing = await findDiagnosticVendorServiceId(vendorId);
  if (existing) return existing;

  const vid = String(vendorId || '').trim();
  if (!vid) return null;

  const diagTests = await query(
    `SELECT id, price FROM diagnostic_tests WHERE vendor_id = $1::uuid LIMIT 1`,
    [vid],
  ).catch(() => ({ rows: [] }));
  if (!(diagTests as { rows?: unknown[] })?.rows?.length) return null;

  const test = (diagTests as { rows: { id?: string; price?: unknown }[] }).rows[0];
  const catalogCategoryId = await lookupDiagnosticCatalogCategoryId();
  const labServiceId = DIAGNOSTIC_LAB_SERVICE_SENTINEL_ID;

  await query(
    `INSERT INTO services (id, name, description, category, price, duration_minutes, is_active, created_at, updated_at)
     VALUES ($1, 'Lab Tests', 'Diagnostic lab tests', 'diagnostic', $2, 30, true, NOW(), NOW())
     ON CONFLICT (id) DO UPDATE SET
       category = EXCLUDED.category,
       updated_at = NOW()`,
    [labServiceId, test.price || 0],
  ).catch(() => undefined);

  try {
    if (catalogCategoryId) {
      await query(
        `INSERT INTO vendor_services (
           vendor_id, service_id, service_name, service_style, category, category_id,
           publish_status, is_enabled, created_at, updated_at
         ) VALUES (
           $1::uuid, $2::uuid, 'Lab Tests', 'at_center', 'diagnostic', $3::uuid,
           'published', true, NOW(), NOW()
         )`,
        [vid, labServiceId, catalogCategoryId],
      );
    } else {
      await query(
        `INSERT INTO vendor_services (
           vendor_id, service_id, service_name, service_style, category,
           publish_status, is_enabled, created_at, updated_at
         ) VALUES (
           $1::uuid, $2::uuid, 'Lab Tests', 'at_center', 'diagnostic',
           'published', true, NOW(), NOW()
         )`,
        [vid, labServiceId],
      );
    }
  } catch (insErr: unknown) {
    const msg = String((insErr as { message?: string })?.message || '');
    const code = (insErr as { code?: string })?.code;
    if (!msg.includes('unique') && code !== '23505') {
      console.warn('[DIAGNOSTIC-VS] vendor_services insert:', msg);
    }
  }

  const after = await findDiagnosticVendorServiceId(vid);
  if (after) return after;

  // Last resort: sentinel catalog id only if a VS row exists for it
  const bySentinel = await query(
    `SELECT id::text AS vs_id, service_id::text AS catalog_service_id
     FROM vendor_services
     WHERE vendor_id = $1::uuid AND service_id = $2::uuid
     LIMIT 1`,
    [vid, labServiceId],
  ).catch(() => ({ rows: [] }));
  const srow = (bySentinel as { rows?: { vs_id?: string; catalog_service_id?: string }[] })?.rows?.[0];
  if (srow?.vs_id) {
    return {
      vendorServiceId: String(srow.vs_id),
      catalogServiceId: srow.catalog_service_id ? String(srow.catalog_service_id) : labServiceId,
    };
  }

  return null;
}

export function isGenericDiagnosticsServiceId(serviceId: string | null | undefined): boolean {
  const s = String(serviceId || '')
    .trim()
    .toLowerCase();
  return s === 'diagnostics' || s === 'diagnostic';
}

export { isDiagnosticCategoryText };
