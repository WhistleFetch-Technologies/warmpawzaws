'use client';

import { CalendarDays } from 'lucide-react';
import { addDays, addMonths, format } from 'date-fns';
import type { SubscriptionDeliveryPattern } from './subscription-checkout-types';

function nextDates(
  start: Date,
  purchaseType: 'WEEKLY_PLAN' | 'MONTHLY_PLAN',
  pattern: SubscriptionDeliveryPattern,
  count: number,
): Date[] {
  const out: Date[] = [];
  let cur = start;
  for (let i = 0; i < count; i++) {
    out.push(cur);
    if (purchaseType === 'MONTHLY_PLAN') {
      cur = addMonths(cur, 1);
      continue;
    }
    if (pattern === 'everyday') cur = addDays(cur, 1);
    else if (pattern === 'alternate_days') cur = addDays(cur, 2);
    else if (pattern === 'weekdays_only') {
      cur = addDays(cur, 1);
      while (cur.getDay() === 0 || cur.getDay() === 6) cur = addDays(cur, 1);
    } else {
      cur = addDays(cur, 7);
    }
  }
  return out;
}

export function UpcomingDeliveriesPreview({
  firstDeliveryDate,
  purchaseType,
  weeklyPattern,
  previewCount,
}: {
  firstDeliveryDate: string;
  purchaseType: 'WEEKLY_PLAN' | 'MONTHLY_PLAN';
  weeklyPattern: SubscriptionDeliveryPattern;
  previewCount: number;
}) {
  const start = new Date(`${firstDeliveryDate}T12:00:00`);
  const dates = nextDates(start, purchaseType, weeklyPattern, previewCount);

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-5 h-5 text-orange-500" />
        <h3 className="font-semibold text-slate-900">Upcoming deliveries (preview)</h3>
      </div>
      <ol className="space-y-2">
        {dates.map((d, idx) => (
          <li key={idx} className="flex justify-between text-sm text-slate-700">
            <span className="text-slate-500">Session {idx + 1}</span>
            <span className="font-medium">{format(d, 'EEE, d MMM yyyy')}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
