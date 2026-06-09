'use client';

import { Minus, Plus, ShoppingCart } from 'lucide-react';

type ShopCartQuantityControlProps = {
  quantity: number;
  disabled?: boolean;
  variant: 'deal' | 'grid';
  onAdd: () => void;
  onQuantityChange: (quantity: number) => void;
};

const minusBtn =
  'flex items-center justify-center shrink-0 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 active:scale-95 transition-transform';
const plusBtn =
  'flex items-center justify-center shrink-0 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 transition-transform';

export function ShopCartQuantityControl({
  quantity,
  disabled = false,
  variant,
  onAdd,
  onQuantityChange,
}: ShopCartQuantityControlProps) {
  if (quantity <= 0) {
    if (variant === 'deal') {
      return (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
          className={`absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-md ${
            disabled ? 'bg-slate-200 text-slate-400' : 'bg-[#FF8C42] text-white'
          }`}
          aria-label="Add to cart"
        >
          <ShoppingCart className="w-4 h-4" />
        </button>
      );
    }

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className={`mt-auto w-full py-2.5 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 ${
          disabled
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-[#FF8C42] text-white shadow-md shadow-orange-500/20 active:opacity-90'
        }`}
      >
        {disabled ? (
          'Unavailable'
        ) : (
          <>
            <ShoppingCart className="w-3.5 h-3.5" />
            Add
          </>
        )}
      </button>
    );
  }

  const stepperClass =
    variant === 'deal'
      ? 'absolute bottom-2 right-2 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-0.5 shadow-md'
      : 'mt-auto w-full flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white p-0.5';

  const minusSize = variant === 'deal' ? 'w-8 h-8' : 'w-10 h-9';
  const plusSize = variant === 'deal' ? 'w-8 h-8' : 'w-10 h-9';
  const qtyClass =
    variant === 'deal'
      ? 'w-7 text-center text-xs font-semibold tabular-nums text-slate-900'
      : 'flex-1 text-center text-sm font-semibold tabular-nums text-slate-900';

  return (
    <div
      className={stepperClass}
      onClick={(e) => e.stopPropagation()}
      role="group"
      aria-label="Cart quantity"
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled}
        onClick={() => onQuantityChange(quantity - 1)}
        className={`${minusBtn} ${minusSize}`}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className={qtyClass}>{quantity}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled}
        onClick={() => onQuantityChange(quantity + 1)}
        className={`${plusBtn} ${plusSize}`}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
