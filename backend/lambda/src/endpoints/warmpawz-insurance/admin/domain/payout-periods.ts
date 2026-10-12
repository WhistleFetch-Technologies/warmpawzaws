/**
 * Payout / reporting period math on IST calendar dates ("YYYY-MM-DD").
 * All arithmetic is on date-only values in UTC so DST and server timezone never shift a day.
 */

export const PAYOUT_FREQUENCIES = [
  'weekly',
  'fortnightly',
  'twice_monthly',
  'monthly',
  'every_two_months',
] as const;

export type PayoutFrequency = (typeof PAYOUT_FREQUENCIES)[number];

export interface PayoutScheduleConfig {
  readonly frequency: PayoutFrequency;
  /** First day of a period for weekly / fortnightly / every-two-months cycles. */
  readonly anchorDate: string;
  readonly dueDaysAfterPeriodEnd: number;
  readonly graceDays: number;
  readonly reminderDaysBefore: readonly number[];
}

export interface PayoutPeriod {
  readonly start: string;
  readonly end: string;
  readonly dueDate: string;
  readonly graceEndsOn: string;
}

export type PayoutPeriodStatus = 'open' | 'due' | 'grace' | 'overdue' | 'paid' | 'nothing_due';

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;
const MAX_PERIODS = 240;

function toUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromUtc(toUtc(iso) + days * DAY_MS);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / DAY_MS);
}

export function todayIst(now: Date = new Date()): string {
  return fromUtc(now.getTime() + IST_OFFSET_MS);
}

/** IST calendar date of an instant. */
export function istDateOf(instant: Date | string): string {
  const ms = typeof instant === 'string' ? Date.parse(instant) : instant.getTime();
  return fromUtc(ms + IST_OFFSET_MS);
}

function monthStart(year: number, monthIndex: number): string {
  return fromUtc(Date.UTC(year, monthIndex, 1));
}

function monthEnd(year: number, monthIndex: number): string {
  return fromUtc(Date.UTC(year, monthIndex + 1, 0));
}

function withDeadlines(cfg: PayoutScheduleConfig, start: string, end: string): PayoutPeriod {
  const dueDate = addDays(end, cfg.dueDaysAfterPeriodEnd);
  return { start, end, dueDate, graceEndsOn: addDays(dueDate, cfg.graceDays) };
}

export function periodContaining(cfg: PayoutScheduleConfig, date: string): PayoutPeriod {
  const [y, m, d] = date.split('-').map(Number);
  switch (cfg.frequency) {
    case 'weekly':
    case 'fortnightly': {
      const length = cfg.frequency === 'weekly' ? 7 : 14;
      const index = Math.floor(daysBetween(cfg.anchorDate, date) / length);
      const start = addDays(cfg.anchorDate, index * length);
      return withDeadlines(cfg, start, addDays(start, length - 1));
    }
    case 'twice_monthly':
      return d <= 15
        ? withDeadlines(cfg, monthStart(y, m - 1), fromUtc(Date.UTC(y, m - 1, 15)))
        : withDeadlines(cfg, fromUtc(Date.UTC(y, m - 1, 16)), monthEnd(y, m - 1));
    case 'monthly':
      return withDeadlines(cfg, monthStart(y, m - 1), monthEnd(y, m - 1));
    case 'every_two_months': {
      const [ay, am] = cfg.anchorDate.split('-').map(Number);
      const anchorMonth = ay * 12 + (am - 1);
      const offset = Math.floor((y * 12 + (m - 1) - anchorMonth) / 2) * 2;
      const first = anchorMonth + offset;
      const firstYear = Math.floor(first / 12);
      const firstMonth = first % 12;
      return withDeadlines(cfg, monthStart(firstYear, firstMonth), monthEnd(firstYear, firstMonth + 1));
    }
    default:
      throw new Error(`Unsupported payout frequency: ${String(cfg.frequency)}`);
  }
}

/** Periods overlapping [from, to], oldest first. */
export function listPeriods(cfg: PayoutScheduleConfig, from: string, to: string): PayoutPeriod[] {
  const out: PayoutPeriod[] = [];
  let period = periodContaining(cfg, from);
  while (period.start <= to && out.length < MAX_PERIODS) {
    out.push(period);
    period = periodContaining(cfg, addDays(period.end, 1));
  }
  return out;
}

export function payoutPeriodStatus(opts: {
  period: PayoutPeriod;
  today: string;
  expected: number;
  received: number;
}): PayoutPeriodStatus {
  const { period, today, expected, received } = opts;
  if (expected <= 0.004) return today <= period.end ? 'open' : 'nothing_due';
  if (received >= expected - 0.009) return 'paid';
  if (today <= period.end) return 'open';
  if (today <= period.dueDate) return 'due';
  if (today <= period.graceEndsOn) return 'grace';
  return 'overdue';
}

/** True when today is one of the configured reminder days before the due date, or past grace. */
export function isReminderDay(cfg: PayoutScheduleConfig, period: PayoutPeriod, today: string): boolean {
  if (today <= period.end) return false;
  if (today > period.graceEndsOn) return true;
  return cfg.reminderDaysBefore.includes(daysBetween(today, period.dueDate));
}

export function describeFrequency(frequency: PayoutFrequency): string {
  switch (frequency) {
    case 'weekly':
      return 'Weekly';
    case 'fortnightly':
      return 'Fortnightly (every 14 days)';
    case 'twice_monthly':
      return 'Twice monthly (1st–15th, 16th–month end)';
    case 'monthly':
      return 'Monthly';
    case 'every_two_months':
      return 'Every two months';
    default:
      return String(frequency);
  }
}
