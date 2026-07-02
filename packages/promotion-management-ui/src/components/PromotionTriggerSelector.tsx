'use client';

import type { AudienceId } from '../types';

const AUDIENCES: { id: AudienceId; label: string; hint: string; soon?: boolean }[] = [
  { id: 'all', label: 'All customers', hint: 'Everyone eligible' },
  { id: 'new_users', label: 'New customers', hint: 'First-time buyers' },
  { id: 'returning_users', label: 'Returning customers', hint: 'Repeat visits' },
  { id: 'vip', label: 'VIP', hint: 'High-value customers' },
  { id: 'segments', label: 'Segments', hint: 'Custom segments', soon: true },
];

export function PromotionTriggerSelector({
  value,
  onChange,
}: {
  value: AudienceId;
  onChange: (v: AudienceId) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {AUDIENCES.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={a.soon}
          onClick={() => !a.soon && onChange(a.id)}
          className={`rounded-xl border p-3 text-left transition ${
            a.soon
              ? 'border-dashed border-slate-200 opacity-60 cursor-not-allowed'
              : value === a.id
                ? 'border-orange-500 bg-orange-50'
                : 'border-slate-200 hover:border-orange-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">{a.label}</p>
            {a.soon ? (
              <span className="text-[10px] font-medium text-slate-500">Coming soon</span>
            ) : null}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{a.hint}</p>
        </button>
      ))}
    </div>
  );
}
