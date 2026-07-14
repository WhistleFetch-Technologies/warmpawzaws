/**
 * Session-wise package tracking: seed scheduled rows, link bookings to slots,
 * mark in_progress / completed idempotently (single decrement per visit).
 */

import { getVendorCommissionRate } from './vendor-commission-rate';
import {
  applySettlementPreviewToCommissionableGross,
  extractSettlementPreviewFromBooking,
} from '../discount-engine/settlement/settlement-hook-bridge';

/** DB surface compatible with `query()` from rds-connection and `PoolClient#query` overloads. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SqlClient = { query: (...args: any[]) => Promise<any> };

/** Seed rows 1..N for a finite package purchase (idempotent). */
export async function seedPackageScheduledSessionsIfMissing(
  db: SqlClient,
  packagePurchaseId: string
): Promise<void> {
  await db.query(
    `
    INSERT INTO package_scheduled_sessions (package_purchase_id, session_number, status)
    SELECT pp.id, gs.n, 'pending'
    FROM package_purchases pp
    CROSS JOIN LATERAL generate_series(1, GREATEST(COALESCE(pp.total_sessions, 0), 0)) AS gs(n)
    WHERE pp.id = $1::uuid
      AND COALESCE(pp.unlimited_usage, false) = false
      AND COALESCE(pp.total_sessions, 0) > 0
    ON CONFLICT (package_purchase_id, session_number) DO NOTHING
    `,
    [packagePurchaseId]
  );
  await reconcileRemainingSessionsForFinitePackage(db, packagePurchaseId);
}

/** `remaining_sessions` = count of slots not yet terminal (single source of truth for finite packages). */
export async function reconcileRemainingSessionsForFinitePackage(
  db: SqlClient,
  packagePurchaseId: string
): Promise<void> {
  await db.query(
    `
    UPDATE package_purchases pp
    SET remaining_sessions = (
        SELECT COUNT(*)::int
        FROM package_scheduled_sessions pss
        WHERE pss.package_purchase_id = pp.id
          AND pss.status NOT IN ('completed', 'cancelled', 'no_show')
      ),
      updated_at = NOW()
    WHERE pp.id = $1::uuid
      AND COALESCE(pp.unlimited_usage, false) = false
    `,
    [packagePurchaseId]
  );
}

/** Ensures slot rows exist for finite purchases that pre-date session tracking (idempotent). */
export async function seedFinitePackagesMissingSessionsForScope(
  db: SqlClient,
  params: { customerId: string; vendorId?: string }
): Promise<void> {
  let sql = `
    SELECT pp.id
    FROM package_purchases pp
    WHERE pp.customer_id = $1::uuid
      AND pp.status = 'active'
      AND (pp.expires_at IS NULL OR pp.expires_at > NOW())
      AND COALESCE(pp.unlimited_usage, false) = false
      AND COALESCE(pp.total_sessions, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM package_scheduled_sessions s WHERE s.package_purchase_id = pp.id
      )
  `;
  const args: unknown[] = [params.customerId];
  if (params.vendorId) {
    sql += ` AND pp.vendor_id = $2::uuid`;
    args.push(params.vendorId);
  }
  const r = await db.query(sql, args);
  for (const row of r.rows ?? []) {
    await seedPackageScheduledSessionsIfMissing(db, String(row.id));
  }
}

/** Seeds missing slot rows for all active finite purchases under a vendor (vendor dashboard lists). */
export async function seedFinitePackagesMissingSessionsForVendor(
  db: SqlClient,
  vendorId: string
): Promise<void> {
  const r = await db.query(
    `
    SELECT pp.id
    FROM package_purchases pp
    WHERE pp.vendor_id = $1::uuid
      AND pp.status = 'active'
      AND (pp.expires_at IS NULL OR pp.expires_at > NOW())
      AND COALESCE(pp.unlimited_usage, false) = false
      AND COALESCE(pp.total_sessions, 0) > 0
      AND NOT EXISTS (
        SELECT 1 FROM package_scheduled_sessions s WHERE s.package_purchase_id = pp.id
      )
    `,
    [vendorId]
  );
  for (const row of r.rows ?? []) {
    await seedPackageScheduledSessionsIfMissing(db, String(row.id));
  }
}

