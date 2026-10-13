import { query } from '../../../../database/rds-connection';
import type { OutreachQuery } from '../dto/insurance-admin.requests';
import { INSURANCE_ROLE_NAMES } from './vendor-links.repo';
import { num, type Row } from './row-mappers';

/**
 * Every customer outreach to an insurance vendor: consultation bookings (with their
 * application when the vendor has started one) plus applications opened without a booking.
 * $1 = insurance role names.
 */
const OUTREACH_CTE = `
  WITH outreach AS (
    SELECT
      b.id AS booking_id, a.id AS application_id, b.customer_id, b.vendor_id,
      COALESCE(a.pet_id, b.pet_id) AS pet_id, a.company_id,
      COALESCE(a.status, 'consultation_booked') AS status, (a.id IS NULL) AS status_derived,
      b.booking_date, b.booking_time, b.status AS booking_status, b.payment_status AS booking_payment_status,
      COALESCE(b.total_amount, b.base_price, 0) AS consultation_fee,
      a.policy_number, a.premium_amount, a.issued_premium, a.policy_issued_at, a.policy_document_url,
      b.created_at AS reached_out_at, COALESCE(a.updated_at, b.created_at) AS last_activity_at
    FROM bookings b
    JOIN vendors bv ON bv.id = b.vendor_id
    JOIN roles br ON br.id = bv.role_id AND br.name = ANY($1::text[])
    LEFT JOIN insurance_applications a ON a.booking_id = b.id
    UNION ALL
    SELECT
      NULL, a.id, a.customer_id, a.vendor_id, a.pet_id, a.company_id, a.status, false,
      NULL, NULL, NULL, NULL, 0,
      a.policy_number, a.premium_amount, a.issued_premium, a.policy_issued_at, a.policy_document_url,
      a.created_at, a.updated_at
    FROM insurance_applications a
    WHERE a.booking_id IS NULL
  )`;

const IST_DAY = `((o.reached_out_at AT TIME ZONE 'Asia/Kolkata')::date)`;

function buildWhere(q: Partial<OutreachQuery>, params: unknown[]): string {
  const where: string[] = [];
  const add = (sql: (n: number) => string, value: unknown) => {
    params.push(value);
    where.push(sql(params.length));
  };
  if (q.status) add((n) => `o.status = $${n}`, q.status);
  if (q.vendorId) add((n) => `o.vendor_id = $${n}::uuid`, q.vendorId);
  if (q.companyId) add((n) => `o.company_id = $${n}::uuid`, q.companyId);
  if (q.from) add((n) => `${IST_DAY} >= $${n}::date`, q.from);
  if (q.to) add((n) => `${IST_DAY} <= $${n}::date`, q.to);
  if (q.search) {
    add(
      (n) =>
        `(c.full_name ILIKE $${n} OR c.phone ILIKE $${n} OR o.policy_number ILIKE $${n}
          OR v.business_name ILIKE $${n} OR v.owner_name ILIKE $${n})`,
      `%${q.search}%`,
    );
  }
  return where.length ? `WHERE ${where.join(' AND ')}` : '';
}

const OUTREACH_FROM = `
  FROM outreach o
  JOIN customers c ON c.id = o.customer_id
  JOIN vendors v ON v.id = o.vendor_id
  LEFT JOIN pets p ON p.id = o.pet_id
  LEFT JOIN insurance_companies ic ON ic.id = o.company_id`;

export async function dbListOutreach(q: OutreachQuery): Promise<{ rows: Row[]; total: number }> {
  const params: unknown[] = [[...INSURANCE_ROLE_NAMES]];
  const where = buildWhere(q, params);
  const countParams = [...params];
  params.push(q.pageSize, (q.page - 1) * q.pageSize);
  const [countRes, listRes] = await Promise.all([
    query(`${OUTREACH_CTE} SELECT COUNT(*)::int AS total ${OUTREACH_FROM} ${where}`, countParams),
    query(
      `${OUTREACH_CTE}
       SELECT o.*, c.full_name AS customer_name, c.phone AS customer_phone,
              v.business_name, v.owner_name, p.name AS pet_name, p.species AS pet_species,
              ic.name AS company_name
       ${OUTREACH_FROM} ${where}
       ORDER BY o.reached_out_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    ),
  ]);
  return { rows: listRes.rows as Row[], total: num(countRes.rows[0]?.total) };
}

export interface OutreachMetricsRow {
  readonly outreach: number;
  readonly upcoming: number;
  readonly inProgress: number;
  readonly awaitingExternal: number;
  readonly issued: number;
  readonly premiumIssued: number;
  readonly cancelled: number;
}

export async function dbOutreachMetrics(range: { from?: string; to?: string }): Promise<OutreachMetricsRow> {
  const params: unknown[] = [[...INSURANCE_ROLE_NAMES]];
  const where = buildWhere(range, params);
  const res = await query(
    `${OUTREACH_CTE}
     SELECT
       COUNT(*)::int AS outreach,
       COUNT(*) FILTER (
         WHERE o.booking_date >= (NOW() AT TIME ZONE 'Asia/Kolkata')::date
           AND LOWER(COALESCE(o.booking_status, '')) NOT IN ('cancelled', 'completed', 'no_show', 'rejected')
       )::int AS upcoming,
       COUNT(*) FILTER (WHERE o.status IN ('quote_shared', 'form_sent', 'form_submitted', 'changes_requested', 'form_confirmed', 'form_required', 'vendor_processing', 'vendor_review'))::int AS in_progress,
       COUNT(*) FILTER (WHERE o.status IN ('payment_link_sent', 'payment_link_expired', 'payment_reported', 'payment_link_shared', 'awaiting_payment', 'documents_uploaded'))::int AS awaiting_external,
       COUNT(*) FILTER (WHERE o.status IN ('policy_uploaded', 'policy_confirmed', 'policy_issued'))::int AS issued,
       COALESCE(SUM(COALESCE(o.issued_premium, o.premium_amount)) FILTER (WHERE o.status IN ('policy_uploaded', 'policy_confirmed', 'policy_issued')), 0)::float AS premium_issued,
       COUNT(*) FILTER (WHERE o.status IN ('cancelled', 'dropped', 'free_look_cancelled'))::int AS cancelled
     ${OUTREACH_FROM} ${where}`,
    params,
  );
  const r = (res.rows[0] ?? {}) as Row;
  return {
    outreach: num(r.outreach),
    upcoming: num(r.upcoming),
    inProgress: num(r.in_progress),
    awaitingExternal: num(r.awaiting_external),
    issued: num(r.issued),
    premiumIssued: num(r.premium_issued),
    cancelled: num(r.cancelled),
  };
}

export async function dbListApplicationEvents(applicationId: string): Promise<Row[]> {
  const res = await query(
    `SELECT * FROM insurance_application_events
     WHERE application_id = $1::uuid
     ORDER BY created_at ASC`,
    [applicationId],
  );
  return res.rows as Row[];
}

export async function dbApplicationExists(applicationId: string): Promise<boolean> {
  const res = await query(`SELECT 1 FROM insurance_applications WHERE id = $1::uuid`, [applicationId]);
  return res.rows.length > 0;
}
