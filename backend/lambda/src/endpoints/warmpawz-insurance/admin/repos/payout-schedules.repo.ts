import type { PoolClient } from 'pg';
import { query } from '../../../../database/rds-connection';
import type { PayoutFrequency, PayoutScheduleConfig } from '../domain/payout-periods';
import type { PayoutScheduleInput } from '../dto/insurance-admin.requests';
import { intArray, isoDate, num, type Row } from './row-mappers';

export const FALLBACK_PAYOUT_SCHEDULE: PayoutScheduleConfig = {
  frequency: 'monthly',
  anchorDate: '2026-01-01',
  dueDaysAfterPeriodEnd: 7,
  graceDays: 3,
  reminderDaysBefore: [3, 1],
};

function mapSchedule(r: Row): PayoutScheduleConfig {
  return {
    frequency: String(r.frequency) as PayoutFrequency,
    anchorDate: isoDate(r.anchor_date) ?? FALLBACK_PAYOUT_SCHEDULE.anchorDate,
    dueDaysAfterPeriodEnd: num(r.due_days_after_period_end),
    graceDays: num(r.grace_days),
    reminderDaysBefore: intArray(r.reminder_days_before),
  };
}

export async function dbGetDefaultPayoutSchedule(): Promise<PayoutScheduleConfig> {
  const res = await query(
    `SELECT * FROM insurance_payout_schedules WHERE vendor_company_id IS NULL LIMIT 1`,
  );
  const row = res.rows[0] as Row | undefined;
  return row ? mapSchedule(row) : FALLBACK_PAYOUT_SCHEDULE;
}

/** Per-link overrides keyed by link id. */
export async function dbListPayoutScheduleOverrides(): Promise<Map<string, PayoutScheduleConfig>> {
  const res = await query(
    `SELECT * FROM insurance_payout_schedules WHERE vendor_company_id IS NOT NULL`,
  );
  const out = new Map<string, PayoutScheduleConfig>();
  for (const r of res.rows as Row[]) out.set(String(r.vendor_company_id), mapSchedule(r));
  return out;
}

const SCHEDULE_VALUES = `$1, $2::date, $3, $4, $5::int[], $6`;

function scheduleParams(input: PayoutScheduleInput, actorId: string | null): unknown[] {
  return [
    input.frequency,
    input.anchorDate,
    input.dueDaysAfterPeriodEnd,
    input.graceDays,
    [...new Set(input.reminderDaysBefore)].sort((a, b) => b - a),
    actorId,
  ];
}

export async function dbSaveDefaultPayoutSchedule(
  input: PayoutScheduleInput,
  actorId: string | null,
): Promise<void> {
  const params = scheduleParams(input, actorId);
  const updated = await query(
    `UPDATE insurance_payout_schedules SET
       frequency = $1, anchor_date = $2::date, due_days_after_period_end = $3, grace_days = $4,
       reminder_days_before = $5::int[], updated_by = $6, updated_at = NOW()
     WHERE vendor_company_id IS NULL`,
    params,
  );
  if ((updated.rowCount ?? 0) > 0) return;
  await query(
    `INSERT INTO insurance_payout_schedules (
       frequency, anchor_date, due_days_after_period_end, grace_days, reminder_days_before, updated_by
     ) VALUES (${SCHEDULE_VALUES})`,
    params,
  );
}

export async function dbSaveLinkPayoutSchedule(
  vendorCompanyId: string,
  input: PayoutScheduleInput,
  actorId: string | null,
  client?: PoolClient,
): Promise<void> {
  await (client ?? { query }).query(
    `INSERT INTO insurance_payout_schedules (
       frequency, anchor_date, due_days_after_period_end, grace_days, reminder_days_before, updated_by,
       vendor_company_id
     ) VALUES (${SCHEDULE_VALUES}, $7::uuid)
     ON CONFLICT (vendor_company_id) WHERE vendor_company_id IS NOT NULL DO UPDATE SET
       frequency = EXCLUDED.frequency, anchor_date = EXCLUDED.anchor_date,
       due_days_after_period_end = EXCLUDED.due_days_after_period_end,
       grace_days = EXCLUDED.grace_days, reminder_days_before = EXCLUDED.reminder_days_before,
       updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [...scheduleParams(input, actorId), vendorCompanyId],
  );
}

export async function dbClearLinkPayoutSchedule(vendorCompanyId: string, client?: PoolClient): Promise<void> {
  await (client ?? { query }).query(
    `DELETE FROM insurance_payout_schedules WHERE vendor_company_id = $1::uuid`,
    [vendorCompanyId],
  );
}
