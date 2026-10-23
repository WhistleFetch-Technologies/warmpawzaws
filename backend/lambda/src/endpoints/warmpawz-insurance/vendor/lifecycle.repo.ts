import { query, withTransaction } from '../../../database/rds-connection';
import type { CommissionSnapshot } from '../shared/lifecycle';

type Row = Record<string, unknown>;

export async function dbCompanyDomains(companyId: string): Promise<string[]> {
  const res = await query(`SELECT payment_link_domains FROM insurance_companies WHERE id = $1::uuid`, [companyId]);
  const raw = (res.rows[0] as Row | undefined)?.payment_link_domains;
  return Array.isArray(raw) ? raw.map(String) : [];
}

export async function dbLinkTerms(vendorId: string, companyId: string): Promise<Row[]> {
  const res = await query(
    `SELECT t.id, t.basis, t.rate, t.vendor_commission_rate, t.gst_rate, t.effective_from, l.id AS link_id
     FROM insurance_vendor_companies l
     JOIN insurance_commission_terms t ON t.vendor_company_id = l.id
     WHERE l.vendor_id = $1::uuid AND l.company_id = $2::uuid AND l.status = 'active'
     ORDER BY t.effective_from ASC`,
    [vendorId, companyId],
  );
  return res.rows as Row[];
}

export async function dbSavePaymentLink(applicationId: string, url: string, expiresAt: string, premium: number): Promise<void> {
  await query(
    `UPDATE insurance_applications
     SET payment_link_url = $2, payment_link_expires_at = $3::timestamptz, quoted_premium = $4, updated_at = NOW()
     WHERE id = $1::uuid`,
    [applicationId, url, expiresAt, premium],
  );
}

export async function dbSavePolicy(input: {
  applicationId: string;
  policyNumber: string;
  issuedPremium: number;
  startDate: string;
  endDate: string;
  documents: unknown;
}): Promise<void> {
  await query(
    `INSERT INTO insurance_policies_issued
       (application_id, policy_number, issued_premium, start_date, end_date, documents)
     VALUES ($1::uuid, $2, $3, $4::date, $5::date, $6::jsonb)
     ON CONFLICT (application_id) DO UPDATE
       SET policy_number = EXCLUDED.policy_number,
           issued_premium = EXCLUDED.issued_premium,
           start_date = EXCLUDED.start_date,
           end_date = EXCLUDED.end_date,
           documents = EXCLUDED.documents,
           uploaded_at = NOW()`,
    [
      input.applicationId,
      input.policyNumber,
      input.issuedPremium,
      input.startDate,
      input.endDate,
      JSON.stringify(input.documents),
    ],
  );
  await query(
    `UPDATE insurance_applications
     SET policy_number = $2,
         issued_premium = $3,
         premium_amount = $3,
         policy_issued_at = COALESCE(policy_issued_at, NOW()),
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [input.applicationId, input.policyNumber, input.issuedPremium],
  );
}

export async function dbConfirmSnapshot(input: {
  applicationId: string;
  linkId: string | null;
  snapshot: CommissionSnapshot;
  confirmedBy: 'customer' | 'auto';
}): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO insurance_commission_snapshots
         (application_id, link_id, terms_id, kind, basis, rate, vendor_commission_rate,
          base_amount, commission_amount, gst_rate, gst_amount, total_amount)
       VALUES ($1::uuid, $2::uuid, $3::uuid, 'confirm', $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (application_id, kind) DO NOTHING`,
      [
        input.applicationId,
        input.linkId,
        input.snapshot.termsId,
        input.snapshot.basis,
        input.snapshot.rate,
        input.snapshot.vendorCommissionRate,
        input.snapshot.baseAmount,
        input.snapshot.commissionAmount,
        input.snapshot.gstRate,
        input.snapshot.gstAmount,
        input.snapshot.totalAmount,
      ],
    );
    await client.query(
      `UPDATE insurance_policies_issued
       SET confirmed_at = COALESCE(confirmed_at, NOW()), confirmed_by = COALESCE(confirmed_by, $2)
       WHERE application_id = $1::uuid`,
      [input.applicationId, input.confirmedBy],
    );
    await client.query(
      `UPDATE insurance_applications SET status = 'policy_confirmed', policy_issued_at = COALESCE(policy_issued_at, NOW()), updated_at = NOW()
       WHERE id = $1::uuid`,
      [input.applicationId],
    );
    await client.query(
      `INSERT INTO insurance_application_events (application_id, from_status, to_status, actor_type, note)
       VALUES ($1::uuid, 'policy_uploaded', 'policy_confirmed', $2, 'Policy confirmed')`,
      [input.applicationId, input.confirmedBy === 'auto' ? 'system' : 'customer'],
    );
  });
}

