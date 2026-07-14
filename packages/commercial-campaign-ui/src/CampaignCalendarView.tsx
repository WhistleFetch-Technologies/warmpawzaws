'use client';

import { useMemo, useState } from 'react';
import type { CommercialCampaignRecord } from './types';
import { CAMPAIGN_LIFECYCLE_LABELS } from './types';

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Visualization-only calendar over the same campaign list — no extra backend. */
export function CampaignCalendarView({
  campaigns,
  onSelect,
}: {
  campaigns: CommercialCampaignRecord[];
  onSelect?: (c: CommercialCampaignRecord) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const days = daysInMonth(year, month);
  const startDow = new Date(year, month, 1).getDay();

  const byDay = useMemo(() => {
    const map = new Map<number, CommercialCampaignRecord[]>();
    for (const c of campaigns) {
      const start = c.startAt ? new Date(c.startAt) : null;
      const end = c.endAt ? new Date(c.endAt) : start;
      if (!start && !end) continue;
      for (let day = 1; day <= days; day++) {
        const cell = new Date(year, month, day);
        const cellEnd = new Date(year, month, day, 23, 59, 59);
        const s = start ?? end!;
        const e = end ?? start!;
        if (s <= cellEnd && e >= cell) {
          const list = map.get(day) ?? [];
          list.push(c);
          map.set(day, list);
        }
      }
    }
    return map;
  }, [campaigns, year, month, days]);

  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < startDow; i++) cells.push({ day: null });
  for (let d = 1; d <= days; d++) cells.push({ day: d });

  return (
    <div className="space-y-3 rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded border px-2 py-1 text-sm"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          Prev
        </button>
        <h3 className="text-sm font-semibold">
          {cursor.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          type="button"
          className="rounded border px-2 py-1 text-sm"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        >
          Next
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-slate-500">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          const list = cell.day != null ? byDay.get(cell.day) ?? [] : [];
          return (
            <div
              key={`${monthKey(cursor)}-${idx}`}
              className={`min-h-[72px] rounded border p-1 text-left ${
                cell.day ? 'bg-slate-50' : 'border-transparent bg-transparent'
              }`}
            >
              {cell.day ? <div className="text-xs font-semibold text-slate-700">{cell.day}</div> : null}
              <div className="mt-0.5 space-y-0.5">
                {list.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={`${c.name} · ${CAMPAIGN_LIFECYCLE_LABELS[c.status]}`}
                    className="block w-full truncate rounded bg-orange-100 px-1 text-[10px] text-orange-900"
                    onClick={() => onSelect?.(c)}
                  >
                    {c.name}
                  </button>
                ))}
                {list.length > 3 ? (
                  <span className="text-[10px] text-slate-500">+{list.length - 3} more</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
