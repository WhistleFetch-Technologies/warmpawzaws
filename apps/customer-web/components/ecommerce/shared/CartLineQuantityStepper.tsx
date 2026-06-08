'use client';

import { Minus, Plus } from 'lucide-react';

type CartLineQuantityStepperProps = {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  size?: 'sm' | 'md';
};

export function CartLineQuantityStepper({
  quantity,
  onDecrease,
  onIncrease,
  size = 'md',
}: CartLineQuantityStepperProps) {
  const btn =
    size === 'sm'
      ? 'w-8 h-8 rounded-lg flex items-center justify-center shrink-0'
      : 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0';

  return (
    <div
      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-0.5"
      role="group"
      aria-label="Quantity"
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={onDecrease}
        className={`${btn} bg-red-100 text-red-600 hover:bg-red-200 active:scale-95 transition-transform`}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span
        className={`text-center font-semibold tabular-nums text-slate-900 ${
          size === 'sm' ? 'w-7 text-xs' : 'w-8 text-sm'
        }`}
      >
        {quantity}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={onIncrease}
        className={`${btn} bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 transition-transform`}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