/** Next discrete session slot for a new booking (pending only). */
export async function pickNextPendingSessionNumber(
  db: SqlClient,
  packagePurchaseId: string
): Promise<number | null> {
  const r = await db.query(
    `
    SELECT session_number
    FROM package_scheduled_sessions
    WHERE package_purchase_id = $1::uuid
      AND status = 'pending'
    ORDER BY session_number ASC
    LIMIT 1
    `,
    [packagePurchaseId]
  );
  const n = r.rows?.[0]?.session_number;
  return n != null ? Number(n) : null;
}

/** Next session index for unlimited packages (bookings-based). */
export async function pickNextUnlimitedPackageSessionNumber(
  db: SqlClient,
  packagePurchaseId: string
): Promise<number> {
  const r = await db.query(
    `
    SELECT COALESCE(MAX(package_session_number), 0) + 1 AS n
    FROM bookings
    WHERE package_purchase_id = $1::uuid
      AND COALESCE(is_package_session, false) = true
    `,
    [packagePurchaseId]
  );
  return Math.max(1, Number(r.rows?.[0]?.n ?? 1));
}

export async function linkPackageScheduledSessionToBooking(
  db: SqlClient,
  params: {
    packagePurchaseId: string;
    sessionNumber: number;
    bookingId: string;
    bookingDate: string;
    bookingTime: string;
  }
): Promise<boolean> {
  const { packagePurchaseId, sessionNumber, bookingId, bookingDate, bookingTime } = params;
  const r = await db.query(
    `
    UPDATE package_scheduled_sessions
    SET booking_id = $1::uuid,
        scheduled_date = $2::date,
        scheduled_time = $3::time,
        status = 'scheduled',
        updated_at = NOW()
    WHERE package_purchase_id = $4::uuid
      AND session_number = $5
      AND (
        status = 'pending'
        OR (status = 'scheduled' AND booking_id IS NULL)
      )
    `,
    [bookingId, bookingDate, bookingTime, packagePurchaseId, sessionNumber]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function markPackageSessionInProgressForBooking(
  db: SqlClient,
  bookingId: string
): Promise<void> {
  await db.query(
    `
    UPDATE package_scheduled_sessions
    SET status = 'in_progress', updated_at = NOW()
    WHERE booking_id = $1::uuid
      AND status = 'scheduled'
    `,
    [bookingId]
  );
}

async function countNonTerminalPackageSessions(
  db: SqlClient,
  packagePurchaseId: string
): Promise<number> {
  const r = await db.query(
    `
    SELECT COUNT(*)::int AS c
    FROM package_scheduled_sessions
    WHERE package_purchase_id = $1::uuid
      AND status NOT IN ('completed', 'cancelled', 'no_show')
    `,
    [packagePurchaseId]
  );
  return Number(r.rows?.[0]?.c ?? 0);
}

const round2Money = (x: number): number => Math.round(x * 100) / 100;

/**
 * One slice of parent `total_amount` per completed child session; last session absorbs paise remainder.
 * Idempotent: one `vendor_earnings` row per child `booking_id`.
 */
async function accrueVendorEarningsForPackageSessionChild(
  db: SqlClient,
  params: { packagePurchaseId: string; childBookingId: string }
): Promise<void> {
  const { packagePurchaseId, childBookingId } = params;

  try {
    const ppRes = await db.query(
      `SELECT COALESCE(total_sessions, 0)::int AS total_sessions,
              COALESCE(unlimited_usage, false) AS unlimited
       FROM package_purchases
       WHERE id = $1::uuid`,
      [packagePurchaseId]
    );
    const ppRow = ppRes.rows?.[0];
    if (!ppRow || ppRow.unlimited) {
      return;
    }

    let n = Number(ppRow.total_sessions);
    if (!Number.isFinite(n) || n <= 0) {
      const cRes = await db.query(
        `SELECT COUNT(*)::int AS c FROM package_scheduled_sessions WHERE package_purchase_id = $1::uuid`,
        [packagePurchaseId]
      );
      n = Number(cRes.rows?.[0]?.c ?? 0);
    }
    if (!Number.isFinite(n) || n <= 0) {
      console.warn('[package-session-sync] skip earnings: no session count', packagePurchaseId);
      return;
    }

    const parentRes = await db.query(
      `SELECT b.vendor_id::text AS vendor_id, b.total_amount::numeric AS total_amount,
              b.notes,
              COALESCE(pp.total_with_tax, pp.amount, pp.package_price, 0)::numeric AS purchase_amount
       FROM bookings b
       LEFT JOIN package_purchases pp ON pp.id = b.package_purchase_id
       WHERE b.package_purchase_id = $1::uuid
         AND COALESCE(b.is_package_session, false) = false
         AND b.parent_booking_id IS NULL
       LIMIT 1`,
      [packagePurchaseId]
    );
    const parentRow = parentRes.rows?.[0];
    if (!parentRow?.vendor_id) {
      return;
    }

    let parentTotal = Number(parentRow.total_amount);
    if (!Number.isFinite(parentTotal) || parentTotal <= 0) {
      parentTotal = Number(parentRow.purchase_amount);
    }
    if (!Number.isFinite(parentTotal) || parentTotal <= 0) {
      return;
    }

    const settlementPreview = extractSettlementPreviewFromBooking(parentRow as Record<string, unknown>);
    parentTotal = applySettlementPreviewToCommissionableGross(parentTotal, settlementPreview);

    const priorRes = await db.query(
      `SELECT COALESCE(SUM(ve.total_amount), 0)::numeric AS sum_gross,
              COUNT(*)::int AS cnt
       FROM vendor_earnings ve
       INNER JOIN bookings b ON b.id = ve.booking_id
       WHERE b.package_purchase_id = $1::uuid
         AND COALESCE(b.is_package_session, false) = true`,
      [packagePurchaseId]
    );
    const sumPriorGross = Number(priorRes.rows?.[0]?.sum_gross ?? 0);
    const priorCnt = Number(priorRes.rows?.[0]?.cnt ?? 0);
    if (priorCnt >= n) {
      return;
    }

    const isLast = priorCnt === n - 1;
    const perSessionGross = isLast
      ? round2Money(parentTotal - sumPriorGross)
      : round2Money(parentTotal / n);

    if (!Number.isFinite(perSessionGross) || perSessionGross <= 0) {
      return;
    }

    const commissionRate = await getVendorCommissionRate(String(parentRow.vendor_id));
    const commissionAmount = round2Money((perSessionGross * commissionRate) / 100);
    const vendorAmount = round2Money(perSessionGross - commissionAmount);
    if (vendorAmount <= 0) {
      return;
    }

    const insRes = await db.query(
      `INSERT INTO vendor_earnings (
         vendor_id, booking_id, amount, commission_amount, total_amount, commission_rate, status, realized_at
       )
       SELECT $1::uuid, $2::uuid, $3::numeric, $4::numeric, $5::numeric, $6::numeric, 'pending', NOW()
       WHERE NOT EXISTS (SELECT 1 FROM vendor_earnings WHERE booking_id = $2::uuid)
       RETURNING id`,
      [
        String(parentRow.vendor_id),
        childBookingId,
        vendorAmount,
        commissionAmount,
        perSessionGross,
        commissionRate,
      ]
    );

    if ((insRes.rowCount ?? 0) > 0 && insRes.rows?.[0]?.id) {
      await db
        .query(
          `UPDATE vendors
           SET pending_payout = COALESCE(pending_payout, 0) + $1,
               total_earnings = COALESCE(total_earnings, 0) + $1,
               updated_at = NOW()
           WHERE id = $2::uuid`,
          [vendorAmount, String(parentRow.vendor_id)]
        )
        .catch((err: unknown) =>
          console.warn('[package-session-sync] vendor totals update:', err)
        );
      console.log(
        `[package-session-sync] vendor_earnings package slice booking=${childBookingId} vendor_gets=${vendorAmount} gross_slice=${perSessionGross}`
      );
    }
  } catch (err: unknown) {
    console.error('[package-session-sync] accrueVendorEarningsForPackageSessionChild failed:', err);
  }
}

/**
 * When a package-linked booking is completed: mark session completed,
 * set `remaining_sessions` from slot counts (no decrement drift), usage log once per booking.
 */
export async function completePackageSessionForBooking(
  db: SqlClient,
  bookingId: string
): Promise<void> {
  const peek = await db.query(
    `
    SELECT pss.package_purchase_id, pss.session_number
    FROM package_scheduled_sessions pss
    WHERE pss.booking_id = $1::uuid
      AND pss.status NOT IN ('completed', 'cancelled', 'no_show')
    LIMIT 1
    `,
    [bookingId]
  );

  let peekPurchaseId: string | undefined;

  if ((peek.rowCount ?? 0) > 0) {
    peekPurchaseId = peek.rows[0].package_purchase_id;
  } else {
    const peek2 = await db.query(
      `
      SELECT b.package_purchase_id, b.package_session_number AS session_number
      FROM bookings b
      JOIN package_scheduled_sessions pss
        ON pss.package_purchase_id = b.package_purchase_id
       AND pss.session_number = b.package_session_number
      WHERE b.id = $1::uuid
        AND b.package_purchase_id IS NOT NULL
        AND COALESCE(b.is_package_session, false) = true
        AND b.package_session_number IS NOT NULL
        AND pss.status NOT IN ('completed', 'cancelled', 'no_show')
      LIMIT 1
      `,
      [bookingId]
    );
    if ((peek2.rowCount ?? 0) === 0) {
      return;
    }
    peekPurchaseId = peek2.rows[0].package_purchase_id;
  }

  let beforeRem: number | undefined;
  if (peekPurchaseId) {
    const limPeek = await db.query(
      `SELECT COALESCE(unlimited_usage, false) AS u FROM package_purchases WHERE id = $1::uuid`,
      [peekPurchaseId]
    );
    if (!limPeek.rows?.[0]?.u) {
      beforeRem = await countNonTerminalPackageSessions(db, peekPurchaseId);
    }
  }

  const u1 = await db.query(
    `
    UPDATE package_scheduled_sessions
    SET status = 'completed', updated_at = NOW()
    WHERE booking_id = $1::uuid
      AND status NOT IN ('completed', 'cancelled', 'no_show')
    RETURNING package_purchase_id, session_number
    `,
    [bookingId]
  );

  let packagePurchaseId: string | undefined;
  let sessionNumber: number | undefined;

  if ((u1.rowCount ?? 0) > 0) {
    packagePurchaseId = u1.rows[0].package_purchase_id;
    sessionNumber = Number(u1.rows[0].session_number);
  } else {
    const u2 = await db.query(
      `
      UPDATE package_scheduled_sessions pss
      SET status = 'completed', updated_at = NOW()
      FROM bookings b
      WHERE b.id = $1::uuid
        AND b.package_purchase_id IS NOT NULL
        AND COALESCE(b.is_package_session, false) = true
        AND b.package_session_number IS NOT NULL
        AND pss.package_purchase_id = b.package_purchase_id
        AND pss.session_number = b.package_session_number
        AND pss.status NOT IN ('completed', 'cancelled', 'no_show')
      RETURNING pss.package_purchase_id, pss.session_number
      `,
      [bookingId]
    );
    if ((u2.rowCount ?? 0) === 0) {
      return;
    }
    packagePurchaseId = u2.rows[0].package_purchase_id;
    sessionNumber = Number(u2.rows[0].session_number);
  }

  if (!packagePurchaseId) {
    return;
  }

  const lim = await db.query(
    `SELECT COALESCE(unlimited_usage, false) AS u FROM package_purchases WHERE id = $1::uuid`,
    [packagePurchaseId]
  );
  if (lim.rows?.[0]?.u) {
    return;
  }

  const afterRem = await countNonTerminalPackageSessions(db, packagePurchaseId);
  await db.query(
    `
    UPDATE package_purchases
    SET remaining_sessions = $2::int,
        updated_at = NOW()
    WHERE id = $1::uuid
      AND COALESCE(unlimited_usage, false) = false
    `,
    [packagePurchaseId, afterRem]
  );

  await db.query(
    `
    INSERT INTO package_usage_log (
      package_purchase_id, booking_id, session_number, action,
      sessions_before, sessions_after, created_at
    )
    SELECT $1::uuid, $2::uuid, $3::int, 'session_used', $4::int, $5::int, NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM package_usage_log
      WHERE booking_id = $2::uuid AND action = 'session_used'
    )
    `,
    [packagePurchaseId, bookingId, sessionNumber, beforeRem ?? afterRem, afterRem]
  );

  await accrueVendorEarningsForPackageSessionChild(db, {
    packagePurchaseId,
    childBookingId: bookingId,
  });

  // When every scheduled session for this finite purchase has reached a terminal
  // state, flip the parent canonical booking (is_package_session = false) to
  // `completed` so the customer/vendor "Completed" lists pick it up. The parent
  // stays `confirmed` while any child is still pending/scheduled/in_progress.
  if (afterRem === 0) {
    await db.query(
      `
      UPDATE bookings
      SET status = 'completed',
          completed_at = COALESCE(completed_at, NOW()),
          updated_at = NOW()
      WHERE package_purchase_id = $1::uuid
        AND COALESCE(is_package_session, false) = false
        AND parent_booking_id IS NULL
        AND status <> 'completed'
      `,
      [packagePurchaseId]
    ).catch(() => undefined);
  }
}

/**
 * Idempotent backfill: completed package session child bookings with no vendor_earnings row.
 * Used when GET /vendor/:id/earnings runs backfill (session may already be marked completed).
 */
export async function backfillPackageSessionEarningsForCompletedBookings(
  db: SqlClient,
  vendorIds: string[],
  logPrefix = '[EARNINGS-PACKAGE-BACKFILL]',
  limit = 200
): Promise<number> {
  const unique = [...new Set((vendorIds || []).filter(Boolean))];
  if (unique.length === 0) return 0;

  const cappedLimit = Math.min(Math.max(1, limit), 500);
  const missing = await db
    .query(
      `SELECT b.id::text AS id
       FROM bookings b
       WHERE b.status = 'completed'
         AND b.vendor_id = ANY($1::uuid[])
         AND b.package_purchase_id IS NOT NULL
         AND COALESCE(b.is_package_session, false) = true
         AND NOT EXISTS (SELECT 1 FROM vendor_earnings ve WHERE ve.booking_id = b.id)
       ORDER BY COALESCE(b.completed_at::timestamptz, b.updated_at::timestamptz) DESC NULLS LAST
       LIMIT $2`,
      [unique, cappedLimit]
    )
    .catch(() => ({ rows: [] as { id?: string }[] }));

  let created = 0;
  for (const row of missing.rows || []) {
    const childId = String(row.id ?? '');
    if (!childId) continue;
    const before = await db
      .query(`SELECT 1 FROM vendor_earnings WHERE booking_id = $1::uuid LIMIT 1`, [childId])
      .catch(() => ({ rowCount: 0 }));
    if ((before.rowCount ?? 0) > 0) continue;

    const pkgRes = await db
      .query(
        `SELECT package_purchase_id::text AS package_purchase_id
         FROM bookings WHERE id = $1::uuid LIMIT 1`,
        [childId]
      )
      .catch(() => ({ rows: [] as { package_purchase_id?: string }[] }));
    const packagePurchaseId = pkgRes.rows?.[0]?.package_purchase_id;
    if (!packagePurchaseId) continue;

    await accrueVendorEarningsForPackageSessionChild(db, {
      packagePurchaseId,
      childBookingId: childId,
    });

    const after = await db
      .query(`SELECT 1 FROM vendor_earnings WHERE booking_id = $1::uuid LIMIT 1`, [childId])
      .catch(() => ({ rowCount: 0 }));
    if ((after.rowCount ?? 0) > 0) {
      created += 1;
    }
  }

  if (created > 0) {
    console.log(`${logPrefix} Created ${created} package session vendor_earnings row(s)`);
  }
  return created;
}
