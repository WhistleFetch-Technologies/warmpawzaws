/**
 * Package parent cancel/decline: blocked once session 1 has started or completed.
 */

import type { SqlClient } from './package-session-sync';

const SESSION_ONE_STARTED_STATUSES = [
  'in_progress',
  'arrived',
  'completed',
  'active',
  'service_started',
  'started',
];

export async function isPackageSessionOneStarted(
  db: SqlClient,
  packagePurchaseId: string
): Promise<boolean> {
  if (!packagePurchaseId) return false;
  const r = await db.query(
    `SELECT status::text AS st, started_at
     FROM bookings
     WHERE package_purchase_id = $1::uuid
       AND COALESCE(is_package_session, false) = true
       AND COALESCE(package_session_number, 0) = 1
     LIMIT 1`,
    [packagePurchaseId]
  );
  const row = r.rows?.[0];
  if (!row) {
    const anyStarted = await db.query(
      `SELECT 1
       FROM bookings
       WHERE package_purchase_id = $1::uuid
         AND COALESCE(is_package_session, false) = true
         AND (
           started_at IS NOT NULL
           OR LOWER(COALESCE(status::text, '')) = ANY($2::text[])
         )
       LIMIT 1`,
      [packagePurchaseId, SESSION_ONE_STARTED_STATUSES]
    );
    return (anyStarted.rowCount ?? 0) > 0 || (anyStarted.rows?.length ?? 0) > 0;
  }
  const st = String(row.st ?? '').toLowerCase();
  return row.started_at != null || SESSION_ONE_STARTED_STATUSES.includes(st);
}

export const PACKAGE_SESSION_ONE_STARTED_CUSTOMER_MESSAGE =
  'This package can no longer be cancelled because the first session has started.';
