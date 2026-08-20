'use client';

import { ChevronDown, MapPin } from 'lucide-react';

interface ShopDeliveryBarProps {
  deliveryLabel: string;
  /** Omit for read-only guest location display. */
  onAddressClick?: () => void;
}

export function ShopDeliveryBar({ deliveryLabel, onAddressClick }: ShopDeliveryBarProps) {
  const interactive = Boolean(onAddressClick);
  const content = (
    <>
      <MapPin className="w-4 h-4 text-[#FF8C42] shrink-0" />
      <span className="text-xs font-medium text-slate-800 truncate">{deliveryLabel}</span>
      {interactive ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : null}
    </>
  );

  return (
    <div className="mx-4 mt-1 mb-1 flex items-center gap-2 rounded-xl bg-orange-50/90 px-3 py-2.5 border border-orange-100/80">
      {interactive ? (
        <button
          type="button"
          onClick={onAddressClick}
          className="flex items-center gap-1.5 min-w-0 flex-1 text-left active:opacity-80"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-1.5 min-w-0 flex-1">{content}</div>
      )}
    </div>
  );
}
