'use client';

import type { PromotionTypeId } from '../types';

const TYPES: { id: PromotionTypeId; label: string; hint: string }[] = [
  { id: 'percentage', label: 'Percentage off', hint: 'e.g. 15% off' },
  { id: 'flat', label: 'Flat amount', hint: 'e.g. ₹200 off' },
  { id: 'buy_x_get_y', label: 'BOGO', hint: 'Buy X get Y' },
  { id: 'bundle', label: 'Bundle offer', hint: 'Combo discount' },
  { id: 'combo', label: 'Combo', hint: 'Service combo' },
  { id: 'loyalty', label: 'Loyalty', hint: 'Repeat customer reward' },
  { id: 'first_order', label: 'First order', hint: 'New shop customers' },
  { id: 'first_booking', label: 'First booking', hint: 'New service customers' },
];

export function PromotionTypeSelector({
  value,
  onChange,
  allowed,
}: {
  value: PromotionTypeId;
  onChange: (v: PromotionTypeId) => void;
  allowed?: PromotionTypeId[];
}) {
  const list = allowed?.length ? TYPES.filter((t) => allowed.includes(t.id)) : TYPES;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {list.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`rounded-xl border p-3 text-left transition ${
            value === t.id
              ? 'border-orange-500 bg-orange-50 ring-1 ring-orange-200'
              : 'border-slate-200 hover:border-orange-300'
          }`}
        >
          <p className="text-sm font-semibold text-slate-900">{t.label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{t.hint}</p>
        </button>
      ))}
    </div>
  );
}
