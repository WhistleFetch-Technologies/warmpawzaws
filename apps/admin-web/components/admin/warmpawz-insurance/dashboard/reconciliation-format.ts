import { todayIso } from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import type { ReconciliationStatus } from '@/lib/warmpawz-insurance-admin';

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

const DAY_MS = 86_400_000;

const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function monthToDate(): DateRange {
  const today = todayIso();
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

export function rangeDays(range: DateRange): number {
  return Math.round((toUtc(range.to) - toUtc(range.from)) / DAY_MS) + 1;
}

/** Moves the range back or forward by its own length, e.g. 1–7 Oct → 8–14 Oct. */
export function shiftRange(range: DateRange, direction: -1 | 1): DateRange {
  const offset = rangeDays(range) * DAY_MS * direction;
  return { from: fromUtc(toUtc(range.from) + offset), to: fromUtc(toUtc(range.to) + offset) };
}

export const STATUS_STYLES: Record<ReconciliationStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  overdue: { label: 'Overdue', className: 'border-red-200 bg-red-50 text-red-700' },
  settled: { label: 'Settled', className: 'border-green-200 bg-green-50 text-green-700' },
  nothing_due: { label: 'Nothing due', className: 'border-gray-200 bg-gray-50 text-gray-600' },
  cancelled: { label: 'Cancelled', className: 'border-gray-200 bg-gray-100 text-gray-500' },
};

export function speciesLabel(species: string | null): string {
  if (!species) return '';
  return species.charAt(0).toUpperCase() + species.slice(1).toLowerCase();
}
