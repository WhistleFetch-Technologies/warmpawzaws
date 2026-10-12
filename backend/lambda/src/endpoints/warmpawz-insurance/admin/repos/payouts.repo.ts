import { query, withTransaction } from '../../../../database/rds-connection';
import { ledgerStateKey } from '../domain/payout-ledger';
import { isoDate, isoTs, num, numOrNull, str, type Row } from './row-mappers';

export interface IssuedPolicyRow {
  readonly applicationId: string;
  readonly vendorId: string;
  readonly companyId: string;
  readonly customerName: string | null;
  readonly policyNumber: string;
  readonly premium: number;
  readonly vendorCommissionAmount: number | null;
  readonly issuedAt: string;
}

/** Issued policies; the table's CHECK guarantees number, premium, date, document and company. */
export async function dbListIssuedPolicies(): Promise<IssuedPolicyRow[]> {
  const res = await query(
    `SELECT a.id, a.vendor_id, a.company_id, a.policy_number, a.premium_amount,
            a.vendor_commission_amount, a.policy_issued_at, c.full_name AS customer_name
     FROM insurance_applications a
     JOIN customers c ON c.id = a.customer_id
     WHERE a.status = 'policy_issued'
     ORDER BY a.policy_issued_at ASC`,
  );
  return (res.rows as Row[]).map((r) => ({
    applicationId: String(r.id),
    vendorId: String(r.vendor_id),
    companyId: String(r.company_id),
    customerName: str(r.customer_name),
    policyNumber: String(r.policy_number),
    premium: num(r.premium_amount),
    vendorCommissionAmount: numOrNull(r.vendor_commission_amount),
    issuedAt: isoTs(r.policy_issued_at) ?? '',
  }));
}

export interface PayoutPeriodStateRow {
  readonly id: string;
  readonly vendorCompanyId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly receivedAmount: number;
  readonly receivedAt: string | null;
  readonly receivedReference: string | null;
  readonly lastRemindedAt: string | null;
  readonly reminderCount: number;
}

export async function dbListPayoutPeriodStates(): Promise<Map<string, PayoutPeriodStateRow>> {
  const res = await query(`SELECT * FROM insurance_payout_periods`);
  const out = new Map<string, PayoutPeriodStateRow>();
  for (const r of res.rows as Row[]) {
    const row: PayoutPeriodStateRow = {
      id: String(r.id),
      vendorCompanyId: String(r.vendor_company_id),
      periodStart: isoDate(r.period_start) ?? '',
      periodEnd: isoDate(r.period_end) ?? '',
      receivedAmount: num(r.received_amount),
      receivedAt: isoTs(r.received_at),
      receivedReference: str(r.received_reference),
      lastRemindedAt: isoTs(r.last_reminded_at),
      reminderCount: num(r.reminder_count),
    };
    out.set(ledgerStateKey(row.vendorCompanyId, row.periodStart, row.periodEnd), row);
  }
  return out;
}

const UPSERT_PERIOD = `
  INSERT INTO insurance_payout_periods (vendor_company_id, period_start, period_end, due_date, updated_by)
  VALUES ($1::uuid, $2::date, $3::date, $4::date, $5)
  ON CONFLICT (vendor_company_id, period_start, period_end)
  DO UPDATE SET due_date = EXCLUDED.due_date, updated_by = EXCLUDED.updated_by, updated_at = NOW()
  RETURNING id`;

export interface PayoutPeriodRef {
  readonly vendorCompanyId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly dueDate: string;
}

/** Records a reminder and the vendor's in-app notification in one transaction. */
export async function dbRecordPayoutReminder(opts: {
  period: PayoutPeriodRef;
  vendorId: string;
  expected: number;
  actorId: string | null;
  title: string;
  message: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const { period, actorId } = opts;
  await withTransaction(async (client) => {
    const res = await client.query(UPSERT_PERIOD, [
      period.vendorCompanyId,
      period.periodStart,
      period.periodEnd,
      period.dueDate,
      actorId,
    ]);
    const periodId = String(res.rows[0].id);
    await client.query(
      `UPDATE insurance_payout_periods
       SET last_reminded_at = NOW(), reminder_count = reminder_count + 1
       WHERE id = $1::uuid`,
      [periodId],
    );
    await client.query(
      `INSERT INTO insurance_payout_reminders (payout_period_id, vendor_id, expected_amount, trigger, sent_by)
       VALUES ($1::uuid, $2::uuid, $3, 'manual', $4)`,
      [periodId, opts.vendorId, opts.expected, actorId],
    );
    await client.query(
      `INSERT INTO notifications (recipient_id, recipient_type, notification_type, title, message, channels, is_read, data)
       VALUES ($1::uuid, 'vendor', 'insurance_payout_reminder', $2, $3, $4::jsonb, false, $5::jsonb)`,
      [
        opts.vendorId,
        opts.title,
        opts.message,
        JSON.stringify({ email: true, sms: false, inApp: true, push: true }),
        JSON.stringify(opts.data),
      ],
    );
  });
}

export async function dbRecordPayoutReceipt(opts: {
  period: PayoutPeriodRef;
  amount: number;
  reference: string | null;
  receivedOn: string | null;
  notes: string | null;
  actorId: string | null;
}): Promise<void> {
  const { period } = opts;
  await withTransaction(async (client) => {
    const res = await client.query(UPSERT_PERIOD, [
      period.vendorCompanyId,
      period.periodStart,
      period.periodEnd,
      period.dueDate,
      opts.actorId,
    ]);
    await client.query(
      `UPDATE insurance_payout_periods SET
         received_amount = $2,
         received_at = COALESCE($3::date::timestamp AT TIME ZONE 'Asia/Kolkata', NOW()),
         received_reference = $4,
         notes = COALESCE($5, notes)
       WHERE id = $1::uuid`,
      [String(res.rows[0].id), opts.amount, opts.receivedOn, opts.reference, opts.notes],
    );
  });
}