export async function dbClawback(applicationId: string, snapshot: CommissionSnapshot, actor: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO insurance_commission_snapshots
         (application_id, kind, basis, rate, vendor_commission_rate, base_amount, commission_amount, gst_rate, gst_amount, total_amount)
       VALUES ($1::uuid, 'clawback', $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (application_id, kind) DO NOTHING`,
      [
        applicationId,
        snapshot.basis,
        snapshot.rate,
        snapshot.vendorCommissionRate,
        snapshot.baseAmount,
        snapshot.commissionAmount,
        snapshot.gstRate,
        snapshot.gstAmount,
        snapshot.totalAmount,
      ],
    );
    await client.query(
      `UPDATE insurance_policies_issued SET cancelled_at = NOW(), cancel_reason = 'free_look' WHERE application_id = $1::uuid`,
      [applicationId],
    );
    await client.query(
      `UPDATE insurance_applications SET status = 'free_look_cancelled', updated_at = NOW() WHERE id = $1::uuid`,
      [applicationId],
    );
    await client.query(
      `INSERT INTO insurance_application_events (application_id, from_status, to_status, actor_type, actor_id, note)
       VALUES ($1::uuid, 'policy_confirmed', 'free_look_cancelled', 'vendor', $2, 'Free look')`,
      [applicationId, actor],
    );
  });
}

export async function dbConfirmSnapshotRow(applicationId: string): Promise<Row | null> {
  const res = await query(
    `SELECT * FROM insurance_commission_snapshots WHERE application_id = $1::uuid AND kind = 'confirm'`,
    [applicationId],
  );
  return (res.rows as Row[])[0] || null;
}

export async function dbPolicy(applicationId: string): Promise<Row | null> {
  const res = await query(`SELECT * FROM insurance_policies_issued WHERE application_id = $1::uuid`, [applicationId]);
  return (res.rows as Row[])[0] || null;
}

export async function dbCustomerPolicies(customerId: string): Promise<Row[]> {
  const res = await query(
    `SELECT a.id AS application_id,
            a.status,
            COALESCE(p.policy_number, a.policy_number) AS policy_number,
            COALESCE(p.issued_premium, a.issued_premium) AS issued_premium,
            p.start_date,
            p.end_date,
            p.documents,
            p.confirmed_at,
            co.name AS company_name,
            co.logo_url AS company_logo_url,
            pl.name AS plan_name,
            pet.name AS pet_name
     FROM insurance_applications a
     LEFT JOIN insurance_policies_issued p ON p.application_id = a.id
     LEFT JOIN insurance_companies co ON co.id = a.company_id
     LEFT JOIN insurance_company_plans pl ON pl.id = a.plan_id
     LEFT JOIN pets pet ON pet.id = a.pet_id
     WHERE a.status IN (
             'policy_uploaded', 'policy_confirmed', 'free_look_cancelled',
             'documents_uploaded', 'policy_issued'
           )
       AND (p.application_id IS NOT NULL OR NULLIF(BTRIM(COALESCE(a.policy_number, '')), '') IS NOT NULL)
       AND (
         a.customer_id = $1::uuid
         OR EXISTS (
           SELECT 1
           FROM customers me
           JOIN customers same ON same.phone = me.phone
           WHERE me.id = $1::uuid
             AND NULLIF(BTRIM(me.phone), '') IS NOT NULL
             AND same.id = a.customer_id
         )
       )
     ORDER BY COALESCE(p.uploaded_at, a.updated_at) DESC`,
    [customerId],
  );
  return res.rows as Row[];
}

export async function dbDueAutoConfirm(days: number): Promise<Row[]> {
  const res = await query(
    `SELECT a.id, a.vendor_id, a.company_id, a.issued_premium, a.vendor_commission_amount, p.uploaded_at
     FROM insurance_applications a
     JOIN insurance_policies_issued p ON p.application_id = a.id
     WHERE a.status = 'policy_uploaded'
       AND p.confirmed_at IS NULL
       AND p.uploaded_at <= NOW() - ($1::int * INTERVAL '1 day')`,
    [days],
  );
  return res.rows as Row[];
}

export async function dbDueExpiry(): Promise<Row[]> {
  const res = await query(
    `SELECT id FROM insurance_applications
     WHERE status = 'payment_link_sent' AND payment_link_expires_at IS NOT NULL AND payment_link_expires_at <= NOW()`,
  );
  return res.rows as Row[];
}

export async function dbSetStatus(applicationId: string, status: string, from: string, actor: string, note: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(`UPDATE insurance_applications SET status = $2, updated_at = NOW() WHERE id = $1::uuid`, [
      applicationId,
      status,
    ]);
    await client.query(
      `INSERT INTO insurance_application_events (application_id, from_status, to_status, actor_type, note)
       VALUES ($1::uuid, $2, $3, $4, $5)`,
      [applicationId, from, status, actor, note],
    );
  });
}

export async function dbUpsertReport(input: {
  vendorCompanyId: string;
  periodStart: string;
  periodEnd: string;
  lines: unknown;
  expected: number;
  reported: number;
  submit: boolean;
}): Promise<Row> {
  const variance = Math.round((input.reported - input.expected) * 100) / 100;
  const res = await query(
    `INSERT INTO insurance_completion_reports
       (vendor_company_id, period_start, period_end, status, reported_policy_count, reported_amount, expected_amount, variance, lines, submitted_at)
     VALUES ($1::uuid, $2::date, $3::date, $4, $5, $6, $7, $8, $9::jsonb, CASE WHEN $4 = 'submitted' THEN NOW() ELSE NULL END)
     ON CONFLICT (vendor_company_id, period_start, period_end) DO UPDATE
       SET reported_policy_count = EXCLUDED.reported_policy_count,
           reported_amount = EXCLUDED.reported_amount,
           expected_amount = EXCLUDED.expected_amount,
           variance = EXCLUDED.variance,
           lines = EXCLUDED.lines,
           status = EXCLUDED.status,
           submitted_at = COALESCE(insurance_completion_reports.submitted_at, EXCLUDED.submitted_at)
     WHERE insurance_completion_reports.status = 'draft'
     RETURNING *`,
    [
      input.vendorCompanyId,
      input.periodStart,
      input.periodEnd,
      input.submit ? 'submitted' : 'draft',
      Array.isArray(input.lines) ? input.lines.length : 0,
      input.reported,
      input.expected,
      variance,
      JSON.stringify(input.lines),
    ],
  );
  return (res.rows as Row[])[0];
}

export async function dbListReports(): Promise<Row[]> {
  const res = await query(`SELECT * FROM insurance_completion_reports ORDER BY period_start DESC`);
  return res.rows as Row[];
}

export async function dbReviewReport(id: string, status: 'accepted' | 'disputed', note: string, reviewer: string): Promise<Row | null> {
  const res = await query(
    `UPDATE insurance_completion_reports
     SET status = $2, review_note = $3, reviewed_by = $4
     WHERE id = $1::uuid AND status = 'submitted'
     RETURNING *`,
    [id, status, note, reviewer],
  );
  return (res.rows as Row[])[0] || null;
}

export async function dbInsertReceipt(input: {
  vendorCompanyId: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  tds: number;
  utr: string | null;
  receivedOn: string;
  recordedBy: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO insurance_payout_receipts
       (vendor_company_id, period_start, period_end, amount, tds_amount, utr, received_on, recorded_by)
     VALUES ($1::uuid, $2::date, $3::date, $4, $5, $6, $7::date, $8)`,
    [
      input.vendorCompanyId,
      input.periodStart,
      input.periodEnd,
      input.amount,
      input.tds,
      input.utr,
      input.receivedOn,
      input.recordedBy,
    ],
  );
}
