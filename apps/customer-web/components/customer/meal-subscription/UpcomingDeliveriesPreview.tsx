'use client';

import { CalendarDays } from 'lucide-react';
import { addDays, addMonths, format } from 'date-fns';
import type { SubscriptionDeliveryPattern } from './subscription-checkout-types';

const MONTHLY_VENDOR_FREQ = new Set(['DAILY', 'ALTERNATE_DAYS', 'TWICE_WEEKLY', 'WEEKLY']);

const DOW_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function twiceWeeklyTargetsFromUiWeekdays(weekdays: string[] | undefined): number[] {
  const seen = new Set<number>();
  const parsed: number[] = [];
  for (const x of weekdays || []) {
    const n = DOW_MAP[String(x).toLowerCase().slice(0, 3)];
    if (n !== undefined && !seen.has(n)) {
      seen.add(n);
      parsed.push(n);
    }
  }
  const uniq = [...parsed].sort((a, b) => a - b);
  if (uniq.length >= 2) return [uniq[0], uniq[1]];
  if (uniq.length === 1) {
    const a = uniq[0];
    const b = (a + 3) % 7;
    return [Math.min(a, b), Math.max(a, b)];
  }
  return [1, 4];
}

function advanceMonthlyVendorCursor(d: Date, freq: string, weekdays: string[] | undefined): Date {
  const u = freq.toUpperCase();
  if (u === 'DAILY') return addDays(d, 1);
  if (u === 'ALTERNATE_DAYS') return addDays(d, 2);
  if (u === 'TWICE_WEEKLY') {
    const targets = twiceWeeklyTargetsFromUiWeekdays(weekdays);
    let x = addDays(d, 1);
    for (let i = 0; i < 21; i++) {
      if (targets.includes(x.getDay())) return x;
      x = addDays(x, 1);
    }
    return addDays(d, 7);
  }
  if (u === 'WEEKLY') return addDays(d, 7);
  return addMonths(d, 1);
}

function advanceWeeklyCursor(
  cur: Date,
  pattern: SubscriptionDeliveryPattern,
  weekdays: string[] | undefined,
): Date {
  if (pattern === 'specific_weekdays' && weekdays?.length) {
    const targets = weekdays
      .map((x) => DOW_MAP[String(x).toLowerCase().slice(0, 3)])
      .filter((n) => n !== undefined) as number[];
    if (!targets.length) return addDays(cur, 7);
    let d = addDays(cur, 1);
    for (let i = 0; i < 21; i++) {
      if (targets.includes(d.getDay())) return d;
      d = addDays(d, 1);
    }
    return addDays(cur, 7);
  }
  if (pattern === 'everyday') return addDays(cur, 1);
  if (pattern === 'alternate_days') return addDays(cur, 2);
  if (pattern === 'weekdays_only') {
    let d = addDays(cur, 1);
    for (let i = 0; i < 14; i++) {
      if (d.getDay() !== 0 && d.getDay() !== 6) return d;
      d = addDays(d, 1);
    }
    return addDays(cur, 1);
  }
  if (pattern === 'weekly_default') {
    return addDays(cur, 7);
  }
  return addDays(cur, 7);
}

function nextDates(
  start: Date,
  purchaseType: 'WEEKLY_PLAN' | 'MONTHLY_PLAN',
  pattern: SubscriptionDeliveryPattern,
  count: number,
  opts: { monthlyVendorFreq?: string | null; weekdays?: string[] },
): Date[] {
  const out: Date[] = [];
  let cur = start;
  for (let i = 0; i < count; i++) {
    out.push(cur);
    if (purchaseType === 'MONTHLY_PLAN') {
      const mf = String(opts.monthlyVendorFreq || '').toUpperCase();
      cur = MONTHLY_VENDOR_FREQ.has(mf)
        ? advanceMonthlyVendorCursor(cur, mf, opts.weekdays)
        : addMonths(cur, 1);
      continue;
    }
    cur = advanceWeeklyCursor(cur, pattern, opts.weekdays);
  }
  return out;
}

export function UpcomingDeliveriesPreview({
  firstDeliveryDate,
  purchaseType,
  weeklyPattern,
  weekdays,
  monthlyVendorFreq,
  previewCount,
}: {
  firstDeliveryDate: string;
  purchaseType: 'WEEKLY_PLAN' | 'MONTHLY_PLAN';
  weeklyPattern: SubscriptionDeliveryPattern;
  weekdays?: string[];
  monthlyVendorFreq?: string | null;
  previewCount: number;
}) {
  const start = new Date(`${firstDeliveryDate}T12:00:00`);
  const dates = nextDates(start, purchaseType, weeklyPattern, previewCount, {
    monthlyVendorFreq,
    weekdays,
  });

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-5 h-5 text-orange-500" />
        <h3 className="font-semibold text-slate-900">Upcoming deliveries (preview)</h3>
      </div>
      <ol className="space-y-2">
        {dates.map((d, idx) => (
          <li key={idx} className="flex justify-between text-sm text-slate-700">
            <span className="text-slate-500">Meal Plan session {idx + 1}</span>
            <span className="font-medium">{format(d, 'EEE, d MMM yyyy')}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
