/**
 * Package session vendor-earnings allocation.
 * Parent owns the commissionable service value; each completed session gets one slice.
 * Last completed session (seq === n) absorbs paise remainder. Sum of slices ≤ parent service.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function allocatePackageSessionGross(params: {
  parentServiceValue: number;
  sessionCount: number;
  priorCount: number;
  priorSum: number;
}): number {
  const parent = round2(Math.max(0, params.parentServiceValue));
  const n = Math.floor(params.sessionCount);
  const priorCount = Math.max(0, Math.floor(params.priorCount));
  const priorSum = round2(Math.max(0, params.priorSum));
  if (parent <= 0.009 || n <= 0 || priorCount >= n) return 0;

  const remaining = round2(parent - priorSum);
  if (remaining <= 0.009) return 0;

  const evenSlice = round2(parent / n);
  const isLast = priorCount === n - 1;
  const slice = isLast ? remaining : Math.min(evenSlice, remaining);
  return slice > 0.009 ? round2(slice) : 0;
}

export function scaleCommissionForAllocatedGross(params: {
  allocatedGross: number;
  commissionRate: number;
}): { commissionAmount: number; vendorNet: number } {
  const gross = round2(Math.max(0, params.allocatedGross));
  const rate = Math.max(0, params.commissionRate);
  const commissionAmount = round2((gross * rate) / 100);
  const vendorNet = round2(gross - commissionAmount);
  return { commissionAmount, vendorNet };
}

export function allocatedEarningsFromStored(params: {
  isPackageSession: boolean;
  unlimited?: boolean;
  parentService: number;
  sessionCount: number;
  sessionSeq: number | null;
  storedGross: number;
  storedCommission: number;
  storedNet: number;
  commissionRate: number | null;
}): { gross: number; commission: number; net: number } {
  const storedGross = round2(Math.max(0, params.storedGross));
  const storedCommission = round2(Math.max(0, params.storedCommission));
  const storedNet = round2(Math.max(0, params.storedNet));
  if (!params.isPackageSession || params.unlimited) {
    return { gross: storedGross, commission: storedCommission, net: storedNet };
  }
  const n = Math.floor(params.sessionCount);
  const seq = params.sessionSeq == null ? 0 : Math.floor(params.sessionSeq);
  const parent = round2(Math.max(0, params.parentService));
  if (parent <= 0.009 || n <= 0 || seq <= 0) {
    return { gross: storedGross, commission: storedCommission, net: storedNet };
  }
  let alloc = 0;
  if (seq > n) alloc = 0;
  else if (seq === n) alloc = round2(parent - round2(parent / n) * (n - 1));
  else alloc = round2(parent / n);

  if (alloc <= 0.009) return { gross: 0, commission: 0, net: 0 };
  if (storedGross > 0.009) {
    const commission = round2(storedCommission * (alloc / storedGross));
    return { gross: alloc, commission, net: round2(alloc - commission) };
  }
  const rate = params.commissionRate ?? 0;
  const scaled = scaleCommissionForAllocatedGross({ allocatedGross: alloc, commissionRate: rate });
  return { gross: alloc, commission: scaled.commissionAmount, net: scaled.vendorNet };
}

/**
 * SQL expression: allocated commissionable gross for a vendor_earnings row.
 * Uses global session sequence among non-cancelled package-child earnings.
 * Non-package rows keep stored total_amount.
 *
 * Aliases required on the enclosing query:
 *   ve (vendor_earnings), b (bookings), pkg (package cap columns)
 */
export const SQL_ALLOCATED_PACKAGE_SESSION_GROSS = `
CASE
  WHEN COALESCE(b.is_package_session, false) = false THEN ve.total_amount
  WHEN COALESCE(pkg.unlimited, false) THEN ve.total_amount
  WHEN COALESCE(pkg.parent_service, 0) <= 0 OR COALESCE(pkg.session_n, 0) <= 0 THEN ve.total_amount
  WHEN COALESCE(pkg.session_seq, 0) > pkg.session_n THEN 0
  WHEN COALESCE(pkg.session_seq, 0) = pkg.session_n THEN
    ROUND(pkg.parent_service - ROUND(pkg.parent_service / pkg.session_n, 2) * (pkg.session_n - 1), 2)
  ELSE ROUND(pkg.parent_service / pkg.session_n, 2)
END
`.trim();

/** CTE producing per-row allocated gross/commission/net for daily accrual. */
export function sqlPackageAllocatedEarningsAgg(): string {
  return `
        package_caps AS (
          SELECT
            ve.id AS earnings_id,
            ve.vendor_id,
            ve.booking_id,
            ve.realized_at,
            ve.status,
            ve.total_amount,
            ve.commission_amount,
            ve.amount,
            ve.commission_rate,
            COALESCE(b.is_package_session, false) AS is_session,
            COALESCE(pp.unlimited_usage, false) AS unlimited,
            COALESCE(
              NULLIF(parent_b.total_amount, 0),
              NULLIF(parent_b.base_price, 0),
              NULLIF(pp.amount, 0),
              NULLIF(pp.package_price, 0),
              0
            )::numeric AS parent_service,
            GREATEST(
              COALESCE(
                NULLIF(pp.total_sessions, 0),
                NULLIF((
                  SELECT COUNT(*)::int
                  FROM package_scheduled_sessions pss
                  WHERE pss.package_purchase_id = b.package_purchase_id
                ), 0),
                1
              ),
              1
            ) AS session_n,
            CASE
              WHEN COALESCE(b.is_package_session, false) AND b.package_purchase_id IS NOT NULL
              THEN ROW_NUMBER() OVER (
                PARTITION BY b.package_purchase_id
                ORDER BY ve.realized_at, ve.booking_id
              )
              ELSE NULL
            END AS session_seq
          FROM vendor_earnings ve
          INNER JOIN bookings b ON b.id = ve.booking_id
          LEFT JOIN bookings parent_b ON parent_b.id = b.parent_booking_id
          LEFT JOIN package_purchases pp ON pp.id = b.package_purchase_id
          WHERE ve.status IS DISTINCT FROM 'cancelled'
        ),
        allocated_earnings AS (
          SELECT
            vendor_id,
            realized_at,
            CASE
              WHEN is_session = false THEN total_amount
              WHEN unlimited THEN total_amount
              WHEN parent_service <= 0 OR session_n <= 0 THEN total_amount
              WHEN session_seq > session_n THEN 0
              WHEN session_seq = session_n THEN
                ROUND(parent_service - ROUND(parent_service / session_n, 2) * (session_n - 1), 2)
              ELSE ROUND(parent_service / session_n, 2)
            END AS alloc_gross,
            total_amount AS stored_gross,
            commission_amount AS stored_commission,
            amount AS stored_net,
            commission_rate
          FROM package_caps
        )
  `;
}
