'use client';

import {
  COMMISSION_BASIS_OPTIONS,
  PAYOUT_FREQUENCY_OPTIONS,
  type CommissionBasis,
  type CommissionTermsInput,
  type PayoutFrequency,
  type PayoutScheduleInput,
} from '@/lib/warmpawz-insurance-admin';
import { Field, inputClass } from './insurance-ui';

export interface TermsDraft {
  basis: CommissionBasis;
  rate: string;
  vendorCommissionRate: string;
  gstRate: string;
  effectiveFrom: string;
  notes: string;
}

export function emptyTermsDraft(effectiveFrom: string): TermsDraft {
  return { basis: 'percent_of_premium', rate: '', vendorCommissionRate: '', gstRate: '18', effectiveFrom, notes: '' };
}

export function termsDraftError(d: TermsDraft): string | null {
  const rate = Number(d.rate);
  if (d.rate.trim() === '' || !Number.isFinite(rate) || rate < 0) return 'Enter the Warmpawz commission rate';
  if (d.basis !== 'fixed_per_policy' && rate > 100) return 'A percentage cannot be above 100';
  if (d.vendorCommissionRate.trim() !== '') {
    const v = Number(d.vendorCommissionRate);
    if (!Number.isFinite(v) || v < 0 || v > 100) return "Vendor's commission rate must be 0–100%";
  }
  const gst = Number(d.gstRate || 0);
  if (!Number.isFinite(gst) || gst < 0 || gst > 100) return 'GST must be 0–100%';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.effectiveFrom)) return 'Choose the date these terms start';
  return null;
}

export function termsDraftToInput(d: TermsDraft): CommissionTermsInput {
  return {
    basis: d.basis,
    rate: Number(d.rate),
    vendorCommissionRate:
      d.basis === 'percent_of_vendor_commission' && d.vendorCommissionRate.trim() !== ''
        ? Number(d.vendorCommissionRate)
        : null,
    gstRate: Number(d.gstRate || 0),
    effectiveFrom: d.effectiveFrom,
    notes: d.notes.trim() || null,
  };
}

export function CommissionTermsFields({
  value,
  onChange,
}: {
  value: TermsDraft;
  onChange: (next: TermsDraft) => void;
}) {
  const set = <K extends keyof TermsDraft>(key: K, v: TermsDraft[K]) => onChange({ ...value, [key]: v });
  const fixed = value.basis === 'fixed_per_policy';

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Warmpawz commission basis">
        <select
          className={inputClass}
          value={value.basis}
          onChange={(e) => set('basis', e.target.value as CommissionBasis)}
        >
          {COMMISSION_BASIS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={fixed ? 'Amount per policy (₹)' : 'Rate (%)'}>
        <input
          type="number"
          min={0}
          max={fixed ? undefined : 100}
          step="0.01"
          className={inputClass}
          value={value.rate}
          onChange={(e) => set('rate', e.target.value)}
        />
      </Field>
      {value.basis === 'percent_of_vendor_commission' ? (
        <Field
          label="Vendor's expected insurer commission (% of premium)"
          hint="Used to estimate when the vendor hasn't recorded their actual commission on a policy"
        >
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            className={inputClass}
            value={value.vendorCommissionRate}
            onChange={(e) => set('vendorCommissionRate', e.target.value)}
          />
        </Field>
      ) : null}
      <Field label="GST on commission (%)" hint="Set 0 if GST is not charged on this commission">
        <input
          type="number"
          min={0}
          max={100}
          step="0.01"
          className={inputClass}
          value={value.gstRate}
          onChange={(e) => set('gstRate', e.target.value)}
        />
      </Field>
      <Field label="Applies to policies issued from">
        <input
          type="date"
          className={inputClass}
          value={value.effectiveFrom}
          onChange={(e) => set('effectiveFrom', e.target.value)}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes">
          <input className={inputClass} value={value.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

export interface ScheduleDraft {
  frequency: PayoutFrequency;
  anchorDate: string;
  dueDaysAfterPeriodEnd: string;
  graceDays: string;
  reminderDaysBefore: string;
}

export function scheduleToDraft(s: PayoutScheduleInput): ScheduleDraft {
  return {
    frequency: s.frequency,
    anchorDate: s.anchorDate,
    dueDaysAfterPeriodEnd: String(s.dueDaysAfterPeriodEnd),
    graceDays: String(s.graceDays),
    reminderDaysBefore: s.reminderDaysBefore.join(', '),
  };
}

function parseDayList(raw: string): number[] | null {
  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 30)) return null;
  return [...new Set(nums)].sort((a, b) => b - a).slice(0, 5);
}

export function scheduleDraftError(d: ScheduleDraft): string | null {
  const due = Number(d.dueDaysAfterPeriodEnd);
  if (!Number.isInteger(due) || due < 0 || due > 90) return 'Due days must be a whole number 0–90';
  const grace = Number(d.graceDays);
  if (!Number.isInteger(grace) || grace < 0 || grace > 60) return 'Grace days must be a whole number 0–60';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.anchorDate)) return 'Choose a cycle start date';
  if (parseDayList(d.reminderDaysBefore) === null) return 'Reminder days must be whole numbers 0–30, comma separated';
  return null;
}

export function scheduleDraftToInput(d: ScheduleDraft): PayoutScheduleInput {
  return {
    frequency: d.frequency,
    anchorDate: d.anchorDate,
    dueDaysAfterPeriodEnd: Number(d.dueDaysAfterPeriodEnd),
    graceDays: Number(d.graceDays),
    reminderDaysBefore: parseDayList(d.reminderDaysBefore) ?? [],
  };
}

export function PayoutScheduleFields({
  value,
  onChange,
}: {
  value: ScheduleDraft;
  onChange: (next: ScheduleDraft) => void;
}) {
  const set = <K extends keyof ScheduleDraft>(key: K, v: ScheduleDraft[K]) => onChange({ ...value, [key]: v });
  const usesAnchor = ['weekly', 'fortnightly', 'every_two_months'].includes(value.frequency);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Payout frequency">
        <select
          className={inputClass}
          value={value.frequency}
          onChange={(e) => set('frequency', e.target.value as PayoutFrequency)}
        >
          {PAYOUT_FREQUENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      {usesAnchor ? (
        <Field label="Cycle starts on" hint="Periods repeat from this date">
          <input
            type="date"
            className={inputClass}
            value={value.anchorDate}
            onChange={(e) => set('anchorDate', e.target.value)}
          />
        </Field>
      ) : (
        <div />
      )}
      <Field label="Payment due (days after period ends)">
        <input
          type="number"
          min={0}
          max={90}
          className={inputClass}
          value={value.dueDaysAfterPeriodEnd}
          onChange={(e) => set('dueDaysAfterPeriodEnd', e.target.value)}
        />
      </Field>
      <Field label="Grace days after due date" hint="Marked overdue after grace ends">
        <input
          type="number"
          min={0}
          max={60}
          className={inputClass}
          value={value.graceDays}
          onChange={(e) => set('graceDays', e.target.value)}
        />
      </Field>
      <div className="sm:col-span-2">
        <Field
          label="Remind the vendor (days before due date)"
          hint="Comma separated, e.g. 3, 1. Overdue periods are flagged for a reminder every day."
        >
          <input
            className={inputClass}
            value={value.reminderDaysBefore}
            onChange={(e) => set('reminderDaysBefore', e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}
