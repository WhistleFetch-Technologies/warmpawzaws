/**
 * Session-wise package tracking: seed scheduled rows, link bookings to slots,
 * mark in_progress / completed idempotently (single decrement per visit).
 */

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
}
