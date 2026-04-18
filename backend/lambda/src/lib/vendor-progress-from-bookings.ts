/**
 * Derives program-style progress rows from completed (and in-progress package) bookings
 * so vendor "Progress" reflects real session work, not only training_progress enrollments.
 */

import { query } from '../database/rds-connection';

export type VendorProgressBookingRow = Record<string, unknown>;

/**
 * Returns rows shaped like GET /vendor/:vendorId/training/progress (training_progress + joins).
 * Safe to call when tables/columns are missing (returns []).
 */
export async function fetchVendorProgressRowsFromBookings(
  vendorId: string,
  options: { includeWalkAggregates: boolean }
): Promise<VendorProgressBookingRow[]> {
  const rows: VendorProgressBookingRow[] = [];

  // --- Package purchases: session counts from bookings + package totals ---
  try {
    const pkgSql = `
      SELECT
        ('pp-' || pp.id::text) AS id,
        pp.package_id AS program_id,
        COALESCE(
          (SELECT b2.pet_id FROM bookings b2
           WHERE b2.package_purchase_id = pp.id AND b2.pet_id IS NOT NULL
           ORDER BY b2.completed_at DESC NULLS LAST, b2.updated_at DESC LIMIT 1),
          (SELECT b3.pet_id FROM bookings b3 WHERE b3.package_purchase_id = pp.id LIMIT 1)
        ) AS pet_id,
        pp.customer_id,
        pp.vendor_id,
        (SELECT MIN((b4.completed_at AT TIME ZONE 'UTC')::date)
         FROM bookings b4
         WHERE b4.package_purchase_id = pp.id AND b4.status = 'completed' AND b4.completed_at IS NOT NULL) AS enrollment_date,
        CASE
          WHEN COALESCE(pp.unlimited_usage, false) THEN
            CASE WHEN (SELECT COUNT(*)::int FROM bookings bx WHERE bx.package_purchase_id = pp.id AND bx.status = 'completed') > 0
              THEN 'in_progress' ELSE 'enrolled' END
          WHEN COALESCE(pp.total_sessions, 0) > 0
            AND (SELECT COUNT(*)::int FROM bookings bx WHERE bx.package_purchase_id = pp.id AND bx.status = 'completed') >= pp.total_sessions
            THEN 'completed'
          WHEN (SELECT COUNT(*)::int FROM bookings bx WHERE bx.package_purchase_id = pp.id AND bx.status = 'completed') > 0
            THEN 'in_progress'
          ELSE 'enrolled'
        END AS status,
        CASE
          WHEN COALESCE(pp.unlimited_usage, false) THEN
            LEAST(100, GREATEST(0,
              (SELECT COUNT(*)::int FROM bookings bx WHERE bx.package_purchase_id = pp.id AND bx.status = 'completed') * 5))
          WHEN COALESCE(NULLIF(pp.total_sessions, 0), 0) > 0 THEN
            LEAST(100, GREATEST(0, ROUND(
              100.0 * (SELECT COUNT(*)::int FROM bookings bx WHERE bx.package_purchase_id = pp.id AND bx.status = 'completed')
              / NULLIF(pp.total_sessions, 0)
            )::int))
          ELSE
            LEAST(100, GREATEST(0,
              (SELECT COUNT(*)::int FROM bookings bx WHERE bx.package_purchase_id = pp.id AND bx.status = 'completed') * 25))
        END AS progress_percentage,
        (SELECT COUNT(*)::int FROM bookings bx WHERE bx.package_purchase_id = pp.id AND bx.status = 'completed') AS sessions_completed,
        COALESCE(
          NULLIF(pp.total_sessions, 0),
          GREATEST(
            (SELECT COUNT(*)::int FROM bookings bx WHERE bx.package_purchase_id = pp.id AND bx.status = 'completed'),
            1
          )
        )::int AS estimated_total_sessions,
        NULL::text AS notes,
        pp.purchased_at AS created_at,
        pp.updated_at AS updated_at,
        COALESCE(sp.package_name, pp.package_name, 'Package') AS program_name,
        COALESCE(sp.service_type::text, 'training') AS program_category,
        4::int AS duration_weeks,
        COALESCE(sp.sessions_included, 2)::int AS sessions_per_week,
        COALESCE(p.name, 'Pet') AS pet_name,
        c.full_name AS customer_name
      FROM package_purchases pp
      LEFT JOIN customers c ON c.id = pp.customer_id
      LEFT JOIN service_packages sp ON sp.id = pp.package_id
      LEFT JOIN pets p ON p.id = COALESCE(
        (SELECT b5.pet_id FROM bookings b5 WHERE b5.package_purchase_id = pp.id AND b5.pet_id IS NOT NULL
         ORDER BY b5.completed_at DESC NULLS LAST LIMIT 1),
        (SELECT b6.pet_id FROM bookings b6 WHERE b6.package_purchase_id = pp.id LIMIT 1)
      )
      WHERE pp.vendor_id = $1::uuid
        AND (
          EXISTS (SELECT 1 FROM bookings b7 WHERE b7.package_purchase_id = pp.id AND b7.status = 'completed')
          OR (COALESCE(pp.total_sessions, 0) - COALESCE(pp.remaining_sessions, pp.total_sessions)) > 0
        )
      ORDER BY pp.updated_at DESC NULLS LAST
    `;
    const pkgRes = await query(pkgSql, [vendorId]).catch(() => ({ rows: [] as VendorProgressBookingRow[] }));
    rows.push(...(pkgRes.rows || []));
  } catch (e) {
    console.warn('[vendor-progress-from-bookings] package aggregate skipped:', (e as Error)?.message);
  }

  // --- Non-package completed sessions (e.g. solo obedience visit) ---
  try {
    const bkSql = `
      SELECT
        ('bk-' || b.vendor_id::text || '-' || b.customer_id::text || '-' || COALESCE(b.pet_id::text, 'np') || '-' || b.service_id::text) AS id,
        b.service_id AS program_id,
        COALESCE(b.pet_id, '00000000-0000-0000-0000-000000000001'::uuid) AS pet_id,
        b.customer_id,
        b.vendor_id,
        MIN((b.completed_at AT TIME ZONE 'UTC')::date) AS enrollment_date,
        'completed'::varchar AS status,
        100::int AS progress_percentage,
        COUNT(*)::int AS sessions_completed,
        GREATEST(COUNT(*)::int, 1) AS estimated_total_sessions,
        NULL::text AS notes,
        MIN(b.created_at) AS created_at,
        MAX(b.updated_at) AS updated_at,
        COALESCE(MAX(sc.service_name), MAX(s.name), 'Service') AS program_name,
        COALESCE(MAX(sc.category_id::text), MAX(s.category::text), 'training') AS program_category,
        4::int AS duration_weeks,
        2::int AS sessions_per_week,
        COALESCE(MAX(p.name), 'Pet') AS pet_name,
        MAX(c.full_name) AS customer_name
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN pets p ON p.id = b.pet_id
      LEFT JOIN services s ON s.id = b.service_id
      LEFT JOIN service_catalog sc ON sc.id = b.service_id
      WHERE b.vendor_id = $1::uuid
        AND b.status = 'completed'
        AND (b.package_purchase_id IS NULL)
      GROUP BY b.vendor_id, b.customer_id, b.pet_id, b.service_id
      ORDER BY MAX(b.completed_at) DESC NULLS LAST
    `;
    const bkRes = await query(bkSql, [vendorId]).catch(() => ({ rows: [] as VendorProgressBookingRow[] }));
    rows.push(...(bkRes.rows || []));
  } catch (e) {
    console.warn('[vendor-progress-from-bookings] non-package aggregate skipped:', (e as Error)?.message);
  }

  // --- Walk sessions: completed at_home visits where service looks like a walk ---
  if (options.includeWalkAggregates) {
    try {
      const walkSql = `
        SELECT
          ('wk-' || $1::text || '-' || b.customer_id::text || '-' || COALESCE(b.pet_id::text, 'np')) AS id,
          NULL::uuid AS program_id,
          COALESCE(MAX(b.pet_id), '00000000-0000-0000-0000-000000000001'::uuid) AS pet_id,
          b.customer_id,
          $1::uuid AS vendor_id,
          MIN((b.completed_at AT TIME ZONE 'UTC')::date) AS enrollment_date,
          'completed'::varchar AS status,
          LEAST(100, GREATEST(0, ROUND(
            100.0 * COUNT(*) FILTER (WHERE b.status = 'completed')
            / NULLIF(GREATEST(7, COUNT(*) FILTER (WHERE b.status = 'completed')), 0)
          )::int)) AS progress_percentage,
          COUNT(*) FILTER (WHERE b.status = 'completed')::int AS sessions_completed,
          GREATEST(7, COUNT(*) FILTER (WHERE b.status = 'completed'))::int AS estimated_total_sessions,
          'Walk sessions (from completed bookings)'::text AS notes,
          MIN(b.created_at) AS created_at,
          MAX(b.updated_at) AS updated_at,
          'Walk sessions'::text AS program_name,
          'walking'::text AS program_category,
          1::int AS duration_weeks,
          7::int AS sessions_per_week,
          COALESCE(MAX(p.name), 'Pet') AS pet_name,
          MAX(c.full_name) AS customer_name
        FROM bookings b
        LEFT JOIN customers c ON c.id = b.customer_id
        LEFT JOIN pets p ON p.id = b.pet_id
        LEFT JOIN services s ON s.id = b.service_id
        LEFT JOIN service_catalog sc ON sc.id = b.service_id
        WHERE b.vendor_id = $1::uuid
          AND b.service_type = 'at_home'
          AND b.status = 'completed'
          AND (
            LOWER(COALESCE(sc.service_name, s.name, '')) LIKE '%walk%'
            OR LOWER(COALESCE(sc.display_name, '')) LIKE '%walk%'
          )
        GROUP BY b.customer_id, b.pet_id
        HAVING COUNT(*) FILTER (WHERE b.status = 'completed') > 0
        ORDER BY MAX(b.completed_at) DESC NULLS LAST
      `;
      const wkRes = await query(walkSql, [vendorId]).catch(() => ({ rows: [] as VendorProgressBookingRow[] }));
      rows.push(...(wkRes.rows || []));
    } catch (e) {
      console.warn('[vendor-progress-from-bookings] walk aggregate skipped:', (e as Error)?.message);
    }
  }

  return rows;
}

export function mergeTrainingProgressWithBookingDerived(
  enrollmentRows: VendorProgressBookingRow[],
  bookingRows: VendorProgressBookingRow[]
): VendorProgressBookingRow[] {
  const seen = new Set<string>();
  const out: VendorProgressBookingRow[] = [];
  for (const r of enrollmentRows || []) {
    const id = String((r as any).id ?? '');
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(r);
    }
  }
  for (const r of bookingRows || []) {
    const id = String((r as any).id ?? '');
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(r);
    }
  }
  return out;
}
