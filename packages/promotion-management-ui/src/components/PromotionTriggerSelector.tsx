'use client';

import type { AudienceId } from '../types';

const AUDIENCES: {
  id: AudienceId;
  label: string;
  hint: string;
  description: string;
  soon?: boolean;
}[] = [
  {
    id: 'all',
    label: 'All customers',
    hint: 'Everyone eligible',
    description:
      'Any customer can use this offer — new, returning, and VIP. Best for broad campaigns like seasonal sales.',
  },
  {
    id: 'new_users',
    label: 'First-time customer',
    hint: 'Never booked or ordered before',
    description:
      'Only customers making their first booking or purchase with you. Ideal for welcome offers and acquisition.',
  },
  {
    id: 'returning_users',
    label: 'Returning customer',
    hint: 'Has booked or ordered before',
    description:
      'Customers who have completed at least one prior booking or order. Use for loyalty and re-engagement.',
  },
  {
    id: 'vip',
    label: 'VIP',
    hint: 'High-value repeat customers',
    description:
      'Your most valuable repeat customers. Reserved for exclusive perks and premium retention offers.',
  },
  {
    id: 'segments',
    label: 'Custom segments',
    hint: 'Rule-based groups',
    description: 'Target specific customer groups defined by admin rules.',
    soon: true,
  },
];

export function PromotionTriggerSelector({
  value,
  onChange,
}: {
  value: AudienceId;
  onChange: (v: AudienceId) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Choose who can see and redeem this offer. This does not change how discounts are calculated.
      </p>
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
                  ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-200'
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
            {value === a.id && !a.soon ? (
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">{a.description}</p>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
