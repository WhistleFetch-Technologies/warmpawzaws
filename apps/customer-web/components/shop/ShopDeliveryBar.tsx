'use client';

import { ChevronDown, MapPin, Zap } from 'lucide-react';

interface ShopDeliveryBarProps {
  deliveryLabel: string;
  onAddressClick: () => void;
}

export function ShopDeliveryBar({ deliveryLabel, onAddressClick }: ShopDeliveryBarProps) {
  return (
    <div className="mx-4 mt-3 mb-1 flex items-center justify-between gap-2 rounded-xl bg-orange-50/90 px-3 py-2.5 border border-orange-100/80">
      <button
        type="button"
        onClick={onAddressClick}
        className="flex items-center gap-1.5 min-w-0 flex-1 text-left active:opacity-80"
      >
        <MapPin className="w-4 h-4 text-[#FF8C42] shrink-0" />
        <span className="text-xs font-medium text-slate-800 truncate">{deliveryLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>
      <div className="flex items-center gap-1 shrink-0 pl-2 border-l border-orange-100">
        <Zap className="w-3.5 h-3.5 text-[#FF8C42]" />
        <span className="text-[10px] font-semibold text-[#FF8C42] whitespace-nowrap">Express Delivery</span>
      </div>
    </div>
  );
}
